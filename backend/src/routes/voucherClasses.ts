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
router.use(requireTier(2, 'Voucher Classes'));

const createSchema = z.object({
  name: z.string().min(1).max(200),
  voucherType: z.enum(['PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL']),
  defaultDebitAccountId: z.string().uuid().optional().nullable(),
  defaultCreditAccountId: z.string().uuid().optional().nullable(),
  narrationTemplate: z.string().max(500).optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  voucherType: z.enum(['PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL']).optional(),
  defaultDebitAccountId: z.string().uuid().optional().nullable(),
  defaultCreditAccountId: z.string().uuid().optional().nullable(),
  narrationTemplate: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /voucher-classes
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { voucherType } = req.query;
    const where: any = { tenantId };
    if (voucherType) where.voucherType = voucherType;
    const classes = await (prisma as any).voucherClass.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: classes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /voucher-classes/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const vc = await (prisma as any).voucherClass.findFirst({ where: { id: req.params.id, tenantId } });
    if (!vc) return res.status(404).json({ success: false, error: 'Voucher class not found.' });
    res.json({ success: true, data: vc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /voucher-classes
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const vc = await (prisma as any).voucherClass.create({
      data: {
        tenantId,
        name: body.name,
        voucherType: body.voucherType,
        defaultDebitAccountId: body.defaultDebitAccountId,
        defaultCreditAccountId: body.defaultCreditAccountId,
        narrationTemplate: body.narrationTemplate,
      },
    });
    res.status(201).json({ success: true, data: vc });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /voucher-classes/:id
router.put('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const vc = await (prisma as any).voucherClass.findFirst({ where: { id: req.params.id, tenantId } });
    if (!vc) return res.status(404).json({ success: false, error: 'Voucher class not found.' });
    const body = updateSchema.parse(req.body);
    const updated = await (prisma as any).voucherClass.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.voucherType !== undefined && { voucherType: body.voucherType }),
        ...(body.defaultDebitAccountId !== undefined && { defaultDebitAccountId: body.defaultDebitAccountId }),
        ...(body.defaultCreditAccountId !== undefined && { defaultCreditAccountId: body.defaultCreditAccountId }),
        ...(body.narrationTemplate !== undefined && { narrationTemplate: body.narrationTemplate }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /voucher-classes/:id
router.delete('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const vc = await (prisma as any).voucherClass.findFirst({ where: { id: req.params.id, tenantId } });
    if (!vc) return res.status(404).json({ success: false, error: 'Voucher class not found.' });
    await (prisma as any).voucherClass.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
