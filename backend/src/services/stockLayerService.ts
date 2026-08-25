import { prisma } from '../config/db';

/**
 * Records a new FIFO stock lot when inventory is received from a vendor bill.
 * Only called when the tenant's stockValuationMethod is 'FIFO'.
 */
export async function addLayer(params: {
  tenantId: string;
  warehouseId: string;
  itemId: string;
  qty: number;
  unitCost: number;
  sourceRef?: string;
}): Promise<void> {
  const { tenantId, warehouseId, itemId, qty, unitCost, sourceRef } = params;
  if (qty <= 0) return;

  await (prisma as any).stockLayer.create({
    data: {
      tenantId,
      warehouseId,
      itemId,
      unitCost,
      originalQty: qty,
      remainingQty: qty,
      purchasedAt: new Date(),
      sourceRef: sourceRef || null,
    },
  });
}

/**
 * Consumes stock layers in FIFO order (oldest purchase first) and returns
 * the total cost of consumed units. Updates remainingQty on each depleted layer.
 *
 * If warehouseId is provided, only layers from that warehouse are consumed.
 * If omitted, layers are consumed across all warehouses in FIFO order — used
 * when invoice payments don't carry a specific warehouse reference.
 *
 * Returns { totalCost } where totalCost is the sum of (unitCost × units consumed).
 * If there are insufficient layers to cover qty, whatever is available is consumed
 * and the returned cost reflects only those layers (graceful degradation).
 */
export async function consumeLayers(params: {
  tenantId: string;
  warehouseId?: string;
  itemId: string;
  qty: number;
}): Promise<{ totalCost: number }> {
  const { tenantId, warehouseId, itemId, qty } = params;
  if (qty <= 0) return { totalCost: 0 };

  const where: any = {
    tenantId,
    itemId,
    remainingQty: { gt: 0 },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const layers = await (prisma as any).stockLayer.findMany({
    where,
    orderBy: { purchasedAt: 'asc' },
  });

  let remaining = qty;
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;

    const layerRemaining = layer.remainingQty;
    const consume = Math.min(remaining, layerRemaining);

    await (prisma as any).stockLayer.update({
      where: { id: layer.id },
      data: { remainingQty: layerRemaining - consume },
    });

    totalCost += consume * Number(layer.unitCost);
    remaining -= consume;
  }

  return { totalCost: Math.round(totalCost * 100) / 100 };
}
