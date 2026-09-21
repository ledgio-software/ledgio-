import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface AttendanceSession {
  id: string;
  title: string;
  session_date: string;
  session_type: string;
  cell_group_id: string | null;
  cell_group_name: string | null;
  total_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  present: boolean;
  notes: string | null;
  created_at: string;
}

// GET /api/v1/church/attendance/summary
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await withCurrentTenantDb(prisma, async (client) => {
      const memberCountRows = await client.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM church_members WHERE is_active = true`,
      );

      const lastSundayRows = await client.$queryRawUnsafe<{ total_count: number; session_date: string }[]>(
        `SELECT total_count, session_date
         FROM church_attendance_sessions
         WHERE session_type = 'SUNDAY_SERVICE'
         ORDER BY session_date DESC
         LIMIT 1`,
      );

      const avgRows = await client.$queryRawUnsafe<{ avg_count: number }[]>(
        `SELECT ROUND(AVG(total_count)::numeric, 1) AS avg_count
         FROM (
           SELECT total_count FROM church_attendance_sessions
           WHERE session_type = 'SUNDAY_SERVICE' AND total_count IS NOT NULL
           ORDER BY session_date DESC LIMIT 4
         ) sub`,
      );

      const trendRows = await client.$queryRawUnsafe<{ session_date: string; total_count: number; title: string }[]>(
        `SELECT session_date, total_count, title
         FROM church_attendance_sessions
         WHERE session_type = 'SUNDAY_SERVICE' AND total_count IS NOT NULL
         ORDER BY session_date DESC LIMIT 8`,
      );

      return {
        totalMembers: memberCountRows[0]?.count ?? 0,
        lastSundayCount: lastSundayRows[0]?.total_count ?? 0,
        lastSundayDate: lastSundayRows[0]?.session_date ?? null,
        avgSundayAttendance: avgRows[0]?.avg_count ?? 0,
        trend: trendRows.reverse(),
      };
    });

    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/attendance/sessions?month=YYYY-MM
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      conditions.push(`TO_CHAR(s.session_date, 'YYYY-MM') = $${idx++}`);
      values.push(month);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<AttendanceSession[]>(
        `SELECT s.*, cg.name AS cell_group_name
         FROM church_attendance_sessions s
         LEFT JOIN church_cell_groups cg ON cg.id = s.cell_group_id
         ${where}
         ORDER BY s.session_date DESC`,
        ...values,
      );
    });

    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/attendance/sessions
router.post('/sessions', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      title: string;
      sessionDate: string;
      sessionType?: string;
      cellGroupId?: string;
      totalCount?: number;
      notes?: string;
    };

    if (!b.title || !b.sessionDate) {
      res.status(400).json({ success: false, error: 'title and sessionDate are required.' });
      return;
    }

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<AttendanceSession[]>(
        `INSERT INTO church_attendance_sessions (title, session_date, session_type, cell_group_id, total_count, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        b.title,
        b.sessionDate,
        b.sessionType ?? 'SUNDAY_SERVICE',
        b.cellGroupId ?? null,
        b.totalCount ?? null,
        b.notes ?? null,
      );
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/attendance/sessions/:id/records
router.get('/sessions/:id/records', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<AttendanceRecord[]>(
        `SELECT ar.*, m.first_name, m.last_name
         FROM church_attendance_records ar
         JOIN church_members m ON m.id = ar.member_id
         WHERE ar.session_id = $1
         ORDER BY m.last_name, m.first_name`,
        id,
      );
    });
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/attendance/sessions/:id/records — bulk upsert [{memberId, present}]
router.post('/sessions/:id/records', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: sessionId } = req.params;
    const records = req.body as { memberId: string; present: boolean }[];

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, error: 'records array is required.' });
      return;
    }

    await withCurrentTenantDb(prisma, async (client) => {
      const sessions = await client.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM church_attendance_sessions WHERE id = $1`,
        sessionId,
      );
      if (sessions.length === 0) {
        throw new Error('Session not found.');
      }

      for (const rec of records) {
        await client.$executeRawUnsafe(
          `INSERT INTO church_attendance_records (session_id, member_id, present)
           VALUES ($1, $2, $3)
           ON CONFLICT (session_id, member_id)
           DO UPDATE SET present = EXCLUDED.present`,
          sessionId,
          rec.memberId,
          rec.present ?? true,
        );
      }
    });

    res.json({ success: true, message: `${records.length} records saved.` });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === 'Session not found.') {
      res.status(404).json({ success: false, error: msg });
      return;
    }
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
