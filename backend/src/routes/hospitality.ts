import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/** Reject non-HOSPITALITY tenants with 403 before any hospitality endpoint runs. */
async function requireHospitalityOrgType(req: Request, res: Response, next: Function): Promise<void> {
  const { tenantId } = requireTenantContext();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { orgType: true } });
  if (!tenant || tenant.orgType !== 'HOSPITALITY') {
    res.status(403).json({ success: false, error: 'This feature is only available for HOSPITALITY tenants.' });
    return;
  }
  next();
}

router.use(requireHospitalityOrgType as any);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const roomTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  ratePerNight: z.number().min(0),
  capacity: z.number().int().min(1).max(50).default(2),
  amenities: z.array(z.string().max(100)).max(50).optional(),
  isActive: z.boolean().optional(),
});

const roomSchema = z.object({
  roomTypeId: z.string().uuid(),
  roomNumber: z.string().min(1).max(20),
  floor: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
});

const reservationSchema = z.object({
  guestId: z.string().uuid().optional().nullable(),
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional().nullable(),
  guestPhone: z.string().max(30).optional().nullable(),
  roomId: z.string().uuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  adults: z.number().int().min(1).max(20).default(1),
  children: z.number().int().min(0).max(20).default(0),
  specialRequests: z.string().max(1000).optional().nullable(),
  depositAmount: z.number().min(0).default(0),
});

const folioChargeSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Room Types ───────────────────────────────────────────────────────────────

