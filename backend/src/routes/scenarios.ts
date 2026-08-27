import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import * as journalEntryService from '../services/journalEntryService';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /scenarios
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenarios = await (prisma as any).scenario.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: scenarios });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /scenarios/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenario = await (prisma as any).scenario.findFirst({ where: { id: req.params.id, tenantId } });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found.' });
    res.json({ success: true, data: scenario });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /scenarios/:id/entries — list provisional journal entries in this scenario
router.get('/:id/entries', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenario = await (prisma as any).scenario.findFirst({ where: { id: req.params.id, tenantId } });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found.' });
    const entries = await (prisma as any).journalEntry.findMany({
      where: { scenarioId: req.params.id },
      include: { lines: true },
      orderBy: { entryDate: 'desc' },
    });
    res.json({ success: true, data: entries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /scenarios/:id/post-all — convert all provisional entries to posted
router.post('/:id/post-all', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenario = await (prisma as any).scenario.findFirst({ where: { id: req.params.id, tenantId } });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found.' });

    const provisionalEntries = await (prisma as any).journalEntry.findMany({
      where: { scenarioId: req.params.id, status: 'DRAFT' },
      include: { lines: true },
    });

    let posted = 0;
    const errors: string[] = [];
    for (const entry of provisionalEntries) {
      try {
        await journalEntryService.postJournalEntry(entry.id);
        await (prisma as any).journalEntry.update({ where: { id: entry.id }, data: { scenarioId: null, voucherType: 'JOURNAL' } });
        posted++;
      } catch (e: any) {
        errors.push(`${entry.entryNumber}: ${e.message}`);
      }
    }
    res.json({ success: true, data: { posted, errors } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /scenarios
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const scenario = await (prisma as any).scenario.create({
      data: { tenantId, name: body.name, description: body.description },
    });
    res.status(201).json({ success: true, data: scenario });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /scenarios/:id
router.put('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenario = await (prisma as any).scenario.findFirst({ where: { id: req.params.id, tenantId } });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found.' });
    const body = updateSchema.parse(req.body);
    const updated = await (prisma as any).scenario.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /scenarios/:id
router.delete('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const scenario = await (prisma as any).scenario.findFirst({ where: { id: req.params.id, tenantId } });
    if (!scenario) return res.status(404).json({ success: false, error: 'Scenario not found.' });
    await (prisma as any).scenario.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
