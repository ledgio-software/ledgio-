import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const VALID_STATUSES = ['draft', 'completed'];

// IEF framework — 4 domains, 19 indicators total
export const IEF_FRAMEWORK = [
  {
    code: 'D1',
    domain: 'Leadership & Management',
    indicators: [
      { code: 'D1.1', label: 'School vision, mission and values' },
      { code: 'D1.2', label: 'School improvement planning' },
      { code: 'D1.3', label: 'Teacher management and deployment' },
      { code: 'D1.4', label: 'Resource management and accountability' },
      { code: 'D1.5', label: 'Monitoring, evaluation and review' },
    ],
  },
  {
    code: 'D2',
    domain: 'Teaching & Learning',
    indicators: [
      { code: 'D2.1', label: 'Lesson preparation and scheme of work' },
      { code: 'D2.2', label: 'Curriculum coverage and delivery' },
      { code: 'D2.3', label: 'Assessment of and for learning' },
      { code: 'D2.4', label: 'Inclusive classroom practices' },
      { code: 'D2.5', label: 'Learning environment and resources' },
    ],
  },
  {
    code: 'D3',
    domain: 'Learner Development & Support',
    indicators: [
      { code: 'D3.1', label: 'Learner welfare and safeguarding' },
      { code: 'D3.2', label: 'Guidance and counselling services' },
      { code: 'D3.3', label: 'Co-curricular and extra-curricular activities' },
      { code: 'D3.4', label: 'Health, nutrition and hygiene' },
      { code: 'D3.5', label: 'Special educational needs support' },
    ],
  },
  {
    code: 'D4',
    domain: 'Partnership, Collaboration & Communication',
    indicators: [
      { code: 'D4.1', label: 'Parental and community engagement' },
      { code: 'D4.2', label: 'Stakeholder collaboration' },
      { code: 'D4.3', label: 'Communication systems and channels' },
      { code: 'D4.4', label: 'External partnerships and networks' },
    ],
  },
];

function computeScores(ratings: { indicatorCode: string; score: number }[]) {
  const ratingMap = new Map(ratings.map((r) => [r.indicatorCode, r.score]));
  const domainScores = IEF_FRAMEWORK.map(({ code, domain, indicators }) => {
    const scores = indicators.map((i) => ratingMap.get(i.code) ?? 0).filter((s) => s > 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { code, domain, avg, rated: scores.length, total: indicators.length };
  });
  const allScores = domainScores.flatMap((d) =>
    Array(d.rated).fill(0).map((_, i) => {
      const domainRatings = ratings.filter((r) => r.indicatorCode.startsWith(d.code));
      return domainRatings[i]?.score ?? 0;
    })
  );
  const validAll = ratings.map((r) => r.score).filter((s) => s > 0);
  const overallAvg = validAll.length ? validAll.reduce((a, b) => a + b, 0) / validAll.length : null;
  return { domainScores, overallAvg };
}

function ratingLabel(avg: number | null): string {
  if (avg === null) return 'Not Rated';
  if (avg >= 3.5) return 'Outstanding';
  if (avg >= 2.5) return 'Good';
  if (avg >= 1.5) return 'Adequate';
  return 'Inadequate';
}

// GET /api/v1/school/nasia/framework
router.get('/framework', (_req: Request, res: Response): void => {
  res.json({ success: true, data: { framework: IEF_FRAMEWORK } });
});

// GET /api/v1/school/nasia/assessments
router.get('/assessments', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const assessments = await prisma.nasiaAssessment.findMany({
      where: { tenantId },
      include: { ratings: { select: { indicatorCode: true, score: true } } },
      orderBy: { date: 'desc' },
    });
    const data = assessments.map((a) => {
      const { domainScores, overallAvg } = computeScores(a.ratings);
      return {
        id: a.id,
        title: a.title,
        date: a.date,
        status: a.status,
        createdAt: a.createdAt,
        ratedCount: a.ratings.length,
        overallAvg,
        overallLabel: ratingLabel(overallAvg),
        domainScores,
      };
    });
    res.json({ success: true, data: { assessments: data } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/nasia/assessments
router.post('/assessments', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, date } = req.body;
    if (!title?.trim() || !date) {
      res.status(400).json({ success: false, error: 'title and date are required.' });
      return;
    }
    const assessment = await prisma.nasiaAssessment.create({
      data: { tenantId, title: title.trim(), date: new Date(date), status: 'draft' },
    });
    res.status(201).json({ success: true, data: { assessment } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/school/nasia/assessments/:id
router.get('/assessments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const assessment = await prisma.nasiaAssessment.findFirst({
      where: { id: req.params.id, tenantId },
      include: { ratings: true },
    });
    if (!assessment) { res.status(404).json({ success: false, error: 'Assessment not found.' }); return; }
    const { domainScores, overallAvg } = computeScores(assessment.ratings);
    res.json({
      success: true,
      data: {
        assessment: {
          ...assessment,
          overallAvg,
          overallLabel: ratingLabel(overallAvg),
          domainScores,
        },
        framework: IEF_FRAMEWORK,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/nasia/assessments/:id
router.put('/assessments/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, date, status } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: 'status must be draft or completed.' });
      return;
    }
    const assessment = await prisma.nasiaAssessment.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ success: true, data: { assessment } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Assessment not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/nasia/assessments/:id
router.delete('/assessments/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.nasiaAssessment.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Assessment not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/nasia/assessments/:id/ratings  (bulk upsert)
router.put('/assessments/:id/ratings', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const assessment = await prisma.nasiaAssessment.findFirst({ where: { id: req.params.id, tenantId } });
    if (!assessment) { res.status(404).json({ success: false, error: 'Assessment not found.' }); return; }

    const { ratings } = req.body as { ratings: { indicatorCode: string; score: number; notes?: string }[] };
    if (!Array.isArray(ratings)) {
      res.status(400).json({ success: false, error: 'ratings must be an array.' });
      return;
    }

    const validCodes = new Set(IEF_FRAMEWORK.flatMap((d) => d.indicators.map((i) => i.code)));
    for (const r of ratings) {
      if (!validCodes.has(r.indicatorCode)) {
        res.status(400).json({ success: false, error: `Unknown indicator code: ${r.indicatorCode}` });
        return;
      }
      if (!Number.isInteger(r.score) || r.score < 1 || r.score > 4) {
        res.status(400).json({ success: false, error: `score must be 1–4 for ${r.indicatorCode}.` });
        return;
      }
    }

    await prisma.$transaction(
      ratings.map((r) =>
        prisma.nasiaRating.upsert({
          where: { assessmentId_indicatorCode: { assessmentId: req.params.id, indicatorCode: r.indicatorCode } },
          update: { score: r.score, notes: r.notes ?? null },
          create: { assessmentId: req.params.id, indicatorCode: r.indicatorCode, score: r.score, notes: r.notes ?? null },
        })
      )
    );

    const updated = await prisma.nasiaAssessment.findFirst({
      where: { id: req.params.id },
      include: { ratings: true },
    });
    const { domainScores, overallAvg } = computeScores(updated!.ratings);
    res.json({ success: true, data: { domainScores, overallAvg, overallLabel: ratingLabel(overallAvg) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
