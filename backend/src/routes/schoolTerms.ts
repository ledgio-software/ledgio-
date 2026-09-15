import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/terms
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const terms = await prisma.academicTerm.findMany({
      where: { tenantId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });
    res.json({ success: true, data: { terms } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/terms
router.post('/', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, academicYear, startDate, endDate, isCurrent } = req.body;

    if (!name || !academicYear || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'name, academicYear, startDate, and endDate are required.' });
      return;
    }

    // Only one term can be current at a time
    if (isCurrent) {
      await prisma.academicTerm.updateMany({ where: { tenantId, isCurrent: true }, data: { isCurrent: false } });
    }

    const term = await prisma.academicTerm.create({
      data: { tenantId, name, academicYear, startDate: new Date(startDate), endDate: new Date(endDate), isCurrent: Boolean(isCurrent) },
    });
    res.status(201).json({ success: true, data: { term } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/terms/:id
router.put('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, academicYear, startDate, endDate, isCurrent } = req.body;

    if (isCurrent) {
      await prisma.academicTerm.updateMany({ where: { tenantId, isCurrent: true }, data: { isCurrent: false } });
    }

    const term = await prisma.academicTerm.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(academicYear !== undefined && { academicYear }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isCurrent !== undefined && { isCurrent: Boolean(isCurrent) }),
      },
    });
    res.json({ success: true, data: { term } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/terms/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.academicTerm.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