router.get('/room-types', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(`
        SELECT id, name, description, rate_per_night, capacity, amenities, is_active, created_at, updated_at
        FROM room_types ORDER BY name
      `);
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/room-types', requireRole('Admin', 'Manager') as any, validateBody(roomTypeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(
        `INSERT INTO room_types (name, description, rate_per_night, capacity, amenities, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        body.name, body.description ?? null, body.ratePerNight, body.capacity ?? 2,
        body.amenities ?? [], body.isActive ?? true
      );
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/room-types/:id', requireRole('Admin', 'Manager') as any, validateBody(roomTypeSchema.partial()), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (body.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(body.name); }
    if (body.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(body.description); }
    if (body.ratePerNight !== undefined) { setClauses.push(`rate_per_night = $${idx++}`); values.push(body.ratePerNight); }
    if (body.capacity !== undefined) { setClauses.push(`capacity = $${idx++}`); values.push(body.capacity); }
    if (body.amenities !== undefined) { setClauses.push(`amenities = $${idx++}`); values.push(body.amenities); }
    if (body.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(body.isActive); }
    if (setClauses.length === 0) { res.status(400).json({ success: false, error: 'No fields to update.' }); return; }
    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(
        `UPDATE room_types SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
        ...values
      );
    });
    if (rows.length === 0) { res.status(404).json({ success: false, error: 'Room type not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Rooms ────────────────────────────────────────────────────────────────────

router.get('/rooms', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(`
        SELECT r.id, r.room_number, r.floor, r.status, r.housekeeping_status, r.is_active,
               r.created_at, r.updated_at,
               rt.id AS room_type_id, rt.name AS room_type_name, rt.rate_per_night, rt.capacity, rt.amenities
        FROM rooms r
        JOIN room_types rt ON rt.id = r.room_type_id
        ORDER BY r.room_number
      `);
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/rooms', requireRole('Admin', 'Manager') as any, validateBody(roomSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(
        `INSERT INTO rooms (room_type_id, room_number, floor, is_active)
         VALUES ($1::uuid, $2, $3, $4) RETURNING *`,
        body.roomTypeId, body.roomNumber, body.floor ?? null, body.isActive ?? true
      );
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    if ((err as any).code === '23505') {
      res.status(409).json({ success: false, error: `Room number "${req.body.roomNumber}" already exists.` });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/rooms/:id/status', requireRole('Admin', 'Manager', 'Staff') as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, housekeepingStatus } = req.body as { status?: string; housekeepingStatus?: string };

    const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'HOUSEKEEPING', 'OUT_OF_ORDER'];
    const VALID_HK_STATUSES = ['CLEAN', 'DIRTY', 'INSPECTED', 'OUT_OF_ORDER'];

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (status) {
      if (!VALID_STATUSES.includes(status)) { res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }); return; }
      setClauses.push(`status = $${idx++}`); values.push(status);
    }
    if (housekeepingStatus) {
      if (!VALID_HK_STATUSES.includes(housekeepingStatus)) { res.status(400).json({ success: false, error: `Invalid housekeepingStatus. Must be one of: ${VALID_HK_STATUSES.join(', ')}` }); return; }
      setClauses.push(`housekeeping_status = $${idx++}`); values.push(housekeepingStatus);
    }
    if (setClauses.length === 0) { res.status(400).json({ success: false, error: 'Provide status or housekeepingStatus.' }); return; }
    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(
        `UPDATE rooms SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
        ...values
      );
    });
    if (rows.length === 0) { res.status(404).json({ success: false, error: 'Room not found.' }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Reservations ─────────────────────────────────────────────────────────────

router.get('/reservations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, from, to } = req.query as Record<string, string>;

    let sql = `
      SELECT r.*, rm.room_number, rm.floor, rt.name AS room_type_name, rt.rate_per_night AS type_rate
      FROM reservations r
      JOIN rooms rm ON rm.id = r.room_id
      JOIN room_types rt ON rt.id = rm.room_type_id
    `;
    const values: any[] = [];
    const conditions: string[] = [];
    let idx = 1;
    if (status) { conditions.push(`r.status = $${idx++}`); values.push(status); }
    if (from) { conditions.push(`r.check_out_date >= $${idx++}::date`); values.push(from); }
    if (to) { conditions.push(`r.check_in_date <= $${idx++}::date`); values.push(to); }
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY r.check_in_date DESC LIMIT 200`;

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(sql, ...values);
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reservations', requireRole('Admin', 'Manager', 'Staff') as any, validateBody(reservationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      // Check room availability (no double-booking)
      const conflict = await client.$queryRawUnsafe<any[]>(
        `SELECT id FROM reservations
         WHERE room_id = $1::uuid
           AND status IN ('CONFIRMED', 'CHECKED_IN')
           AND check_in_date < $2::date
           AND check_out_date > $3::date`,
        body.roomId, body.checkOutDate, body.checkInDate
      );
      if (conflict.length > 0) throw Object.assign(new Error('Room is already booked for the selected dates.'), { status: 409 });

      // Snapshot the room type's current rate
      const roomRows = await client.$queryRawUnsafe<any[]>(
        `SELECT rt.rate_per_night FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id WHERE r.id = $1::uuid`,
        body.roomId
      );
      if (roomRows.length === 0) throw Object.assign(new Error('Room not found.'), { status: 404 });
      const ratePerNight = roomRows[0].rate_per_night;

      const resNum = `RES-${Date.now().toString(36).toUpperCase()}`;
      return client.$queryRawUnsafe<any[]>(
        `INSERT INTO reservations
           (reservation_number, guest_id, guest_name, guest_email, guest_phone,
            room_id, check_in_date, check_out_date, rate_per_night, adults, children,
            special_requests, deposit_amount)
         VALUES ($1,$2,$3,$4,$5,$6::uuid,$7::date,$8::date,$9,$10,$11,$12,$13) RETURNING *`,
        resNum, body.guestId ? body.guestId : null, body.guestName, body.guestEmail ?? null, body.guestPhone ?? null,
        body.roomId, body.checkInDate, body.checkOutDate, ratePerNight, body.adults ?? 1,
        body.children ?? 0, body.specialRequests ?? null, body.depositAmount ?? 0
      );
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status((err as any).status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── Check-in ────────────────────────────────────────────────────────────────

router.post('/reservations/:id/check-in', requireRole('Admin', 'Manager', 'Staff') as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await withCurrentTenantDb(prisma, async (client) => {
      const resRows = await client.$queryRawUnsafe<any[]>(`SELECT * FROM reservations WHERE id = $1::uuid`, id);
      if (resRows.length === 0) throw Object.assign(new Error('Reservation not found.'), { status: 404 });
      const reservation = resRows[0];
      if (reservation.status !== 'CONFIRMED') throw Object.assign(new Error(`Cannot check in a reservation with status ${reservation.status}.`), { status: 400 });

      await client.$executeRawUnsafe(`UPDATE reservations SET status = 'CHECKED_IN', actual_check_in = NOW(), updated_at = NOW() WHERE id = $1::uuid`, id);
      await client.$executeRawUnsafe(`UPDATE rooms SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1::uuid`, reservation.room_id);

      const updated = await client.$queryRawUnsafe<any[]>(`SELECT * FROM reservations WHERE id = $1::uuid`, id);
      return updated[0];
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status((err as any).status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── Check-out ────────────────────────────────────────────────────────────────

router.post('/reservations/:id/check-out', requireRole('Admin', 'Manager') as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { id } = req.params;

    // Load reservation with room number
    const resRows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(`
        SELECT r.*, rm.room_number FROM reservations r
        LEFT JOIN rooms rm ON rm.id = r.room_id
        WHERE r.id = $1`, id);
    });
    if (resRows.length === 0) { res.status(404).json({ success: false, error: 'Reservation not found.' }); return; }
    const reservation = resRows[0];
    if (reservation.status !== 'CHECKED_IN') {
      res.status(400).json({ success: false, error: `Cannot check out a reservation with status ${reservation.status}.` });
      return;
    }

    // Calculate nights
    const checkIn = new Date(reservation.check_in_date);
    const nights = Math.max(1, Math.ceil((Date.now() - checkIn.getTime()) / 86_400_000));
    const roomTotal = Number(reservation.rate_per_night) * nights;

    // Get folio charges
    const folioRows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(`SELECT * FROM folio_charges WHERE reservation_id = $1`, id);
    });
    const folioTotal = (folioRows as any[]).reduce((sum, r) => sum + Number(r.amount), 0);
    const grandTotal = roomTotal + folioTotal;

    // Find or create walk-in guest customer (public schema)
    let guestCustomer = await prisma.customer.findFirst({
      where: { tenantId, customerType: 'GUEST' },
      select: { id: true },
    });
    if (!guestCustomer) {
      guestCustomer = await prisma.customer.create({
        data: { tenantId, name: 'Walk-in Guest', email: '__guest__@ledgio.internal', customerType: 'GUEST' },
        select: { id: true },
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: `STAY-${Date.now().toString(36).toUpperCase()}`,
        customerId: guestCustomer.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        currency: 'GHS',
        subtotal: grandTotal,
        tax: 0,
        total: grandTotal,
        status: 'SENT',
        items: {
          create: [
            {
              tenantId,
              description: `Room ${reservation.room_number ?? ''} — ${nights} night(s) @ GHS ${Number(reservation.rate_per_night).toFixed(2)}/night (Res: ${reservation.reservation_number})`,
              quantity: nights,
              unitPrice: Number(reservation.rate_per_night),
              amount: roomTotal,
            },
            ...(folioRows as any[]).map((fc) => ({
              tenantId,
              description: fc.description,
              quantity: 1,
              unitPrice: Number(fc.amount),
              amount: Number(fc.amount),
            })),
          ],
        },
      },
    });

    // Mark reservation checked out and room as needing housekeeping
    await withCurrentTenantDb(prisma, async (client) => {
      await client.$executeRawUnsafe(
        `UPDATE reservations SET status = 'CHECKED_OUT', actual_check_out = NOW(), invoice_id = $2, updated_at = NOW() WHERE id = $1`,
        id, invoice.id
      );
      await client.$executeRawUnsafe(
        `UPDATE rooms SET status = 'HOUSEKEEPING', housekeeping_status = 'DIRTY', updated_at = NOW() WHERE id = $1`,
        reservation.room_id
      );
    });

    res.json({ success: true, invoiceId: invoice.id, totalAmount: grandTotal, nights });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Folio ────────────────────────────────────────────────────────────────────

router.get('/reservations/:id/folio', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [resRows, chargeRows] = await Promise.all([
      withCurrentTenantDb(prisma, async (client) => client.$queryRawUnsafe<any[]>(`SELECT * FROM reservations WHERE id = $1`, id)),
      withCurrentTenantDb(prisma, async (client) => client.$queryRawUnsafe<any[]>(`SELECT * FROM folio_charges WHERE reservation_id = $1 ORDER BY charge_date, created_at`, id)),
    ]);
    if (resRows.length === 0) { res.status(404).json({ success: false, error: 'Reservation not found.' }); return; }

    const reservation = resRows[0];
    const charges = chargeRows;
    const nights = Math.max(1, Math.ceil((new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 86_400_000));
    const roomTotal = Number(reservation.rate_per_night) * nights;
    const folioTotal = charges.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({
      success: true,
      reservation,
      charges,
      summary: { nights, ratePerNight: Number(reservation.rate_per_night), roomTotal, folioTotal, grandTotal: roomTotal + folioTotal - Number(reservation.deposit_amount) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reservations/:id/folio-charges', requireRole('Admin', 'Manager', 'Staff') as any, validateBody(folioChargeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;
    const user = (req as any).user;

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      const resRows = await client.$queryRawUnsafe<any[]>(`SELECT status FROM reservations WHERE id = $1`, id);
      if (resRows.length === 0) throw Object.assign(new Error('Reservation not found.'), { status: 404 });
      if (!['CONFIRMED', 'CHECKED_IN'].includes(resRows[0].status)) {
        throw Object.assign(new Error('Cannot add charges to a completed or cancelled reservation.'), { status: 400 });
      }
      return client.$queryRawUnsafe<any[]>(
        `INSERT INTO folio_charges (reservation_id, description, amount, charge_date, posted_by_user_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        id, body.description, body.amount, body.chargeDate ?? new Date().toISOString().slice(0, 10), user?.id ?? null
      );
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status((err as any).status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── Cancel / No-Show ─────────────────────────────────────────────────────────

router.patch('/reservations/:id/cancel', requireRole('Admin', 'Manager') as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, noShow } = req.body as { reason?: string; noShow?: boolean };
    const newStatus = noShow ? 'NO_SHOW' : 'CANCELLED';

    const result = await withCurrentTenantDb(prisma, async (client) => {
      const resRows = await client.$queryRawUnsafe<any[]>(`SELECT * FROM reservations WHERE id = $1`, id);
      if (resRows.length === 0) throw Object.assign(new Error('Reservation not found.'), { status: 404 });
      const reservation = resRows[0];
      if (!['CONFIRMED'].includes(reservation.status)) {
        throw Object.assign(
          new Error(`Cannot cancel a reservation with status ${reservation.status}. Only CONFIRMED reservations can be cancelled.`),
          { status: 400 }
        );
      }

      const notePrefix = `[${newStatus}]${reason ? ': ' + reason : ''}`;
      await client.$executeRawUnsafe(
        `UPDATE reservations SET status = $2, special_requests = CASE WHEN special_requests IS NULL OR special_requests = '' THEN $3 ELSE special_requests || ' | ' || $3 END, updated_at = NOW() WHERE id = $1`,
        id, newStatus, notePrefix
      );

      // Free up the room
      await client.$executeRawUnsafe(
        `UPDATE rooms SET status = 'AVAILABLE', updated_at = NOW() WHERE id = $1`,
        reservation.room_id
      );

      const updated = await client.$queryRawUnsafe<any[]>(`SELECT * FROM reservations WHERE id = $1`, id);
      return updated[0];
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status((err as any).status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── Night Audit ──────────────────────────────────────────────────────────────

router.get('/reports/night-audit', async (req: Request, res: Response): Promise<void> => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const data = await withCurrentTenantDb(prisma, async (client) => {
      const [totalRow, occupiedRow, revenueRow] = await Promise.all([
        client.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS total FROM rooms WHERE is_active = TRUE`),
        client.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*)::int AS occupied FROM reservations
           WHERE status = 'CHECKED_IN' AND check_in_date <= $1::date AND check_out_date > $1::date`, date),
        client.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(SUM(rate_per_night), 0)::numeric AS room_revenue
           FROM reservations
           WHERE status IN ('CHECKED_IN', 'CHECKED_OUT')
             AND check_in_date <= $1::date AND check_out_date > $1::date`, date),
      ]);
      const total = Number(totalRow[0]?.total ?? 0);
      const occupied = Number(occupiedRow[0]?.occupied ?? 0);
      const roomRevenue = Number(revenueRow[0]?.room_revenue ?? 0);
      return {
        date,
        totalRooms: total,
        occupiedRooms: occupied,
        occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
        roomRevenue,
        revpar: total > 0 ? Math.round((roomRevenue / total) * 100) / 100 : 0,
      };
    });

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/occupancy', async (req: Request, res: Response): Promise<void> => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);

    const rows = await withCurrentTenantDb(prisma, async (client) => {
      return client.$queryRawUnsafe<any[]>(
        `SELECT
           gs::date AS date,
           (SELECT COUNT(*)::int FROM rooms WHERE is_active = TRUE) AS total_rooms,
           (SELECT COUNT(*)::int FROM reservations
            WHERE status IN ('CHECKED_IN','CHECKED_OUT')
              AND check_in_date <= gs AND check_out_date > gs) AS occupied_rooms
         FROM generate_series($1::date, $2::date, '1 day'::interval) gs
         ORDER BY gs`,
        from, to
      );
    });

    const data = (rows as any[]).map((r) => ({
      date: r.date,
      totalRooms: Number(r.total_rooms),
      occupiedRooms: Number(r.occupied_rooms),
      occupancyPct: Number(r.total_rooms) > 0
        ? Math.round((Number(r.occupied_rooms) / Number(r.total_rooms)) * 100)
        : 0,
    }));

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
