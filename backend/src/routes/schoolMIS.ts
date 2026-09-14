import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';

const router = Router();

// GET /api/v1/school/mis?termId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };

    // Total students
    const [totalStudents, activeStudents] = await Promise.all([
      prisma.student.count({ where: { tenantId } }),
      prisma.student.count({ where: { tenantId, isActive: true } }),
    ]);

    // Students by class
    const studentsByClass = await prisma.student.groupBy({
      by: ['className'],
      where: { tenantId, isActive: true },
      _count: { id: true },
      orderBy: { className: 'asc' },
    });

    const byClass = studentsByClass.map((r) => ({ className: r.className, count: r._count.id }));

    // Fee stats for the selected term
    let totalFeesDemand = 0;
    let totalFeesCollected = 0;
    let totalDefaulters = 0;

    if (termId) {
      const [schedules, collections] = await Promise.all([
        prisma.feeSchedule.findMany({ where: { tenantId, termId }, select: { amount: true } }),
        prisma.$queryRawUnsafe<Array<{ total_paid: string }>>(
          `SELECT COALESCE(SUM(amount_paid), 0)::text AS total_paid FROM fee_collection_records WHERE tenant_id = $1 AND term_id = $2`,
          tenantId, termId
        ).catch(() => [{ total_paid: '0' }]),
      ]);

      totalFeesDemand = schedules.reduce((s, sc) => s + Number(sc.amount), 0);
      totalFeesCollected = Number((collections[0] as any)?.total_paid ?? 0);

      // Count defaulters: students with unpaid fees
      const studentCount = await prisma.student.count({ where: { tenantId, isActive: true } });
      totalDefaulters = Math.max(0, studentCount - Math.floor(totalFeesCollected / (totalFeesDemand / Math.max(studentCount, 1))));
    }

    const collectionRate = totalFeesDemand > 0 ? Math.round((totalFeesCollected / totalFeesDemand) * 100) : 0;

    // Attendance summary
    const attendanceFilter = termId ? { tenantId, termId } : { tenantId };
    const [totalAttendance, presentAttendance] = await Promise.all([
      prisma.schoolAttendance.count({ where: attendanceFilter }),
      prisma.schoolAttendance.count({ where: { ...attendanceFilter, status: 'PRESENT' } }),
    ]);

    const avgAttendanceRate = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;
    const totalDaysRecorded = totalAttendance;

    // Assessment summary
    const assessmentFilter = termId ? { tenantId, termId } : { tenantId };
    const assessments = await prisma.studentAssessment.findMany({
      where: assessmentFilter,
      select: { score: true, maxScore: true, studentId: true },
    });

    let avgScore = 0;
    if (assessments.length > 0) {
      const totalPct = assessments.reduce((s, a) => {
        const mx = Number(a.maxScore);
        return s + (mx > 0 ? (Number(a.score) / mx) * 100 : 0);
      }, 0);
      avgScore = Math.round(totalPct / assessments.length);
    }

    // Admissions summary
    const [pendingAdmissions, acceptedAdmissions, enrolledAdmissions] = await Promise.all([
      prisma.admission.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.admission.count({ where: { tenantId, status: 'ACCEPTED' } }),
      prisma.admission.count({ where: { tenantId, status: 'ENROLLED' } }),
    ]);

    // Upcoming events (next 30 days)
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingEvents = await prisma.schoolEvent.findMany({
      where: { tenantId, eventDate: { gte: now, lte: in30 } },
      orderBy: { eventDate: 'asc' },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        byClass,
        totalFeesDemand,
        totalFeesCollected,
        collectionRate,
        totalDefaulters,
        attendanceSummary: { avgAttendanceRate, totalDaysRecorded },
        assessmentSummary: { avgScore },
        admissionsSummary: { pending: pendingAdmissions, accepted: acceptedAdmissions, enrolled: enrolledAdmissions },
        upcomingEvents,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
