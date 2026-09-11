import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { BroadcastService } from '../services/broadcastService';

const router = Router();

function verifyAdminPasscode(req: Request): boolean {
  const passcode = (req.query.passcode as string) || (req.headers['x-admin-passcode'] as string | undefined);
  return !!passcode && BroadcastService.verifyPasscode(passcode);
}

// The 5 key feature areas whose audit-log actions signal a tenant has
// actually derived value from the product. Used to compute adoption score.
const FEATURE_SIGNALS: Record<string, string[]> = {
  invoicing: ['INVOICE.PAID', 'INVOICE.EMAILED', 'INVOICE.PAYMENT_REMINDER_SENT'],
  bookkeeping: ['JOURNAL_ENTRY.POSTED', 'JOURNAL_ENTRY.CREATED'],
  inventory: ['INVENTORY_ITEM.CREATED', 'INVENTORY_ITEM.BULK_CREATED', 'STOCK_ADJUSTMENT.RECORDED', 'STOCK_TAKE.RECONCILED'],
  sales: ['SALES_ORDER.CREATED', 'SALES_ORDER.CONFIRMED', 'GRN.CREATED'],
  banking: ['BANK_ACCOUNT.CONNECTED', 'BANK_TRANSACTION.RECONCILED'],
};

const ALL_SIGNAL_ACTIONS = Object.values(FEATURE_SIGNALS).flat();

/**
 * GET /api/v1/admin/churn-risk
 *
 * Returns at-risk tenants grouped into urgency buckets plus per-tenant
 * feature adoption signals (derived from AuditLog action presence — if
 * the action was ever written, the tenant used that feature). Adoption
 * score 0-5 across the five key feature areas.
 *
 * At-risk = any of: TRIAL expiring ≤30 days, ACTIVE renewal ≤14 days,
 * EXPIRED, or zero audit-log activity in the past 14 days.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyAdminPasscode(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized: valid master passcode required.' });
    return;
  }

  try {
    const now = new Date();
    const day14Ago = new Date(now.getTime() - 14 * 86_400_000);

    const [allTenants, activityRows, adoptionRows, userCounts] = await Promise.all([
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
      // Most-recent audit log timestamp per tenant (activity signal)
      prisma.auditLog.groupBy({
        by: ['tenantId'],
        _max: { createdAt: true },
        where: { tenantId: { not: null } },
      }),
      // Feature adoption: distinct (tenantId, action) pairs for key actions
      prisma.auditLog.findMany({
        where: { action: { in: ALL_SIGNAL_ACTIONS }, tenantId: { not: null } },
        select: { tenantId: true, action: true },
        distinct: ['tenantId', 'action'],
      }),
      // Active user count per tenant
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { not: null }, isActive: true },
      }),
    ]);

    const activityMap = new Map(
      activityRows.map((r) => [r.tenantId as string, r._max.createdAt]),
    );

    // Build feature-adoption map: tenantId -> Set of feature areas used
    const adoptionMap = new Map<string, Set<string>>();
    for (const row of adoptionRows) {
      if (!row.tenantId) continue;
      for (const [feature, actions] of Object.entries(FEATURE_SIGNALS)) {
        if (actions.includes(row.action)) {
          if (!adoptionMap.has(row.tenantId)) adoptionMap.set(row.tenantId, new Set());
          adoptionMap.get(row.tenantId)!.add(feature);
        }
      }
    }

    const userCountMap = new Map(
      userCounts.map((r) => [r.tenantId as string, r._count.id]),
    );

    type AtRiskTenant = {
      id: string; name: string; slug: string; tier: number;
      subscriptionStatus: string; trialEndsAt: string | null;
      subscriptionPaidUntil: string | null; createdAt: string; isLive: boolean;
      userCount: number; lastActivityAt: string | null;
      daysSinceActivity: number | null; trialDaysLeft: number | null;
      paidDaysLeft: number | null; adoptionScore: number;
      adoptionDetail: Record<string, boolean>;
      bucket: 'expired' | 'trial_critical' | 'trial_soon' | 'trial_watch' | 'renewal_soon' | 'dormant';
    };

    const enrichedRaw = allTenants.map((t) => {
      const lastActivityAt = activityMap.get(t.id) ?? null;
      const daysSinceActivity = lastActivityAt
        ? Math.floor((now.getTime() - lastActivityAt.getTime()) / 86_400_000)
        : null;
      const trialDaysLeft = t.trialEndsAt
        ? Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
        : null;
      const paidDaysLeft = t.subscriptionPaidUntil
        ? Math.ceil((t.subscriptionPaidUntil.getTime() - now.getTime()) / 86_400_000)
        : null;

      const featuresUsed = adoptionMap.get(t.id) ?? new Set<string>();
      const adoptionScore = featuresUsed.size;
      const adoptionDetail: Record<string, boolean> = {};
      for (const feature of Object.keys(FEATURE_SIGNALS)) {
        adoptionDetail[feature] = featuresUsed.has(feature);
      }

      // Bucket classification (a tenant may belong to multiple, but we
      // assign the most urgent one so each appears once in the UI):
      // priority: expired > trial_critical > trial_soon > renewal_soon > dormant
      let bucket: 'expired' | 'trial_critical' | 'trial_soon' | 'trial_watch' | 'renewal_soon' | 'dormant' | null = null;

      if (t.subscriptionStatus === 'EXPIRED') {
        bucket = 'expired';
      } else if (t.subscriptionStatus === 'TRIAL') {
        if (trialDaysLeft !== null && trialDaysLeft <= 3) bucket = 'trial_critical';
        else if (trialDaysLeft !== null && trialDaysLeft <= 7) bucket = 'trial_soon';
        else if (trialDaysLeft !== null && trialDaysLeft <= 30) bucket = 'trial_watch';
        else if (daysSinceActivity !== null && daysSinceActivity >= 14) bucket = 'dormant';
      } else if (t.subscriptionStatus === 'ACTIVE') {
        if (paidDaysLeft !== null && paidDaysLeft <= 14) bucket = 'renewal_soon';
        else if (daysSinceActivity !== null && daysSinceActivity >= 14) bucket = 'dormant';
      }

      // Only include tenants that fall into some at-risk bucket
      if (!bucket) return null;

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
        adoptionScore,
        adoptionDetail,
        bucket,
      } satisfies AtRiskTenant;
    });

    const enriched: AtRiskTenant[] = enrichedRaw.filter((r): r is AtRiskTenant => r !== null);

    const BUCKET_ORDER: AtRiskTenant['bucket'][] = ['expired', 'trial_critical', 'trial_soon', 'renewal_soon', 'dormant', 'trial_watch'];
    enriched.sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket));

    const summary = {
      total: enriched.length,
      expired: enriched.filter((r) => r.bucket === 'expired').length,
      trialCritical: enriched.filter((r) => r.bucket === 'trial_critical').length,
      trialSoon: enriched.filter((r) => r.bucket === 'trial_soon').length,
      trialWatch: enriched.filter((r) => r.bucket === 'trial_watch').length,
      renewalSoon: enriched.filter((r) => r.bucket === 'renewal_soon').length,
      dormant: enriched.filter((r) => r.bucket === 'dormant').length,
      notEmbedded: enriched.filter((r) => r.adoptionScore <= 1).length,
    };

    res.json({ success: true, data: { summary, tenants: enriched } });
  } catch (err) {
    console.error('[admin/churn-risk] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load churn risk data.' });
  }
});

export default router;
