import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/assessments?termId=&className=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, className } = req.query as { termId?: string; className?: string };

    // If className is provided, get student ids in that class first
    let studentIdFilter: string[] | undefined;
    if (className) {
      const classStudents = await prisma.student.findMany({
        where: { tenantId, className },
        select: { id: true },
      });
      studentIdFilter = classStudents.map((s) => s.id);
    }

    const assessments = await prisma.studentAssessment.findMany({
      where: {
        tenantId,
        ...(termId ? { termId } : {}),
        ...(studentIdFilter ? { studentId: { in: studentIdFilter } } : {}),
      },
      orderBy: [{ subjectName: 'asc' }, { examType: 'asc' }],
    });

    // Fetch student names
    const studentIds = [...new Set(assessments.map((a) => a.studentId))];
    const students = await prisma.student.findMany({
      where: { tenantId, id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, className: true, studentCode: true },
    });
    const studentMap: Record<string, (typeof students)[0]> = {};
    for (const s of students) studentMap[s.id] = s;

    const rows = assessments.map((a) => ({
      ...a,
      score: Number(a.score),
      maxScore: Number(a.maxScore),
      student: studentMap[a.studentId] ?? null,
    }));

    res.json({ success: true, data: { assessments: rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/assessments
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, termId, subjectName, examType, score, maxScore } = req.body;

    if (!studentId || !termId || !subjectName || !examType || score == null || maxScore == null) {
      res.status(400).json({ success: false, error: 'studentId, termId, subjectName, examType, score, maxScore required' });
      return;
    }

    const assessment = await prisma.studentAssessment.create({
      data: { tenantId, studentId, termId, subjectName, examType, score, maxScore },
    });

    res.status(201).json({ success: true, data: { assessment } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/assessments/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { subjectName, examType, score, maxScore } = req.body;

    const assessment = await prisma.studentAssessment.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(subjectName !== undefined && { subjectName }),
        ...(examType !== undefined && { examType }),
        ...(score !== undefined && { score }),
        ...(maxScore !== undefined && { maxScore }),
      },
    });

    res.json({ success: true, data: { assessment } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/assessments/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.studentAssessment.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
