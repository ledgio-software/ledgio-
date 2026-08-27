import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { requireTenantContext } from '../context/tenantContext';
import * as journalService from './journalEntryService';
import * as accountRepository from '../repository/accountRepository';
import * as approvalWorkflowService from './approvalWorkflowService';
import * as fxRateService from './fxRateService';
import { recordAuditLogTx, diffFields, AuditActor } from './auditLogService';
import { recordChange, notifyChange, invoiceToSyncPayload } from './syncChangeLogService';
import * as fiscalPeriodService from './fiscalPeriodService';
import { consumeLayers } from './stockLayerService';

/** Round a Decimal to 2dp and return as JS number for use in journal line amounts. */
function d2(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

export class InvoicePaymentServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'InvoicePaymentServiceError';
    this.statusCode = statusCode;
  }
}

export interface RecordInvoicePaymentOptions {
  // Native-currency amount being paid now. Omitted/undefined means "pay off
  // whatever's still outstanding" - the old markInvoicePaid behavior,
  // preserved as the default so every existing caller (the manual /pay
  // route with no body, Paystack collecting its full requested amount)
  // keeps working unchanged.
  amount?: number;
  method?: 'MANUAL' | 'PAYSTACK';
  description?: string;
  // Caller-supplied idempotency key (e.g. Paystack transaction reference).
  // If a payment with this key already exists for the tenant, the call
  // short-circuits and returns the invoice without posting a second payment.
  // Prevents double-posting on network retries.
  idempotencyKey?: string;
}

/**
 * Records a payment (full or partial) against an invoice and posts the real
 * Cash/Revenue journal entry for just that payment - shared by the manual
 * "/pay" route and the Paystack payment-confirmation path, so both post
 * through the exact same accounting logic instead of duplicating it.
 * Requires tenant context to already be established: either
 * by tenantContextMiddleware on an authenticated request, or manually via
 * runWithTenantContext for a background caller.
 *
 * Revenue is still only ever recognized as cash is actually received (see
 * creditDebitNoteService.ts's module comment) - a partial payment simply
 * means that recognition now happens in more than one installment per
 * invoice instead of exactly once. Each call posts its own journal entry
 * scaled to just the amount being paid *now*, not the invoice's full total.
 */
