import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);
router.use(requireTier(2, 'Price Lists'));

const entrySchema = z.object({
  inventoryItemId: z.string().uuid(),
  unitPrice: z.number().nonnegative(),
  minQty: z.number().int().positive().default(1),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  currency: z.string().length(3).default('GHS'),
  isDefault: z.boolean().default(false),
  entries: z.array(entrySchema).optional().default([]),
});

const updateSchema = createSchema.partial();

// GET /price-lists
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const lists = await (prisma as any).priceList.findMany({
      where: { tenantId },
      include: { entries: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: lists });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /price-lists/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const list = await (prisma as any).priceList.findFirst({
      where: { id: req.params.id, tenantId },
      include: { entries: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } }, customers: { select: { id: true, name: true } } },
    });
    if (!list) return res.status(404).json({ success: false, error: 'Price list not found.' });
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /price-lists
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    // If this new list is the default, clear any existing default first
    if (body.isDefault) {
      await (prisma as any).priceList.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
    }
    const list = await (prisma as any).priceList.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        currency: body.currency,
        isDefault: body.isDefault,
        entries: {
          create: body.entries.map((e) => ({ tenantId, inventoryItemId: e.inventoryItemId, unitPrice: e.unitPrice, minQty: e.minQty })),
        },
      },
      include: { entries: true },
    });
    res.status(201).json({ success: true, data: list });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /price-lists/:id
router.put('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const existing = await (prisma as any).priceList.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Price list not found.' });
    const body = updateSchema.parse(req.body);
    if (body.isDefault) {
      await (prisma as any).priceList.updateMany({ where: { tenantId, isDefault: true, NOT: { id: req.params.id } }, data: { isDefault: false } });
    }
    const list = await (prisma as any).priceList.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      },
    });
    res.json({ success: true, data: list });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /price-lists/:id
router.delete('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const existing = await (prisma as any).priceList.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Price list not found.' });
    await (prisma as any).priceList.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /price-lists/:id/entries
router.post('/:id/entries', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const list = await (prisma as any).priceList.findFirst({ where: { id: req.params.id, tenantId } });
    if (!list) return res.status(404).json({ success: false, error: 'Price list not found.' });
    const body = entrySchema.parse(req.body);
    // Upsert: if entry for this item already exists, update it; otherwise create
    const existing = await (prisma as any).priceListEntry.findFirst({
      where: { priceListId: req.params.id, inventoryItemId: body.inventoryItemId, tenantId },
    });
    let entry;
    if (existing) {
      entry = await (prisma as any).priceListEntry.update({
        where: { id: existing.id },
        data: { unitPrice: body.unitPrice, minQty: body.minQty },
      });
    } else {
      entry = await (prisma as any).priceListEntry.create({
        data: { tenantId, priceListId: req.params.id, inventoryItemId: body.inventoryItemId, unitPrice: body.unitPrice, minQty: body.minQty },
      });
    }
    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /price-lists/:id/entries/:entryId
router.delete('/:id/entries/:entryId', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const entry = await (prisma as any).priceListEntry.findFirst({
      where: { id: req.params.entryId, priceListId: req.params.id, tenantId },
    });
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found.' });
    await (prisma as any).priceListEntry.delete({ where: { id: req.params.entryId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /price-lists/:id/customers — assign customer list to this price list
router.put('/:id/customers', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const list = await (prisma as any).priceList.findFirst({ where: { id: req.params.id, tenantId } });
    if (!list) return res.status(404).json({ success: false, error: 'Price list not found.' });
    const { customerIds } = z.object({ customerIds: z.array(z.string().uuid()) }).parse(req.body);
    // Disconnect all current customers from this price list, then assign the new set
    await (prisma as any).customer.updateMany({ where: { tenantId, priceListId: req.params.id }, data: { priceListId: null } });
    if (customerIds.length > 0) {
      await (prisma as any).customer.updateMany({ where: { tenantId, id: { in: customerIds } }, data: { priceListId: req.params.id } });
    }
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
