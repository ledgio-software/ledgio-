import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { prisma } from '../config/db';
import { recordAuditLogTx, actorFromRequest, AuditChanges } from '../services/auditLogService';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);
router.use(requireTier(2, 'Cost Centres'));

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /cost-centres
router.get('/', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const costCentres = await (prisma as any).costCentre.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
    res.json({ success: true, costCentres });
  } catch (err: any) {
    console.error('[CostCentres] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve cost centres.' });
  }
});

// GET /cost-centres/:id
router.get('/:id', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const cc = await (prisma as any).costCentre.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!cc) { res.status(404).json({ success: false, error: 'Cost centre not found.' }); return; }
    res.json({ success: true, costCentre: cc });
  } catch (err: any) {
    console.error('[CostCentres] get error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve cost centre.' });
  }
});

// POST /cost-centres
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createSchema.parse(req.body);
    const { tenantId } = requireTenantContext();

    const existing = await (prisma as any).costCentre.findFirst({
      where: { tenantId, code: body.code },
    });
    if (existing) {
      res.status(409).json({ success: false, error: `Cost centre code '${body.code}' already exists.` });
      return;
    }

    const cc = await (prisma as any).costCentre.create({
      data: { tenantId, ...body },
    });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'CREATE',
      entity: 'CostCentre',
      entityId: cc.id,
      details: `Created cost centre ${body.code}: ${body.name}`,
    });

    res.status(201).json({ success: true, costCentre: cc });
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ success: false, error: err.issues[0]?.message || 'Validation error.' });
      return;
    }
    console.error('[CostCentres] create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create cost centre.' });
  }
});

// PUT /cost-centres/:id
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateSchema.parse(req.body);
    const { tenantId } = requireTenantContext();

    const cc = await (prisma as any).costCentre.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!cc) { res.status(404).json({ success: false, error: 'Cost centre not found.' }); return; }

    const changes: AuditChanges = {};
    if (body.name !== undefined && body.name !== cc.name) changes.name = { from: cc.name, to: body.name };
    if (body.description !== undefined && body.description !== cc.description) changes.description = { from: cc.description, to: body.description };
    if (body.isActive !== undefined && body.isActive !== cc.isActive) changes.isActive = { from: cc.isActive, to: body.isActive };

    const updated = await (prisma as any).costCentre.update({
      where: { id: req.params.id },
      data: body,
    });

    if (Object.keys(changes).length > 0) {
      void recordAuditLogTx(prisma, {
        tenantId,
        actor: actorFromRequest(req),
        action: 'UPDATE',
        entity: 'CostCentre',
        entityId: cc.id,
        changes,
      });
    }

    res.json({ success: true, costCentre: updated });
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ success: false, error: err.issues[0]?.message || 'Validation error.' });
      return;
    }
    console.error('[CostCentres] update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update cost centre.' });
  }
});

// DELETE /cost-centres/:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const cc = await (prisma as any).costCentre.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!cc) { res.status(404).json({ success: false, error: 'Cost centre not found.' }); return; }

    await (prisma as any).costCentre.delete({ where: { id: req.params.id } });

    void recordAuditLogTx(prisma, {
      tenantId,
      actor: actorFromRequest(req),
      action: 'DELETE',
      entity: 'CostCentre',
      entityId: cc.id,
      details: `Deleted cost centre ${cc.code}: ${cc.name}`,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[CostCentres] delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete cost centre.' });
  }
});

export default router;
