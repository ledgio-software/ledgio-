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
router.use(requireTier(2, 'Job Work Orders'));

const createSchema = z.object({
  jobId: z.string().uuid().optional().nullable(),
  type: z.enum(['IN', 'OUT']),
  vendorId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  dueDate: z.string().optional().nullable(),
});

// GET /job-work-orders
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { jobId, status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const where: any = { tenantId };
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [orders, total] = await Promise.all([
      (prisma as any).jobWorkOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(pageSize) }),
      (prisma as any).jobWorkOrder.count({ where }),
    ]);
    res.json({ success: true, data: orders, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /job-work-orders/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).jobWorkOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ success: false, error: 'Work order not found.' });
    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /job-work-orders
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const order = await (prisma as any).jobWorkOrder.create({
      data: {
        tenantId,
        jobId: body.jobId,
        type: body.type,
        vendorId: body.vendorId,
        itemId: body.itemId,
        quantity: body.quantity,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        status: 'PENDING',
      },
    });
    res.status(201).json({ success: true, data: order });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /job-work-orders/:id/receive — mark goods received (for OUT orders coming back)
router.patch('/:id/receive', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).jobWorkOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ success: false, error: 'Work order not found.' });
    if (order.status === 'RECEIVED') return res.status(400).json({ success: false, error: 'Already received.' });
    const { billId } = z.object({ billId: z.string().uuid().optional().nullable() }).parse(req.body);
    const updated = await (prisma as any).jobWorkOrder.update({
      where: { id: req.params.id },
      data: { status: 'RECEIVED', ...(billId ? { billId } : {}) },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /job-work-orders/:id/send — mark as SENT (goods dispatched to sub-contractor)
router.patch('/:id/send', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).jobWorkOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ success: false, error: 'Work order not found.' });
    if (order.status !== 'PENDING') return res.status(400).json({ success: false, error: `Cannot send a ${order.status} work order.` });
    const updated = await (prisma as any).jobWorkOrder.update({ where: { id: req.params.id }, data: { status: 'SENT' } });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /job-work-orders/:id/cancel
router.patch('/:id/cancel', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const order = await (prisma as any).jobWorkOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!order) return res.status(404).json({ success: false, error: 'Work order not found.' });
    await (prisma as any).jobWorkOrder.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
