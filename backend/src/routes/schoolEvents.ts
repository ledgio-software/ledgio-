import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/events?month=&year=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { month, year } = req.query as { month?: string; year?: string };

    let dateFilter: { gte: Date; lte: Date } | undefined;
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      dateFilter = { gte: start, lte: end };
    }

    const events = await prisma.schoolEvent.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { eventDate: dateFilter } : {}),
      },
      orderBy: { eventDate: 'asc' },
    });

    res.json({ success: true, data: { events } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/events
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, description, eventDate, endDate, eventType, location } = req.body;

    if (!title || !eventDate || !eventType) {
      res.status(400).json({ success: false, error: 'title, eventDate, eventType are required' });
      return;
    }

    const event = await prisma.schoolEvent.create({
      data: {
        tenantId,
        title,
        description: description || null,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        eventType,
        location: location || null,
      },
    });

    res.status(201).json({ success: true, data: { event } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/events/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, description, eventDate, endDate, eventType, location } = req.body;

    const event = await prisma.schoolEvent.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(eventType !== undefined && { eventType }),
        ...(location !== undefined && { location: location || null }),
      },
    });

    res.json({ success: true, data: { event } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/events/:id
router.delete('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.schoolEvent.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
