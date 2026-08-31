import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);
router.use(requireTier(2, 'Cost Categories'));

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /cost-categories
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const categories = await (prisma as any).costCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /cost-categories/:id
router.get('/:id', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const cat = await (prisma as any).costCategory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!cat) return res.status(404).json({ success: false, error: 'Cost category not found.' });
    res.json({ success: true, data: cat });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /cost-categories
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const body = createSchema.parse(req.body);
    const cat = await (prisma as any).costCategory.create({
      data: { tenantId, name: body.name, description: body.description },
    });
    res.status(201).json({ success: true, data: cat });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.issues });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /cost-categories/:id
router.put('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const cat = await (prisma as any).costCategory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!cat) return res.status(404).json({ success: false, error: 'Cost category not found.' });
    const body = updateSchema.parse(req.body);
    const updated = await (prisma as any).costCategory.update({
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

// DELETE /cost-categories/:id
router.delete('/:id', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const cat = await (prisma as any).costCategory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!cat) return res.status(404).json({ success: false, error: 'Cost category not found.' });
    await (prisma as any).costCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
