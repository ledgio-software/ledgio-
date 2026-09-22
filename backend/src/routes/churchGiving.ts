import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface Giving {
  id: string;
  giving_date: string;
  service_type: string;
  giving_type: string;
  amount: number;
  currency: string;
  member_id: string | null;
  member_name: string | null;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

// GET /api/v1/church/giving/summary?from=&to=
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (from) { conditions.push(`g.giving_date >= $${idx++}::date`); values.push(from); }
    if (to)   { conditions.push(`g.giving_date <= $${idx++}::date`); values.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const data = await withCurrentTenantDb(prisma, async (client) => {
      const byType = await client.$queryRawUnsafe<{ giving_type: string; total: number; count: number }[]>(
        `SELECT giving_type, SUM(amount)::float AS total, COUNT(*)::int AS count
         FROM church_givings g ${where}
         GROUP BY giving_type ORDER BY total DESC`,
        ...values,
      );

      const byMonth = await client.$queryRawUnsafe<{ month: string; total: number }[]>(
        `SELECT TO_CHAR(g.giving_date, 'YYYY-MM') AS month, SUM(amount)::float AS total
         FROM church_givings g ${where}
         GROUP BY month ORDER BY month DESC LIMIT 12`,
        ...values,
      );

      const grandTotal = await client.$queryRawUnsafe<{ total: number; count: number }[]>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total, COUNT(*)::int AS count
         FROM church_givings g ${where}`,
        ...values,
      );

      return { byType, byMonth: byMonth.reverse(), grandTotal: grandTotal[0] };
    });

    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/giving?from=&to=&type=&memberId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, type, memberId } = req.query as {
      from?: string; to?: string; type?: string; memberId?: string;
    };

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (from)     { conditions.push(`g.giving_date >= $${idx++}::date`); values.push(from); }
    if (to)       { conditions.push(`g.giving_date <= $${idx++}::date`); values.push(to); }
    if (type)     { conditions.push(`g.giving_type = $${idx++}`); values.push(type); }
    if (memberId) { conditions.push(`g.member_id = $${idx++}::uuid`); values.push(memberId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<Giving[]>(
        `SELECT g.*,
                CONCAT(m.first_name, ' ', m.last_name) AS member_name
         FROM church_givings g
         LEFT JOIN church_members m ON m.id = g.member_id
         ${where}
         ORDER BY g.giving_date DESC, g.created_at DESC
         LIMIT 500`,
        ...values,
      );
    });

    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/giving
router.post('/', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      givingDate: string;
      serviceType?: string;
      givingType: string;
      amount: number;
      currency?: string;
      memberId?: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      branchId?: string;
    };

    if (!b.givingDate || !b.givingType || b.amount == null) {
      res.status(400).json({ success: false, error: 'givingDate, givingType, and amount are required.' });
      return;
    }

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<Giving[]>(
        `INSERT INTO church_givings
           (giving_date, service_type, giving_type, amount, currency, member_id, payment_method, reference, notes, branch_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        b.givingDate,
        b.serviceType ?? 'SUNDAY_SERVICE',
        b.givingType,
        b.amount,
        b.currency ?? 'GHS',
        b.memberId ?? null,
        b.paymentMethod ?? 'CASH',
        b.reference ?? null,
        b.notes ?? null,
        b.branchId ?? null,
      );
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/giving/:id
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<{ id: string }[]>(
        `DELETE FROM church_givings WHERE id = $1::uuid RETURNING id`,
        id,
      );
    });

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Record not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
