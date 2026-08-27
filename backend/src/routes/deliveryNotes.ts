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
});

const createSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  dispatchDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

function actorFromReq(req: any): AuditActor {
  return { userId: req.user?.id, userEmail: req.user?.email };
}

async function nextDnNumber(tenantId: string): Promise<string> {
  const last = await (prisma as any).deliveryNote.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { dnNumber: true },
  });
  if (!last) return 'DN-0001';
  const num = parseInt(last.dnNumber.replace(/\D/g, ''), 10) || 0;
  return `DN-${String(num + 1).padStart(4, '0')}`;
}

// GET /delivery-notes
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const where: any = { tenantId };
    if (status) where.status = status;

    const [notes, total] = await Promise.all([
      (prisma as any).deliveryNote.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      (prisma as any).deliveryNote.count({ where }),
    ]);

    res.json({ notes, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /delivery-notes/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const note = await (prisma as any).deliveryNote.findFirst({
      where: { id: req.params.id, tenantId },
      include: { customer: true, lines: true },
    });
    if (!note) return res.status(404).json({ error: 'Delivery note not found.' });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /delivery-notes
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const dnNumber = await nextDnNumber(tenantId);

    const note = await (prisma as any).deliveryNote.create({
      data: {
        tenantId,
        dnNumber,
        customerId: body.customerId,
        invoiceId: body.invoiceId,
        salesOrderId: body.salesOrderId,
        dispatchDate: body.dispatchDate ? new Date(body.dispatchDate) : undefined,
        notes: body.notes,
        status: 'DRAFT',
        lines: {
          create: body.lines.map((l) => ({
            tenantId,
            description: l.description,
            quantity: l.quantity,
          })),
        },
      },
      include: { customer: true, lines: true },
    });

    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'DELIVERY_NOTE.CREATED',
        entity: 'DeliveryNote',
        entityId: note.id,
        actor: actorFromReq(req),
        details: `Delivery note ${dnNumber} created.`,
      })
    );

    res.status(201).json(note);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    res.status(500).json({ error: err.message });
  }
});

// PUT /delivery-notes/:id/dispatch
router.put('/:id/dispatch', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const note = await (prisma as any).deliveryNote.findFirst({ where: { id: req.params.id, tenantId } });
    if (!note) return res.status(404).json({ error: 'Delivery note not found.' });
    if (note.status !== 'DRAFT') return res.status(400).json({ error: `Cannot dispatch a ${note.status} delivery note.` });

    const updated = await (prisma as any).deliveryNote.update({
      where: { id: req.params.id },
      data: { status: 'DISPATCHED', dispatchDate: note.dispatchDate ?? new Date() },
    });

    const changes: AuditChanges = { status: { from: 'DRAFT', to: 'DISPATCHED' } };
    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'DELIVERY_NOTE.DISPATCHED',
        entity: 'DeliveryNote',
        entityId: note.id,
        actor: actorFromReq(req),
        changes,
        details: `Delivery note ${note.dnNumber} dispatched.`,
      })
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