export async function recordInvoicePayment(
  invoiceId: string,
  actor: AuditActor,
  options: RecordInvoicePaymentOptions = {}
) {
  const { tenantId } = requireTenantContext();

  // Short-circuit on duplicate: if this idempotency key was already used,
  // return the invoice as-is without posting another payment.
  if (options.idempotencyKey) {
    const existingPayment = await withCurrentTenantDb(prisma, async (client) => {
      return (client as any).invoicePayment.findFirst({
        where: { tenantId, idempotencyKey: options.idempotencyKey },
        select: { invoiceId: true },
      });
    });
    if (existingPayment) {
      const inv = await withCurrentTenantDb(prisma, async (client) => {
        return (client as any).invoice.findFirst({
          where: { id: invoiceId, tenantId },
          include: { customer: true },
        });
      });
      if (!inv) throw new InvoicePaymentServiceError('Invoice not found.', 404);
      return inv;
    }
  }

  const invoice = await withCurrentTenantDb(prisma, async (client) => {
    return (client as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { customer: true, taxRate: true, items: { include: { inventoryItem: true } } },
    });
  });

  if (!invoice) {
    throw new InvoicePaymentServiceError('Invoice not found.', 404);
  }
  if (invoice.status === 'DRAFT') {
    throw new InvoicePaymentServiceError('Cannot record a payment against a draft invoice - send it first.', 400);
  }
  if (invoice.status === 'PAID') {
    throw new InvoicePaymentServiceError('Invoice is already paid.', 400);
  }

  await approvalWorkflowService.assertApprovedOrNoWorkflow(tenantId, 'Invoice', invoiceId);
  await fiscalPeriodService.assertPeriodOpenForDate(tenantId, new Date());

  const invoiceTotal = new Decimal(invoice.total);
  const alreadyPaid = new Decimal(invoice.amountPaid);
  const remainingBalance = invoiceTotal.minus(alreadyPaid).toDecimalPlaces(2);

  const amountDecimal = options.amount !== undefined && options.amount !== null
    ? new Decimal(options.amount).toDecimalPlaces(2)
    : remainingBalance;

  if (amountDecimal.isNaN() || amountDecimal.lte(0)) {
    throw new InvoicePaymentServiceError('Payment amount must be greater than 0.', 400);
  }
  // Allow up to 1 cent tolerance for floating-point caller inputs
  if (amountDecimal.gt(remainingBalance.plus(new Decimal('0.01')))) {
    throw new InvoicePaymentServiceError(
      `Payment amount (${amountDecimal.toFixed(2)}) exceeds the remaining balance (${remainingBalance.toFixed(2)}) for invoice ${invoice.invoiceNumber}.`,
      400
    );
  }
  const amount = amountDecimal.toNumber();

  const accounts = await withCurrentTenantDb(prisma, (client) => accountRepository.listAccounts(client));
  const cashAcc = accountRepository.resolveDefaultAccount(accounts, 'CASH') || accounts[0];
  const revenueAcc = accountRepository.resolveDefaultAccount(accounts, 'REVENUE') || accounts[0];
  const expenseAcc = accountRepository.resolveDefaultAccount(accounts, 'EXPENSE') || accounts[0];
  const cogsAcc = accountRepository.resolveDefaultAccount(accounts, 'COGS');
  const invAcc = accountRepository.resolveDefaultAccount(accounts, 'INVENTORY_ASSET');
  const accountsById = new Map(accounts.map((a: any) => [a.id, a]));

  // Same base-currency conversion ratio for the whole invoice, applied to
  // just this payment's native-currency amount below - degrades to exactly
  // 1 for same-currency tenants (baseCurrencyAmount === total).
  const invoiceTotalNum = invoiceTotal.toNumber();
  const fxScaleDecimal = invoiceTotalNum !== 0 && invoice.baseCurrencyAmount != null
    ? new Decimal(invoice.baseCurrencyAmount).div(invoiceTotal)
    : new Decimal(1);
  // What fraction of the whole invoice this one payment represents.
  const paymentShareDecimal = invoiceTotalNum !== 0 ? amountDecimal.div(invoiceTotal) : new Decimal(1);
  const fxScale = fxScaleDecimal.toNumber();
  const paymentShare = paymentShareDecimal.toNumber();

  // Original base-currency amount using the rate locked at invoice creation.
  const postingAmount = d2(amountDecimal.times(fxScaleDecimal));

  // FX gain/loss: when payment currency differs from base currency and live
  // rates are available, revalue the cash receipt at today's rate. Any
  // difference vs. the locked rate is a realized FX gain (credit REVENUE)
  // or FX loss (debit EXPENSE).
  const invoiceCurrency = invoice.currency || 'USD';
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const baseCurrency = tenant?.baseCurrency || 'USD';
  let cashPostingAmount = postingAmount; // default: use locked rate
  let fxGainLoss = 0;
  if (invoiceCurrency !== baseCurrency && fxRateService.isFxConfigured()) {
    try {
      const currentBaseAmount = await fxRateService.convertAmount(amount, invoiceCurrency, baseCurrency);
      fxGainLoss = d2(new Decimal(currentBaseAmount).minus(postingAmount));
      cashPostingAmount = d2(new Decimal(currentBaseAmount));
    } catch {
      // If live rate fetch fails, fall back to the locked rate silently.
    }
  }

  // Determine each levy's destination GL account and its share of this
  // payment's base-currency amount, merging levies that share a
  // destination. A destination account that no longer exists (deleted
  // after the invoice was created/taxRate was edited) is silently dropped
  // here - its amount folds into Revenue below rather than hard-blocking
  // payment of an otherwise-unrelated invoice.
  const taxDestinationTotals = new Map<string, number>();
  const breakdown: { name: string; rate: number; amount: number; accountId?: string }[] | null =
    Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : null;

  if (breakdown && breakdown.length > 0) {
    for (const line of breakdown) {
      if (!line.accountId || !accountsById.has(line.accountId)) continue;
      const scaledAmount = d2(new Decimal(line.amount).times(paymentShareDecimal).times(fxScaleDecimal));
      taxDestinationTotals.set(line.accountId, (taxDestinationTotals.get(line.accountId) || 0) + scaledAmount);
    }
  } else if (new Decimal(invoice.tax ?? 0).gt(0) && invoice.taxRate?.accountId && accountsById.has(invoice.taxRate.accountId)) {
    const scaledAmount = d2(new Decimal(invoice.tax).times(paymentShareDecimal).times(fxScaleDecimal));
    taxDestinationTotals.set(invoice.taxRate.accountId, scaledAmount);
  }

  let taxDestinationSum = 0;
  const taxLines = Array.from(taxDestinationTotals.entries())
    .filter(([, taxAmount]) => taxAmount > 0.001)
    .map(([accountId, taxAmount]) => {
      taxDestinationSum += taxAmount;
      const account = accountsById.get(accountId) as any;
      return {
        accountId,
        debit: 0,
        credit: taxAmount,
        description: `${account?.name || 'Tax'} - ${invoice.invoiceNumber}`,
        fundId: invoice.fundId || undefined,
      };
    });

  const revenueAmount = d2(new Decimal(postingAmount).minus(taxDestinationSum));

  let journalId = null;
  if (cashAcc && revenueAcc) {
    // Every line carries the invoice's fundId (if any) uniformly - keeps the
    // whole payment transaction inside one fund by construction, so no
    // separate "guard against cross-fund posting" logic is needed anywhere.
    const lines: { accountId: string; debit: number; credit: number; description: string; fundId?: string }[] = [
      { accountId: cashAcc.id, debit: cashPostingAmount, credit: 0, description: `Cash Received - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined },
      ...taxLines,
    ];
    if (revenueAmount > 0.001) {
      lines.push({ accountId: revenueAcc.id, debit: 0, credit: revenueAmount, description: `Revenue - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined });
    }
    // FX gain: credit REVENUE; FX loss: debit EXPENSE
    if (Math.abs(fxGainLoss) > 0.001) {
      if (fxGainLoss > 0) {
        lines.push({ accountId: revenueAcc.id, debit: 0, credit: fxGainLoss, description: `FX Gain - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined });
      } else if (expenseAcc) {
        lines.push({ accountId: expenseAcc.id, debit: -fxGainLoss, credit: 0, description: `FX Loss - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined });
      }
    }

    // COGS: recognize cost proportional to this payment's share of the invoice.
    // Scaled by fxScale to convert native cost prices into base currency.
    // For FIFO tenants, consume stock layers for actual lot-level costs.
    if (cogsAcc && invAcc && Array.isArray(invoice.items) && invoice.items.length > 0) {
      let cogsCost = 0;
      if ((tenant as any)?.stockValuationMethod === 'FIFO') {
        for (const item of (invoice.items as any[])) {
          if (!item.inventoryItemId || !item.quantity) continue;
          const consumeQty = new Decimal(item.quantity).times(paymentShareDecimal).toDecimalPlaces(0).toNumber();
          if (consumeQty <= 0) continue;
          const { totalCost } = await consumeLayers({ tenantId, itemId: item.inventoryItemId, qty: consumeQty });
          cogsCost += totalCost;
        }
        cogsCost = d2(new Decimal(cogsCost).times(fxScaleDecimal));
      } else {
        const totalNativeCost = (invoice.items as any[]).reduce((acc: Decimal, item: any) => {
          if (!item.inventoryItemId || item.inventoryItem?.costPrice == null) return acc;
          return acc.plus(new Decimal(item.inventoryItem.costPrice).times(new Decimal(item.quantity)));
        }, new Decimal(0));
        cogsCost = d2(totalNativeCost.times(paymentShareDecimal).times(fxScaleDecimal));
      }
      if (cogsCost > 0.001) {
        lines.push({ accountId: cogsAcc.id, debit: cogsCost, credit: 0, description: `COGS - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined });
        lines.push({ accountId: invAcc.id, debit: 0, credit: cogsCost, description: `Inventory - ${invoice.invoiceNumber}`, fundId: invoice.fundId || undefined });
      }
    }

    const journal = await journalService.createJournalEntry(
      {
        description: options.description || `Payment Received for Invoice ${invoice.invoiceNumber} (${invoice.customer.name})`,
        entryDate: new Date().toISOString().split('T')[0],
        status: 'POSTED',
        lines,
      },
      actor
    );
    journalId = journal.id;
  }

  let syncSeq: bigint | null = null;
  const updated = await withCurrentTenantDb(prisma, async (client) => {
    // Acquire a row-level lock on the invoice before reading its balance.
    // Forces concurrent payment transactions on the same invoice to queue
    // behind each other rather than reading a stale amountPaid value.
    // FOR NO KEY UPDATE is less restrictive than FOR UPDATE: it still
    // blocks concurrent row updates but does not block child-row inserts.
    await (client as any).$executeRawUnsafe(
      `SELECT id FROM invoices WHERE id = $1::uuid FOR NO KEY UPDATE`,
      invoiceId
    );

    // Re-read the live balance inside the locked transaction. This is the
    // authoritative value — the outer read may be stale if a concurrent
    // payment committed between that read and this lock.
    const fresh = await (client as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { amountPaid: true, status: true, total: true },
    });
    if (!fresh || fresh.status === 'PAID') {
      throw new InvoicePaymentServiceError('Invoice is already paid.', 409);
    }
    const freshAlreadyPaid = new Decimal(fresh.amountPaid);
    const freshTotal = new Decimal(fresh.total);
    const freshNewAmountPaid = d2(freshAlreadyPaid.plus(amountDecimal));
    if (new Decimal(freshNewAmountPaid).gt(freshTotal.plus(new Decimal('0.01')))) {
      throw new InvoicePaymentServiceError(
        `Payment amount exceeds the remaining balance — a concurrent payment may have been applied.`,
        409
      );
    }
    const safeNewStatus = new Decimal(freshNewAmountPaid).gte(freshTotal.minus(new Decimal('0.01'))) ? 'PAID' : 'PARTIALLY_PAID';

    const invoiceUpdated = await (client as any).invoice.update({
      where: { id: invoiceId },
      data: { status: safeNewStatus, amountPaid: freshNewAmountPaid, journalId },
      include: { customer: true },
    });

    await (client as any).invoicePayment.create({
      data: {
        tenantId,
        invoiceId,
        amount,
        baseCurrencyAmount: postingAmount,
        method: options.method || 'MANUAL',
        journalId,
        idempotencyKey: options.idempotencyKey || null,
        recordedByUserId: actor.userId || null,
        recordedByEmail: actor.userEmail || null,
      },
    });

    // The transactional outbox entry - must stay inside this same
    // transaction (see syncChangeLogService.recordChange) so a client can
    // never observe a committed payment that never got logged.
    syncSeq = await recordChange(client, {
      tenantId,
      entityType: 'Invoice',
      entityId: invoiceUpdated.id,
      operation: 'UPDATE',
      payload: invoiceToSyncPayload(invoiceUpdated),
    });

    // Same transaction as the invoice's status/amountPaid write, for the
    // same reason as recordChange above.
    await recordAuditLogTx(client, {
      action: safeNewStatus === 'PAID' ? 'INVOICE.PAID' : 'INVOICE.PARTIALLY_PAID',
      entity: 'Invoice',
      entityId: invoiceUpdated.id,
      actor,
      changes: diffFields(invoice, invoiceUpdated, ['status', 'amountPaid', 'journalId']),
      details: `Invoice ${invoice.invoiceNumber}: payment of ${amount.toFixed(2)} recorded (${safeNewStatus === 'PAID' ? 'now fully paid' : `${freshTotal.minus(freshNewAmountPaid).toDecimalPlaces(2).toFixed(2)} still owed`}).`,
    });

    return invoiceUpdated;
  });

  if (syncSeq !== null) {
    notifyChange({
      tenantId,
      entityType: 'Invoice',
      entityId: updated.id,
      operation: 'UPDATE',
      payload: invoiceToSyncPayload(updated),
      sequence: syncSeq,
    });
  }

  return updated;
}

/** Full payment history for an invoice, newest first - backs the "Payment History" view on Invoices.tsx. */
export async function listPaymentsForInvoice(invoiceId: string) {
  const { tenantId } = requireTenantContext();
  return withCurrentTenantDb(prisma, async (client) => {
    return (client as any).invoicePayment.findMany({
      where: { invoiceId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  });
}
