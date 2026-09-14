import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const VALID_LEVELS = ['CRECHE', 'NURSERY', 'KG', 'PRIMARY', 'JHS'];

// GET /api/v1/school/classes
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const classes = await prisma.schoolClass.findMany({
      where: { tenantId },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    // Attach student count to each class
    const counts = await prisma.student.groupBy({
      by: ['className'],
      where: { tenantId, isActive: true },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.className, c._count.id]));
    const data = classes.map((c) => ({ ...c, studentCount: countMap.get(c.name) ?? 0 }));
    res.json({ success: true, data: { classes: data } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/classes
router.post('/', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, level, capacity } = req.body;

    if (!name?.trim() || !level) {
      res.status(400).json({ success: false, error: 'name and level are required.' });
      return;
    }
    if (!VALID_LEVELS.includes(level)) {
      res.status(400).json({ success: false, error: `level must be one of: ${VALID_LEVELS.join(', ')}.` });
      return;
    }

    const schoolClass = await prisma.schoolClass.create({
      data: {
        tenantId,
        name: name.trim(),
        level,
        capacity: capacity ? Number(capacity) : 30,
      },
    });
    res.status(201).json({ success: true, data: { class: schoolClass } });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A class with that name already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/classes/:id
router.put('/:id', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, level, capacity, isActive } = req.body;

    if (level && !VALID_LEVELS.includes(level)) {
      res.status(400).json({ success: false, error: `level must be one of: ${VALID_LEVELS.join(', ')}.` });
      return;
    }

    const schoolClass = await prisma.schoolClass.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(level !== undefined && { level }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    res.json({ success: true, data: { class: schoolClass } });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A class with that name already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/classes/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    // Prevent deletion if students are assigned
    const className = await prisma.schoolClass.findUnique({ where: { id: req.params.id, tenantId }, select: { name: true } });
    if (!className) { res.status(404).json({ success: false, error: 'Class not found.' }); return; }
    const count = await prisma.student.count({ where: { tenantId, className: className.name, isActive: true } });
    if (count > 0) {
      res.status(409).json({ success: false, error: `Cannot delete: ${count} active student(s) are assigned to this class.` });
      return;
    }
    await prisma.schoolClass.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
