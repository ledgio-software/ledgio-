import cron, { ScheduledTask } from 'node-cron';
import { wrapCronTick } from './cronJobRegistry';
import { prisma } from '../config/db';
import { runWithTenantContext } from '../context/tenantContext';
import { withCurrentTenantDb } from '../database/tenantClient';
import * as accountRepository from '../repository/accountRepository';
import * as journalEntryService from './journalEntryService';

/**
 * Daily sweep that accrues interest on overdue customer invoices.
 * Runs at 07:00 daily. Skips invoices that already have a charge for
 * today's period (unique constraint on tenant_id+invoice_id+period_start).
 * Uses CASH as the debit side (proxy for interest receivable) and
 * INTEREST_INCOME as the credit — the InterestCharge row is the
 * authoritative record; the journal satisfies double-entry.
 */
export class InterestChargeCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    this.task = cron.schedule('0 7 * * *', wrapCronTick('Interest Charges', async () => {
      console.log('[InterestChargeCron] Running daily interest accrual sweep...');
      await this.runJob();
    }));

    console.log('[InterestChargeCron] Daily Interest Charge Cron Job Initialized.');
  }

  public static async runJob(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    let tenants: any[];
    try {
      tenants = await prisma.tenant.findMany();
    } catch (err: any) {
      console.error('[InterestChargeCron] Failed to fetch tenants:', err);
      return;
    }

    for (const tenant of tenants) {
      try {
        // Policy lives in the public schema — query outside tenant context.
        const policy = await (prisma as any).interestPolicy.findUnique({
          where: { tenantId: tenant.id },
        });
        if (!policy || !policy.isActive) continue;

        const annualRate = Number(policy.annualRate);
        const graceDays = Number(policy.graceDays) || 0;
        const graceCutoff = new Date(today);
        graceCutoff.setUTCDate(graceCutoff.getUTCDate() - graceDays);

        await runWithTenantContext(
          { tenantId: tenant.id, tenantSchema: tenant.schema, tenantName: tenant.name, tenantSlug: tenant.slug },
          async () => {
            const accounts = await withCurrentTenantDb(prisma, (client) =>
              accountRepository.listAccounts(client)
            );

            const cashAcc = accountRepository.resolveDefaultAccount(accounts, 'CASH');
            const interestAcc = accountRepository.resolveDefaultAccount(accounts, 'INTEREST_INCOME');

            if (!cashAcc || !interestAcc) {
              console.warn(`[InterestChargeCron] Tenant ${tenant.id}: missing CASH or INTEREST_INCOME account, skipping.`);
              return;
            }

            // Resolve interest income GL from policy.accountId if set.
            const interestGl = policy.accountId
              ? accounts.find((a: any) => a.id === policy.accountId) || interestAcc
              : interestAcc;

            const overdueInvoices = await withCurrentTenantDb(prisma, async (client) => {
              return (client as any).invoice.findMany({
                where: {
                  tenantId: tenant.id,
                  status: { in: ['SENT', 'PARTIALLY_PAID'] },
                  dueDate: { lt: graceCutoff },
                },
              });
            });

            for (const invoice of overdueInvoices) {
              try {
                const balanceDue = Math.round(
                  (Number(invoice.total) - Number(invoice.amountPaid || 0)) * 100
                ) / 100;
                if (balanceDue <= 0) continue;

                // Skip if a charge for today already exists (idempotency).
                const existing = await (prisma as any).interestCharge.findFirst({
                  where: { tenantId: tenant.id, invoiceId: invoice.id, periodStart: today },
                });
                if (existing) continue;

                const dailyInterest = Math.round((balanceDue * annualRate / 365) * 100) / 100;
                if (dailyInterest <= 0) continue;

                const entryNumber = `INT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const journal = await journalEntryService.createJournalEntry({
                  entryNumber,
                  entryDate: today.toISOString().split('T')[0],
                  description: `Interest charge — Invoice ${invoice.invoiceNumber}`,
                  status: 'POSTED',
                  lines: [
                    { accountId: cashAcc.id, debit: dailyInterest, credit: 0, description: `Interest receivable — Invoice ${invoice.invoiceNumber}` },
                    { accountId: interestGl.id, debit: 0, credit: dailyInterest, description: `Interest income — Invoice ${invoice.invoiceNumber}` },
                  ],
                });

                await (prisma as any).interestCharge.create({
                  data: {
                    tenantId: tenant.id,
                    invoiceId: invoice.id,
                    amount: dailyInterest,
                    periodStart: today,
                    periodEnd: tomorrow,
                    journalId: journal.id,
                    status: 'POSTED',
                  },
                });

                console.log(`[InterestChargeCron] Tenant ${tenant.id}: charged ${dailyInterest} on invoice ${invoice.id}`);
              } catch (invoiceErr: any) {
                console.error(`[InterestChargeCron] Tenant ${tenant.id}, invoice ${invoice.id} error:`, invoiceErr);
              }
            }
          }
        );
      } catch (tenantErr: any) {
        console.error(`[InterestChargeCron] Tenant ${tenant.id} sweep error:`, tenantErr);
      }
    }
  }

  public static stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}
