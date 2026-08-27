import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { runWithTenantContext } from '../context/tenantContext';
import { ensureTenantSchemaMigrated } from '../database/tenantMigrationRunner';
import { verifyPassword } from '../utils/password';

/**
 * Authenticates a request using the X-API-Key header.
 * Resolves the tenant from the key, sets the AsyncLocalStorage tenant context,
 * and attaches tenantId to the request so downstream handlers can use it.
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const raw = req.headers['x-api-key'] as string | undefined;
  if (!raw) {
    res.status(401).json({ success: false, error: 'API key required. Pass it as the X-API-Key header.' });
    return;
  }

  try {
    const prefix = raw.slice(0, 8);
    const candidates = await (prisma as any).apiKey.findMany({
      where: { keyPrefix: prefix, isActive: true },
      include: { tenant: true },
    });

    for (const candidate of candidates) {
      const match = verifyPassword(raw, candidate.keyHash);
      if (match) {
        // Update lastUsedAt without blocking the request
        (prisma as any).apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

        const tenant = candidate.tenant;
        await ensureTenantSchemaMigrated(prisma, tenant.schema, tenant.id);

        const tenantContext = {
          tenantId: tenant.id,
          tenantSchema: tenant.schema,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          tenantTier: tenant.tier,
          tenantSubscriptionStatus: (tenant as any).subscriptionStatus ?? 'ACTIVE',
          tenantTrialEndsAt: (tenant as any).trialEndsAt ?? null,
          tenantSubscriptionPaidUntil: (tenant as any).subscriptionPaidUntil ?? null,
        };

        req.tenantContext = tenantContext;
        await runWithTenantContext(tenantContext, async () => { next(); });
        return;
      }
    }

    res.status(401).json({ success: false, error: 'Invalid or inactive API key.' });
  } catch (err: any) {
    console.error('[ApiKeyMiddleware] Error:', err);
    res.status(500).json({ success: false, error: 'Authentication failed.' });
  }
}
