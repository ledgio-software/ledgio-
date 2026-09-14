import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

// GET /api/v1/school/health?className=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { className } = req.query as { className?: string };

    const students = await prisma.student.findMany({
      where: { tenantId, isActive: true, ...(className ? { className } : {}) },
      orderBy: [{ className: 'asc' }, { lastName: 'asc' }],
    });

    const healthRecords = await prisma.studentHealth.findMany({
      where: { tenantId, studentId: { in: students.map((s) => s.id) } },
    });

    const healthMap: Record<string, (typeof healthRecords)[0]> = {};
    for (const h of healthRecords) healthMap[h.studentId] = h;

    const rows = students.map((s) => ({
      student: {
        id: s.id,
        studentCode: s.studentCode,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.className,
      },
      health: healthMap[s.id] ?? null,
      hasRecord: !!healthMap[s.id],
    }));

    res.json({ success: true, data: { rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/health/:studentId
router.get('/:studentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const health = await prisma.studentHealth.findUnique({
      where: { tenantId_studentId: { tenantId, studentId: req.params.studentId } },
    });

    res.json({ success: true, data: { health } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/health/:studentId (upsert)
router.put('/:studentId', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId } = req.params;
    const {
      bloodGroup, allergies, medicalConditions,
      emergencyContact, emergencyPhone, vaccinationNotes,
    } = req.body;

    const allergiesStr = Array.isArray(allergies) ? allergies.join(',') : (allergies ?? '');
    const conditionsStr = Array.isArray(medicalConditions) ? medicalConditions.join(',') : (medicalConditions ?? '');

    const health = await prisma.studentHealth.upsert({
      where: { tenantId_studentId: { tenantId, studentId } },
      create: {
        tenantId,
        studentId,
        bloodGroup: bloodGroup || null,
        allergies: allergiesStr,
        medicalConditions: conditionsStr,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        vaccinationNotes: vaccinationNotes || null,
      },
      update: {
        bloodGroup: bloodGroup || null,
        allergies: allergiesStr,
        medicalConditions: conditionsStr,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        vaccinationNotes: vaccinationNotes || null,
      },
    });

    res.json({ success: true, data: { health } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
