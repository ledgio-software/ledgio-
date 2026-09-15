import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/scholarships?studentId=&termId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, termId } = req.query as { studentId?: string; termId?: string };

    const scholarships = await prisma.scholarship.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
        ...(termId ? { termId } : {}),
      },
      orderBy: { awardedDate: 'desc' },
    });

    // Attach student and term info
    const studentIds = [...new Set(scholarships.map((s) => s.studentId))];
    const termIds = [...new Set(scholarships.map((s) => s.termId).filter(Boolean))] as string[];

    const [students, terms] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId, id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, className: true, studentCode: true },
      }),
      termIds.length > 0
        ? prisma.academicTerm.findMany({ where: { tenantId, id: { in: termIds } }, select: { id: true, name: true, academicYear: true } })
        : [],
    ]);

    const studentMap: Record<string, (typeof students)[0]> = {};
    for (const s of students) studentMap[s.id] = s;

    const termMap: Record<string, (typeof terms)[0]> = {};
    for (const t of terms) termMap[t.id] = t;

    const rows = scholarships.map((s) => {
      const stu = studentMap[s.studentId];
      const term = s.termId ? termMap[s.termId] : null;
      return {
        id: s.id,
        studentId: s.studentId,
        studentName: stu ? `${stu.firstName} ${stu.lastName}` : '—',
        studentCode: stu?.studentCode ?? '',
        className: stu?.className ?? '',
        termId: s.termId,
        termName: term ? `${term.name} (${term.academicYear})` : null,
        scholarshipName: s.scholarshipName,
        discountType: s.discountType,
        discountValue: Number(s.discountValue),
        reason: s.reason,
        awardedDate: s.awardedDate.toISOString(),
        student: stu ?? null,
      };
    });

    res.json({ success: true, data: { scholarships: rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/scholarships
router.post('/', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, termId, scholarshipName, discountType, discountValue, reason, awardedDate } = req.body;

    if (!studentId || !scholarshipName || !discountType || discountValue == null || !awardedDate) {
      res.status(400).json({ success: false, error: 'studentId, scholarshipName, discountType, discountValue, awardedDate are required' });
      return;
    }

    const scholarship = await prisma.scholarship.create({
      data: {
        tenantId,
        studentId,
        termId: termId || null,
        scholarshipName,
        discountType,
        discountValue,
        reason: reason || null,
        awardedDate: new Date(awardedDate),
      },
    });

    res.status(201).json({ success: true, data: { scholarship } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/scholarships/:id
router.put('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, scholarshipName, discountType, discountValue, reason, awardedDate } = req.body;

    const scholarship = await prisma.scholarship.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(termId !== undefined && { termId: termId || null }),
        ...(scholarshipName !== undefined && { scholarshipName }),
        ...(discountType !== undefined && { discountType }),
        ...(discountValue !== undefined && { discountValue }),
        ...(reason !== undefined && { reason: reason || null }),
        ...(awardedDate !== undefined && { awardedDate: new Date(awardedDate) }),
      },
    });

    res.json({ success: true, data: { scholarship } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/scholarships/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.scholarship.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
