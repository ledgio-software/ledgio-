import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { withCurrentTenantDb } from '../database/tenantClient';
import { recordAuditLogTx, AuditActor, AuditChanges } from '../services/auditLogService';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  inventoryItemId: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  customerId: z.string().uuid(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

function actorFromReq(req: any): AuditActor {
  return { userId: req.user?.id, userEmail: req.user?.email };
}

async function nextSoNumber(tenantId: string): Promise<string> {
  const last = await (prisma as any).salesOrder.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { soNumber: true },
  });
  if (!last) return 'SO-0001';
  const num = parseInt(last.soNumber.replace(/\D/g, ''), 10) || 0;
  return `SO-${String(num + 1).padStart(4, '0')}`;
}

// GET /sales-orders
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const where: any = { tenantId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      (prisma as any).salesOrder.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      (prisma as any).salesOrder.count({ where }),
    ]);

    res.json({ orders, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sales-orders/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).salesOrder.findFirst({
      where: { id: req.params.id, tenantId },
      include: { customer: true, lines: true },
    });
    if (!order) return res.status(404).json({ error: 'Sales order not found.' });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sales-orders
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const soNumber = await nextSoNumber(tenantId);
    const orderDate = body.orderDate ? new Date(body.orderDate) : new Date();

    // Load customer's price list for auto-pricing (same logic as invoices.ts)
    let priceListEntries: Map<string, { unitPrice: number; minQty: number }[]> = new Map();
    const customer = await (prisma as any).customer.findFirst({ where: { id: body.customerId, tenantId }, select: { priceListId: true } });
    if (customer?.priceListId) {
      const entries: any[] = await (prisma as any).priceListEntry.findMany({
        where: { priceListId: customer.priceListId, tenantId },
        orderBy: { minQty: 'asc' },
      });
      for (const e of entries) {
        const key = e.inventoryItemId as string;
        if (!priceListEntries.has(key)) priceListEntries.set(key, []);
        priceListEntries.get(key)!.push({ unitPrice: Number(e.unitPrice), minQty: e.minQty });
      }
    }

    const lines = body.lines.map((l: any) => {
      let unitPrice = l.unitPrice as number;
      if (unitPrice === 0 && l.inventoryItemId && priceListEntries.has(l.inventoryItemId)) {
        const tiers = priceListEntries.get(l.inventoryItemId)!;
        const applicable = tiers.filter((t) => l.quantity >= t.minQty);
        if (applicable.length > 0) unitPrice = applicable[applicable.length - 1].unitPrice;
      }
      return {
        tenantId,
        description: l.description,
        quantity: l.quantity,
        unitPrice,
        amount: Math.round(l.quantity * unitPrice * 100) / 100,
      };
    });

    const order = await (prisma as any).salesOrder.create({
      data: {
        tenantId,
        soNumber,
        customerId: body.customerId,
        orderDate,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        currency: body.currency,
        notes: body.notes,
        status: 'DRAFT',
        lines: { create: lines },
      },
      include: { customer: true, lines: true },
    });

    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'SALES_ORDER.CREATED',
        entity: 'SalesOrder',
        entityId: order.id,
        actor: actorFromReq(req),
        details: `Sales order ${soNumber} created.`,
      })
    );

    res.status(201).json(order);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    res.status(500).json({ error: err.message });
  }
});

// PUT /sales-orders/:id/confirm
router.put('/:id/confirm', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).salesOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ error: 'Sales order not found.' });
    if (order.status !== 'DRAFT') return res.status(400).json({ error: `Cannot confirm a ${order.status} sales order.` });

    const updated = await (prisma as any).salesOrder.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
    });

    const changes: AuditChanges = { status: { from: 'DRAFT', to: 'CONFIRMED' } };
    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'SALES_ORDER.CONFIRMED',
        entity: 'SalesOrder',
        entityId: order.id,
        actor: actorFromReq(req),
        changes,
        details: `Sales order ${order.soNumber} confirmed.`,
      })
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /sales-orders/:id/cancel
router.put('/:id/cancel', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).salesOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ error: 'Sales order not found.' });
    if (order.status === 'INVOICED') return res.status(400).json({ error: 'Cannot cancel a sales order that has already been invoiced.' });
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Sales order is already cancelled.' });

    const updated = await (prisma as any).salesOrder.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    const changes: AuditChanges = { status: { from: order.status, to: 'CANCELLED' } };
    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'SALES_ORDER.CANCELLED',
        entity: 'SalesOrder',
        entityId: order.id,
        actor: actorFromReq(req),
        changes,
        details: `Sales order ${order.soNumber} cancelled.`,
      })
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sales-orders/:id/convert-to-invoice
router.post('/:id/convert-to-invoice', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).salesOrder.findFirst({
      where: { id: req.params.id, tenantId },
      include: { lines: true, customer: true },
    });
    if (!order) return res.status(404).json({ error: 'Sales order not found.' });
    if (order.status !== 'CONFIRMED') return res.status(400).json({ error: 'Only CONFIRMED sales orders can be converted to an invoice.' });

    const lastInvoice = await withCurrentTenantDb(prisma, async (client) =>
      (client as any).invoice.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      })
    );
    const lastNum = lastInvoice?.invoiceNumber
      ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10) || 0
      : 0;
    const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`;

    const subtotal = order.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await withCurrentTenantDb(prisma, async (client) =>
      (client as any).invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          customerId: order.customerId,
          issueDate: new Date(),
          dueDate,
          currency: order.currency,
          subtotal,
          tax: 0,
          total: subtotal,
          status: 'SENT',
          salesOrderId: order.id,
          items: {
            create: order.lines.map((l: any) => ({
              tenantId,
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              amount: Number(l.amount),
            })),
          },
        },
        include: { customer: true, items: true },
      })
    );

    await (prisma as any).salesOrder.update({
      where: { id: order.id },
      data: { status: 'INVOICED', invoiceId: invoice.id },
    });

    const changes: AuditChanges = { status: { from: 'CONFIRMED', to: 'INVOICED' } };
    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'SALES_ORDER.INVOICED',
        entity: 'SalesOrder',
        entityId: order.id,
        actor: actorFromReq(req),
        changes,
        details: `Sales order ${order.soNumber} converted to invoice ${invoiceNumber}.`,
      })
    );

    res.status(201).json({ invoice, salesOrder: { ...order, status: 'INVOICED', invoiceId: invoice.id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
