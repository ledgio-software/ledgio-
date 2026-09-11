import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { BroadcastService } from '../services/broadcastService';

const router = Router();

function verifyAdminPasscode(req: Request): boolean {
  const passcode = (req.query.passcode as string) || (req.headers['x-admin-passcode'] as string | undefined);
  return !!passcode && BroadcastService.verifyPasscode(passcode);
}

/**
 * GET /api/v1/admin/client-health
 *
 * Returns a per-tenant health snapshot for the AGOD Control Engine's
 * "Client Health Dashboard" tab. Proxies last-activity via the most-recent
 * AuditLog row for each tenantId (AuditLog is written on every user action,
 * so it is a reliable signal of real usage without needing a dedicated
 * last-login column). Churn-risk signals are derived from the tenant's
 * subscriptionStatus, trialEndsAt, and days-since-activity.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyAdminPasscode(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized: valid master passcode required.' });
    return;
  }

  try {
    const [tenants, activityRows, userCounts] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          tier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionPaidUntil: true,
          createdAt: true,
          isLive: true,
        },
      }),
      // Most recent audit log timestamp per tenant
      prisma.auditLog.groupBy({
        by: ['tenantId'],
        _max: { createdAt: true },
        where: { tenantId: { not: null } },
      }),
      // User count per tenant
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { not: null }, isActive: true },
      }),
    ]);

    const activityMap = new Map(
      activityRows.map((r) => [r.tenantId as string, r._max.createdAt]),
    );
    const userCountMap = new Map(
      userCounts.map((r) => [r.tenantId as string, r._count.id]),
    );

    const now = new Date();

    const rows = tenants.map((t) => {
      const lastActivityAt = activityMap.get(t.id) ?? null;
      const daysSinceActivity = lastActivityAt
        ? Math.floor((now.getTime() - lastActivityAt.getTime()) / 86_400_000)
        : null;

      // Trial expiry risk: trial ending within 7 days
      const trialDaysLeft = t.trialEndsAt
        ? Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
        : null;

      // Subscription expiry risk: active but paid-until within 7 days
      const paidDaysLeft = t.subscriptionPaidUntil
        ? Math.ceil((t.subscriptionPaidUntil.getTime() - now.getTime()) / 86_400_000)
        : null;

      // Churn risk label
      let churnRisk: 'high' | 'medium' | 'low' | 'none' = 'none';
      if (t.subscriptionStatus === 'EXPIRED') {
        churnRisk = 'high';
      } else if (daysSinceActivity !== null && daysSinceActivity >= 14) {
        churnRisk = 'high';
      } else if (trialDaysLeft !== null && trialDaysLeft <= 7 && t.subscriptionStatus === 'TRIAL') {
        churnRisk = 'high';
      } else if (paidDaysLeft !== null && paidDaysLeft <= 7 && t.subscriptionStatus === 'ACTIVE') {
        churnRisk = 'medium';
      } else if (daysSinceActivity !== null && daysSinceActivity >= 7) {
        churnRisk = 'medium';
      } else if (trialDaysLeft !== null && trialDaysLeft <= 14 && t.subscriptionStatus === 'TRIAL') {
        churnRisk = 'medium';
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        tier: t.tier,
        subscriptionStatus: t.subscriptionStatus,
        trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
        subscriptionPaidUntil: t.subscriptionPaidUntil?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        isLive: t.isLive,
        userCount: userCountMap.get(t.id) ?? 0,
        lastActivityAt: lastActivityAt?.toISOString() ?? null,
        daysSinceActivity,
        trialDaysLeft,
        paidDaysLeft,
        churnRisk,
      };
    });

    // Summary stats
    const summary = {
      totalTenants: rows.length,
      activeTenants: rows.filter((r) => r.subscriptionStatus === 'ACTIVE').length,
      trialTenants: rows.filter((r) => r.subscriptionStatus === 'TRIAL').length,
      expiredTenants: rows.filter((r) => r.subscriptionStatus === 'EXPIRED').length,
      dormantTenants: rows.filter((r) => r.daysSinceActivity !== null && r.daysSinceActivity >= 14).length,
      highRiskTenants: rows.filter((r) => r.churnRisk === 'high').length,
      mediumRiskTenants: rows.filter((r) => r.churnRisk === 'medium').length,
      trialsExpiringIn7Days: rows.filter(
        (r) => r.subscriptionStatus === 'TRIAL' && r.trialDaysLeft !== null && r.trialDaysLeft <= 7 && r.trialDaysLeft >= 0,
      ).length,
    };

    res.json({ success: true, data: { summary, tenants: rows } });
  } catch (err) {
    console.error('[admin/client-health] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load client health data.' });
  }
});

export default router;
