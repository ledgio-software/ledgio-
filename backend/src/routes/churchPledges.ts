import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface ChurchPledge {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  pledge_type: string;
  amount: number;
  currency: string;
  pledge_date: string;
  due_date: string | null;
  fulfilled_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/v1/church/pledges?memberId=&status=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, status } = req.query as { memberId?: string; status?: string };

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (memberId) {
      conditions.push(`p.member_id = $${idx++}::uuid`);
      values.push(memberId);
    }
    if (status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchPledge[]>(
        `SELECT p.*, m.first_name, m.last_name
         FROM church_pledges p
         JOIN church_members m ON m.id = p.member_id
         ${where}
         ORDER BY p.pledge_date DESC`,
        ...values,
      );
    });

    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/pledges
router.post('/', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      memberId: string;
      pledgeType: string;
      amount: number;
      currency?: string;
      pledgeDate: string;
      dueDate?: string;
      notes?: string;
    };

    if (!b.memberId || !b.pledgeType || b.amount == null || !b.pledgeDate) {
      res.status(400).json({ success: false, error: 'memberId, pledgeType, amount, and pledgeDate are required.' });
      return;
    }

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchPledge[]>(
        `INSERT INTO church_pledges (member_id, pledge_type, amount, currency, pledge_date, due_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        b.memberId,
        b.pledgeType,
        b.amount,
        b.currency ?? 'GHS',
        b.pledgeDate,
        b.dueDate ?? null,
        b.notes ?? null,
      );
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/pledges/:id
router.put('/:id', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, unknown>;

    const fieldMap: Record<string, string> = {
      pledgeType: 'pledge_type',
      amount: 'amount',
      currency: 'currency',
      pledgeDate: 'pledge_date',
      dueDate: 'due_date',
      fulfilledAmount: 'fulfilled_amount',
      status: 'status',
      notes: 'notes',
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

    // Auto-update status to FULFILLED when fulfilledAmount >= amount
    const sql = `
      UPDATE church_pledges
      SET ${setClauses.join(', ')},
          status = CASE
            WHEN fulfilled_amount >= amount AND status != 'CANCELLED' THEN 'FULFILLED'
            WHEN fulfilled_amount < amount AND status = 'FULFILLED' THEN 'ACTIVE'
            ELSE status
          END
      WHERE id = $${idx}::uuid
      RETURNING *`;

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<ChurchPledge[]>(sql, ...values);
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Pledge not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
