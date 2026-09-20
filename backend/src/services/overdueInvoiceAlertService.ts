import cron, { ScheduledTask } from 'node-cron';
import { wrapCronTick } from './cronJobRegistry';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { runWithTenantContext } from '../context/tenantContext';
import { invalidateAllNotificationCaches } from '../cache/notificationCache';
import { redis } from '../config/redis';

/**
 * Maps a daysOverdue count to the highest threshold it has crossed.
 * Returns null for invoices that are not yet past any alertable threshold.
 */
function alertBucket(daysOverdue: number): '30' | '60' | '90' | null {
  if (daysOverdue >= 90) return '90';
  if (daysOverdue >= 60) return '60';
  if (daysOverdue >= 30) return '30';
  return null;
}

function redisKey(tenantId: string, invoiceId: string): string {
  return `overdue-alert-bucket:${tenantId}:${invoiceId}`;
}

async function getLastAlertedBucket(tenantId: string, invoiceId: string): Promise<string | null> {
  try {
    return await redis.get(redisKey(tenantId, invoiceId));
  } catch {
    return null;
  }
}

async function setLastAlertedBucket(tenantId: string, invoiceId: string, bucket: string): Promise<void> {
  try {
    // Keep for 180 days — enough to cover 90-day max threshold + buffer
    await redis.set(redisKey(tenantId, invoiceId), bucket, 'EX', 180 * 24 * 60 * 60);
  } catch {
    // Fail-open: if Redis is down the alert fires again next day, which is acceptable
  }
}

const BUCKET_ORDER = ['30', '60', '90'] as const;

function isBucketHigher(current: string, previous: string | null): boolean {
  if (previous === null) return true;
  return BUCKET_ORDER.indexOf(current as any) > BUCKET_ORDER.indexOf(previous as any);
}

/**
 * Daily sweep across every tenant's overdue AR invoices. Creates an in-app
 * Notification targeted at the tenant (userId: null = all users) the first
 * time an invoice enters each 30/60/90-day overdue bucket. Uses Redis to
 * remember which bucket was last alerted, so each bucket transition fires
 * exactly once per invoice regardless of how many days pass between runs.
 *
 * This is the internal-team complement to DunningReminderCronService, which
 * notifies the customer. This notifies the business: "Invoice INV-001 is now
 * 60 days overdue — take action."
 */
export class OverdueInvoiceAlertCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    // 8:30 AM UTC daily — 30 minutes after the dunning reminders so both
    // jobs don't hit the DB simultaneously.
    this.task = cron.schedule('30 8 * * *', wrapCronTick('Overdue Invoice Alerts', async () => {
      console.log('[OverdueInvoiceAlertCron] Starting daily overdue invoice threshold sweep...');
      await this.runAlertSweep();
    }));

    console.log('[OverdueInvoiceAlertCron] Daily Overdue Invoice Alert Cron Initialized.');
  }

  public static async runAlertSweep(): Promise<void> {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    try {
      const tenants = await prisma.tenant.findMany({ select: { id: true, schema: true, name: true, slug: true } });

      for (const tenant of tenants) {
        try {
          await runWithTenantContext(
            { tenantId: tenant.id, tenantSchema: tenant.schema, tenantName: tenant.name, tenantSlug: tenant.slug },
            async () => {
              const overdueInvoices = await withCurrentTenantDb(prisma, (client) =>
                (client as any).invoice.findMany({
                  where: {
                    tenantId: tenant.id,
                    status: { notIn: ['PAID', 'DRAFT', 'CANCELLED'] },
                    dueDate: { lt: now },
                  },
                  select: {
                    id: true,
                    invoiceNumber: true,
                    dueDate: true,
                    total: true,
                    amountPaid: true,
                    currency: true,
                    customer: { select: { name: true } },
                  },
                })
              ) as any[];

              let alertsCreated = 0;
              for (const invoice of overdueInvoices) {
                const daysOverdue = Math.floor(
                  (now.getTime() - new Date(invoice.dueDate).getTime()) / (24 * 60 * 60 * 1000)
                );
                const bucket = alertBucket(daysOverdue);
                if (!bucket) continue;

                const lastBucket = await getLastAlertedBucket(tenant.id, invoice.id);
                if (!isBucketHigher(bucket, lastBucket)) continue;

                const balanceDue = Math.round(
                  (Number(invoice.total) - Number(invoice.amountPaid)) * 100
                ) / 100;
                if (balanceDue <= 0) continue;

                const customerName = invoice.customer?.name ?? 'Unknown customer';
                const title = `Invoice ${invoice.invoiceNumber} — ${daysOverdue} days overdue`;
                const message = `${customerName} owes ${invoice.currency} ${balanceDue.toFixed(2)} on invoice ${invoice.invoiceNumber}. It is now ${daysOverdue} days past the due date (${bucket}-day threshold crossed). Review the AR Aging Report or follow up directly.`;

                try {
                  await withCurrentTenantDb(prisma, (client) =>
                    (client as any).notification.create({
                      data: {
                        tenantId: tenant.id,
                        userId: null,
                        title,
                        message,
                        type: 'INVOICE_OVERDUE',
                        link: '/reports/aging',
                      },
                    })
                  );

                  await setLastAlertedBucket(tenant.id, invoice.id, bucket);
                  alertsCreated++;
                } catch (createErr: any) {
                  console.error(`[OverdueInvoiceAlertCron] Failed to create notification for invoice ${invoice.id}:`, createErr);
                }
              }

              if (alertsCreated > 0) {
                await invalidateAllNotificationCaches(tenant.id).catch(() => {});
                console.log(`[OverdueInvoiceAlertCron] Tenant ${tenant.id}: created ${alertsCreated} overdue alert(s).`);
              }
            }
          );
        } catch (tenantErr: any) {
          console.error(`[OverdueInvoiceAlertCron] Error sweeping tenant ${tenant.id}:`, tenantErr);
        }
      }
    } catch (err: any) {
      console.error('[OverdueInvoiceAlertCron] Fatal error in alert sweep:', err);
    }
  }

  public static stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}
