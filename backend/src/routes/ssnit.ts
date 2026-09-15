import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { prisma } from '../lib/prisma';

// Ghana SSNIT contribution rates (effective 2024+)
const TIER1_EMPLOYEE_RATE = 0.055;  // 5.5% — employee
const TIER1_EMPLOYER_RATE = 0.08;   // 8.0% — employer portion to SSNIT Tier 1
const TIER2_EMPLOYER_RATE = 0.05;   // 5.0% — employer portion to Tier 2 occupational pension
// Total employer = 13% (8 + 5), total employee = 5.5%

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

// ── Helper: raw SQL via prisma.$queryRawUnsafe ───────────────────────────────

const db = prisma as unknown as {
  $queryRawUnsafe: <T = unknown>(sql: string, ...args: unknown[]) => Promise<T[]>;
  $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
};

// ── Employee SSNIT compliance ────────────────────────────────────────────────

// GET /compliance — employee registration overview
router.get('/compliance', requireRole('Admin', 'Accountant', 'Auditor', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();

  const employees = await db.$queryRawUnsafe<{
    id: string; employee_number: string; first_name: string; last_name: string;
    department: string | null; position: string | null; is_active: boolean;
    gross_salary: string; ssnit_number: string | null;
    tier2_scheme: string | null; tier2_member_no: string | null;
  }>(
    `SELECT id, employee_number, first_name, last_name, department, position,
            is_active, gross_salary, ssnit_number, tier2_scheme, tier2_member_no
     FROM employees WHERE tenant_id = $1 ORDER BY last_name, first_name`,
    tenantId,
  );

  const total = employees.length;
  const active = employees.filter((e) => e.is_active);
  const registered = active.filter((e) => e.ssnit_number);
  const unregistered = active.filter((e) => !e.ssnit_number);

  res.json({
    summary: {
      total,
      active: active.length,
      registered: registered.length,
      unregistered: unregistered.length,
      complianceRate: active.length > 0
        ? Math.round((registered.length / active.length) * 100)
        : 100,
    },
    employees: employees.map((e) => ({
      id: e.id,
      employeeNumber: e.employee_number,
      firstName: e.first_name,
      lastName: e.last_name,
      department: e.department,
      position: e.position,
      isActive: e.is_active,
      grossSalary: Number(e.gross_salary),
      ssnitNumber: e.ssnit_number,
      tier2Scheme: e.tier2_scheme,
      tier2MemberNo: e.tier2_member_no,
    })),
  });
});

// PATCH /employees/:id — update SSNIT registration details
router.patch('/employees/:id', requireRole('Admin', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { id } = req.params;
  const { ssnitNumber, tier2Scheme, tier2MemberNo } = req.body as {
    ssnitNumber?: string; tier2Scheme?: string; tier2MemberNo?: string;
  };

  const rows = await db.$queryRawUnsafe<{ id: string }>(
    `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2`,
    id, tenantId,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });

  await db.$executeRawUnsafe(
    `UPDATE employees SET ssnit_number = $1, tier2_scheme = $2, tier2_member_no = $3, updated_at = NOW()
     WHERE id = $4 AND tenant_id = $5`,
    ssnitNumber ?? null, tier2Scheme ?? null, tier2MemberNo ?? null, id, tenantId,
  );

  const [updated] = await db.$queryRawUnsafe<Record<string, unknown>>(
    `SELECT id, employee_number, first_name, last_name, ssnit_number, tier2_scheme, tier2_member_no
     FROM employees WHERE id = $1`,
    id,
  );
  res.json({ employee: updated });
});

// ── Monthly schedules ────────────────────────────────────────────────────────

// GET /schedules — list all schedules
router.get('/schedules', requireRole('Admin', 'Accountant', 'Auditor', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();

  const schedules = await db.$queryRawUnsafe<{
    id: string; period_month: number; period_year: number; payroll_run_id: string | null;
    status: string; submitted_at: string | null; submitted_by: string | null;
    total_tier1_employee: string; total_tier1_employer: string; total_tier2_employer: string;
    generated_at: string;
  }>(
    `SELECT * FROM ssnit_schedules WHERE tenant_id = $1 ORDER BY period_year DESC, period_month DESC`,
    tenantId,
  );

  res.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      periodMonth: s.period_month,
      periodYear: s.period_year,
      payrollRunId: s.payroll_run_id,
      status: s.status,
      submittedAt: s.submitted_at,
      submittedBy: s.submitted_by,
      totals: {
        tier1Employee: Number(s.total_tier1_employee),
        tier1Employer: Number(s.total_tier1_employer),
        tier2Employer: Number(s.total_tier2_employer),
        grandTotal: Number(s.total_tier1_employee) + Number(s.total_tier1_employer) + Number(s.total_tier2_employer),
      },
      generatedAt: s.generated_at,
    })),
  });
});

