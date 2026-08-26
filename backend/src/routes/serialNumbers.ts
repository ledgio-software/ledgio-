import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

// GET /serial-numbers?inventoryItemId=&warehouseId=&status=
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { inventoryItemId, warehouseId, status, page = '1', pageSize = '100' } = req.query as Record<string, string>;
    const where: any = { tenantId };
    if (inventoryItemId) where.inventoryItemId = inventoryItemId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (status) where.status = status;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [serials, total] = await Promise.all([
      (prisma as any).serialNumber.findMany({ where, include: { inventoryItem: { select: { id: true, name: true, sku: true } } }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(pageSize) }),
      (prisma as any).serialNumber.count({ where }),
    ]);
    res.json({ success: true, data: serials, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /serial-numbers/receive — bulk-receive serials on bill/GRN
router.post('/receive', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = z.object({
      inventoryItemId: z.string().uuid(),
      warehouseId: z.string().uuid(),
      serialNumbers: z.array(z.string().min(1).max(100)).min(1),
      billId: z.string().uuid().optional().nullable(),
    }).parse(req.body);

    const created: any[] = [];
    const skipped: string[] = [];
    for (const sn of body.serialNumbers) {
      const existing = await (prisma as any).serialNumber.findFirst({
        where: { tenantId, inventoryItemId: body.inventoryItemId, serialNumber: sn },
      });
      if (existing) { skipped.push(sn); continue; }
      const record = await (prisma as any).serialNumber.create({
        data: {
          tenantId,
          inventoryItemId: body.inventoryItemId,
          warehouseId: body.warehouseId,
          serialNumber: sn,
          status: 'AVAILABLE',
          ...(body.billId ? { billId: body.billId } : {}),
        },
      });
      created.push(record);
    }
    res.status(201).json({ success: true, data: { created: created.length, skipped } });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /serial-numbers/assign — assign serials to an invoice line
router.post('/assign', requireRole('Accountant', 'Shop Manager'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = z.object({
      serialNumberIds: z.array(z.string().uuid()).min(1),
      invoiceId: z.string().uuid(),
    }).parse(req.body);

    const serials = await (prisma as any).serialNumber.findMany({
      where: { tenantId, id: { in: body.serialNumberIds } },
    });
    const unavailable = serials.filter((s: any) => s.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      return res.status(400).json({ success: false, error: `Serial(s) not available: ${unavailable.map((s: any) => s.serialNumber).join(', ')}` });
    }
    await (prisma as any).serialNumber.updateMany({
      where: { tenantId, id: { in: body.serialNumberIds } },
      data: { status: 'SOLD', invoiceId: body.invoiceId },
    });
    res.json({ success: true, data: { assigned: body.serialNumberIds.length } });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /serial-numbers/return — mark serial(s) as returned (e.g. from a credit note)
router.post('/return', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = z.object({
      serialNumberIds: z.array(z.string().uuid()).min(1),
    }).parse(req.body);

    await (prisma as any).serialNumber.updateMany({
      where: { tenantId, id: { in: body.serialNumberIds } },
      data: { status: 'RETURNED', invoiceId: null },
    });
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
