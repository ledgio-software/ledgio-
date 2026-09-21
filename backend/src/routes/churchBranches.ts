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
         WHERE id=$8 RETURNING *`,
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
      client.$queryRawUnsafe<{ id: string }[]>(`DELETE FROM church_branches WHERE id=$1 RETURNING id`, id)
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