// POST /schedules/generate — generate from a payroll run
router.post('/schedules/generate', requireRole('Admin', 'Accountant', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { payrollRunId } = req.body as { payrollRunId: string };

  if (!payrollRunId) return res.status(400).json({ error: 'payrollRunId is required' });

  // Fetch the payroll run to get period
  const runs = await db.$queryRawUnsafe<{
    id: string; period_month: number; period_year: number; status: string; tenant_id: string;
  }>(`SELECT id, period_month, period_year, status, tenant_id FROM payroll_runs WHERE id = $1`, payrollRunId);

  if (runs.length === 0) return res.status(404).json({ error: 'Payroll run not found' });
  const run = runs[0];
  if (run.tenant_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
  if (run.status !== 'POSTED') return res.status(400).json({ error: 'Payroll run must be in POSTED status' });

  // Check for duplicate
  const existing = await db.$queryRawUnsafe<{ id: string }>(
    `SELECT id FROM ssnit_schedules WHERE tenant_id = $1 AND period_month = $2 AND period_year = $3`,
    tenantId, run.period_month, run.period_year,
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: `A schedule already exists for ${run.period_month}/${run.period_year}. Delete it first to regenerate.` });
  }

  // Fetch payslips joined to employees for this run
  const payslips = await db.$queryRawUnsafe<{
    employee_id: string; employee_number: string; first_name: string; last_name: string;
    ssnit_number: string | null; gross_salary: string;
  }>(
    `SELECT p.employee_id, e.employee_number, e.first_name, e.last_name,
            e.ssnit_number, p.gross_salary
     FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     WHERE p.payroll_run_id = $1
     ORDER BY e.last_name, e.first_name`,
    payrollRunId,
  );

  if (payslips.length === 0) return res.status(400).json({ error: 'No payslips found for this run' });

  // Compute per-employee SSNIT contributions
  let sumTier1Emp = 0, sumTier1Er = 0, sumTier2 = 0;
  const lines = payslips.map((p) => {
    const gross = Number(p.gross_salary);
    const tier1Emp = parseFloat((gross * TIER1_EMPLOYEE_RATE).toFixed(2));
    const tier1Er  = parseFloat((gross * TIER1_EMPLOYER_RATE).toFixed(2));
    const tier2    = parseFloat((gross * TIER2_EMPLOYER_RATE).toFixed(2));
    sumTier1Emp += tier1Emp;
    sumTier1Er  += tier1Er;
    sumTier2    += tier2;
    return {
      employeeId: p.employee_id,
      employeeNumber: p.employee_number,
      firstName: p.first_name,
      lastName: p.last_name,
      ssnitNumber: p.ssnit_number,
      grossSalary: gross,
      tier1Employee: tier1Emp,
      tier1Employer: tier1Er,
      tier2Employer: tier2,
    };
  });

  sumTier1Emp = parseFloat(sumTier1Emp.toFixed(2));
  sumTier1Er  = parseFloat(sumTier1Er.toFixed(2));
  sumTier2    = parseFloat(sumTier2.toFixed(2));

  // Insert schedule
  const [schedule] = await db.$queryRawUnsafe<{ id: string }>(
    `INSERT INTO ssnit_schedules
       (tenant_id, period_month, period_year, payroll_run_id,
        total_tier1_employee, total_tier1_employer, total_tier2_employer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    tenantId, run.period_month, run.period_year, payrollRunId,
    sumTier1Emp, sumTier1Er, sumTier2,
  );

  // Insert lines
  for (const l of lines) {
    await db.$executeRawUnsafe(
      `INSERT INTO ssnit_schedule_lines
         (schedule_id, employee_id, employee_number, first_name, last_name,
          ssnit_number, gross_salary, tier1_employee, tier1_employer, tier2_employer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      schedule.id, l.employeeId, l.employeeNumber, l.firstName, l.lastName,
      l.ssnitNumber, l.grossSalary, l.tier1Employee, l.tier1Employer, l.tier2Employer,
    );
  }

  res.status(201).json({
    schedule: {
      id: schedule.id,
      periodMonth: run.period_month,
      periodYear: run.period_year,
      lines,
      totals: { tier1Employee: sumTier1Emp, tier1Employer: sumTier1Er, tier2Employer: sumTier2,
        grandTotal: parseFloat((sumTier1Emp + sumTier1Er + sumTier2).toFixed(2)) },
    },
  });
});

