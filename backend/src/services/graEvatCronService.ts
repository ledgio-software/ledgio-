import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { runWithTenantContext } from '../context/tenantContext';
import { decryptCredential } from '../utils/credentialEncryption';
import * as graEvatService from './graEvatService';

const WINDOW_MS = 48 * 60 * 60 * 1000; // 48-hour mandate from GRA

/** Decrypt a customer row's PII fields, tolerating plaintext input. */
function decryptCustomer(c: any): any {
  if (!c) return c;
  const safe = (v: string | null): string | null => {
    if (!v) return v;
    try { return decryptCredential(v); } catch { return v; }
  };
  return { ...c, email: safe(c.email), phone: safe(c.phone), tin: safe(c.tin) };
}

/**
 * Every 15 minutes: sweep all VAT-registered, GRA-configured tenants for
 * invoices that are NOT_REQUESTED, PENDING, or FAILED and were created
 * within the last 48 hours (GRA's offline-clearance mandate window).
 *
 * Each qualifying invoice is submitted to the VSDC API and its status
 * updated to CLEARED or FAILED accordingly. Invoices already outside
 * the 48-hour window are left for manual handling — the cron does not
 * auto-retry them to avoid polluting GRA's records with stale invoices.
 */
export class GraEvatCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    this.task = cron.schedule('*/15 * * * *', async () => {
      console.log('[GraEvatCron] Running 15-minute VSDC clearance sweep...');
      await this.runSync();
    });

    console.log('[GraEvatCron] GRA E-VAT Sync Cron Initialized (every 15 minutes).');
  }

  public static async runSync(): Promise<void> {
    const cutoff = new Date(Date.now() - WINDOW_MS);

    // Only process tenants that are VAT-registered and have GRA credentials configured.
    const tenants = await prisma.tenant.findMany({
      where: { vatRegistered: true },
      select: {
        id: true,
        schema: true,
        name: true,
        slug: true,
        graTin: true,
        graDeviceNumber: true,
        graSecurityKeyEncrypted: true,
      },
    });

    for (const tenant of tenants) {
      if (!graEvatService.isGraEvatConfigured({
        tin: tenant.graTin ?? null,
        deviceNumber: tenant.graDeviceNumber ?? null,
        securityKeyEncrypted: tenant.graSecurityKeyEncrypted ?? null,
      })) continue;

      try {
        await runWithTenantContext(
          { tenantId: tenant.id, tenantSchema: tenant.schema, tenantName: tenant.name, tenantSlug: tenant.slug },
          async () => {
            const pending = await withCurrentTenantDb(prisma, async (client) => {
              return (client as any).invoice.findMany({
                where: {
                  tenantId: tenant.id,
                  graClearanceStatus: { in: ['NOT_REQUESTED', 'PENDING', 'FAILED'] },
                  createdAt: { gte: cutoff },
                },
                include: {
                  customer: true,
                  items: { include: { inventoryItem: true } },
                },
              });
            });

            console.log(`[GraEvatCron] Tenant ${tenant.name}: ${pending.length} invoice(s) to sync.`);

            for (const invoice of pending) {
              try {
                invoice.customer = decryptCustomer(invoice.customer);

                const result = await graEvatService.requestClearance(
                  {
                    tin: tenant.graTin ?? null,
                    deviceNumber: tenant.graDeviceNumber ?? null,
                    securityKeyEncrypted: tenant.graSecurityKeyEncrypted ?? null,
                  },
                  {
                    invoiceNumber: invoice.invoiceNumber,
                    issueDate: invoice.issueDate,
                    currency: invoice.currency,
                    exchangeRate: Number(invoice.exchangeRate),
                    subtotal: Number(invoice.subtotal),
                    tax: Number(invoice.tax),
                    total: Number(invoice.total),
                    taxBreakdown: (invoice.taxBreakdown as any) ?? null,
                    customerName: invoice.customer?.name ?? 'Unknown',
                    customerTin: invoice.customer?.tin ?? null,
                    userName: 'Ledgio System',
                    items: invoice.items.map((item: any) => ({
                      id: item.id,
                      description: item.description,
                      quantity: Number(item.quantity),
                      unitPrice: Number(item.unitPrice),
                      amount: Number(item.amount),
                      sku: item.inventoryItem?.sku ?? null,
                    })),
                  }
                );

                const qrCodeDataUrl = await graEvatService.renderClearanceQrCode(result.qrCodeData);

                await withCurrentTenantDb(prisma, async (client) => {
                  await (client as any).invoice.update({
                    where: { id: invoice.id },
                    data: {
                      graClearanceStatus: 'CLEARED',
                      graVerificationEngineId: result.verificationEngineId,
                      graQrCodeData: qrCodeDataUrl,
                      graSignature: result.signature,
                      graEncryptedData: result.encryptedData,
                      graClearedAt: result.clearedAt,
                      graClearanceError: null,
                    },
                  });
                });

                console.log(`[GraEvatCron] Invoice ${invoice.invoiceNumber} cleared.`);
              } catch (invoiceErr: any) {
                const msg = invoiceErr instanceof graEvatService.GraEvatServiceError
                  ? invoiceErr.message
                  : 'GRA clearance failed during cron sync.';

                await withCurrentTenantDb(prisma, async (client) => {
                  await (client as any).invoice.update({
                    where: { id: invoice.id },
                    data: { graClearanceStatus: 'FAILED', graClearanceError: msg },
                  });
                }).catch(() => {});

                console.error(`[GraEvatCron] Invoice ${invoice.invoiceNumber} failed:`, msg);
              }
            }
          }
        );
      } catch (tenantErr: any) {
        console.error(`[GraEvatCron] Error processing tenant ${tenant.id}:`, tenantErr);
      }
    }
  }

  public static stop(): void {
    this.task?.stop();
    this.task = null;
  }
}
