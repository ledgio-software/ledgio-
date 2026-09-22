import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface CellGroup {
  id: string;
  name: string;
  leader_name: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

// GET /api/v1/church/cell-groups
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<CellGroup[]>(
        `SELECT cg.*,
                COUNT(m.id) FILTER (WHERE m.is_active = true)::int AS member_count
         FROM church_cell_groups cg
         LEFT JOIN church_members m ON m.cell_group_id = cg.id
         WHERE cg.is_active = true
         GROUP BY cg.id
         ORDER BY cg.name`,
      );
    });
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/cell-groups
router.post('/', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      name: string;
      leaderName?: string;
      meetingDay?: string;
      meetingTime?: string;
      location?: string;
      description?: string;
    };

    if (!b.name) {
      res.status(400).json({ success: false, error: 'name is required.' });
      return;
    }

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<CellGroup[]>(
        `INSERT INTO church_cell_groups (name, leader_name, meeting_day, meeting_time, location, description)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        b.name,
        b.leaderName ?? null,
        b.meetingDay ?? null,
        b.meetingTime ?? null,
        b.location ?? null,
        b.description ?? null,
      );
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/cell-groups/:id
router.put('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, unknown>;

    const fieldMap: Record<string, string> = {
      name: 'name',
      leaderName: 'leader_name',
      meetingDay: 'meeting_day',
      meetingTime: 'meeting_time',
      location: 'location',
      description: 'description',
      isActive: 'is_active',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [jsKey, sqlCol] of Object.entries(fieldMap)) {
      if (b[jsKey] !== undefined) {
        setClauses.push(`${sqlCol} = $${idx++}`);
        values.push(b[jsKey] ?? null);
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update.' });
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<CellGroup[]>(
        `UPDATE church_cell_groups SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        ...values,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Cell group not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/cell-groups/:id — soft delete
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<{ id: string }[]>(
        `UPDATE church_cell_groups SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        id,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Cell group not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
