import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  visit_date: string;
  service_type: string;
  how_they_heard: string | null;
  follow_up_status: string;
  follow_up_notes: string | null;
  converted_to_member_id: string | null;
  created_at: string;
}

// GET /api/v1/church/visitors?status=&from=&to=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, from, to } = req.query as { status?: string; from?: string; to?: string };
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`follow_up_status = $${idx++}`); values.push(status); }
    if (from)   { conditions.push(`visit_date >= $${idx++}`); values.push(from); }
    if (to)     { conditions.push(`visit_date <= $${idx++}`); values.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Visitor[]>(
        `SELECT * FROM church_visitors ${where} ORDER BY visit_date DESC, created_at DESC LIMIT 500`,
        ...values,
      )
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/visitors
router.post('/', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      firstName: string; lastName: string; phone?: string; email?: string;
      address?: string; visitDate: string; serviceType?: string;
      howTheyHeard?: string; followUpNotes?: string;
    };
    if (!b.firstName || !b.lastName || !b.visitDate) {
      res.status(400).json({ success: false, error: 'firstName, lastName, and visitDate are required.' });
      return;
    }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Visitor[]>(
        `INSERT INTO church_visitors
           (first_name, last_name, phone, email, address, visit_date, service_type, how_they_heard, follow_up_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        b.firstName, b.lastName, b.phone ?? null, b.email ?? null, b.address ?? null,
        b.visitDate, b.serviceType ?? 'SUNDAY_SERVICE', b.howTheyHeard ?? null, b.followUpNotes ?? null,
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/v1/church/visitors/:id/follow-up
router.patch('/:id/follow-up', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body as { status: string; notes?: string };
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Visitor[]>(
        `UPDATE church_visitors SET follow_up_status=$1, follow_up_notes=COALESCE($2, follow_up_notes), updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        status, notes ?? null, id,
      )
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/visitors/:id/convert  — convert visitor to member
router.post('/:id/convert', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as { cellGroupId?: string; membershipDate?: string };

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      const visitors = await client.$queryRawUnsafe<Visitor[]>(
        `SELECT * FROM church_visitors WHERE id=$1`, id,
      );
      if (!visitors.length) return null;
      const v = visitors[0];

      const members = await client.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO church_members
           (first_name, last_name, phone, email, membership_status, membership_date, cell_group_id)
         VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6) RETURNING id`,
        v.first_name, v.last_name, v.phone, v.email,
        b.membershipDate ?? new Date().toISOString().split('T')[0],
        b.cellGroupId ?? null,
      );
      const memberId = members[0].id;

      await client.$executeRawUnsafe(
        `UPDATE church_visitors SET converted_to_member_id=$1, follow_up_status='CONVERTED', updated_at=NOW() WHERE id=$2`,
        memberId, id,
      );
      return memberId;
    });

    if (!rows) { res.status(404).json({ success: false, error: 'Visitor not found.' }); return; }
    res.status(201).json({ success: true, data: { memberId: rows } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/visitors/:id
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(`DELETE FROM church_visitors WHERE id=$1 RETURNING id`, id)
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
