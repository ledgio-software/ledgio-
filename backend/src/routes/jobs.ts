import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { resolveDefaultAccount, listAccounts } from '../repository/accountRepository';
import * as journalEntryService from '../services/journalEntryService';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);
router.use(requireTier(2, 'Job Costing'));

const costLineSchema = z.object({
  type: z.enum(['MATERIAL', 'LABOUR', 'OVERHEAD', 'SUBCONTRACT']),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  accountId: z.string().uuid().optional().nullable(),
});

const createJobSchema = z.object({
  name: z.string().min(1).max(200),
  customerId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
});

async function nextJobNumber(tenantId: string): Promise<string> {
  const last = await (prisma as any).job.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { jobNumber: true } });
  if (!last) return 'JOB-0001';
  const num = parseInt(last.jobNumber.replace(/\D/g, ''), 10) || 0;
  return `JOB-${String(num + 1).padStart(4, '0')}`;
}

// GET /jobs
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const where: any = { tenantId };
    if (status) where.status = status;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [jobs, total] = await Promise.all([
      (prisma as any).job.findMany({ where, include: { costLines: true, workOrders: true }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(pageSize) }),
      (prisma as any).job.count({ where }),
    ]);
    res.json({ success: true, data: jobs, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /jobs/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const job = await (prisma as any).job.findFirst({
      where: { id: req.params.id, tenantId },
      include: { costLines: true, workOrders: true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /jobs
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createJobSchema.parse(req.body);
    const jobNumber = await nextJobNumber(tenantId);
    const job = await (prisma as any).job.create({
      data: {
        tenantId,
        jobNumber,
        name: body.name,
        customerId: body.customerId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        description: body.description,
        budget: body.budget ?? null,
        status: 'OPEN',
      },
    });
    res.status(201).json({ success: true, data: job });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /jobs/:id
router.put('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const job = await (prisma as any).job.findFirst({ where: { id: req.params.id, tenantId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    const body = createJobSchema.partial().parse(req.body);
    const updated = await (prisma as any).job.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.customerId !== undefined && { customerId: body.customerId }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.budget !== undefined && { budget: body.budget }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /jobs/:id/cost-lines — add a cost line; posts journal Dr WIP / Cr relevant account
router.post('/:id/cost-lines', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const job = await (prisma as any).job.findFirst({ where: { id: req.params.id, tenantId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: `Cannot add cost lines to a ${job.status} job.` });
    }
    const body = costLineSchema.parse(req.body);
    const amount = Math.round(body.quantity * body.unitCost * 100) / 100;

    // Attempt to post a journal: Dr Job WIP / Cr the specified or default GL account
    let journalId: string | null = null;
    let journalWarning: string | null = null;
    try {
      const accounts = await listAccounts(prisma as any);
      const wipAccount = resolveDefaultAccount(accounts, 'JOB_WIP');
      const creditAccount = body.accountId
        ? accounts.find((a: any) => a.id === body.accountId)
        : resolveDefaultAccount(accounts, body.type === 'MATERIAL' ? 'INVENTORY_ASSET' : 'JOB_EXPENSE');

      if (wipAccount && creditAccount) {
        const journal = await journalEntryService.createJournalEntry({
          description: `Job ${job.jobNumber} — ${body.type}: ${body.description}`,
          entryDate: new Date(),
          lines: [
            { accountId: wipAccount.id, debit: amount, credit: 0 },
            { accountId: creditAccount.id, debit: 0, credit: amount },
          ],
          status: 'POSTED',
        });
        journalId = (journal as any).id || null;
      } else {
        journalWarning = 'GL not updated — WIP or cost account not configured. Set up JOB_WIP and JOB_EXPENSE accounts in your chart of accounts.';
      }
    } catch (journalErr: any) {
      journalWarning = `GL entry failed: ${journalErr?.message || 'unknown error'}. Cost line was recorded.`;
    }

    const line = await (prisma as any).jobCostLine.create({
      data: { tenantId, jobId: req.params.id, type: body.type, description: body.description, quantity: body.quantity, unitCost: body.unitCost, amount, accountId: body.accountId, journalId },
    });
    // Update job status to IN_PROGRESS if OPEN
    if (job.status === 'OPEN') {
      await (prisma as any).job.update({ where: { id: req.params.id }, data: { status: 'IN_PROGRESS' } });
    }
    res.status(201).json({ success: true, data: line, ...(journalWarning ? { journalWarning } : {}) });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /jobs/:id/complete — mark job COMPLETED; posts COGS entry rolling up WIP
router.post('/:id/complete', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const job = await (prisma as any).job.findFirst({ where: { id: req.params.id, tenantId }, include: { costLines: true } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    if (job.status === 'COMPLETED') return res.status(400).json({ success: false, error: 'Job is already completed.' });

    const totalCost = job.costLines.reduce((s: number, l: any) => s + Number(l.amount), 0);

    // Post final COGS journal: Dr COGS / Cr Job WIP
    let completeJournalWarning: string | null = null;
    if (totalCost > 0) {
      try {
        const accounts = await listAccounts(prisma as any);
        const cogsAccount = resolveDefaultAccount(accounts, 'COGS');
        const wipAccount = resolveDefaultAccount(accounts, 'JOB_WIP');
        if (cogsAccount && wipAccount) {
          await journalEntryService.createJournalEntry({
            description: `Job ${job.jobNumber} completed — transfer WIP to COGS`,
            entryDate: new Date(),
            lines: [
              { accountId: cogsAccount.id, debit: totalCost, credit: 0 },
              { accountId: wipAccount.id, debit: 0, credit: totalCost },
            ],
            status: 'POSTED',
          });
        } else {
          completeJournalWarning = 'COGS journal not posted — COGS or JOB_WIP account not configured.';
        }
      } catch (journalErr: any) {
        completeJournalWarning = `COGS GL entry failed: ${journalErr?.message || 'unknown error'}.`;
      }
    }

    await (prisma as any).job.update({ where: { id: req.params.id }, data: { status: 'COMPLETED', endDate: new Date() } });
    res.json({ success: true, data: { totalCost }, ...(completeJournalWarning ? { journalWarning: completeJournalWarning } : {}) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /jobs/:id/cancel
router.post('/:id/cancel', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const job = await (prisma as any).job.findFirst({ where: { id: req.params.id, tenantId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    await (prisma as any).job.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
