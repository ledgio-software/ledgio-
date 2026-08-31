import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { withCurrentTenantDb } from '../database/tenantClient';
import { recordAuditLogTx, AuditActor, AuditChanges } from '../services/auditLogService';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);
router.use(requireTier(2, 'Delivery Notes & GRN'));

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
});

const createSchema = z.object({
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  vendorBillId: z.string().uuid().optional(),
  receiptDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

function actorFromReq(req: any): AuditActor {
  return { userId: req.user?.id, userEmail: req.user?.email };
}

async function nextGrnNumber(tenantId: string): Promise<string> {
  const last = await (prisma as any).goodsReceiptNote.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { grnNumber: true },
  });
  if (!last) return 'GRN-0001';
  const num = parseInt(last.grnNumber.replace(/\D/g, ''), 10) || 0;
  return `GRN-${String(num + 1).padStart(4, '0')}`;
}

// GET /goods-receipt-notes
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const where: any = { tenantId };
    if (status) where.status = status;

    const [notes, total] = await Promise.all([
      (prisma as any).goodsReceiptNote.findMany({
        where,
        include: { vendor: { select: { id: true, name: true } }, lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      (prisma as any).goodsReceiptNote.count({ where }),
    ]);

    res.json({ notes, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /goods-receipt-notes/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const note = await (prisma as any).goodsReceiptNote.findFirst({
      where: { id: req.params.id, tenantId },
      include: { vendor: true, lines: true },
    });
    if (!note) return res.status(404).json({ error: 'Goods receipt note not found.' });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /goods-receipt-notes
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const grnNumber = await nextGrnNumber(tenantId);

    const note = await (prisma as any).goodsReceiptNote.create({
      data: {
        tenantId,
        grnNumber,
        vendorId: body.vendorId,
        purchaseOrderId: body.purchaseOrderId,
        vendorBillId: body.vendorBillId,
        receiptDate: body.receiptDate ? new Date(body.receiptDate) : undefined,
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
      include: { vendor: true, lines: true },
    });

    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'GRN.CREATED',
        entity: 'GoodsReceiptNote',
        entityId: note.id,
        actor: actorFromReq(req),
        details: `Goods receipt note ${grnNumber} created.`,
      })
    );

    res.status(201).json(note);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    res.status(500).json({ error: err.message });
  }
});

// PUT /goods-receipt-notes/:id/receive
router.put('/:id/receive', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const note = await (prisma as any).goodsReceiptNote.findFirst({ where: { id: req.params.id, tenantId } });
    if (!note) return res.status(404).json({ error: 'Goods receipt note not found.' });
    if (note.status !== 'DRAFT') return res.status(400).json({ error: `Cannot receive a ${note.status} GRN.` });

    const updated = await (prisma as any).goodsReceiptNote.update({
      where: { id: req.params.id },
      data: { status: 'RECEIVED', receiptDate: note.receiptDate ?? new Date() },
    });

    const changes: AuditChanges = { status: { from: 'DRAFT', to: 'RECEIVED' } };
    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'GRN.RECEIVED',
        entity: 'GoodsReceiptNote',
        entityId: note.id,
        actor: actorFromReq(req),
        changes,
        details: `Goods receipt note ${note.grnNumber} marked as received.`,
      })
    );

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
