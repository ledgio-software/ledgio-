import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const VALID_MODES = new Set(['CASH', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER', 'WAIVER']);
const VALID_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'CANCELLED']);

function resolveInstallmentStatuses(installments: { amount: number; amountPaid: number; dueDate: Date; status: string }[]) {
  const now = new Date();
  return installments.map((inst) => {
    if (inst.amountPaid >= inst.amount) return { ...inst, status: 'PAID' };
    if (inst.amountPaid > 0) return { ...inst, status: 'PARTIAL' };
    if (inst.dueDate < now) return { ...inst, status: 'OVERDUE' };
    return { ...inst, status: 'PENDING' };
  });
}

// GET /api/v1/school/fee-payment-plans?termId=&studentId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, studentId } = req.query as { termId?: string; studentId?: string };

    const plans = await prisma.feePaymentPlan.findMany({
      where: {
        tenantId,
        ...(termId && { termId }),
        ...(studentId && { studentId }),
      },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const data = plans.map((plan) => {
      const installments = resolveInstallmentStatuses(
        plan.installments.map((i) => ({
          ...i,
          amount: Number(i.amount),
          amountPaid: Number(i.amountPaid),
        }))
      );
      const totalPaid = installments.reduce((s, i) => s + i.amountPaid, 0);
      const totalAmount = Number(plan.totalAmount);
      const status = totalPaid >= totalAmount ? 'COMPLETED' : plan.status;
      return { ...plan, totalAmount, installments, totalPaid, balance: Math.max(0, totalAmount - totalPaid), status };
    });

    res.json({ success: true, data: { plans: data } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/fee-payment-plans
// Body: { studentId, termId, scheduleId, totalAmount, installments: [{ dueDate, amount }], notes? }
router.post('/', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, termId, scheduleId, totalAmount, installments, notes } = req.body as {
      studentId: string;
      termId: string;
      scheduleId: string;
      totalAmount: number;
      installments: { dueDate: string; amount: number }[];
      notes?: string;
    };

    if (!studentId || !termId || !scheduleId || totalAmount === undefined) {
      res.status(400).json({ success: false, error: 'studentId, termId, scheduleId and totalAmount are required.' });
      return;
    }
    if (!Array.isArray(installments) || installments.length === 0) {
      res.status(400).json({ success: false, error: 'installments must be a non-empty array.' });
      return;
    }
    for (const inst of installments) {
      if (!inst.dueDate || inst.amount === undefined || Number(inst.amount) <= 0) {
        res.status(400).json({ success: false, error: 'Each installment requires a dueDate and a positive amount.' });
        return;
      }
    }
    const instTotal = installments.reduce((s, i) => s + Number(i.amount), 0);
    if (Math.abs(instTotal - Number(totalAmount)) > 0.01) {
      res.status(400).json({ success: false, error: `Installment amounts (${instTotal}) must sum to totalAmount (${totalAmount}).` });
      return;
    }

    // Verify student + schedule belong to this tenant
    const [student, schedule] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId }, select: { id: true } }),
      prisma.feeSchedule.findFirst({ where: { id: scheduleId, tenantId }, select: { id: true } }),
    ]);
    if (!student) { res.status(404).json({ success: false, error: 'Student not found.' }); return; }
    if (!schedule) { res.status(404).json({ success: false, error: 'Fee schedule not found.' }); return; }

    const plan = await prisma.feePaymentPlan.create({
      data: {
        tenantId,
        studentId,
        termId,
        scheduleId,
        totalAmount,
        notes: notes ?? null,
        status: 'ACTIVE',
        installments: {
          create: installments.map((i) => ({
            dueDate: new Date(i.dueDate),
            amount: i.amount,
            amountPaid: 0,
            status: 'PENDING',
          })),
        },
      },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });

    res.status(201).json({ success: true, data: { plan } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/fee-payment-plans/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const plan = await prisma.feePaymentPlan.findFirst({
      where: { id: req.params.id, tenantId },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });
    if (!plan) { res.status(404).json({ success: false, error: 'Payment plan not found.' }); return; }

    const installments = resolveInstallmentStatuses(
      plan.installments.map((i) => ({ ...i, amount: Number(i.amount), amountPaid: Number(i.amountPaid) }))
    );
    const totalPaid = installments.reduce((s, i) => s + i.amountPaid, 0);
    const totalAmount = Number(plan.totalAmount);
    res.json({
      success: true,
      data: { plan: { ...plan, totalAmount, installments, totalPaid, balance: Math.max(0, totalAmount - totalPaid) } },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/fee-payment-plans/:id  (cancel — only if no payments made)
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const plan = await prisma.feePaymentPlan.findFirst({
      where: { id: req.params.id, tenantId },
      include: { installments: true },
    });
    if (!plan) { res.status(404).json({ success: false, error: 'Payment plan not found.' }); return; }

    const anyPaid = plan.installments.some((i) => Number(i.amountPaid) > 0);
    if (anyPaid) {
      // Soft-cancel instead of delete
      await prisma.feePaymentPlan.update({ where: { id: plan.id }, data: { status: 'CANCELLED' } });
      res.json({ success: true, data: { cancelled: true } });
      return;
    }
    await prisma.feePaymentPlan.delete({ where: { id: plan.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Payment plan not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/fee-payment-plans/:id/installments/:instId/pay
// Body: { amount, paymentMode?, notes? }
router.post('/:id/installments/:instId/pay', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const plan = await prisma.feePaymentPlan.findFirst({
      where: { id: req.params.id, tenantId },
      include: { installments: true },
    });
    if (!plan) { res.status(404).json({ success: false, error: 'Payment plan not found.' }); return; }

    const inst = plan.installments.find((i) => i.id === req.params.instId);
    if (!inst) { res.status(404).json({ success: false, error: 'Installment not found.' }); return; }

    const { amount, paymentMode, notes } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, error: 'amount must be a positive number.' });
      return;
    }
    const mode = paymentMode ?? 'CASH';
    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ success: false, error: `paymentMode must be one of: ${[...VALID_MODES].join(', ')}` });
      return;
    }

    const currentPaid = Number(inst.amountPaid);
    const instAmount = Number(inst.amount);
    const newPaid = Math.min(currentPaid + numAmount, instAmount);
    const newStatus = newPaid >= instAmount ? 'PAID' : 'PARTIAL';

    await prisma.feeInstallment.update({
      where: { id: inst.id },
      data: {
        amountPaid: newPaid,
        status: newStatus,
        paidAt: newStatus === 'PAID' ? new Date() : inst.paidAt,
        paymentMode: mode,
        notes: notes ?? inst.notes,
        updatedAt: new Date(),
      },
    });

    // Check if all installments are now paid → mark plan COMPLETED
    const allInstallments = await prisma.feeInstallment.findMany({ where: { planId: plan.id } });
    const allPaid = allInstallments.every((i) => i.id === inst.id ? newStatus === 'PAID' : Number(i.amountPaid) >= Number(i.amount));
    if (allPaid && plan.status === 'ACTIVE') {
      await prisma.feePaymentPlan.update({ where: { id: plan.id }, data: { status: 'COMPLETED' } });
    }

    const updatedPlan = await prisma.feePaymentPlan.findFirst({
      where: { id: plan.id },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });
    const installments = resolveInstallmentStatuses(
      updatedPlan!.installments.map((i) => ({ ...i, amount: Number(i.amount), amountPaid: Number(i.amountPaid) }))
    );
    const totalPaid = installments.reduce((s, i) => s + i.amountPaid, 0);
    const totalAmount = Number(updatedPlan!.totalAmount);
    res.json({
      success: true,
      data: { plan: { ...updatedPlan, totalAmount, installments, totalPaid, balance: Math.max(0, totalAmount - totalPaid) } },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/fee-payment-plans/upcoming?days=14
// Lists installments due within N days (default 14) across all active plans
router.get('/upcoming/due', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const days = Math.min(90, Math.max(1, parseInt((req.query.days as string) || '14', 10)));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const installments = await prisma.feeInstallment.findMany({
      where: {
        plan: { tenantId, status: 'ACTIVE' },
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        dueDate: { lte: cutoff },
      },
      include: {
        plan: {
          include: {
            installments: false,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: { installments } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
