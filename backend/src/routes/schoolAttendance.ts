import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

// GET /api/v1/school/attendance?date=&className=&termId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { date, className, termId } = req.query as { date?: string; className?: string; termId?: string };

    if (!date) {
      res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
      return;
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid date format' });
      return;
    }

    // Fetch students for the class
    const students = await prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(className ? { className } : {}),
      },
      orderBy: [{ className: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    // Fetch attendance records for these students on this date
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const attendanceRecords = await prisma.schoolAttendance.findMany({
      where: {
        tenantId,
        date: { gte: startOfDay, lte: endOfDay },
        ...(termId ? { termId } : {}),
        studentId: { in: students.map((s) => s.id) },
      },
    });

    const attendanceMap: Record<string, { id: string; status: string; note: string | null }> = {};
    for (const r of attendanceRecords) {
      attendanceMap[r.studentId] = { id: r.id, status: r.status, note: r.note };
    }

    const rows = students.map((s) => ({
      student: {
        id: s.id,
        studentCode: s.studentCode,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.className,
      },
      attendance: attendanceMap[s.id] ?? null,
    }));

    res.json({ success: true, data: { rows, date, className: className ?? null } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/attendance/summary?termId=&className=
// Returns per-student attendance totals for the term (for the summary report).
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, className } = req.query as { termId?: string; className?: string };

    if (!termId) {
      res.status(400).json({ success: false, error: 'termId is required' });
      return;
    }

    const students = await prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(className ? { className } : {}),
      },
      orderBy: [{ className: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    if (students.length === 0) {
      res.json({ success: true, data: { rows: [] } });
      return;
    }

    const attendanceRecords = await prisma.schoolAttendance.findMany({
      where: {
        tenantId,
        termId,
        studentId: { in: students.map((s) => s.id) },
      },
      select: { studentId: true, status: true },
    });

    // Aggregate per student
    const counts = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const r of attendanceRecords) {
      const entry = counts.get(r.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      if (r.status === 'PRESENT') entry.present++;
      else if (r.status === 'ABSENT') entry.absent++;
      else if (r.status === 'LATE') entry.late++;
      else if (r.status === 'EXCUSED') entry.excused++;
      counts.set(r.studentId, entry);
    }

    const rows = students.map((s) => {
      const c = counts.get(s.id) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      const total = c.present + c.absent + c.late + c.excused;
      const attendanceRate = total > 0 ? Math.round((c.present / total) * 1000) / 10 : 0;
      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        studentCode: s.studentCode,
        className: s.className,
        present: c.present,
        absent: c.absent,
        late: c.late,
        excused: c.excused,
        total,
        attendanceRate,
      };
    });

    res.json({ success: true, data: { rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/attendance/bulk
router.post('/bulk', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { date, termId, records } = req.body as {
      date: string;
      termId: string;
      records: Array<{ studentId: string; status: string; note?: string }>;
    };

    if (!date || !termId || !Array.isArray(records)) {
      res.status(400).json({ success: false, error: 'date, termId, and records[] are required' });
      return;
    }

    const targetDate = new Date(date + 'T00:00:00.000Z');

    const upserts = await Promise.all(
      records.map((r) =>
        prisma.schoolAttendance.upsert({
          where: { tenantId_studentId_date: { tenantId, studentId: r.studentId, date: targetDate } },
          create: {
            tenantId,
            studentId: r.studentId,
            termId,
            date: targetDate,
            status: r.status,
            note: r.note ?? null,
          },
          update: {
            status: r.status,
            note: r.note ?? null,
            termId,
          },
        })
      )
    );

    res.json({ success: true, data: { saved: upserts.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
