import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import * as accountRepository from '../repository/accountRepository';
import * as journalService from './journalEntryService';
import * as approvalWorkflowService from './approvalWorkflowService';
import * as fxRateService from './fxRateService';
import { recordAuditLogTx, diffFields, AuditActor } from './auditLogService';
import * as fiscalPeriodService from './fiscalPeriodService';

export class VendorBillPaymentServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'VendorBillPaymentServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Marks one vendor bill PAID and posts the real Debit Expense / Credit Cash
 * journal entry - extracted from routes/bills.ts's POST /:id/pay so this
 * exact logic can also be called from vendorPaymentSchedulingCronService.ts
 * (automated payment on a bill's scheduledPaymentDate) without duplicating
 * it. Requires an active tenant context (withCurrentTenantDb) - the cron
 * establishes one via runWithTenantContext per tenant, same as
 * dunningReminderService.ts.
 */
export async function payVendorBill(tenantId: string, billId: string, actor?: AuditActor) {
  const bill = await withCurrentTenantDb(prisma, async (client) => {
    return (client as any).vendorBill.findFirst({ where: { id: billId, tenantId }, include: { vendor: true } });
  });
  // Fetch the WHT rate separately from the public schema (wht_rates is in public, not tenant schema)
  const whtRate = bill?.whtRateId
    ? await (prisma as any).whtRate.findFirst({ where: { id: bill.whtRateId, tenantId } })
    : null;

  if (!bill) {
    throw new VendorBillPaymentServiceError('Vendor bill not found.', 404);
  }
  if (bill.status === 'PAID') {
    throw new VendorBillPaymentServiceError('Vendor bill is already paid.', 400);
  }

  // Opt-in approval gate: only blocks if approval was actually requested for this bill.
  await approvalWorkflowService.assertApprovedOrNoWorkflow(tenantId, 'VendorBill', billId);
  await fiscalPeriodService.assertPeriodOpenForDate(tenantId, new Date());

  const accounts = await withCurrentTenantDb(prisma, (client) => accountRepository.listAccounts(client));
  const expenseAcc = accountRepository.resolveDefaultAccount(accounts, 'EXPENSE') || accounts[0];
  const cashAcc = accountRepository.resolveDefaultAccount(accounts, 'CASH') || accounts[0];
  const revenueAcc = accountRepository.resolveDefaultAccount(accounts, 'REVENUE') || accounts[0];

  // Amount at locked (original) rate
  const lockedBaseAmount = bill.baseCurrencyAmount != null ? Number(bill.baseCurrencyAmount) : Number(bill.amount);
  const nativeAmount = Number(bill.amount);

  // FX gain/loss on AP: if bill was in a foreign currency and we have live
  // rates, revalue the cash outflow at today's rate. A favorable rate move
  // (we pay less base currency than originally accrued) is an FX gain
  // (credit REVENUE); an unfavorable move is an FX loss (debit EXPENSE).
  const billCurrency = bill.currency || 'USD';
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const baseCurrency = tenant?.baseCurrency || 'USD';
  let cashPostingAmount = lockedBaseAmount;
  let fxGainLoss = 0;
  if (billCurrency !== baseCurrency && fxRateService.isFxConfigured()) {
    try {
      const currentBaseAmount = await fxRateService.convertAmount(nativeAmount, billCurrency, baseCurrency);
      fxGainLoss = Math.round((lockedBaseAmount - currentBaseAmount) * 100) / 100;
      cashPostingAmount = Math.round(currentBaseAmount * 100) / 100;
    } catch {
      // Fall back to locked rate silently if live rate unavailable.
    }
  }

  // WHT: compute the amount to deduct from the cash outflow and post to WHT Payable.
  let whtAmount = 0;
  let whtPayableAccId: string | null = null;
  if (whtRate) {
    whtAmount = Math.round(lockedBaseAmount * Number(whtRate.rate) * 100) / 100;
    if (whtRate.accountId) {
      whtPayableAccId = whtRate.accountId;
    } else {
      const whtPayableAcc = accountRepository.resolveDefaultAccount(accounts, 'WHT_PAYABLE');
      whtPayableAccId = whtPayableAcc?.id || null;
    }
  }
  const cashNetAmount = Math.round((cashPostingAmount - whtAmount) * 100) / 100;

  let journalId = null;
  if (expenseAcc && cashAcc) {
    const lines: { accountId: string; debit: number; credit: number; description: string; fundId?: string }[] = [
      { accountId: expenseAcc.id, debit: lockedBaseAmount, credit: 0, description: `Expense - ${bill.billNumber}`, fundId: bill.fundId || undefined },
      { accountId: cashAcc.id, debit: 0, credit: whtAmount > 0 ? cashNetAmount : cashPostingAmount, description: `Cash Payment - ${bill.billNumber}`, fundId: bill.fundId || undefined },
    ];
    // WHT deduction: credit WHT Payable for the withheld amount
    if (whtAmount > 0 && whtPayableAccId) {
      lines.push({ accountId: whtPayableAccId, debit: 0, credit: whtAmount, description: `WHT Payable - ${bill.billNumber}`, fundId: bill.fundId || undefined });
    }
    // FX gain (paid less than accrued): credit REVENUE; FX loss: debit EXPENSE
    if (Math.abs(fxGainLoss) > 0.001) {
      if (fxGainLoss > 0 && revenueAcc) {
        lines.push({ accountId: revenueAcc.id, debit: 0, credit: fxGainLoss, description: `FX Gain - ${bill.billNumber}`, fundId: bill.fundId || undefined });
      } else if (fxGainLoss < 0) {
        lines.push({ accountId: expenseAcc.id, debit: -fxGainLoss, credit: 0, description: `FX Loss - ${bill.billNumber}`, fundId: bill.fundId || undefined });
      }
    }
    const journal = await journalService.createJournalEntry(
      {
        description: `Vendor Bill Payment for ${bill.billNumber} (${bill.vendor.name})`,
        entryDate: new Date().toISOString().split('T')[0],
        status: 'POSTED',
        lines,
      },
      actor
    );
    journalId = journal.id;
  }

  return withCurrentTenantDb(prisma, async (client) => {
    const updated = await (client as any).vendorBill.update({
      where: { id: billId },
      data: {
        status: 'PAID',
        journalId,
        ...(whtAmount > 0 ? { whtAmount } : {}),
      },
    });

    await recordAuditLogTx(client, {
      action: 'VENDOR_BILL.PAID',
      entity: 'VendorBill',
      entityId: billId,
      actor,
      changes: diffFields(bill, updated, ['status', 'journalId']),
      details: `Vendor bill ${bill.billNumber} marked PAID (${cashPostingAmount}).`,
    });

    return updated;
  });
}
