import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { recordAuditLogTx, actorFromRequest } from '../services/auditLogService';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);
router.use(requireTier(2, 'Manufacturing'));

// ─── BOM Template schemas ──────────────────────────────────────────────────

const bomLineSchema = z.object({
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
});

const createBomSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  finishedItemId: z.string().uuid(),
  outputQty: z.number().positive().default(1),
  lines: z.array(bomLineSchema).min(1),
});

const updateBomSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Production Order schemas ──────────────────────────────────────────────

const createOrderSchema = z.object({
  bomTemplateId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  plannedQty: z.number().positive(),
  notes: z.string().optional(),
});

// ─── BOM Templates ─────────────────────────────────────────────────────────

// GET /manufacturing/bom-templates
router.get('/bom-templates', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const templates = await (prisma as any).bomTemplate.findMany({
      where: { tenantId },
      include: {
        finishedItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        lines: {
          include: { componentItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, templates });
  } catch (err: any) {
    console.error('[Manufacturing] list BOM templates error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve BOM templates.' });
  }
});

// GET /manufacturing/bom-templates/:id
router.get('/bom-templates/:id', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const tpl = await (prisma as any).bomTemplate.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        finishedItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        lines: {
          include: { componentItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } },
        },
        productionOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!tpl) { res.status(404).json({ success: false, error: 'BOM template not found.' }); return; }
    res.json({ success: true, template: tpl });
  } catch (err: any) {
    console.error('[Manufacturing] get BOM template error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve BOM template.' });
  }
});

// POST /manufacturing/bom-templates
router.post('/bom-templates', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createBomSchema.parse(req.body);
    const { tenantId } = requireTenantContext();

    const finishedItem = await (prisma as any).inventoryItem.findFirst({
      where: { id: body.finishedItemId, tenantId },
    });
    if (!finishedItem) {
      res.status(400).json({ success: false, error: 'Finished item not found.' });
      return;
    }

    const componentIds = body.lines.map((l) => l.componentItemId);
    const components = await (prisma as any).inventoryItem.findMany({
      where: { id: { in: componentIds }, tenantId },
    });
    if (components.length !== componentIds.length) {
      res.status(400).json({ success: false, error: 'One or more component items not found.' });
      return;
    }

    const tpl = await (prisma as any).bomTemplate.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        finishedItemId: body.finishedItemId,
        outputQty: body.outputQty,
        lines: {
          create: body.lines.map((l) => ({
            tenantId,
            componentItemId: l.componentItemId,
            quantity: l.quantity,
          })),
        },
      },
      include: {
        finishedItem: { select: { id: true, name: true, sku: true } },
        lines: { include: { componentItem: { select: { id: true, name: true, sku: true } } } },
      },
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'CREATE',
      entity: 'BomTemplate',
      entityId: tpl.id,
      details: `Created BOM template "${body.name}" for ${finishedItem.name}.`,
    });

    res.status(201).json({ success: true, template: tpl });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ success: false, error: err.issues[0]?.message || 'Validation error.' }); return; }
    console.error('[Manufacturing] create BOM template error:', err);
    res.status(500).json({ success: false, error: 'Failed to create BOM template.' });
  }
});

// PUT /manufacturing/bom-templates/:id
router.put('/bom-templates/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateBomSchema.parse(req.body);
    const { tenantId } = requireTenantContext();

    const tpl = await (prisma as any).bomTemplate.findFirst({ where: { id: req.params.id, tenantId } });
    if (!tpl) { res.status(404).json({ success: false, error: 'BOM template not found.' }); return; }

    const updated = await (prisma as any).bomTemplate.update({
      where: { id: req.params.id },
      data: body,
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'UPDATE',
      entity: 'BomTemplate',
      entityId: tpl.id,
      details: `Updated BOM template "${tpl.name}".`,
    });

    res.json({ success: true, template: updated });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ success: false, error: err.issues[0]?.message || 'Validation error.' }); return; }
    console.error('[Manufacturing] update BOM template error:', err);
    res.status(500).json({ success: false, error: 'Failed to update BOM template.' });
  }
});

