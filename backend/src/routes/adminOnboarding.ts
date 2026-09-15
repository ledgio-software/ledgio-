import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware.

// The 7 post-signup milestones tracked in AuditLog.
// isLive (step 0) comes from the Tenant model directly.
const MILESTONE_ACTIONS: Record<string, string[]> = {
  teamMemberAdded:    ['INVITATION.SENT'],
  firstJournalPosted: ['JOURNAL_ENTRY.POSTED'],
  firstInvoiceSent:   ['INVOICE.EMAILED', 'INVOICE.PAID'],
  firstSaleRecorded:  ['SALES_ORDER.CREATED', 'SALES_ORDER.CONFIRMED', 'CASH_SALE.VOIDED'],
  firstInventoryItem: ['INVENTORY_ITEM.CREATED', 'INVENTORY_ITEM.BULK_CREATED'],
  bankConnected:      ['BANK_ACCOUNT.CONNECTED'],
  firstReconciliation:['BANK_TRANSACTION.RECONCILED'],
};

const ALL_MILESTONE_ACTIONS = Object.values(MILESTONE_ACTIONS).flat();
const MILESTONE_KEYS = Object.keys(MILESTONE_ACTIONS) as (keyof typeof MILESTONE_ACTIONS)[];
// Total steps including isLive (step 0)
const TOTAL_STEPS = 1 + MILESTONE_KEYS.length;

/**
 * GET /api/v1/admin/onboarding
 *
 * Returns per-tenant onboarding completion for the AGOD Control Engine's
 * "Onboarding" tab. Step 0 is the onboarding wizard (Tenant.isLive);
 * steps 1-7 are milestones derived from AuditLog action presence.
 * A client who signed up >7 days ago with completion < 4 is flagged as
 * "stuck" — they need a proactive outreach call from AGOD.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [tenants, milestoneRows, userCounts] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          tier: true,
          subscriptionStatus: true,
          isLive: true,
          createdAt: true,
        },
      }),
      // Distinct (tenantId, action) pairs for all milestone actions
      prisma.auditLog.findMany({
        where: { action: { in: ALL_MILESTONE_ACTIONS }, tenantId: { not: null } },
        select: { tenantId: true, action: true },
        distinct: ['tenantId', 'action'],
      }),
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { not: null }, isActive: true },
      }),
    ]);

    // Build milestone map: tenantId -> Set of milestone keys completed
    const milestoneMap = new Map<string, Set<string>>();
    for (const row of milestoneRows) {
      if (!row.tenantId) continue;
      for (const [key, actions] of Object.entries(MILESTONE_ACTIONS)) {
        if (actions.includes(row.action)) {
          if (!milestoneMap.has(row.tenantId)) milestoneMap.set(row.tenantId, new Set());
          milestoneMap.get(row.tenantId)!.add(key);
        }
      }
    }

    const userCountMap = new Map(
      userCounts.map((r) => [r.tenantId as string, r._count.id]),
    );

    const now = new Date();

    const rows = tenants.map((t) => {
      const completedMilestones = milestoneMap.get(t.id) ?? new Set<string>();
      const milestoneDetail: Record<string, boolean> = {};
      for (const key of MILESTONE_KEYS) {
        milestoneDetail[key] = completedMilestones.has(key);
      }
      // Step 0: onboarding wizard (isLive)
      const completionScore = (t.isLive ? 1 : 0) + completedMilestones.size;
      const completionPct = Math.round((completionScore / TOTAL_STEPS) * 100);

      const daysSinceSignup = Math.floor((now.getTime() - t.createdAt.getTime()) / 86_400_000);

      // "Stuck" = signed up >7 days ago but less than half the steps done
      const isStuck = daysSinceSignup > 7 && completionScore < Math.ceil(TOTAL_STEPS / 2);

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        tier: t.tier,
        subscriptionStatus: t.subscriptionStatus,
        isLive: t.isLive,
        createdAt: t.createdAt.toISOString(),
        userCount: userCountMap.get(t.id) ?? 0,
        daysSinceSignup,
        completionScore,
        completionPct,
        isStuck,
        milestoneDetail,
      };
    });

    const summary = {
      total: rows.length,
      fullyOnboarded: rows.filter((r) => r.completionScore === TOTAL_STEPS).length,
      halfOrMore: rows.filter((r) => r.completionScore >= Math.ceil(TOTAL_STEPS / 2) && r.completionScore < TOTAL_STEPS).length,
      barelyStarted: rows.filter((r) => r.completionScore < 2).length,
      stuck: rows.filter((r) => r.isStuck).length,
      avgCompletionPct: rows.length > 0
        ? Math.round(rows.reduce((s, r) => s + r.completionPct, 0) / rows.length)
        : 0,
    };

    res.json({ success: true, data: { summary, totalSteps: TOTAL_STEPS, tenants: rows } });
  } catch (err) {
    console.error('[admin/onboarding] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load onboarding data.' });
  }
});

export default router;
