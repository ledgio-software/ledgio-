import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const CPD_TARGET_PER_YEAR = 50; // NTC: 100 credits over 2-year cycle → 50/year

const VALID_CPD_CATEGORIES = ['WORKSHOP', 'CONFERENCE', 'ONLINE_COURSE', 'PGDE', 'SEMINAR', 'SCHOOL_BASED', 'OTHER'];

function cpdYearRange(year: number) {
  return { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) };
}

function licenseStatus(expiryDate: Date | null | undefined): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!expiryDate) return 'none';
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days <= 60) return 'expiring';
  return 'valid';
}

// GET /api/v1/school/teachers
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const currentYear = new Date().getFullYear();

    const teachers = await prisma.teacher.findMany({
      where: { tenantId },
      include: {
        cpdActivities: {
          where: { date: cpdYearRange(currentYear) },
          select: { hours: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const data = teachers.map((t) => {
      const cpdHoursThisYear = t.cpdActivities.reduce((sum, a) => sum + Number(a.hours), 0);
      return {
        id: t.id,
        staffId: t.staffId,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        subject: t.subject,
        className: t.className,
        ntcLicenseNo: t.ntcLicenseNo,
        ntcIssueDate: t.ntcIssueDate,
        ntcExpiryDate: t.ntcExpiryDate,
        isActive: t.isActive,
        createdAt: t.createdAt,
        licenseStatus: licenseStatus(t.ntcExpiryDate),
        cpdHoursThisYear,
        cpdTargetYear: CPD_TARGET_PER_YEAR,
      };
    });

    // Summary stats
    const active = data.filter((t) => t.isActive);
    const summary = {
      total: active.length,
      licensed: active.filter((t) => t.licenseStatus === 'valid').length,
      expiringSoon: active.filter((t) => t.licenseStatus === 'expiring').length,
      expired: active.filter((t) => t.licenseStatus === 'expired').length,
      noLicense: active.filter((t) => t.licenseStatus === 'none').length,
      cpdCompliant: active.filter((t) => t.cpdHoursThisYear >= CPD_TARGET_PER_YEAR).length,
    };

    res.json({ success: true, data: { teachers: data, summary } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/teachers
router.post('/', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, staffId, email, phone, subject, className, ntcLicenseNo, ntcIssueDate, ntcExpiryDate } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      res.status(400).json({ success: false, error: 'First name and last name are required.' });
      return;
    }

    const teacher = await prisma.teacher.create({
      data: {
        tenantId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        staffId: staffId?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        subject: subject?.trim() || null,
        className: className?.trim() || null,
        ntcLicenseNo: ntcLicenseNo?.trim() || null,
        ntcIssueDate: ntcIssueDate ? new Date(ntcIssueDate) : null,
        ntcExpiryDate: ntcExpiryDate ? new Date(ntcExpiryDate) : null,
      },
    });
    res.status(201).json({ success: true, data: { teacher } });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A teacher with that staff ID already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/teachers/:id
router.put('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, staffId, email, phone, subject, className, ntcLicenseNo, ntcIssueDate, ntcExpiryDate, isActive } = req.body;

    const teacher = await prisma.teacher.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(staffId !== undefined && { staffId: staffId?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(subject !== undefined && { subject: subject?.trim() || null }),
        ...(className !== undefined && { className: className?.trim() || null }),
        ...(ntcLicenseNo !== undefined && { ntcLicenseNo: ntcLicenseNo?.trim() || null }),
        ...(ntcIssueDate !== undefined && { ntcIssueDate: ntcIssueDate ? new Date(ntcIssueDate) : null }),
        ...(ntcExpiryDate !== undefined && { ntcExpiryDate: ntcExpiryDate ? new Date(ntcExpiryDate) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    res.json({ success: true, data: { teacher } });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, error: 'Teacher not found.' }); return; }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/teachers/:id  (soft delete)
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.teacher.update({ where: { id: req.params.id, tenantId }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CPD Activities ──────────────────────────────────────────────────────────

// GET /api/v1/school/teachers/:id/cpd
router.get('/:id/cpd', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, tenantId }, select: { id: true, firstName: true, lastName: true } });
    if (!teacher) { res.status(404).json({ success: false, error: 'Teacher not found.' }); return; }

    const activities = await prisma.cpdActivity.findMany({
      where: { teacherId: req.params.id, tenantId },
      orderBy: { date: 'desc' },
    });

    // Group hours by year
    const byYear: Record<number, number> = {};
    for (const a of activities) {
      const y = new Date(a.date).getFullYear();
      byYear[y] = (byYear[y] ?? 0) + Number(a.hours);
    }

    res.json({ success: true, data: { teacher, activities, byYear, targetPerYear: CPD_TARGET_PER_YEAR } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/teachers/:id/cpd
router.post('/:id/cpd', requireRole('Admin', 'Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, category, date, hours, provider, certificate } = req.body;

    if (!title?.trim() || !category || !date || hours === undefined) {
      res.status(400).json({ success: false, error: 'title, category, date, and hours are required.' });
      return;
    }
    if (!VALID_CPD_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: `category must be one of: ${VALID_CPD_CATEGORIES.join(', ')}.` });
      return;
    }
    const numHours = Number(hours);
    if (isNaN(numHours) || numHours <= 0 || numHours > 200) {
      res.status(400).json({ success: false, error: 'hours must be between 0.5 and 200.' });
      return;
    }

    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, tenantId } });
    if (!teacher) { res.status(404).json({ success: false, error: 'Teacher not found.' }); return; }

    const activity = await prisma.cpdActivity.create({
      data: {
        tenantId,
        teacherId: req.params.id,
        title: title.trim(),
        category,
        date: new Date(date),
        hours: numHours,
        provider: provider?.trim() || null,
        certificate: certificate?.trim() || null,
      },
    });
    res.status(201).json({ success: true, data: { activity } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/teachers/:id/cpd/:activityId
router.delete('/:id/cpd/:activityId', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.cpdActivity.delete({ where: { id: req.params.activityId, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
