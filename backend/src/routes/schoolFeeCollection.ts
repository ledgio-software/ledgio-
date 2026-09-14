import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';

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
      // All school-fee invoices for this term
      prisma.invoice.findMany({
        where: {
          tenantId,
          notes: { contains: `[SCHOOL-FEE:` },
          status: { not: 'VOIDED' },
        },
        select: { id: true, notes: true, status: true, total: true, amountPaid: true, dueDate: true },
      }),
    ]);

    // Index invoices by studentId
    const invoicesByStudent = new Map<string, typeof termInvoices>();
    for (const inv of termInvoices) {
      // Filter to this term's schedules only
      const scheduleIdMatch = inv.notes?.match(/\[SCHOOL-FEE:([a-z0-9-]+)\]/i);
      if (!scheduleIdMatch) continue;
      const scheduleId = scheduleIdMatch[1];
      if (!schedules.find((s) => s.id === scheduleId)) continue;

      const studentIdMatch = inv.notes?.match(/STUDENT:([a-z0-9-]+)/i);
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

export default router;
