import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface ChurchEvent {
  id: string;
  title: string;
  event_type: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  venue: string | null;
  expected_attendance: number | null;
  actual_attendance: number | null;
  is_active: boolean;
  registration_count: number;
  created_at: string;
}

// GET /api/v1/church/events?upcoming=true&type=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { upcoming, type } = req.query as { upcoming?: string; type?: string };
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (upcoming === 'true') { conditions.push(`e.event_date >= CURRENT_DATE`); }
    if (type) { conditions.push(`e.event_type = $${idx++}`); values.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<ChurchEvent[]>(
        `SELECT e.*, COUNT(r.id)::int AS registration_count
         FROM church_events e
         LEFT JOIN church_event_registrations r ON r.event_id = e.id
         ${where}
         GROUP BY e.id
         ORDER BY e.event_date DESC LIMIT 200`,
        ...values,
      )
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v1/church/events/:id/registrations
router.get('/:id/registrations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string; member_id: string | null; name: string; phone: string | null; attended: boolean; registered_at: string }[]>(
        `SELECT r.id, r.member_id,
                COALESCE(CONCAT(m.first_name,' ',m.last_name), r.visitor_name) AS name,
                COALESCE(m.phone, r.phone) AS phone,
                r.attended, r.registered_at
         FROM church_event_registrations r
         LEFT JOIN church_members m ON m.id = r.member_id
         WHERE r.event_id = $1
         ORDER BY r.registered_at`,
        id,
      )
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/events
router.post('/', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body as {
      title: string; eventType?: string; description?: string;
      eventDate: string; endDate?: string; venue?: string;
      expectedAttendance?: number;
    };
    if (!b.title || !b.eventDate) {
      res.status(400).json({ success: false, error: 'title and eventDate are required.' });
      return;
    }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<ChurchEvent[]>(
        `INSERT INTO church_events (title, event_type, description, event_date, end_date, venue, expected_attendance)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        b.title, b.eventType ?? 'GENERAL', b.description ?? null, b.eventDate,
        b.endDate ?? null, b.venue ?? null, b.expectedAttendance ?? null,
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/events/:id
router.put('/:id', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const b = req.body as {
      title?: string; eventType?: string; description?: string;
      eventDate?: string; endDate?: string; venue?: string;
      expectedAttendance?: number; actualAttendance?: number; isActive?: boolean;
    };
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<ChurchEvent[]>(
        `UPDATE church_events SET
           title=COALESCE($1,title), event_type=COALESCE($2,event_type),
           description=COALESCE($3,description), event_date=COALESCE($4,event_date),
           end_date=COALESCE($5,end_date), venue=COALESCE($6,venue),
           expected_attendance=COALESCE($7,expected_attendance),
           actual_attendance=COALESCE($8,actual_attendance),
           is_active=COALESCE($9,is_active), updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        b.title ?? null, b.eventType ?? null, b.description ?? null, b.eventDate ?? null,
        b.endDate ?? null, b.venue ?? null, b.expectedAttendance ?? null,
        b.actualAttendance ?? null, b.isActive ?? null, id,
      )
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v1/church/events/:id/registrations
router.post('/:id/registrations', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { memberId, visitorName, phone } = req.body as { memberId?: string; visitorName?: string; phone?: string };
    if (!memberId && !visitorName) {
      res.status(400).json({ success: false, error: 'memberId or visitorName is required.' });
      return;
    }
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO church_event_registrations (event_id, member_id, visitor_name, phone)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        id, memberId ?? null, visitorName ?? null, phone ?? null,
      )
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/v1/church/events/:id/registrations/:regId/attended
router.patch('/:id/registrations/:regId/attended', requireRole('Admin', 'Accountant') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { regId } = req.params;
    const { attended } = req.body as { attended: boolean };
    await withCurrentTenantDb(prisma, (client) =>
      client.$executeRawUnsafe(
        `UPDATE church_event_registrations SET attended=$1 WHERE id=$2`, attended, regId,
      )
    );
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v1/church/events/:id
router.delete('/:id', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(`DELETE FROM church_events WHERE id=$1 RETURNING id`, id)
    );
    if (!rows.length) { res.status(404).json({ success: false, error: 'Not found.' }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
