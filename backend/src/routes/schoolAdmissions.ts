import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/admissions?status=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { status } = req.query as { status?: string };

    const admissions = await prisma.admission.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { admissions } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/admissions
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const {
      applicantFirstName, applicantLastName, dateOfBirth,
      applyingClass, parentName, parentPhone, parentEmail, notes,
    } = req.body;

    if (!applicantFirstName || !applicantLastName || !applyingClass || !parentName || !parentPhone) {
      res.status(400).json({ success: false, error: 'applicantFirstName, applicantLastName, applyingClass, parentName, parentPhone are required' });
      return;
    }

    // Auto-generate application number ADM-{year}-{seq}
    const year = new Date().getFullYear();
    const count = await prisma.admission.count({ where: { tenantId } });
    const applicationNumber = `ADM-${year}-${String(count + 1).padStart(4, '0')}`;

    const admission = await prisma.admission.create({
      data: {
        tenantId,
        applicationNumber,
        applicantFirstName,
        applicantLastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        applyingClass,
        parentName,
        parentPhone,
        parentEmail: parentEmail || null,
        notes: notes || null,
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, data: { admission } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/admissions/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const {
      applicantFirstName, applicantLastName, dateOfBirth, applyingClass,
      parentName, parentPhone, parentEmail, status, notes,
    } = req.body;

    const admission = await prisma.admission.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(applicantFirstName !== undefined && { applicantFirstName }),
        ...(applicantLastName !== undefined && { applicantLastName }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(applyingClass !== undefined && { applyingClass }),
        ...(parentName !== undefined && { parentName }),
        ...(parentPhone !== undefined && { parentPhone }),
        ...(parentEmail !== undefined && { parentEmail: parentEmail || null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    res.json({ success: true, data: { admission } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/admissions/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.admission.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
