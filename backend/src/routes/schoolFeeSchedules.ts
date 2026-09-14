import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

// GET /api/v1/school/fee-schedules?termId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };
    const schedules = await prisma.feeSchedule.findMany({
      where: { tenantId, ...(termId && { termId }) },
      include: { term: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: { schedules } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/school/fee-schedules
router.post('/', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, feeName, className, amount, dueDate } = req.body;

    if (!termId || !feeName || amount === undefined) {
      res.status(400).json({ success: false, error: 'termId, feeName, and amount are required.' });
      return;
    }

    const term = await prisma.academicTerm.findFirst({ where: { id: termId, tenantId } });
    if (!term) {
      res.status(404).json({ success: false, error: 'Term not found.' });
      return;
    }

    const schedule = await prisma.feeSchedule.create({
      data: {
        tenantId, termId, feeName,
        className: className || null,
        amount,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { term: true },
    });
    res.status(201).json({ success: true, data: { schedule } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/school/fee-schedules/:id
router.put('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { feeName, className, amount, dueDate } = req.body;
    const schedule = await prisma.feeSchedule.update({
      where: { id: req.params.id, tenantId },
      data: {
        ...(feeName !== undefined && { feeName }),
        ...(className !== undefined && { className: className || null }),
        ...(amount !== undefined && { amount }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: { term: true },
    });
    res.json({ success: true, data: { schedule } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/school/fee-schedules/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await prisma.feeSchedule.delete({ where: { id: req.params.id, tenantId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/school/fee-schedules/:id/generate-invoices
 * Bulk-creates one invoice per eligible student for this fee schedule.
 * Creates a Customer record (guardian as customer) on the fly if one
 * matching the guardian phone doesn't already exist.
 * Skips students who already have a matching invoice for this schedule.
 */
router.post('/:id/generate-invoices', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const schedule = await prisma.feeSchedule.findFirst({
      where: { id: req.params.id, tenantId },
      include: { term: true },
    });
    if (!schedule) {
      res.status(404).json({ success: false, error: 'Fee schedule not found.' });
      return;
    }

    // Find eligible students
    const students = await prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(schedule.className ? { className: schedule.className } : {}),
      },
    });

    if (students.length === 0) {
      res.json({ success: true, created: 0, message: 'No active students found for this fee schedule.' });
      return;
    }

    // Unique invoice note prefix to detect existing invoices for this schedule
    const notePrefix = `[SCHOOL-FEE:${schedule.id}]`;

    // Find invoices already generated for this schedule
    const existingInvoices = await prisma.invoice.findMany({
      where: { tenantId, notes: { contains: notePrefix } },
      select: { notes: true },
    });
    const existingStudentIds = new Set(
      existingInvoices
        .map((inv) => {
          const m = inv.notes?.match(/STUDENT:([a-z0-9-]+)/i);
          return m ? m[1] : null;
        })
        .filter(Boolean) as string[]
    );

    // Find or create a customer for each student's guardian, then create invoice
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get a default GL account (Income) for fee line items — use the first income account
    const incomeAccount = await prisma.account.findFirst({
      where: { tenantId, type: 'INCOME', isActive: true },
      orderBy: { code: 'asc' },
    });

    for (const student of students) {
      if (existingStudentIds.has(student.id)) {
        skipped++;
        continue;
      }

      try {
        // Find or create guardian as customer
        let customer = await prisma.customer.findFirst({
          where: { tenantId, phone: student.guardianPhone },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              tenantId,
              name: student.guardianName,
              email: student.guardianEmail ?? `guardian_${student.studentCode.toLowerCase()}@school.local`,
              phone: student.guardianPhone,
            },
          });
        }

        const invoiceNumber = `SF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const amount = Number(schedule.amount);
        const dueDate = schedule.dueDate ?? schedule.term.endDate;
        const notes = `${notePrefix} STUDENT:${student.id} — ${student.firstName} ${student.lastName} (${student.className}) — ${schedule.feeName} | ${schedule.term.name}`;

        await prisma.invoice.create({
          data: {
            tenantId,
            invoiceNumber,
            customerId: customer.id,
            issueDate: new Date(),
            dueDate,
            currency: 'GHS',
            exchangeRate: 1.0,
            subtotal: amount,
            tax: 0,
            total: amount,
            amountPaid: 0,
            status: 'SENT',
            notes,
            items: {
              create: [{
                tenantId,
                description: `${schedule.feeName} — ${student.firstName} ${student.lastName} (${student.className})`,
                quantity: 1,
                unitPrice: amount,
                lineTotal: amount,
                ...(incomeAccount ? { accountId: incomeAccount.id } : {}),
              }],
            },
          },
        });

        created++;
      } catch (e: any) {
        errors.push(`${student.studentCode}: ${e.message}`);
      }
    }

    res.json({
      success: true,
      created,
      skipped,
      total: students.length,
      errors: errors.length ? errors : undefined,
      message: `Generated ${created} invoice(s). ${skipped} already existed.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
