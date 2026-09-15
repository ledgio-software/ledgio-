import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const VALID_VEHICLE_STATUSES = new Set(['ACTIVE', 'MAINTENANCE', 'RETIRED']);
const VALID_FUEL_TYPES = new Set(['PETROL', 'DIESEL', 'LPG']);
const VALID_MAINT_TYPES = new Set(['OIL_CHANGE', 'TYRE', 'BRAKE', 'SERVICE', 'REPAIR', 'OTHER']);

// ─── VEHICLES ────────────────────────────────────────────────────────────────

router.get('/vehicles', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const vehicles = await prisma.transportVehicle.findMany({
      where: { tenantId },
      orderBy: { regNumber: 'asc' },
    });
    res.json({ success: true, data: { vehicles } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/vehicles', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { regNumber, make, model, capacity, fuelType, status } = req.body;
    if (!regNumber?.trim()) {
      res.status(400).json({ success: false, error: 'regNumber is required.' }); return;
    }
    if (fuelType && !VALID_FUEL_TYPES.has(fuelType)) {
      res.status(400).json({ success: false, error: 'fuelType must be PETROL, DIESEL, or LPG.' }); return;
    }
    const vehicle = await prisma.transportVehicle.create({
      data: { tenantId, regNumber: regNumber.trim().toUpperCase(), make, model, capacity: capacity ? Number(capacity) : null, fuelType, status: status ?? 'ACTIVE' },
    });
    res.status(201).json({ success: true, data: { vehicle } });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ success: false, error: 'A vehicle with this reg number already exists.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/vehicles/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { regNumber, make, model, capacity, fuelType, status } = req.body;
    if (fuelType && !VALID_FUEL_TYPES.has(fuelType)) {
      res.status(400).json({ success: false, error: 'fuelType must be PETROL, DIESEL, or LPG.' }); return;
    }
    if (status && !VALID_VEHICLE_STATUSES.has(status)) {
      res.status(400).json({ success: false, error: 'status must be ACTIVE, MAINTENANCE, or RETIRED.' }); return;
    }
    const vehicle = await prisma.transportVehicle.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(regNumber !== undefined && { regNumber: regNumber.trim().toUpperCase() }),
        ...(make !== undefined && { make }),
        ...(model !== undefined && { model }),
        ...(capacity !== undefined && { capacity: capacity ? Number(capacity) : null }),
        ...(fuelType !== undefined && { fuelType }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ success: true, data: { vehicle } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Vehicle not found.' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ success: false, error: 'Reg number already in use.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/vehicles/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.transportVehicle.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Vehicle not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DRIVERS ─────────────────────────────────────────────────────────────────

router.get('/drivers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const drivers = await prisma.transportDriver.findMany({
      where: { tenantId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json({ success: true, data: { drivers } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/drivers', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, phone, licenseNo, licenseExp } = req.body;
    if (!firstName?.trim() || !lastName?.trim()) {
      res.status(400).json({ success: false, error: 'firstName and lastName are required.' }); return;
    }
    const driver = await prisma.transportDriver.create({
      data: { tenantId, firstName: firstName.trim(), lastName: lastName.trim(), phone, licenseNo, licenseExp: licenseExp ? new Date(licenseExp) : null },
    });
    res.status(201).json({ success: true, data: { driver } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/drivers/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, phone, licenseNo, licenseExp, isActive } = req.body;
    const driver = await prisma.transportDriver.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(phone !== undefined && { phone }),
        ...(licenseNo !== undefined && { licenseNo }),
        ...(licenseExp !== undefined && { licenseExp: licenseExp ? new Date(licenseExp) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data: { driver } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Driver not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/drivers/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    // Soft delete — detach from routes first
    await prisma.transportRoute.updateMany({ where: { tenantId, driverId: req.params.id }, data: { driverId: null } });
    await prisma.transportDriver.update({ where: { id: req.params.id, tenantId }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Driver not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

router.get('/routes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const routes = await prisma.transportRoute.findMany({
      where: { tenantId },
      include: {
        vehicle: { select: { id: true, regNumber: true, make: true, model: true, capacity: true, status: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true, licenseExp: true } },
        stops: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { routes } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/routes', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, description, vehicleId, driverId, morningDep, afternoonDep, fee, stops } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'name is required.' }); return;
    }
    const route = await prisma.transportRoute.create({
      data: {
        tenantId, name: name.trim(), description,
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        morningDep, afternoonDep,
        fee: fee !== undefined ? Number(fee) : null,
        stops: Array.isArray(stops) && stops.length > 0
          ? { create: stops.map((s: { name: string; order: number; landmark?: string }) => ({ name: s.name, order: s.order, landmark: s.landmark ?? null })) }
          : undefined,
      },
      include: { vehicle: true, driver: true, stops: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json({ success: true, data: { route } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/routes/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, description, vehicleId, driverId, morningDep, afternoonDep, fee, isActive, stops } = req.body;
    const route = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportRoute.update({
        where: { id: req.params.id, tenantId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(vehicleId !== undefined && { vehicleId: vehicleId || null }),
          ...(driverId !== undefined && { driverId: driverId || null }),
          ...(morningDep !== undefined && { morningDep }),
          ...(afternoonDep !== undefined && { afternoonDep }),
          ...(fee !== undefined && { fee: fee !== null ? Number(fee) : null }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      if (Array.isArray(stops)) {
        await tx.transportStop.deleteMany({ where: { routeId: req.params.id } });
        if (stops.length > 0) {
          await tx.transportStop.createMany({
            data: stops.map((s: { name: string; order: number; landmark?: string }) => ({ routeId: req.params.id, name: s.name, order: s.order, landmark: s.landmark ?? null })),
          });
        }
      }
      return tx.transportRoute.findFirst({
        where: { id: req.params.id },
        include: { vehicle: true, driver: true, stops: { orderBy: { order: 'asc' } } },
      });
    });
    res.json({ success: true, data: { route } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Route not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/routes/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.transportRoute.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Route not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FUEL LOGS ────────────────────────────────────────────────────────────────

router.get('/fuel-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { vehicleId } = req.query as { vehicleId?: string };
    const logs = await prisma.transportFuelLog.findMany({
      where: { tenantId, ...(vehicleId && { vehicleId }) },
      include: { vehicle: { select: { regNumber: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    const totalCost = logs.reduce((s, l) => s + Number(l.totalCost), 0);
    const totalLitres = logs.reduce((s, l) => s + Number(l.litres), 0);
    res.json({ success: true, data: { logs, totalCost, totalLitres } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fuel-logs', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { vehicleId, date, litres, costPerLitre, odometer, station } = req.body;
    if (!vehicleId || !date || litres === undefined || costPerLitre === undefined) {
      res.status(400).json({ success: false, error: 'vehicleId, date, litres and costPerLitre are required.' }); return;
    }
    const l = Number(litres); const c = Number(costPerLitre);
    if (isNaN(l) || l <= 0 || isNaN(c) || c <= 0) {
      res.status(400).json({ success: false, error: 'litres and costPerLitre must be positive numbers.' }); return;
    }
    const vehicle = await prisma.transportVehicle.findFirst({ where: { id: vehicleId, tenantId }, select: { id: true } });
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found.' }); return; }
    const log = await prisma.transportFuelLog.create({
      data: { tenantId, vehicleId, date: new Date(date), litres: l, costPerLitre: c, totalCost: +(l * c).toFixed(2), odometer: odometer ? Number(odometer) : null, station },
    });
    res.status(201).json({ success: true, data: { log } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/fuel-logs/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.transportFuelLog.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Fuel log not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── MAINTENANCE LOGS ─────────────────────────────────────────────────────────

router.get('/maint-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { vehicleId } = req.query as { vehicleId?: string };
    const logs = await prisma.transportMaintLog.findMany({
      where: { tenantId, ...(vehicleId && { vehicleId }) },
      include: { vehicle: { select: { regNumber: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    const totalCost = logs.reduce((s, l) => s + Number(l.cost), 0);
    // Upcoming maintenance (next_due_date within 30 days)
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const upcoming = logs.filter((l) => l.nextDueDate && l.nextDueDate <= soon && l.nextDueDate >= new Date());
    res.json({ success: true, data: { logs, totalCost, upcomingCount: upcoming.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/maint-logs', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { vehicleId, date, type, description, cost, workshop, nextDueDate } = req.body;
    if (!vehicleId || !date || !type || !description || cost === undefined) {
      res.status(400).json({ success: false, error: 'vehicleId, date, type, description and cost are required.' }); return;
    }
    if (!VALID_MAINT_TYPES.has(type)) {
      res.status(400).json({ success: false, error: `type must be one of: ${[...VALID_MAINT_TYPES].join(', ')}` }); return;
    }
    const vehicle = await prisma.transportVehicle.findFirst({ where: { id: vehicleId, tenantId }, select: { id: true } });
    if (!vehicle) { res.status(404).json({ success: false, error: 'Vehicle not found.' }); return; }
    const log = await prisma.transportMaintLog.create({
      data: { tenantId, vehicleId, date: new Date(date), type, description, cost: Number(cost), workshop, nextDueDate: nextDueDate ? new Date(nextDueDate) : null },
    });
    res.status(201).json({ success: true, data: { log } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/maint-logs/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.transportMaintLog.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Maintenance log not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const [vehicles, drivers, routes, fuelLogs, maintLogs] = await Promise.all([
      prisma.transportVehicle.findMany({ where: { tenantId } }),
      prisma.transportDriver.findMany({ where: { tenantId } }),
      prisma.transportRoute.findMany({ where: { tenantId, isActive: true } }),
      prisma.transportFuelLog.findMany({ where: { tenantId } }),
      prisma.transportMaintLog.findMany({ where: { tenantId } }),
    ]);

    const now = new Date();
    const soon = new Date(); soon.setDate(soon.getDate() + 30);

    const licenseExpiringSoon = drivers.filter((d) => d.licenseExp && d.licenseExp <= soon && d.licenseExp >= now).length;
    const vehiclesInMaint = vehicles.filter((v) => v.status === 'MAINTENANCE').length;
    const totalFuelCost = fuelLogs.reduce((s, l) => s + Number(l.totalCost), 0);
    const totalMaintCost = maintLogs.reduce((s, l) => s + Number(l.cost), 0);
    const upcomingMaint = maintLogs.filter((l) => l.nextDueDate && l.nextDueDate <= soon && l.nextDueDate >= now).length;

    res.json({
      success: true,
      data: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter((v) => v.status === 'ACTIVE').length,
        vehiclesInMaintenance: vehiclesInMaint,
        totalDrivers: drivers.filter((d) => d.isActive).length,
        licenseExpiringSoon,
        activeRoutes: routes.length,
        totalFuelCost,
        totalMaintCost,
        upcomingMaintenance: upcomingMaint,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
