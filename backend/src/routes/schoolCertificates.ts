import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/certificates?studentId=&type=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, type } = req.query as { studentId?: string; type?: string };

    const certificates = await prisma.schoolCertificate.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
        ...(type ? { certificateType: type } : {}),
      },
      orderBy: { issuedDate: 'desc' },
    });

    // Attach student names
    const studentIds = [...new Set(certificates.map((c) => c.studentId))];
    const students = await prisma.student.findMany({
      where: { tenantId, id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, className: true, studentCode: true },
    });
    const studentMap: Record<string, (typeof students)[0]> = {};
    for (const s of students) studentMap[s.id] = s;

    const rows = certificates.map((c) => ({ ...c, student: studentMap[c.studentId] ?? null }));

    res.json({ success: true, data: { certificates: rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/certificates
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, certificateType, issuedDate, issuedBy, notes } = req.body;

    if (!studentId || !certificateType || !issuedDate || !issuedBy) {
      res.status(400).json({ success: false, error: 'studentId, certificateType, issuedDate, issuedBy are required' });
      return;
    }

    const certificate = await prisma.schoolCertificate.create({
      data: {
        tenantId,
        studentId,
        certificateType,
        issuedDate: new Date(issuedDate),
        issuedBy,
        notes: notes || null,
      },
    });

    res.status(201).json({ success: true, data: { certificate } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/certificates/:id/print
router.get('/:id/print', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const certificate = await prisma.schoolCertificate.findFirst({
      where: { id: req.params.id, tenantId },
    });

    if (!certificate) {
      res.status(404).json({ success: false, error: 'Certificate not found' });
      return;
    }

    const student = await prisma.student.findFirst({
      where: { id: certificate.studentId, tenantId },
    });

    res.json({ success: true, data: { certificate, student } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
