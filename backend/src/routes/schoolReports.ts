import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';

const router = Router();

/**
 * GET /api/v1/school/reports/fee-defaulters?termId=
 * Returns students with outstanding balances (unpaid or partially paid) for the term.
 */
router.get('/fee-defaulters', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };

    let resolvedTermId = termId;
    if (!resolvedTermId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { tenantId, isCurrent: true },
        select: { id: true, name: true },
      });
      resolvedTermId = currentTerm?.id;
    }

    if (!resolvedTermId) {
      res.json({ success: true, data: { defaulters: [], termId: null } });
      return;
    }

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { schoolConfig: true } });
    const schoolConfig = tenant?.schoolConfig ? JSON.parse(tenant.schoolConfig) : {};
    const lateFine: { enabled: boolean; ratePerDay: number; graceDays: number } =
      schoolConfig.lateFine ?? { enabled: false, ratePerDay: 0, graceDays: 0 };

    const [students, schedules, termInvoices] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ className: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId: resolvedTermId } }),
      prisma.invoice.findMany({
        where: {
          tenantId,
          clientTxnId: { startsWith: 'SF:' },
          status: { not: 'VOIDED' },
        },
        select: { id: true, clientTxnId: true, status: true, total: true, amountPaid: true, dueDate: true },
      }),
    ]);

    const scheduleSet = new Set(schedules.map((s) => s.id));
    const invoicesByStudent = new Map<string, typeof termInvoices>();
    for (const inv of termInvoices) {
      const m = inv.clientTxnId?.match(/^SF:([a-z0-9-]+):([a-z0-9-]+)$/i);
      if (!m || !scheduleSet.has(m[1])) continue;
      const sid = m[2];
      if (!invoicesByStudent.has(sid)) invoicesByStudent.set(sid, []);
      invoicesByStudent.get(sid)!.push(inv);
    }

    const defaulters = [];
    for (const student of students) {
      const mySchedules = schedules.filter((s) => !s.className || s.className === student.className);
      const myInvoices = invoicesByStudent.get(student.id) ?? [];
      if (mySchedules.length === 0 || myInvoices.length === 0) continue;
      const totalOwed = mySchedules.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalPaid = myInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
      const balance = totalOwed - totalPaid;
      if (balance <= 0) continue;

      const daysOverdue = myInvoices.reduce((max, inv) => {
        if (!inv.dueDate) return max;
        const d = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
        return Math.max(max, d);
      }, 0);

      const effectiveDaysOverdue = Math.max(0, daysOverdue - lateFine.graceDays);
      const lateFineAmount =
        lateFine.enabled && effectiveDaysOverdue > 0
          ? Math.round(balance * lateFine.ratePerDay * effectiveDaysOverdue * 100) / 100
          : 0;

      defaulters.push({
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
        balance,
        daysOverdue: Math.max(0, daysOverdue),
        lateFineAmount,
        totalDue: balance + lateFineAmount,
        paymentStatus: totalPaid > 0 ? 'partial' : 'unpaid',
      });
    }

    res.json({ success: true, data: { termId: resolvedTermId, defaulters, lateFineConfig: lateFine } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/school/reports/demand-vs-collection?termId=
 * Returns demand (expected) vs actual collection per fee schedule for the term.
 */
router.get('/demand-vs-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };

    let resolvedTermId = termId;
    if (!resolvedTermId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { tenantId, isCurrent: true },
        select: { id: true },
      });
      resolvedTermId = currentTerm?.id;
    }

    if (!resolvedTermId) {
      res.json({ success: true, data: { rows: [], totals: { demand: 0, collected: 0, balance: 0 }, termId: null } });
      return;
    }

    const [students, schedules] = await Promise.all([
      prisma.student.findMany({ where: { tenantId, isActive: true } }),
      prisma.feeSchedule.findMany({
        where: { tenantId, termId: resolvedTermId },
        include: { term: true },
      }),
    ]);

    const rows = await Promise.all(
      schedules.map(async (schedule) => {
        const eligibleStudents = students.filter(
          (s) => !schedule.className || s.className === schedule.className
        );
        const demand = eligibleStudents.length * Number(schedule.amount);

        const invoices = await prisma.invoice.findMany({
          where: {
            tenantId,
            clientTxnId: { startsWith: `SF:${schedule.id}:` },
            status: { not: 'VOIDED' },
          },
          select: { amountPaid: true, status: true },
        });

        const collected = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
        const invoiceCount = invoices.length;
        const paidCount = invoices.filter((inv) => inv.status === 'PAID').length;

        return {
          scheduleId: schedule.id,
          feeName: schedule.feeName,
          className: schedule.className ?? 'All Classes',
          dueDate: schedule.dueDate ?? schedule.term.endDate,
          eligibleStudents: eligibleStudents.length,
          invoicesGenerated: invoiceCount,
          demand,
          collected,
          balance: demand - collected,
          collectionRate: demand > 0 ? Math.round((collected / demand) * 100) : 0,
          paidCount,
        };
      })
    );

    const totals = rows.reduce(
      (acc, r) => ({ demand: acc.demand + r.demand, collected: acc.collected + r.collected, balance: acc.balance + r.balance }),
      { demand: 0, collected: 0, balance: 0 }
    );

    res.json({ success: true, data: { termId: resolvedTermId, rows, totals } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/school/reports/student-ledger/:studentId
 * Returns full payment history for a student across all terms.
 */
router.get('/student-ledger/:studentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId } = req.params;

    const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }

    // All school-fee invoices for this student
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        clientTxnId: { contains: `:${studentId}` },
        status: { not: 'VOIDED' },
      },
      include: {
        payments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, amount: true, method: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // For each invoice resolve schedule + term info via clientTxnId
    const scheduleIds = invoices
      .map((inv) => inv.clientTxnId?.match(/^SF:([a-z0-9-]+):/i)?.[1])
      .filter(Boolean) as string[];

    const schedules = scheduleIds.length
      ? await prisma.feeSchedule.findMany({
          where: { id: { in: scheduleIds }, tenantId },
          include: { term: true },
        })
      : [];
    const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

    const ledger = invoices.map((inv) => {
      const sid = inv.clientTxnId?.match(/^SF:([a-z0-9-]+):/i)?.[1];
      const schedule = sid ? scheduleMap.get(sid) : undefined;
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeName: schedule?.feeName ?? 'School Fee',
        termName: schedule?.term?.name ?? '—',
        academicYear: schedule?.term?.academicYear ?? '—',
        dueDate: inv.dueDate,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        balance: Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
        status: inv.status,
        payments: inv.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.createdAt,
        })),
      };
    });

    const totalCharged = ledger.reduce((sum, r) => sum + r.total, 0);
    const totalPaid = ledger.reduce((sum, r) => sum + r.amountPaid, 0);

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.className,
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
        },
        ledger,
        summary: { totalCharged, totalPaid, balance: Math.max(0, totalCharged - totalPaid) },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
