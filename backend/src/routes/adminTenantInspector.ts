import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { verifyAdminSessionToken } from '../services/adminTotpService';
import { BroadcastService } from '../services/broadcastService';

const router = Router();

function isMasterAdmin(req: Request): boolean {
  const session = req.headers['x-admin-session'] as string | undefined;
  if (session && verifyAdminSessionToken(session)) return true;
  const passcode = req.headers['x-admin-passcode'] as string | undefined;
  return !!passcode && BroadcastService.verifyPasscode(passcode);
}

/** GET /admin/tenants?q=search&status=ACTIVE&limit=50 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? '';
    const statusFilter = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (statusFilter) where.subscriptionStatus = statusFilter;

    const [tenants, userCounts, activityRows] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, name: true, slug: true, schema: true, tier: true,
          subscriptionStatus: true, trialEndsAt: true, subscriptionPaidUntil: true,
          isLive: true, orgType: true, businessType: true, createdAt: true,
          referralCode: true,
        },
      }),
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { not: null }, isActive: true },
      }),
      prisma.auditLog.groupBy({
        by: ['tenantId'],
        _max: { createdAt: true },
        where: { tenantId: { not: null } },
      }),
    ]);

    const userCountMap = new Map(userCounts.map((r) => [r.tenantId as string, r._count.id]));
    const activityMap = new Map(activityRows.map((r) => [r.tenantId as string, r._max.createdAt]));

    const data = tenants.map((t) => ({
      ...t,
      activeUsers: userCountMap.get(t.id) ?? 0,
      lastActivity: activityMap.get(t.id) ?? null,
    }));

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PATCH /admin/tenants/:id — suspend or reactivate a tenant (master admin only) */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }
  const { subscriptionStatus } = req.body as { subscriptionStatus?: string };
  if (!subscriptionStatus || !['TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED'].includes(subscriptionStatus)) {
    res.status(400).json({ success: false, error: 'Valid subscriptionStatus required.' });
    return;
  }
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { subscriptionStatus },
      select: { id: true, name: true, slug: true, subscriptionStatus: true },
    });
    res.json({ success: true, data: tenant });
  } catch (err: any) {
    res.status(err.code === 'P2025' ? 404 : 500).json({ success: false, error: err.message });
  }
});

export default router;