// GET /schedules/:id — detailed schedule with lines
router.get('/schedules/:id', requireRole('Admin', 'Accountant', 'Auditor', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { id } = req.params;

  const schedules = await db.$queryRawUnsafe<Record<string, unknown>>(
    `SELECT * FROM ssnit_schedules WHERE id = $1 AND tenant_id = $2`,
    id, tenantId,
  );
  if (schedules.length === 0) return res.status(404).json({ error: 'Schedule not found' });
  const sched = schedules[0];

  const lines = await db.$queryRawUnsafe<Record<string, unknown>>(
    `SELECT * FROM ssnit_schedule_lines WHERE schedule_id = $1 ORDER BY last_name, first_name`,
    id,
  );

  res.json({
    schedule: {
      ...sched,
      periodMonth: sched.period_month,
      periodYear: sched.period_year,
      totals: {
        tier1Employee: Number(sched.total_tier1_employee),
        tier1Employer: Number(sched.total_tier1_employer),
        tier2Employer: Number(sched.total_tier2_employer),
        grandTotal: Number(sched.total_tier1_employee) + Number(sched.total_tier1_employer) + Number(sched.total_tier2_employer),
      },
    },
    lines: lines.map((l) => ({
      id: l.id,
      employeeId: l.employee_id,
      employeeNumber: l.employee_number,
      firstName: l.first_name,
      lastName: l.last_name,
      ssnitNumber: l.ssnit_number,
      grossSalary: Number(l.gross_salary),
      tier1Employee: Number(l.tier1_employee),
      tier1Employer: Number(l.tier1_employer),
      tier2Employer: Number(l.tier2_employer),
      total: Number(l.tier1_employee) + Number(l.tier1_employer) + Number(l.tier2_employer),
    })),
  });
});

// PATCH /schedules/:id/submit — mark as submitted
router.patch('/schedules/:id/submit', requireRole('Admin', 'Accountant'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { id } = req.params;
  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  const rows = await db.$queryRawUnsafe<{ id: string; status: string }>(
    `SELECT id, status FROM ssnit_schedules WHERE id = $1 AND tenant_id = $2`, id, tenantId,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
  if (rows[0].status === 'SUBMITTED') return res.status(400).json({ error: 'Already submitted' });

  await db.$executeRawUnsafe(
    `UPDATE ssnit_schedules SET status = 'SUBMITTED', submitted_at = NOW(), submitted_by = $1 WHERE id = $2`,
    userId ?? null, id,
  );
  res.json({ success: true });
});

// DELETE /schedules/:id — delete a DRAFT schedule
router.delete('/schedules/:id', requireRole('Admin', 'Accountant'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { id } = req.params;

  const rows = await db.$queryRawUnsafe<{ id: string; status: string }>(
    `SELECT id, status FROM ssnit_schedules WHERE id = $1 AND tenant_id = $2`, id, tenantId,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
  if (rows[0].status === 'SUBMITTED') return res.status(400).json({ error: 'Cannot delete a submitted schedule' });

  await db.$executeRawUnsafe(`DELETE FROM ssnit_schedules WHERE id = $1`, id);
  res.status(204).send();
});

// GET /payroll-runs — list POSTED runs for the dropdown
router.get('/payroll-runs', requireRole('Admin', 'Accountant', 'Auditor', 'HR'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();

  const runs = await db.$queryRawUnsafe<{
    id: string; period_month: number; period_year: number; status: string; total_net_pay: string;
  }>(
    `SELECT id, period_month, period_year, status, total_net_pay
     FROM payroll_runs WHERE tenant_id = $1 AND status = 'POSTED'
     ORDER BY period_year DESC, period_month DESC`,
    tenantId,
  );

  // Which runs already have schedules?
  const scheduleMap: Record<string, boolean> = {};
  if (runs.length > 0) {
    const schedules = await db.$queryRawUnsafe<{ payroll_run_id: string }>(
      `SELECT payroll_run_id FROM ssnit_schedules WHERE tenant_id = $1 AND payroll_run_id IS NOT NULL`,
      tenantId,
    );
    for (const s of schedules) scheduleMap[s.payroll_run_id] = true;
  }

  res.json({
    runs: runs.map((r) => ({
      id: r.id,
      periodMonth: r.period_month,
      periodYear: r.period_year,
      totalNetPay: Number(r.total_net_pay),
      hasSchedule: !!scheduleMap[r.id],
    })),
  });
});

export default router;
