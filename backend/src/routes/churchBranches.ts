import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface Branch {
  id: string;
  name: string;
  address: string | null;
  pastor_id: string | null;
  pastor_name: string | null;
  phone: string | null;
  email: string | null;
  established_date: string | null;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

// GET /api/v1/church/branches
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Branch[]>(`
        SELECT b.*,
               CONCAT(p.first_name, ' ', p.last_name) AS pastor_name,
               COUNT(m.id)::int AS member_count
        FROM church_branches b
        LEFT JOIN church_members p ON p.id = b.pastor_id
        LEFT JOIN church_members m ON m.branch_id = b.id AND m.is_active = true
        GROUP BY b.id, p.first_name, p.last_name
        ORDER BY b.name
      `)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/leaderboard
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const dateFilter = (alias: string) => {
      const parts: string[] = [];
      if (from) parts.push(`${alias}.giving_date >= '${from}'::date`);
      if (to)   parts.push(`${alias}.giving_date <= '${to}'::date`);
      return parts.length ? `AND ${parts.join(' AND ')}` : '';
    };

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<{
        id: string; name: string; pastor_name: string | null;
        member_count: number; giving_total: number; attendance_avg: number; event_count: number;
        giving_rank: number; attendance_rank: number; overall_score: number;
      }>(`
        WITH branch_stats AS (
          SELECT
            b.id,
            b.name,
            CONCAT(p.first_name, ' ', p.last_name) AS pastor_name,
            COUNT(DISTINCT m.id) FILTER (WHERE m.is_active = true)::int AS member_count,
            COALESCE(SUM(g.amount) FILTER (WHERE g.branch_id = b.id ${dateFilter('g')}), 0)::float AS giving_total,
            COALESCE(AVG(s.total_count) FILTER (WHERE s.branch_id = b.id), 0)::float AS attendance_avg,
            COUNT(DISTINCT e.id) FILTER (WHERE e.branch_id = b.id)::int AS event_count
          FROM church_branches b
          LEFT JOIN church_members p  ON p.id = b.pastor_id
          LEFT JOIN church_members m  ON m.branch_id = b.id
          LEFT JOIN church_givings g  ON g.branch_id = b.id
          LEFT JOIN church_attendance_sessions s ON s.branch_id = b.id
          LEFT JOIN church_events e   ON e.branch_id = b.id
          WHERE b.is_active = true
          GROUP BY b.id, p.first_name, p.last_name
        )
        SELECT *,
          RANK() OVER (ORDER BY giving_total DESC)::int    AS giving_rank,
          RANK() OVER (ORDER BY attendance_avg DESC)::int  AS attendance_rank,
          ROUND((giving_total / NULLIF(MAX(giving_total) OVER (), 0) * 40
               + attendance_avg / NULLIF(MAX(attendance_avg) OVER (), 0) * 40
               + member_count::float / NULLIF(MAX(member_count) OVER (), 0) * 20)::numeric, 1)::float AS overall_score
        FROM branch_stats
        ORDER BY overall_score DESC NULLS LAST
      `);
    });

    res.json({ success: true, data: Array.isArray(rows) ? rows : [rows].filter(Boolean) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/summary
router.get('/:id/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = await withCurrentTenantDb(prisma, async (client) => {
      const [branchRows, stats] = await Promise.all([
        client.$queryRawUnsafe<Branch[]>(`
          SELECT b.*, CONCAT(p.first_name, ' ', p.last_name) AS pastor_name,
                 COUNT(m.id)::int AS member_count
          FROM church_branches b
          LEFT JOIN church_members p ON p.id = b.pastor_id
          LEFT JOIN church_members m ON m.branch_id = b.id AND m.is_active = true
          WHERE b.id = $1::uuid
          GROUP BY b.id, p.first_name, p.last_name
        `, id),
        client.$queryRawUnsafe<{
          giving_total: number; giving_count: number;
          attendance_avg: number; session_count: number;
          event_count: number; visitor_count: number; pledge_total: number;
        }[]>(`
          SELECT
            COALESCE(SUM(g.amount),0)::float      AS giving_total,
            COUNT(DISTINCT g.id)::int             AS giving_count,
            COALESCE(AVG(s.total_count),0)::float AS attendance_avg,
            COUNT(DISTINCT s.id)::int             AS session_count,
            COUNT(DISTINCT e.id)::int             AS event_count,
            COUNT(DISTINCT v.id)::int             AS visitor_count,
            COALESCE(SUM(p.amount),0)::float      AS pledge_total
          FROM church_branches b
          LEFT JOIN church_givings g  ON g.branch_id = b.id
          LEFT JOIN church_attendance_sessions s ON s.branch_id = b.id
          LEFT JOIN church_events e   ON e.branch_id = b.id
          LEFT JOIN church_visitors v ON v.branch_id = b.id
          LEFT JOIN church_pledges p  ON p.branch_id = b.id
          WHERE b.id = $1::uuid
        `, id),
      ]);

      if (!branchRows.length) return null;
      return { branch: branchRows[0], stats: stats[0] };
    });

    if (!data) { res.status(404).json({ success: false, error: 'Branch not found.' }); return; }
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/members
router.get('/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{
        id: string; first_name: string; last_name: string; phone: string | null;
        email: string | null; membership_status: string; membership_date: string | null;
        cell_group_name: string | null;
      }[]>(`
        SELECT m.id, m.first_name, m.last_name, m.phone, m.email,
               m.membership_status, m.membership_date,
               cg.name AS cell_group_name
        FROM church_members m
        LEFT JOIN church_cell_groups cg ON cg.id = m.cell_group_id
        WHERE m.branch_id = $1::uuid AND m.is_active = true
        ORDER BY m.last_name, m.first_name
      `, id)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/giving?from=&to=
router.get('/:id/giving', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ['g.branch_id = $1::uuid'];
    const values: unknown[] = [id];
    let idx = 2;

    if (from) { conditions.push(`g.giving_date >= $${idx++}::date`); values.push(from); }
    if (to)   { conditions.push(`g.giving_date <= $${idx++}::date`); values.push(to); }

    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{
        id: string; giving_date: string; giving_type: string; amount: number;
        payment_method: string; member_name: string | null;
      }[]>(
        `SELECT g.*, CONCAT(m.first_name,' ',m.last_name) AS member_name
         FROM church_givings g
         LEFT JOIN church_members m ON m.id = g.member_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY g.giving_date DESC LIMIT 500`,
        ...values,
      )
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/attendance
router.get('/:id/attendance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{
        id: string; session_date: string; session_type: string;
        total_count: number | null; notes: string | null;
      }[]>(`
        SELECT id, session_date, session_type, total_count, notes
        FROM church_attendance_sessions
        WHERE branch_id = $1::uuid
        ORDER BY session_date DESC LIMIT 200
      `, id)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/events
router.get('/:id/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{
        id: string; title: string; event_type: string; event_date: string;
        venue: string | null; expected_attendance: number | null; actual_attendance: number | null;
      }[]>(`
        SELECT id, title, event_type, event_date, venue, expected_attendance, actual_attendance
        FROM church_events
        WHERE branch_id = $1::uuid OR branch_id IS NULL
        ORDER BY event_date DESC LIMIT 200
      `, id)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/visitors
router.get('/:id/visitors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{
        id: string; first_name: string; last_name: string; visit_date: string;
        follow_up_status: string; phone: string | null;
      }[]>(`
        SELECT id, first_name, last_name, visit_date, follow_up_status, phone
        FROM church_visitors
        WHERE branch_id = $1::uuid
        ORDER BY visit_date DESC LIMIT 200
      `, id)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/branches/:id/report — structured data for PDF/report export
router.get('/:id/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    const dateWhere = (col: string) => {
      const parts: string[] = [];
      if (from) parts.push(`${col} >= '${from}'::date`);
      if (to)   parts.push(`${col} <= '${to}'::date`);
      return parts.length ? `AND ${parts.join(' AND ')}` : '';
    };

    const data = await withCurrentTenantDb(prisma, async (client) => {
      const [branchRows, givingSummary, attendanceSummary, memberSummary, visitorRows, eventRows] = await Promise.all([
        client.$queryRawUnsafe<Branch[]>(`
          SELECT b.*, CONCAT(p.first_name,' ',p.last_name) AS pastor_name,
                 COUNT(m.id)::int AS member_count
          FROM church_branches b
          LEFT JOIN church_members p ON p.id = b.pastor_id
          LEFT JOIN church_members m ON m.branch_id = b.id AND m.is_active = true
          WHERE b.id = $1::uuid GROUP BY b.id, p.first_name, p.last_name
        `, id),
        client.$queryRawUnsafe<{ giving_type: string; total: number; count: number }[]>(`
          SELECT giving_type, SUM(amount)::float AS total, COUNT(*)::int AS count
          FROM church_givings WHERE branch_id = $1::uuid ${dateWhere('giving_date')}
          GROUP BY giving_type ORDER BY total DESC
        `, id),
        client.$queryRawUnsafe<{ session_type: string; avg_count: number; sessions: number }[]>(`
          SELECT session_type, AVG(total_count)::float AS avg_count, COUNT(*)::int AS sessions
          FROM church_attendance_sessions WHERE branch_id = $1::uuid
          GROUP BY session_type ORDER BY sessions DESC
        `, id),
        client.$queryRawUnsafe<{ membership_status: string; count: number }[]>(`
          SELECT membership_status, COUNT(*)::int AS count
          FROM church_members WHERE branch_id = $1::uuid AND is_active = true
          GROUP BY membership_status
        `, id),
        client.$queryRawUnsafe<{ status: string; count: number }[]>(`
          SELECT follow_up_status AS status, COUNT(*)::int AS count
          FROM church_visitors WHERE branch_id = $1::uuid ${dateWhere('visit_date')}
          GROUP BY follow_up_status
        `, id),
        client.$queryRawUnsafe<{ title: string; event_date: string; actual_attendance: number | null }[]>(`
          SELECT title, event_date, actual_attendance
          FROM church_events WHERE branch_id = $1::uuid
          ORDER BY event_date DESC LIMIT 20
        `, id),
      ]);

      if (!branchRows.length) return null;
      return {
        branch: branchRows[0],
        period: { from: from ?? null, to: to ?? null },
        giving: givingSummary,
        attendance: attendanceSummary,
        members: memberSummary,
        visitors: visitorRows,
        events: eventRows,
      };
    });

    if (!data) { res.status(404).json({ success: false, error: 'Branch not found.' }); return; }
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/branches
router.post('/', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      name: string; address?: string; pastorId?: string;
      phone?: string; email?: string; establishedDate?: string;
    };
    if (!b.name) { res.status(400).json({ success: false, error: 'name is required.' }); return; }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Branch[]>(
        `INSERT INTO church_branches (name, address, pastor_id, phone, email, established_date)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        b.name, b.address ?? null, b.pastorId ?? null, b.phone ?? null,
        b.email ?? null, b.establishedDate ?? null,
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/branches/:id
router.put('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as {
      name?: string; address?: string; pastorId?: string;
      phone?: string; email?: string; establishedDate?: string; isActive?: boolean;
    };
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Branch[]>(
        `UPDATE church_branches SET
           name=COALESCE($1,name), address=COALESCE($2,address),
           pastor_id=COALESCE($3,pastor_id), phone=COALESCE($4,phone),
           email=COALESCE($5,email), established_date=COALESCE($6,established_date),
           is_active=COALESCE($7,is_active), updated_at=NOW()
         WHERE id=$8::uuid RETURNING *`,
        b.name ?? null, b.address ?? null, b.pastorId ?? null, b.phone ?? null,
        b.email ?? null, b.establishedDate ?? null, b.isActive ?? null, id,
      )
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/branches/:id
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(`DELETE FROM church_branches WHERE id=$1::uuid RETURNING id`, id)
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
