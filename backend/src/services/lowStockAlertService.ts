import { withCurrentTenantDb } from '../database/tenantClient';
import { prisma } from '../config/db';
import { invalidateAllNotificationCaches } from '../cache/notificationCache';
import { SmsService } from './smsService';

/**
 * Checks whether the named item is below its reorder level and, if so,
 * creates an in-app Notification and optionally sends an SMS.
 *
 * Call this fire-and-forget after any stock-reducing operation (sale,
 * REMOVE adjustment, transfer out). Errors are swallowed so that a
 * notification failure never rolls back or fails the caller's response.
 *
 * Guards: re-alerts only once per 24 hours per item (lastLowStockAlertAt).
 */
export async function checkAndAlertLowStock(
  tenantId: string,
  itemId: string
): Promise<void> {
  try {
    const item = await withCurrentTenantDb(prisma, (client) =>
      (client as any).inventoryItem.findFirst({
        where: { id: itemId, tenantId },
        select: { id: true, name: true, reorderLevel: true, lastLowStockAlertAt: true },
      })
    ) as { id: string; name: string; reorderLevel: number; lastLowStockAlertAt: Date | null } | null;
    if (!item) return;

    const stocks = await withCurrentTenantDb(prisma, (client) =>
      (client as any).warehouseStock.findMany({
        where: { itemId, tenantId },
        select: { quantityOnHand: true },
      })
    );
    const totalQty: number = (stocks as any[]).reduce(
      (sum: number, s: any) => sum + (s.quantityOnHand || 0),
      0
    );

    if (totalQty > item.reorderLevel) return;

    // 24-hour dedup guard
    if (item.lastLowStockAlertAt) {
      const elapsed = Date.now() - new Date(item.lastLowStockAlertAt).getTime();
      if (elapsed < 24 * 60 * 60 * 1000) return;
    }

    await withCurrentTenantDb(prisma, (client) =>
      (client as any).notification.create({
        data: {
          tenantId,
          userId: null,
          title: `Low Stock: ${item.name}`,
          message: `${totalQty} unit${totalQty === 1 ? '' : 's'} remaining (reorder level: ${item.reorderLevel}). Please restock soon.`,
          type: 'LOW_STOCK',
          link: '/inventory/warehouse-management',
        },
      })
    );

    await withCurrentTenantDb(prisma, (client) =>
      (client as any).inventoryItem.update({
        where: { id: itemId },
        data: { lastLowStockAlertAt: new Date() },
      })
    );

    await invalidateAllNotificationCaches(tenantId).catch(() => {});

    // Optional SMS to tenant boss phone
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { bossPhone: true },
    });
    if (tenant?.bossPhone) {
      SmsService.send(
        tenant.bossPhone,
        `[Ledgio] Low stock alert: ${item.name} — ${totalQty} unit${totalQty === 1 ? '' : 's'} left (reorder level: ${item.reorderLevel}). Please reorder.`
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[LowStockAlert] Error checking/sending low-stock alert:', err);
  }
}
