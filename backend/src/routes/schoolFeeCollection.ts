import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireRole } from '../middleware/rbacMiddleware';
import { actorFromRequest } from '../services/auditLogService';
import { recordInvoicePayment } from '../services/invoicePaymentService';
import { SmsService } from '../services/smsService';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/school/fee-collection/info
 * Returns basic school info (name) for the current tenant.
 */
router.get('/info', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
    res.json({ success: true, data: { name: tenant?.name ?? 'School' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/school/fee-collection?termId=
 * Returns per-student fee payment status for the given term.
 * For each student: lists all fee schedules for their class,
 * and the invoice status (PAID / PARTIALLY_PAID / SENT/unpaid / not generated).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.query as { termId?: string };

    // Resolve term — default to current term
    let resolvedTermId = termId;
    if (!resolvedTermId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { tenantId, isCurrent: true },
        select: { id: true },
      });
      resolvedTermId = currentTerm?.id;
    }

    if (!resolvedTermId) {
      res.json({ success: true, data: { students: [], summary: { total: 0, paid: 0, partial: 0, unpaid: 0, notGenerated: 0 } } });
      return;
    }

    const [students, schedules, termInvoices] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ className: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.feeSchedule.findMany({
        where: { tenantId, termId: resolvedTermId },
      }),
      // All school-fee invoices for this term (clientTxnId starts with 'SF:')
      prisma.invoice.findMany({
        where: {
          tenantId,
          clientTxnId: { startsWith: 'SF:' },
          status: { not: 'VOIDED' },
        },
        select: { id: true, clientTxnId: true, status: true, total: true, amountPaid: true, dueDate: true },
      }),
    ]);

    // Index invoices by studentId; also build a map from clientTxnId → schedule amount
    // so the frontend can detect scholarship-discounted invoices (invoice.total < scheduleAmount)
    const scheduleAmountByClientTxnId = new Map<string, number>();
    const invoicesByStudent = new Map<string, typeof termInvoices>();
    for (const inv of termInvoices) {
      // clientTxnId format: SF:{scheduleId}:{studentId}
      const scheduleIdMatch = inv.clientTxnId?.match(/^SF:([a-z0-9-]+):/i);
      if (!scheduleIdMatch) continue;
      const scheduleId = scheduleIdMatch[1];
      const schedule = schedules.find((s) => s.id === scheduleId);
      if (!schedule) continue;
      scheduleAmountByClientTxnId.set(inv.clientTxnId!, Number(schedule.amount));

      const studentIdMatch = inv.clientTxnId?.match(/^SF:[a-z0-9-]+:([a-z0-9-]+)$/i);
      if (!studentIdMatch) continue;
      const sid = studentIdMatch[1];
      if (!invoicesByStudent.has(sid)) invoicesByStudent.set(sid, []);
      invoicesByStudent.get(sid)!.push(inv);
    }

    const summary = { total: students.length, paid: 0, partial: 0, unpaid: 0, notGenerated: 0 };

    const rows = students.map((student) => {
      const mySchedules = schedules.filter(
        (s) => !s.className || s.className === student.className
      );
      const myInvoices = invoicesByStudent.get(student.id) ?? [];
      const totalOwed = mySchedules.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalPaid = myInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);

      let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'not_generated';
      if (mySchedules.length === 0 || myInvoices.length === 0) {
        paymentStatus = mySchedules.length === 0 ? 'paid' : 'not_generated';
      } else if (totalPaid >= totalOwed && totalOwed > 0) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'unpaid';
      }

      if (paymentStatus === 'paid') summary.paid++;
      else if (paymentStatus === 'partial') summary.partial++;
      else if (paymentStatus === 'unpaid') summary.unpaid++;
      else if (paymentStatus === 'not_generated') summary.notGenerated++;

      return {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.className,
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
        },
        totalOwed,
        totalPaid,
        balance: Math.max(0, totalOwed - totalPaid),
        paymentStatus,
        invoices: myInvoices.map((inv) => ({
          id: inv.id,
          status: inv.status,
          total: Number(inv.total),
          amountPaid: Number(inv.amountPaid),
          dueDate: inv.dueDate,
          scheduleAmount: scheduleAmountByClientTxnId.get(inv.clientTxnId!) ?? Number(inv.total),
        })),
      };
    });

    res.json({ success: true, data: { termId: resolvedTermId, students: rows, summary } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const VALID_MODES = new Set(['CASH', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER', 'WAIVER']);

/**
 * POST /api/v1/school/fee-collection/collect
 * Record a fee payment for a student for the given term.
 * Applies the payment to the student's outstanding school-fee invoices
 * (oldest first) until the amount is exhausted.
 */
router.post('/collect', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const actor = actorFromRequest(req);
    const { studentId, termId, amount, paymentMode } = req.body;

    if (!studentId || !termId || amount === undefined) {
      res.status(400).json({ success: false, error: 'studentId, termId, and amount are required.' });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, error: 'amount must be a positive number.' });
      return;
    }
    const mode = (paymentMode || 'CASH') as string;
    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ success: false, error: `paymentMode must be one of: ${[...VALID_MODES].join(', ')}` });
      return;
    }

    // Validate student and term belong to this tenant
    const [student, schedules] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId } }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId } }),
    ]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }
    if (schedules.length === 0) {
      res.status(404).json({ success: false, error: 'No fee schedules found for this term.' });
      return;
    }

    const scheduleIds = schedules.map((s) => s.id);

    // Find all unpaid/partial school fee invoices for this student+term
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        clientTxnId: { in: scheduleIds.map((sid) => `SF:${sid}:${studentId}`) },
        status: { notIn: ['PAID', 'VOIDED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (invoices.length === 0) {
      res.status(400).json({ success: false, error: 'No outstanding invoices found for this student in this term.' });
      return;
    }

    let remaining = numAmount;
    const results: { invoiceId: string; paid: number }[] = [];

    for (const inv of invoices) {
      if (remaining <= 0) break;
      const balance = Number(inv.total) - Number(inv.amountPaid);
      if (balance <= 0) continue;
      const toPay = Math.min(remaining, balance);
      await recordInvoicePayment(inv.id, actor, {
        amount: toPay,
        method: mode as any,
        description: `School fee payment — ${student.firstName} ${student.lastName} (${student.className})`,
      });
      results.push({ invoiceId: inv.id, paid: toPay });
      remaining -= toPay;
    }

    const totalPaid = numAmount - remaining;
    res.json({
      success: true,
      totalPaid,
      change: Math.max(0, remaining),
      invoicesUpdated: results.length,
      message: `Payment of GHS ${totalPaid.toFixed(2)} recorded via ${mode.replace('_', ' ')}.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/school/fee-collection/waive
 * Apply a fee waiver (full or partial) to a specific invoice for a student.
 * Admin only. Records the waiver as an invoice payment with method WAIVER.
 */
router.post('/waive', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const actor = actorFromRequest(req);
    const { invoiceId, amount, reason } = req.body;

    if (!invoiceId || amount === undefined) {
      res.status(400).json({ success: false, error: 'invoiceId and amount are required.' });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, error: 'amount must be a positive number.' });
      return;
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, clientTxnId: { startsWith: 'SF:' } },
    });
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }
    const balance = Number(invoice.total) - Number(invoice.amountPaid);
    if (balance <= 0) {
      res.status(400).json({ success: false, error: 'Invoice is already fully paid.' });
      return;
    }
    const waiverAmount = Math.min(numAmount, balance);

    await recordInvoicePayment(invoice.id, actor, {
      amount: waiverAmount,
      method: 'WAIVER' as any,
      description: reason ? `Fee waiver: ${reason}` : 'Fee waiver',
    });

    res.json({
      success: true,
      waivedAmount: waiverAmount,
      message: `Waiver of GHS ${waiverAmount.toFixed(2)} applied.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/school/fee-collection/generate-invoices
 * Bulk-generate school fee invoices for all eligible students in a term.
 * Idempotent — skips students that already have an invoice for a given schedule.
 * Uses (or creates) a per-tenant "School Fees" system customer as the invoice owner.
 */
router.post('/generate-invoices', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.body as { termId?: string };

    if (!termId) {
      res.status(400).json({ success: false, error: 'termId is required.' });
      return;
    }

    const [term, schedules, students] = await Promise.all([
      prisma.academicTerm.findFirst({ where: { id: termId, tenantId } }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId } }),
      prisma.student.findMany({ where: { tenantId, isActive: true } }),
    ]);

    // Fetch scholarships that apply to this term (termId matches or null = all terms)
    const allScholarships = await prisma.scholarship.findMany({
      where: {
        tenantId,
        studentId: { in: students.map((s) => s.id) },
        OR: [{ termId }, { termId: null }],
      },
    });
    // Index scholarships by studentId — first one wins per student
    const scholarshipByStudent = new Map<string, (typeof allScholarships)[0]>();
    for (const sc of allScholarships) {
      if (!scholarshipByStudent.has(sc.studentId)) {
        scholarshipByStudent.set(sc.studentId, sc);
      }
    }

    if (!term) {
      res.status(404).json({ success: false, error: 'Term not found.' });
      return;
    }
    if (schedules.length === 0) {
      res.status(400).json({ success: false, error: 'No fee schedules found for this term.' });
      return;
    }

    // Find or create a system customer for school fee invoices
    const SCHOOL_CUSTOMER_EMAIL = `__school__@ledgio.internal`;
    let schoolCustomer = await prisma.customer.findFirst({
      where: { tenantId, email: SCHOOL_CUSTOMER_EMAIL },
      select: { id: true },
    });
    if (!schoolCustomer) {
      schoolCustomer = await prisma.customer.create({
        data: { tenantId, name: 'School Fees Account', email: SCHOOL_CUSTOMER_EMAIL },
        select: { id: true },
      });
    }

    // Index existing SF invoices for this term to skip duplicates
    const scheduleIds = schedules.map((s) => s.id);
    const existingClientTxnIds = new Set(
      (await prisma.invoice.findMany({
        where: {
          tenantId,
          clientTxnId: { in: scheduleIds.flatMap((sid) => students.map((st) => `SF:${sid}:${st.id}`)) },
        },
        select: { clientTxnId: true },
      })).map((inv) => inv.clientTxnId!)
    );

    let generated = 0;
    let skipped = 0;
    let discountedCount = 0;
    const dueDate = term.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    for (const student of students) {
      const eligibleSchedules = schedules.filter((s) => !s.className || s.className === student.className);
      const scholarship = scholarshipByStudent.get(student.id);

      for (const schedule of eligibleSchedules) {
        const clientTxnId = `SF:${schedule.id}:${student.id}`;
        if (existingClientTxnIds.has(clientTxnId)) {
          skipped++;
          continue;
        }
        const originalAmount = Number(schedule.amount);

        // Apply scholarship discount
        let finalAmount = originalAmount;
        if (scholarship) {
          if (scholarship.discountType === 'PERCENT') {
            finalAmount = Math.round(originalAmount * (1 - Number(scholarship.discountValue) / 100) * 100) / 100;
          } else {
            // FIXED_AMOUNT
            finalAmount = Math.round((originalAmount - Number(scholarship.discountValue)) * 100) / 100;
          }
          finalAmount = Math.max(0, finalAmount);
        }
        const scholarshipApplied = scholarship !== undefined && finalAmount < originalAmount;
        if (scholarshipApplied) discountedCount++;

        await prisma.invoice.create({
          data: {
            tenantId,
            invoiceNumber: `SF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            customerId: schoolCustomer.id,
            dueDate,
            currency: 'GHS',
            exchangeRate: 1.0,
            subtotal: finalAmount,
            tax: 0,
            total: finalAmount,
            baseCurrencyAmount: finalAmount,
            status: 'SENT',
            clientTxnId,
          },
        });
        generated++;
      }
    }

    const scholarshipMsg = discountedCount > 0 ? ` (${discountedCount} with scholarship discounts applied)` : '';
    res.json({
      success: true,
      data: { generated, skipped, discountedCount, termId, termName: term.name },
      message: `Generated ${generated} invoice${generated !== 1 ? 's' : ''}${scholarshipMsg} (${skipped} already existed).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/school/fee-collection/send-reminders
 * Send SMS fee reminders to guardians of all defaulters for a given term.
 * Accountant or Admin only. Returns counts of sent / failed / skipped (no phone).
 */
router.post('/send-reminders', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId } = req.body as { termId?: string };

    if (!termId) {
      res.status(400).json({ success: false, error: 'termId is required.' });
      return;
    }

    const [term, students, schedules, termInvoices, tenant] = await Promise.all([
      prisma.academicTerm.findFirst({ where: { id: termId, tenantId }, select: { name: true, endDate: true } }),
      prisma.student.findMany({ where: { tenantId, isActive: true } }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId } }),
      prisma.invoice.findMany({
        where: { tenantId, clientTxnId: { startsWith: 'SF:' }, status: { not: 'VOIDED' } },
        select: { clientTxnId: true, total: true, amountPaid: true },
      }),
      prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
    ]);

    if (!term) {
      res.status(404).json({ success: false, error: 'Term not found.' });
      return;
    }

    const scheduleSet = new Set(schedules.map((s) => s.id));
    const invoicesByStudent = new Map<string, typeof termInvoices>();
    for (const inv of termInvoices) {
      const m = inv.clientTxnId?.match(/^SF:([a-z0-9-]+):([a-z0-9-]+)$/i);
      if (!m || !scheduleSet.has(m[1])) continue;
      const sid = m[2];
      if (!invoicesByStudent.has(sid)) invoicesByStudent.set(sid, []);
      invoicesByStudent.get(sid)!.push(inv);
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const schoolName = tenant?.name ?? 'School';

    for (const student of students) {
      const mySchedules = schedules.filter((s) => !s.className || s.className === student.className);
      const myInvoices = invoicesByStudent.get(student.id) ?? [];
      if (mySchedules.length === 0 || myInvoices.length === 0) continue;
      const totalOwed = mySchedules.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalPaid = myInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
      const balance = totalOwed - totalPaid;
      if (balance <= 0) continue;

      const phone = student.guardianPhone?.trim();
      if (!phone) { skipped++; continue; }

      const message =
        `${schoolName}: Dear ${student.guardianName ?? 'Guardian'}, ` +
        `${student.firstName} ${student.lastName} (${student.className}) ` +
        `has an outstanding school fee balance of GHS ${balance.toFixed(2)} ` +
        `for ${term.name}. Please pay at the school accounts office. Thank you.`;

      const ok = await SmsService.send(phone, message);
      if (ok) { sent++; } else { failed++; }
    }

    res.json({
      success: true,
      data: { sent, failed, skipped },
      message: `SMS reminders sent: ${sent} delivered, ${failed} failed, ${skipped} skipped (no phone).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/school/fee-collection/late-fine-config
 * PUT /api/v1/school/fee-collection/late-fine-config
 * Manage late fine configuration: rate per day (GHS), grace period days, enabled flag.
 * Stored in tenants.school_config as JSON.
 */
router.get('/late-fine-config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { schoolConfig: true } });
    const schoolConfig = tenant?.schoolConfig ? JSON.parse(tenant.schoolConfig) : {};
    const config = schoolConfig.lateFine ?? { enabled: false, ratePerDay: 0, graceDays: 0 };
    res.json({ success: true, data: { config } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/late-fine-config', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { ratePerDay, graceDays, enabled } = req.body;
    const lateFine = {
      enabled: Boolean(enabled),
      ratePerDay: Math.max(0, Number(ratePerDay ?? 0)),
      graceDays: Math.max(0, Number(graceDays ?? 0)),
    };
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { schoolConfig: true } });
    const existing = tenant?.schoolConfig ? JSON.parse(tenant.schoolConfig) : {};
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { schoolConfig: JSON.stringify({ ...existing, lateFine }) },
    });
    res.json({ success: true, data: { config: lateFine } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── MoMo Reconciliation ──────────────────────────────────────────────────────

interface MomoTxn {
  phone: string;
  amount: number;
  momoRef?: string;
  date?: string;
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  // Convert +233XXXXXXXXX or 233XXXXXXXXX → 0XXXXXXXXX
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits;
}

/**
 * POST /api/v1/school/fee-collection/momo-reconcile/preview
 * Matches a list of MoMo transactions (phone, amount) to students by guardian phone.
 * Returns matched rows (student info + outstanding balance) and unmatched transactions.
 */
router.post('/momo-reconcile/preview', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { termId, transactions } = req.body as { termId: string; transactions: MomoTxn[] };

    if (!termId || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ success: false, error: 'termId and transactions[] are required.' });
      return;
    }

    const [students, schedules] = await Promise.all([
      prisma.student.findMany({ where: { tenantId, isActive: true } }),
      prisma.feeSchedule.findMany({ where: { tenantId, termId } }),
    ]);

    // Build normalized phone → student lookup
    const studentByPhone = new Map<string, typeof students[0]>();
    for (const s of students) {
      if (s.guardianPhone) studentByPhone.set(normalizePhone(s.guardianPhone), s);
    }

    // Get outstanding SF invoice balances per student for this term
    const scheduleIds = schedules.map((s) => s.id);
    const candidateTxnIds = scheduleIds.flatMap((sid) => students.map((st) => `SF:${sid}:${st.id}`));
    const invoices = candidateTxnIds.length > 0
      ? await prisma.invoice.findMany({
          where: { tenantId, clientTxnId: { in: candidateTxnIds }, status: { notIn: ['PAID', 'VOIDED'] } },
          select: { clientTxnId: true, total: true, amountPaid: true },
        })
      : [];

    const balanceByStudent = new Map<string, number>();
    for (const inv of invoices) {
      const m = inv.clientTxnId?.match(/^SF:[^:]+:([^:]+)$/);
      if (!m) continue;
      const balance = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
      balanceByStudent.set(m[1], (balanceByStudent.get(m[1]) ?? 0) + balance);
    }

    const matched: Array<{
      txn: MomoTxn;
      student: { id: string; studentCode: string; firstName: string; lastName: string; className: string; guardianPhone: string; guardianName: string };
      outstandingBalance: number;
    }> = [];
    const unmatched: MomoTxn[] = [];

    for (const txn of transactions) {
      const phone = normalizePhone(txn.phone);
      const student = studentByPhone.get(phone);
      if (!student) { unmatched.push(txn); continue; }
      matched.push({
        txn,
        student: {
          id: student.id, studentCode: student.studentCode,
          firstName: student.firstName, lastName: student.lastName,
          className: student.className,
          guardianPhone: student.guardianPhone, guardianName: student.guardianName,
        },
        outstandingBalance: balanceByStudent.get(student.id) ?? 0,
      });
    }

    res.json({ success: true, data: { matched, unmatched, termId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/school/fee-collection/momo-reconcile/commit
 * Posts MOBILE_MONEY payments for the selected matched transactions.
 * Each entry is applied to the student's oldest unpaid SF invoices first.
 */
router.post('/momo-reconcile/commit', requireRole('Accountant', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const actor = actorFromRequest(req);
    const { termId, entries } = req.body as {
      termId: string;
      entries: Array<{ studentId: string; amount: number; momoRef?: string }>;
    };

    if (!termId || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ success: false, error: 'termId and entries[] are required.' });
      return;
    }

    const schedules = await prisma.feeSchedule.findMany({ where: { tenantId, termId } });
    if (schedules.length === 0) {
      res.status(404).json({ success: false, error: 'No fee schedules found for this term.' });
      return;
    }
    const scheduleIds = schedules.map((s) => s.id);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        const student = await prisma.student.findFirst({ where: { id: entry.studentId, tenantId } });
        if (!student) { errors.push(`Student not found: ${entry.studentId}`); failed++; continue; }

        const invoices = await prisma.invoice.findMany({
          where: {
            tenantId,
            clientTxnId: { in: scheduleIds.map((sid) => `SF:${sid}:${entry.studentId}`) },
            status: { notIn: ['PAID', 'VOIDED'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (invoices.length === 0) {
          errors.push(`No outstanding invoices for ${student.firstName} ${student.lastName}`);
          failed++;
          continue;
        }

        let remaining = Number(entry.amount);
        for (const inv of invoices) {
          if (remaining <= 0) break;
          const balance = Number(inv.total) - Number(inv.amountPaid);
          if (balance <= 0) continue;
          const toPay = Math.min(remaining, balance);
          await recordInvoicePayment(inv.id, actor, {
            amount: toPay,
            method: 'MOBILE_MONEY' as any,
            description: `MoMo reconciliation${entry.momoRef ? ` — Ref: ${entry.momoRef}` : ''} — ${student.firstName} ${student.lastName} (${student.className})`,
          });
          remaining -= toPay;
        }
        processed++;
      } catch (e: any) {
        errors.push(e.message);
        failed++;
      }
    }

    res.json({
      success: true,
      data: { processed, failed, errors: errors.length ? errors : undefined },
      message: `Posted ${processed} MoMo payment(s). ${failed} failed.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
