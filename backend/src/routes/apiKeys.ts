import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { hashPassword } from '../utils/password';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/api-keys
 * Lists all API keys for the tenant. Never returns the raw key.
 */
router.get('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const keys = await (prisma as any).apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, isActive: true, createdAt: true },
    });
    res.json({ success: true, data: { apiKeys: keys } });
  } catch (err: any) {
    console.error('[ApiKeys] List error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve API keys.' });
  }
});

/**
 * POST /api/v1/api-keys
 * Generates a new API key. Returns the raw key ONCE — it is never stored
 * in plain text and cannot be retrieved again.
 */
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: 'A name for the API key is required.' });
      return;
    }

    const rawKey = `ledgio_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = hashPassword(rawKey);
    const keyPrefix = rawKey.slice(0, 8);

    const apiKey = await (prisma as any).apiKey.create({
      data: {
        tenantId,
        name: String(name).trim(),
        keyHash,
        keyPrefix,
      },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });

    res.status(201).json({
      success: true,
      message: 'API key created. Copy the key now — it will not be shown again.',
      data: { apiKey: { ...apiKey, rawKey } },
    });
  } catch (err: any) {
    console.error('[ApiKeys] Create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create API key.' });
  }
});

/**
 * DELETE /api/v1/api-keys/:id
 * Revokes an API key (soft delete — sets isActive=false).
 */
router.delete('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const key = await (prisma as any).apiKey.findFirst({ where: { id: req.params.id, tenantId } });
    if (!key) {
      res.status(404).json({ success: false, error: 'API key not found.' });
      return;
    }
    await (prisma as any).apiKey.update({ where: { id: key.id }, data: { isActive: false } });
    res.json({ success: true, message: 'API key revoked.' });
  } catch (err: any) {
    console.error('[ApiKeys] Revoke error:', err);
    res.status(500).json({ success: false, error: 'Failed to revoke API key.' });
  }
});

export default router;
