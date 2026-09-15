import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { recordAuditLog } from '../services/auditLogService';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware.

/**
 * GET /api/v1/admin/users/search?q=<email>&tenantId=<id>
 * Cross-tenant user search. Never returns password hashes.
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim();
  const tenantId = String(req.query.tenantId ?? '').trim();
  if (!q && !tenantId) {
    res.status(400).json({ success: false, error: 'Provide q (email search) or tenantId.' });
    return;
  }
  try {
    const where: Record<string, any> = {};
    if (q) where.email = { contains: q, mode: 'insensitive' };
    if (tenantId) where.tenantId = tenantId;
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true, tier: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: { users } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message ?? 'Search failed.' });
  }
});

/**
 * PATCH /api/v1/admin/users/:userId/deactivate
 * Platform-level user deactivation (isActive = false).
 */
router.patch('/:userId/deactivate', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, tenantId: true, isActive: true } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (!user.isActive) {
      res.status(400).json({ success: false, error: 'User is already inactive.' });
      return;
    }
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await recordAuditLog({
      tenantId: null,
      action: 'USER.ADMIN_DEACTIVATED',
      entity: 'User',
      entityId: userId,
      details: `Platform admin deactivated user ${user.email}`,
    });
    res.json({ success: true, message: `User ${user.email} deactivated.` });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message ?? 'Deactivation failed.' });
  }
});

/**
 * PATCH /api/v1/admin/users/:userId/activate
 * Platform-level user re-activation.
 */
router.patch('/:userId/activate', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, tenantId: true, isActive: true } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    await recordAuditLog({
      tenantId: null,
      action: 'USER.ADMIN_ACTIVATED',
      entity: 'User',
      entityId: userId,
      details: `Platform admin re-activated user ${user.email}`,
    });
    res.json({ success: true, message: `User ${user.email} activated.` });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message ?? 'Activation failed.' });
  }
});

export default router;
