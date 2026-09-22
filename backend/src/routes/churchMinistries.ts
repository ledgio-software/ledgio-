import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  leader_name: string | null;
  meeting_schedule: string | null;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

// GET /api/v1/church/ministries
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Ministry[]>(`
        SELECT m.*,
               CONCAT(ldr.first_name, ' ', ldr.last_name) AS leader_name,
               COUNT(mm.id)::int AS member_count
        FROM church_ministries m
        LEFT JOIN church_members ldr ON ldr.id = m.leader_id
        LEFT JOIN church_ministry_members mm ON mm.ministry_id = m.id
        GROUP BY m.id, ldr.first_name, ldr.last_name
        ORDER BY m.name
      `)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/ministries/:id/members
router.get('/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string; member_id: string; member_name: string; role: string; joined_at: string }[]>(`
        SELECT mm.id, mm.member_id, CONCAT(m.first_name,' ',m.last_name) AS member_name, mm.role, mm.joined_at
        FROM church_ministry_members mm
        JOIN church_members m ON m.id = mm.member_id
        WHERE mm.ministry_id = $1::uuid
        ORDER BY m.first_name, m.last_name
      `, id)
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/ministries
router.post('/', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as { name: string; description?: string; leaderId?: string; meetingSchedule?: string };
    if (!b.name) { res.status(400).json({ success: false, error: 'name is required.' }); return; }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Ministry[]>(
        `INSERT INTO church_ministries (name, description, leader_id, meeting_schedule)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        b.name, b.description ?? null, b.leaderId ?? null, b.meetingSchedule ?? null,
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/ministries/:id
router.put('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as { name?: string; description?: string; leaderId?: string; meetingSchedule?: string; isActive?: boolean };
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Ministry[]>(
        `UPDATE church_ministries SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           leader_id=COALESCE($3,leader_id), meeting_schedule=COALESCE($4,meeting_schedule),
           is_active=COALESCE($5,is_active), updated_at=NOW()
         WHERE id=$6::uuid RETURNING *`,
        b.name ?? null, b.description ?? null, b.leaderId ?? null, b.meetingSchedule ?? null,
        b.isActive ?? null, id,
      )
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/ministries/:id/members  — assign member
router.post('/:id/members', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { memberId, role } = req.body as { memberId: string; role?: string };
    if (!memberId) { res.status(400).json({ success: false, error: 'memberId is required.' }); return; }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO church_ministry_members (ministry_id, member_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (ministry_id, member_id) DO UPDATE SET role=EXCLUDED.role
         RETURNING id`,
        id, memberId, role ?? 'Member',
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/ministries/:id/members/:memberId  — remove member
router.delete('/:id/members/:memberId', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, memberId } = req.params;
    await withCurrentTenantDb(prisma, (client) =>
      client.$executeRawUnsafe(
        `DELETE FROM church_ministry_members WHERE ministry_id=$1::uuid AND member_id=$2::uuid`, id, memberId,
      )
    );
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/ministries/:id
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(`DELETE FROM church_ministries WHERE id=$1::uuid RETURNING id`, id)
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
