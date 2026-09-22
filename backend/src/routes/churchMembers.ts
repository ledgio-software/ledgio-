import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface ChurchMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  membership_date: string | null;
  membership_status: string;
  cell_group_id: string | null;
  cell_group_name: string | null;
  department: string | null;
  address: string | null;
  occupation: string | null;
  marital_status: string | null;
  baptism_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/v1/church/members?search=&status=&cellGroupId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, cellGroupId } = req.query as {
      search?: string;
      status?: string;
      cellGroupId?: string;
    };

    const conditions: string[] = ['m.is_active = true'];
    const values: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(
        `(m.first_name ILIKE $${idx} OR m.last_name ILIKE $${idx} OR m.email ILIKE $${idx} OR m.phone ILIKE $${idx})`,
      );
      values.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`m.membership_status = $${idx++}`);
      values.push(status);
    }
    if (cellGroupId) {
      conditions.push(`m.cell_group_id = $${idx++}::uuid`);
      values.push(cellGroupId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchMember[]>(
        `SELECT m.*, cg.name AS cell_group_name
         FROM church_members m
         LEFT JOIN church_cell_groups cg ON cg.id = m.cell_group_id
         ${where}
         ORDER BY m.last_name, m.first_name`,
        ...values,
      );
    });

    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/members
router.post('/', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      gender?: string;
      dateOfBirth?: string;
      membershipDate?: string;
      membershipStatus?: string;
      cellGroupId?: string;
      department?: string;
      address?: string;
      occupation?: string;
      maritalStatus?: string;
      baptismDate?: string;
      notes?: string;
    };

    if (!b.firstName || !b.lastName) {
      res.status(400).json({ success: false, error: 'firstName and lastName are required.' });
      return;
    }

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchMember[]>(
        `INSERT INTO church_members
           (first_name, last_name, email, phone, gender, date_of_birth, membership_date,
            membership_status, cell_group_id, department, address, occupation,
            marital_status, baptism_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        b.firstName,
        b.lastName,
        b.email ?? null,
        b.phone ?? null,
        b.gender ?? null,
        b.dateOfBirth ?? null,
        b.membershipDate ?? null,
        b.membershipStatus ?? 'ACTIVE',
        b.cellGroupId ?? null,
        b.department ?? null,
        b.address ?? null,
        b.occupation ?? null,
        b.maritalStatus ?? null,
        b.baptismDate ?? null,
        b.notes ?? null,
      );
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/members/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchMember[]>(
        `SELECT m.*, cg.name AS cell_group_name
         FROM church_members m
         LEFT JOIN church_cell_groups cg ON cg.id = m.cell_group_id
         WHERE m.id = $1::uuid`,
        id,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Member not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/members/:id
router.put('/:id', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, unknown>;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      gender: 'gender',
      dateOfBirth: 'date_of_birth',
      membershipDate: 'membership_date',
      membershipStatus: 'membership_status',
      cellGroupId: 'cell_group_id',
      department: 'department',
      address: 'address',
      occupation: 'occupation',
      maritalStatus: 'marital_status',
      baptismDate: 'baptism_date',
      notes: 'notes',
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
      return client.$queryRawUnsafe<ChurchMember[]>(
        `UPDATE church_members SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
        ...values,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Member not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/members/:id — soft delete
router.delete('/:id', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<{ id: string }[]>(
        `UPDATE church_members SET is_active = false, updated_at = NOW() WHERE id = $1::uuid RETURNING id`,
        id,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Member not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
