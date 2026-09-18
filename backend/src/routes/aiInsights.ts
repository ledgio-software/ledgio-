import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

const MODULES_BY_TIER: Record<number, string[]> = {
  1: ['inventory_demand', 'next_action'],
  2: ['inventory_demand', 'cash_flow_forecast', 'invoice_risk_score', 'anomaly_detection', 'next_action'],
  3: ['inventory_demand', 'cash_flow_forecast', 'invoice_risk_score', 'anomaly_detection', 'budget_burn', 'next_action'],
};

function allowedModules(tier: number): string[] {
  if (tier >= 3) return MODULES_BY_TIER[3];
  if (tier >= 2) return MODULES_BY_TIER[2];
  return MODULES_BY_TIER[1];
}

/**
 * GET /api/v1/ai/insights
 * Returns active (non-expired, non-dismissed) insights for the authenticated tenant,
 * filtered by the tenant's subscription tier.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const tier = (req as any).user?.tier ?? 1;

    const insights = await prisma.aiTenantInsight.findMany({
      where: {
        tenantId,
        module: { in: allowedModules(tier) },
        dismissedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { severity: 'desc' },
        { computedAt: 'desc' },
      ],
      take: 50,
    });

    res.json({ success: true, data: insights });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Failed to fetch insights' });
  }
});

/**
 * POST /api/v1/ai/insights/:id/dismiss
 * Marks an insight as dismissed by the current user.
 */
router.post('/:id/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const insight = await prisma.aiTenantInsight.findFirst({
      where: { id, tenantId },
    });

    if (!insight) {
      res.status(404).json({ success: false, error: 'Insight not found' });
      return;
    }

    await prisma.aiTenantInsight.update({
      where: { id },
      data: { dismissedAt: new Date(), dismissedBy: userId ?? null },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Failed to dismiss insight' });
  }
});

export default router;
