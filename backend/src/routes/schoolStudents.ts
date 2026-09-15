import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

// GET /api/v1/school/students?search=&limit=&className=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { search, limit, className } = req.query as { search?: string; limit?: string; className?: string };
    const take = limit ? Math.min(200, parseInt(limit, 10)) : undefined;
    const students = await prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(className ? { className } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { studentCode: { contains: search, mode: 'insensitive' } },
                { className: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ className: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      ...(take ? { take } : {}),
    });
    res.json({ success: true, data: { students } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/students
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, className, guardianName, guardianPhone, guardianEmail, dateOfBirth } = req.body;

    if (!firstName || !lastName || !className || !guardianName || !guardianPhone) {
      res.status(400).json({ success: false, error: 'firstName, lastName, className, guardianName, and guardianPhone are required.' });
      return;
    }

    // Auto-generate student code: STU-NNNN
    const count = await prisma.student.count({ where: { tenantId } });
    const studentCode = `STU-${String(count + 1).padStart(4, '0')}`;

    const student = await prisma.student.create({
      data: {
        tenantId, studentCode, firstName, lastName, className,
        guardianName, guardianPhone,
        guardianEmail: guardianEmail || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
    res.status(201).json({ success: true, data: { student } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/students/promote
// Bulk-promote students from one class to another. Admin only.
// Body: { fromClass: string, toClass: string, studentIds?: string[] }
// If studentIds is omitted or empty, promotes ALL active students in fromClass.
// IMPORTANT: must be registered before /:id routes to avoid route collision.
router.post('/promote', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { fromClass, toClass, studentIds } = req.body as {
      fromClass?: string;
      toClass?: string;
      studentIds?: string[];
    };

    if (!fromClass || !toClass) {
      res.status(400).json({ success: false, error: 'fromClass and toClass are required.' });
      return;
    }
    if (fromClass === toClass) {
      res.status(400).json({ success: false, error: 'fromClass and toClass must be different.' });
      return;
    }

    const idFilter = Array.isArray(studentIds) && studentIds.length > 0
      ? { id: { in: studentIds } }
      : {};

    const result = await prisma.student.updateMany({
      where: { tenantId, className: fromClass, isActive: true, ...idFilter },
      data: { className: toClass },
    });

    res.json({
      success: true,
      data: { promoted: result.count, fromClass, toClass },
      message: `${result.count} student${result.count !== 1 ? 's' : ''} promoted from ${fromClass} to ${toClass}.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/students/bulk — CSV import, up to 500 rows
router.post('/bulk', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { students } = req.body as {
      students: Array<{
        firstName: string; lastName: string; className: string;
        guardianName: string; guardianPhone: string;
        guardianEmail?: string; dateOfBirth?: string;
      }>;
    };

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ success: false, error: 'students array is required and must not be empty.' });
      return;
    }
    if (students.length > 500) {
      res.status(400).json({ success: false, error: 'Maximum 500 students per import.' });
      return;
    }

    const baseCount = await prisma.student.count({ where: { tenantId } });
    const results: Array<{ row: number; success: boolean; studentCode?: string; name?: string; error?: string }> = [];
    let successCount = 0;

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.firstName?.trim() || !s.lastName?.trim() || !s.className?.trim() || !s.guardianName?.trim() || !s.guardianPhone?.trim()) {
        results.push({ row: i + 1, success: false, error: 'Missing required fields (First Name, Last Name, Class, Guardian Name, Guardian Phone).' });
        continue;
      }
      try {
        const studentCode = `STU-${String(baseCount + successCount + 1).padStart(4, '0')}`;
        await prisma.student.create({
          data: {
            tenantId, studentCode,
            firstName: s.firstName.trim(), lastName: s.lastName.trim(),
            className: s.className.trim(),
            guardianName: s.guardianName.trim(), guardianPhone: s.guardianPhone.trim(),
            guardianEmail: s.guardianEmail?.trim() || null,
            dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
          },
        });
        successCount++;
        results.push({ row: i + 1, success: true, studentCode, name: `${s.firstName.trim()} ${s.lastName.trim()}` });
      } catch (err: any) {
        results.push({ row: i + 1, success: false, error: err.message });
      }
    }

    const failed = results.filter((r) => !r.success).length;
    res.status(201).json({
      success: true,
      data: { imported: successCount, failed, results },
      message: `Imported ${successCount} student${successCount !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} row${failed !== 1 ? 's' : ''} had errors.` : '.'}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/students/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { firstName, lastName, className, guardianName, guardianPhone, guardianEmail, dateOfBirth, isActive } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(className !== undefined && { className }),
        ...(guardianName !== undefined && { guardianName }),
        ...(guardianPhone !== undefined && { guardianPhone }),
        ...(guardianEmail !== undefined && { guardianEmail: guardianEmail || null }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ success: true, data: { student } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/students/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.student.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
