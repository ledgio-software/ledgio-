import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

interface Setting { key: string; value: string | null }

// GET /api/v1/church/settings — returns all settings as {key: value} map
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await withCurrentTenantDb(prisma, (client) =>
      client.$queryRawUnsafe<Setting[]>(`SELECT key, value FROM church_settings ORDER BY key`)
    );
    const map: Record<string, string | null> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({ success: true, data: map });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/v1/church/settings — upsert multiple keys at once
router.put('/', requireRole('Admin') as never, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body as Record<string, string | null>;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, error: 'Body must be a key/value object.' });
      return;
    }

    await withCurrentTenantDb(prisma, async (client) => {
      for (const [key, value] of Object.entries(updates)) {
        await client.$executeRawUnsafe(
          `INSERT INTO church_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          key, value ?? null,
        );
      }
    });

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
