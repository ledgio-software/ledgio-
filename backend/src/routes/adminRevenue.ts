import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { BroadcastService } from '../services/broadcastService';
import { SUBSCRIPTION_PLANS } from './subscription';

const router = Router();

function verifyAdminPasscode(req: Request): boolean {
  const passcode = (req.query.passcode as string) || (req.headers['x-admin-passcode'] as string | undefined);
  return !!passcode && BroadcastService.verifyPasscode(passcode);
}

const PLAN_MAP = new Map(SUBSCRIPTION_PLANS.map((p) => [p.tier, p]));
const priceForTier = (tier: number): number => PLAN_MAP.get(tier)?.priceGhs ?? 105;
const nameForTier = (tier: number): string => PLAN_MAP.get(tier)?.name ?? 'Shop';

/**
 * GET /api/v1/admin/revenue
 *
 * Returns subscription revenue analytics for the AGOD Control Engine:
 * - MRR (active paid tenants × their tier price)
 * - ARR projection (MRR × 12)
 * - Trial pipeline value (active trials × their tier price)
 * - Revenue at risk (renewals due in ≤30 days + expired tenants)
 * - Trial-to-paid conversion funnel totals
 * - Tier-based revenue breakdown
 * - Month-by-month new-paid activations for the last 12 months
 *   (approximated from Tenant.createdAt for tenants that converted to ACTIVE)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyAdminPasscode(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized: valid master passcode required.' });
    return;
  }

  try {
    const now = new Date();
    const day30From = new Date(now.getTime() + 30 * 86_400_000);

    const tenants = await prisma.tenant.findMany({
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
    });

    // ── Per-tenant enrichment ──────────────────────────────────────────────
    type TenantRow = {
      id: string; name: string; slug: string; tier: number;
      tierName: string; priceGhs: number;
      subscriptionStatus: string;
      trialEndsAt: string | null; subscriptionPaidUntil: string | null;
      createdAt: string; isLive: boolean;
      trialDaysLeft: number | null; renewalDaysLeft: number | null;
      isRevenueAtRisk: boolean;
    };

    const enriched: TenantRow[] = tenants.map((t) => {
      const price = priceForTier(t.tier);
      const tierName = nameForTier(t.tier);
      const trialDaysLeft = t.trialEndsAt
        ? Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
        : null;
      const renewalDaysLeft = t.subscriptionPaidUntil
        ? Math.ceil((t.subscriptionPaidUntil.getTime() - now.getTime()) / 86_400_000)
        : null;
      const isRevenueAtRisk =
        t.subscriptionStatus === 'EXPIRED' ||
        (t.subscriptionStatus === 'ACTIVE' && renewalDaysLeft !== null && renewalDaysLeft <= 30);

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        tier: t.tier,
        tierName,
        priceGhs: price,
        subscriptionStatus: t.subscriptionStatus,
        trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
        subscriptionPaidUntil: t.subscriptionPaidUntil?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        isLive: t.isLive,
        trialDaysLeft,
        renewalDaysLeft,
        isRevenueAtRisk,
      };
    });

    // ── Aggregates ────────────────────────────────────────────────────────
    const active = enriched.filter((t) => t.subscriptionStatus === 'ACTIVE');
    const trial = enriched.filter((t) => t.subscriptionStatus === 'TRIAL');
    const expired = enriched.filter((t) => t.subscriptionStatus === 'EXPIRED');
    const atRisk = enriched.filter((t) => t.isRevenueAtRisk);

    const mrr = active.reduce((s, t) => s + t.priceGhs, 0);
    const arr = mrr * 12;
    const trialPipelineValue = trial.reduce((s, t) => s + t.priceGhs, 0);
    const revenueAtRisk = atRisk.reduce((s, t) => s + t.priceGhs, 0);

    // Tier breakdown
    const tierBreakdown = SUBSCRIPTION_PLANS.map((plan) => {
      const inTier = active.filter((t) => t.tier === plan.tier);
      return {
        tier: plan.tier,
        name: plan.name,
        priceGhs: plan.priceGhs,
        activeCount: inTier.length,
        tierMrr: inTier.length * plan.priceGhs,
      };
    });

    // Renewals due in next 30 days (ACTIVE tenants only)
    const renewalsDue = active
      .filter((t) => t.renewalDaysLeft !== null && t.renewalDaysLeft >= 0 && t.renewalDaysLeft <= 30)
      .sort((a, b) => (a.renewalDaysLeft ?? 0) - (b.renewalDaysLeft ?? 0));

    // Monthly new-paid activations: last 12 full calendar months (ACTIVE only)
    // Approximation: we bucket by createdAt month for ACTIVE tenants — the
    // true "paid_at" timestamp isn't stored, but for monthly trend purposes
    // createdAt is a reasonable proxy (most trials convert within their first month).
    const monthlyActivations: { month: string; count: number; mrr: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const inMonth = active.filter((t) => {
        const c = new Date(t.createdAt);
        return c >= d && c < monthEnd;
      });
      monthlyActivations.push({
        month: label,
        count: inMonth.length,
        mrr: inMonth.reduce((s, t) => s + t.priceGhs, 0),
      });
    }

    const summary = {
      totalTenants: enriched.length,
      activePaid: active.length,
      trial: trial.length,
      expired: expired.length,
      mrr,
      arr,
      trialPipelineValue,
      revenueAtRisk,
      renewalsDueIn30Days: renewalsDue.length,
      avgRevenuePerTenant: active.length > 0 ? Math.round(mrr / active.length) : 0,
      trialConversionRate:
        enriched.length > 0 ? Math.round((active.length / enriched.length) * 100) : 0,
    };

    res.json({
      success: true,
      data: {
        summary,
        tierBreakdown,
        renewalsDue,
        monthlyActivations,
        allTenants: enriched,
      },
    });
  } catch (err) {
    console.error('[admin/revenue] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load revenue data.' });
  }
});

export default router;