// ─── Production Orders ──────────────────────────────────────────────────────

// GET /manufacturing/production-orders
router.get('/production-orders', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { status } = req.query;
    const where: any = { tenantId };
    if (status) where.status = status;

    const orders = await withCurrentTenantDb(prisma, async (client) => {
      return (client as any).productionOrder.findMany({
        where,
        include: {
          bomTemplate: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    res.json({ success: true, orders });
  } catch (err: any) {
    console.error('[Manufacturing] list production orders error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve production orders.' });
  }
});

// GET /manufacturing/production-orders/:id
router.get('/production-orders/:id', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const order = await withCurrentTenantDb(prisma, async (client) => {
      return (client as any).productionOrder.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          bomTemplate: {
            include: {
              finishedItem: { select: { id: true, name: true, sku: true, unit: true } },
              lines: {
                include: { componentItem: { select: { id: true, name: true, sku: true, unit: true } } },
              },
            },
          },
          warehouse: { select: { id: true, name: true } },
        },
      });
    });

    if (!order) { res.status(404).json({ success: false, error: 'Production order not found.' }); return; }
    res.json({ success: true, order });
  } catch (err: any) {
    console.error('[Manufacturing] get production order error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve production order.' });
  }
});

// POST /manufacturing/production-orders
router.post('/production-orders', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createOrderSchema.parse(req.body);
    const { tenantId } = requireTenantContext();

    const tpl = await (prisma as any).bomTemplate.findFirst({
      where: { id: body.bomTemplateId, tenantId, isActive: true },
    });
    if (!tpl) {
      res.status(400).json({ success: false, error: 'BOM template not found or inactive.' });
      return;
    }

    const order = await withCurrentTenantDb(prisma, async (client) => {
      const warehouse = await (client as any).warehouse.findFirst({
        where: { id: body.warehouseId, tenantId },
      });
      if (!warehouse) throw Object.assign(new Error('Warehouse not found.'), { status: 400 });

      const seq = await (client as any).productionOrder.count({ where: { tenantId } });
      const orderNumber = `PO-${String(seq + 1).padStart(5, '0')}`;

      return (client as any).productionOrder.create({
        data: {
          tenantId,
          orderNumber,
          bomTemplateId: body.bomTemplateId,
          warehouseId: body.warehouseId,
          plannedQty: body.plannedQty,
          notes: body.notes,
          status: 'DRAFT',
        },
        include: {
          bomTemplate: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'CREATE',
      entity: 'ProductionOrder',
      entityId: (order as any).id,
      details: `Created production order ${(order as any).orderNumber}.`,
    });

    res.status(201).json({ success: true, order });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ success: false, error: err.issues[0]?.message || 'Validation error.' }); return; }
    if (err?.status === 400) { res.status(400).json({ success: false, error: err.message }); return; }
    console.error('[Manufacturing] create production order error:', err);
    res.status(500).json({ success: false, error: 'Failed to create production order.' });
  }
});

// PUT /manufacturing/production-orders/:id/start — DRAFT → IN_PROGRESS
router.put('/production-orders/:id/start', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const order = await withCurrentTenantDb(prisma, async (client) => {
      const o = await (client as any).productionOrder.findFirst({ where: { id: req.params.id, tenantId } });
      if (!o) throw Object.assign(new Error('Production order not found.'), { status: 404 });
      if (o.status !== 'DRAFT') throw Object.assign(new Error(`Cannot start order with status ${o.status}.`), { status: 400 });
      return (client as any).productionOrder.update({
        where: { id: req.params.id },
        data: { status: 'IN_PROGRESS' },
      });
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'UPDATE',
      entity: 'ProductionOrder',
      entityId: req.params.id,
      details: `Started production order ${(order as any).orderNumber}.`,
    });

    res.json({ success: true, order });
  } catch (err: any) {
    if (err?.status) { res.status(err.status).json({ success: false, error: err.message }); return; }
    console.error('[Manufacturing] start production order error:', err);
    res.status(500).json({ success: false, error: 'Failed to start production order.' });
  }
});

