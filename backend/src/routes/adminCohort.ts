import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

/**
 * GET /admin/cohort?days=7
 * Returns tenants created within the last N days, with their onboarding step and
 * whether they've posted their first transaction (isLive proxy).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Math.min(parseInt(req.query.days as string || '7', 10), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const tenants = await prisma.tenant.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, tier: true,
        subscriptionStatus: true, trialEndsAt: true,
        isLive: true, orgType: true, businessType: true,
        vatRegistered: true, createdAt: true, referralCode: true,
      },
    });

    const tenantIds = tenants.map((t) => t.id);

    const [userCounts, auditFirsts, invites] = await Promise.all([
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { in: tenantIds }, isActive: true },
      }),
      // First audit log per tenant (proxy for first real action after signup)
      prisma.auditLog.groupBy({
        by: ['tenantId'],
        _min: { createdAt: true },
        where: { tenantId: { in: tenantIds } },
      }),
      prisma.invitation.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { in: tenantIds } },
      }),
    ]);

    const userMap = new Map(userCounts.map((r) => [r.tenantId as string, r._count.id]));
    const firstActionMap = new Map(auditFirsts.map((r) => [r.tenantId as string, r._min.createdAt]));
    const inviteMap = new Map(invites.map((r) => [r.tenantId as string, r._count.id]));

    const data = tenants.map((t) => {
      const userCount = userMap.get(t.id) ?? 0;
      const firstAction = firstActionMap.get(t.id) ?? null;
      const inviteCount = inviteMap.get(t.id) ?? 0;

      // Derive onboarding step
      let onboardingStep = 'Registered';
      if (t.isLive) onboardingStep = 'Live (first transaction posted)';
      else if (firstAction) onboardingStep = 'Active (using the app)';
      else if (userCount > 1 || inviteCount > 0) onboardingStep = 'Invited team';
      else if (t.businessType) onboardingStep = 'Setup wizard completed';

      return {
        ...t,
        activeUsers: userCount,
        teamInvites: inviteCount,
        firstAction,
        onboardingStep,
        daysSinceSignup: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000),
      };
    });

    res.json({ success: true, data, meta: { days, since } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
