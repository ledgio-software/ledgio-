import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/church/dashboard
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await withCurrentTenantDb(prisma, async (client) => {
      const [members, attendance, pledges, giving] = await Promise.all([
        // Member stats
        client.$queryRawUnsafe<{ total: number; active: number; new_this_month: number }[]>(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active = true AND membership_status = 'ACTIVE')::int AS active,
            COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE))::int AS new_this_month
          FROM church_members
        `),

        // Last Sunday attendance
        client.$queryRawUnsafe<{ total_count: number; session_date: string; title: string }[]>(`
          SELECT total_count, session_date, title
          FROM church_attendance_sessions
          WHERE session_type = 'SUNDAY_SERVICE' AND total_count IS NOT NULL
          ORDER BY session_date DESC LIMIT 1
        `),

        // Pledge summary
        client.$queryRawUnsafe<{ total_pledged: number; total_fulfilled: number; active_count: number }[]>(`
          SELECT
            COALESCE(SUM(amount), 0)::float AS total_pledged,
            COALESCE(SUM(fulfilled_amount), 0)::float AS total_fulfilled,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count
          FROM church_pledges
        `),

        // Giving this month
        client.$queryRawUnsafe<{ total: number; count: number }[]>(`
          SELECT
            COALESCE(SUM(amount), 0)::float AS total,
            COUNT(*)::int AS count
          FROM church_givings
          WHERE DATE_TRUNC('month', giving_date) = DATE_TRUNC('month', CURRENT_DATE)
        `),
      ]);

      // 8-week attendance trend
      const trend = await client.$queryRawUnsafe<{ session_date: string; total_count: number; title: string }[]>(`
        SELECT session_date, total_count, title
        FROM church_attendance_sessions
        WHERE session_type = 'SUNDAY_SERVICE' AND total_count IS NOT NULL
        ORDER BY session_date DESC LIMIT 8
      `);

      // Giving by type this month
      const givingByType = await client.$queryRawUnsafe<{ giving_type: string; total: number }[]>(`
        SELECT giving_type, SUM(amount)::float AS total
        FROM church_givings
        WHERE DATE_TRUNC('month', giving_date) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY giving_type ORDER BY total DESC
      `);

      // Cell group count
      const cellGroups = await client.$queryRawUnsafe<{ count: number }[]>(`
        SELECT COUNT(*)::int AS count FROM church_cell_groups WHERE is_active = true
      `);

      return {
        members: members[0] ?? { total: 0, active: 0, new_this_month: 0 },
        lastSunday: attendance[0] ?? null,
        pledges: pledges[0] ?? { total_pledged: 0, total_fulfilled: 0, active_count: 0 },
        givingThisMonth: giving[0] ?? { total: 0, count: 0 },
        attendanceTrend: trend.reverse(),
        givingByType,
        cellGroupCount: cellGroups[0]?.count ?? 0,
      };
    });

    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