// PUT /manufacturing/production-orders/:id/complete — IN_PROGRESS → COMPLETED
// Decrements component stock, increments finished goods stock, posts journal entry.
router.put('/production-orders/:id/complete', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const completedQty = Number(req.body.completedQty);
    if (!completedQty || completedQty <= 0) {
      res.status(400).json({ success: false, error: 'completedQty must be a positive number.' });
      return;
    }

    const tplData = await (prisma as any).bomTemplate.findFirst({
      where: { tenantId },
      include: { lines: true },
    });

    const order = await withCurrentTenantDb(prisma, async (client) => {
      const o = await (client as any).productionOrder.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          bomTemplate: { include: { lines: true, finishedItem: true } },
          warehouse: true,
        },
      });
      if (!o) throw Object.assign(new Error('Production order not found.'), { status: 404 });
      if (o.status !== 'IN_PROGRESS') throw Object.assign(new Error(`Cannot complete order with status ${o.status}.`), { status: 400 });

      const bom = o.bomTemplate;
      const warehouseId = o.warehouseId;
      const ratio = completedQty / Number(bom.outputQty);

      // Verify and decrement each component's stock atomically
      for (const line of bom.lines) {
        const requiredQty = Number(line.quantity) * ratio;
        const stock = await (client as any).warehouseStock.findUnique({
          where: { warehouseId_itemId: { warehouseId, itemId: line.componentItemId } },
        });
        if (!stock || Number(stock.quantityOnHand) < requiredQty) {
          throw Object.assign(
            new Error(`Insufficient stock for component item (available: ${stock?.quantityOnHand ?? 0}).`),
            { status: 400 }
          );
        }
        const deducted = await (client as any).warehouseStock.updateMany({
          where: { id: stock.id, quantityOnHand: { gte: requiredQty } },
          data: { quantityOnHand: { decrement: requiredQty } },
        });
        if (deducted.count === 0) {
          throw Object.assign(new Error('Concurrent stock change detected; please retry.'), { status: 409 });
        }
      }

      // Increment finished goods stock
      await (client as any).warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId, itemId: bom.finishedItemId } },
        update: { quantityOnHand: { increment: completedQty } },
        create: { tenantId, warehouseId, itemId: bom.finishedItemId, quantityOnHand: completedQty },
      });

      // Update the order
      return (client as any).productionOrder.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED', completedQty, completedAt: new Date() },
      });
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'UPDATE',
      entity: 'ProductionOrder',
      entityId: req.params.id,
      details: `Completed production order ${(order as any).orderNumber} — produced ${completedQty} units.`,
    });

    res.json({ success: true, order });
  } catch (err: any) {
    if (err?.status) { res.status(err.status).json({ success: false, error: err.message }); return; }
    console.error('[Manufacturing] complete production order error:', err);
    res.status(500).json({ success: false, error: 'Failed to complete production order.' });
  }
});

// PUT /manufacturing/production-orders/:id/cancel — DRAFT or IN_PROGRESS → CANCELLED
router.put('/production-orders/:id/cancel', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const order = await withCurrentTenantDb(prisma, async (client) => {
      const o = await (client as any).productionOrder.findFirst({ where: { id: req.params.id, tenantId } });
      if (!o) throw Object.assign(new Error('Production order not found.'), { status: 404 });
      if (o.status === 'COMPLETED' || o.status === 'CANCELLED') {
        throw Object.assign(new Error(`Cannot cancel order with status ${o.status}.`), { status: 400 });
      }
      return (client as any).productionOrder.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'UPDATE',
      entity: 'ProductionOrder',
      entityId: req.params.id,
      details: `Cancelled production order ${(order as any).orderNumber}.`,
    });

    res.json({ success: true, order });
  } catch (err: any) {
    if (err?.status) { res.status(err.status).json({ success: false, error: err.message }); return; }
    console.error('[Manufacturing] cancel production order error:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel production order.' });
  }
});

export default router;
