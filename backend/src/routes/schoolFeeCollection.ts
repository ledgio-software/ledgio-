import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';
import { actorFromRequest } from '../services/auditLogService';
import { recordInvoicePayment } from '../services/invoicePaymentService';

const router = Router();

/**
 * GET /api/v1/school/fee-collection?termId=
 * Returns per-student fee payment status for the given term.
 * For each student: lists all fee schedules for their class,
 * and the invoice status (PAID / PARTIALLY_PAID / SENT/unpaid / not generated).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };

    // Resolve term — default to current term
    let resolvedTermId = termId;
    if (!resolvedTermId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { tenantId, isCurrent: true },
        select: { id: true },
      });
      resolvedTermId = currentTerm?.id;
    }

    if (!resolvedTermId) {
      res.json({ success: true, data: { students: [], summary: { total: 0, paid: 0, partial: 0, unpaid: 0, notGenerated: 0 } } });
      return;
    }

    const [students, schedules, termInvoices] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ className: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.feeSchedule.findMany({
        where: { tenantId, termId: resolvedTermId },
      }),
      // All school-fee invoices for this term (clientTxnId starts with 'SF:')
      prisma.invoice.findMany({
        where: {
          tenantId,
          clientTxnId: { startsWith: 'SF:' },
          status: { not: 'VOIDED' },
        },
        select: { id: true, clientTxnId: true, status: true, total: true, amountPaid: true, dueDate: true },
      }),
    ]);

    // Index invoices by studentId
    const invoicesByStudent = new Map<string, typeof termInvoices>();
    for (const inv of termInvoices) {
      // clientTxnId format: SF:{scheduleId}:{studentId}
      const scheduleIdMatch = inv.clientTxnId?.match(/^SF:([a-z0-9-]+):/i);
      if (!scheduleIdMatch) continue;
      const scheduleId = scheduleIdMatch[1];
      if (!schedules.find((s) => s.id === scheduleId)) continue;

      const studentIdMatch = inv.clientTxnId?.match(/^SF:[a-z0-9-]+:([a-z0-9-]+)$/i);
      if (!studentIdMatch) continue;
      const sid = studentIdMatch[1];
      if (!invoicesByStudent.has(sid)) invoicesByStudent.set(sid, []);
      invoicesByStudent.get(sid)!.push(inv);
    }

    const summary = { total: students.length, paid: 0, partial: 0, unpaid: 0, notGenerated: 0 };

    const rows = students.map((student) => {
      const mySchedules = schedules.filter(
        (s) => !s.className || s.className === student.className
      );
      const myInvoices = invoicesByStudent.get(student.id) ?? [];
      const totalOwed = mySchedules.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalPaid = myInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);

      let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'not_generated';
      if (mySchedules.length === 0 || myInvoices.length === 0) {
        paymentStatus = mySchedules.length === 0 ? 'paid' : 'not_generated';
      } else if (totalPaid >= totalOwed && totalOwed > 0) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'unpaid';
      }

      if (paymentStatus === 'paid') summary.paid++;
      else if (paymentStatus === 'partial') summary.partial++;
      else if (paymentStatus === 'unpaid') summary.unpaid++;
      else if (paymentStatus === 'not_generated') summary.notGenerated++;

      return {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.className,
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
        },
        totalOwed,
        totalPaid,
        balance: Math.max(0, totalOwed - totalPaid),
        paymentStatus,
        invoices: myInvoices.map((inv) => ({
          id: inv.id,
          status: inv.status,
          total: Number(inv.total),
          amountPaid: Number(inv.amountPaid),
          dueDate: inv.dueDate,
        })),
      };
    });

    res.json({ success: true, data: { termId: resolvedTermId, students: rows, summary } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const VALID_MODES = new Set(['CASH', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER']);

/**
 * POST /api/v1/school/fee-collection/collect
 * Record a fee payment for a student for the given term.
 * Applies the payment to the student's outstanding school-fee invoices
 * (oldest first) until the amount is exhausted.
 */
router.post('/collect', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const actor = actorFromRequest(req);
    const { studentId, termId, amount, paymentMode } = req.body;

    if (!studentId || !termId || amount === undefined) {
      res.status(400).json({ success: false, error: 'studentId, termId, and amount are required.' });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, error: 'amount must be a positive number.' });
      return;
    }
    const mode = (paymentMode || 'CASH') as string;
    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ success: false, error: `paymentMode must be one of: ${[...VALID_MODES].join(', ')}` });
      return;
    }

    // Validate student and term belong to this tenant
    const [student, schedules] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId } }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId } }),
    ]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    if (schedules.length === 0) {
      res.status(404).json({ success: false, error: 'No fee schedules found for this term.' });
      return;
    }

    const scheduleIds = schedules.map((s) => s.id);

    // Find all unpaid/partial school fee invoices for this student+term
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        clientTxnId: { in: scheduleIds.map((sid) => `SF:${sid}:${studentId}`) },
        status: { notIn: ['PAID', 'VOIDED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (invoices.length === 0) {
      res.status(400).json({ success: false, error: 'No outstanding invoices found for this student in this term.' });
      return;
    }

    let remaining = numAmount;
    const results: { invoiceId: string; paid: number }[] = [];

    for (const inv of invoices) {
      if (remaining <= 0) break;
      const balance = Number(inv.total) - Number(inv.amountPaid);
      if (balance <= 0) continue;
      const toPay = Math.min(remaining, balance);
      await recordInvoicePayment(inv.id, actor, {
        amount: toPay,
        method: mode as any,
        description: `School fee payment — ${student.firstName} ${student.lastName} (${student.className})`,
      });
      results.push({ invoiceId: inv.id, paid: toPay });
      remaining -= toPay;
    }

    const totalPaid = numAmount - remaining;
    res.json({
      success: true,
      totalPaid,
      change: Math.max(0, remaining),
      invoicesUpdated: results.length,
      message: `Payment of GHS ${totalPaid.toFixed(2)} recorded via ${mode.replace('_', ' ')}.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
