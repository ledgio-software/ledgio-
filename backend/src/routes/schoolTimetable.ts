import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/timetable?className=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { className } = req.query as { className?: string };

    const slots = await prisma.timetableSlot.findMany({
      where: { tenantId, ...(className ? { className } : {}) },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ success: true, data: { slots } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/timetable
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { className, dayOfWeek, startTime, endTime, subjectName, teacherName } = req.body;

    if (!className || !dayOfWeek || !startTime || !endTime || !subjectName) {
      res.status(400).json({ success: false, error: 'className, dayOfWeek, startTime, endTime, subjectName are required' });
      return;
    }

    const slot = await prisma.timetableSlot.create({
      data: { tenantId, className, dayOfWeek, startTime, endTime, subjectName, teacherName: teacherName || null },
    });

    res.status(201).json({ success: true, data: { slot } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/timetable/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { className, dayOfWeek, startTime, endTime, subjectName, teacherName } = req.body;

    const slot = await prisma.timetableSlot.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(className !== undefined && { className }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(subjectName !== undefined && { subjectName }),
        ...(teacherName !== undefined && { teacherName: teacherName || null }),
      },
    });

    res.json({ success: true, data: { slot } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/timetable/:id
router.delete('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.timetableSlot.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
