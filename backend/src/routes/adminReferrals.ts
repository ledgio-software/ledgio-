import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware.

// Monthly subscription price per tier (USD). Tier 0 = free/trial counts as $0.
const TIER_MRR: Record<number, number> = { 0: 0, 1: 29, 2: 49, 3: 99 };

function mrrForTier(tier: number): number {
  return TIER_MRR[tier] ?? 29;
}

/** GET /api/v1/admin/referrals/partners — list all partners with live stats */
router.get('/partners', async (req: Request, res: Response): Promise<void> => {
  try {
    const partners = await prisma.referralPartner.findMany({ orderBy: { createdAt: 'asc' } });
    const tenants = await prisma.tenant.findMany({
      where: { referralCode: { not: null } },
      select: { referralCode: true, tier: true, subscriptionStatus: true },
    });

    const result = partners.map((p) => {
      const referred = tenants.filter((t) => t.referralCode === p.code);
      const totalMrr = referred.reduce((sum, t) => sum + (t.subscriptionStatus === 'ACTIVE' ? mrrForTier(t.tier) : 0), 0);
      const commissionDue = (totalMrr * Number(p.commissionRate)) / 100;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        commissionRate: Number(p.commissionRate),
        contacts: p.contacts,
        isActive: p.isActive,
        tenantCount: referred.length,
        totalMrr,
        commissionDue: Math.round(commissionDue * 100) / 100,
      };
    });

    res.json({ success: true, data: { partners: result } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch referral partners.' });
  }
});

/** POST /api/v1/admin/referrals/partners — create a new partner */
router.post('/partners', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, code, commissionRate, contacts } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, error: 'name and code are required.' });
      return;
    }
    const partner = await prisma.referralPartner.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        commissionRate: commissionRate != null ? Number(commissionRate) : 10,
        contacts: contacts ? String(contacts).trim() : null,
      },
    });
    res.status(201).json({ success: true, data: { partner } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A partner with that code already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create referral partner.' });
  }
});

/** PATCH /api/v1/admin/referrals/partners/:id — update partner fields */
router.patch('/partners/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, commissionRate, contacts, isActive } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (commissionRate !== undefined) data.commissionRate = Number(commissionRate);
    if (contacts !== undefined) data.contacts = contacts ? String(contacts).trim() : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const partner = await prisma.referralPartner.update({ where: { id }, data });
    res.json({ success: true, data: { partner } });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Partner not found.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update referral partner.' });
  }
});

/** GET /api/v1/admin/referrals/stats — cross-partner summary totals */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const [partners, tenants] = await Promise.all([
      prisma.referralPartner.findMany(),
      prisma.tenant.findMany({
        where: { referralCode: { not: null } },
        select: { referralCode: true, tier: true, subscriptionStatus: true },
      }),
    ]);

    const codeToRate: Record<string, number> = {};
    partners.forEach((p) => { codeToRate[p.code] = Number(p.commissionRate); });

    let totalMrr = 0;
    let totalCommissionDue = 0;
    tenants.forEach((t) => {
      if (t.subscriptionStatus !== 'ACTIVE' || !t.referralCode) return;
      const mrr = mrrForTier(t.tier);
      totalMrr += mrr;
      totalCommissionDue += (mrr * (codeToRate[t.referralCode] ?? 0)) / 100;
    });

    res.json({
      success: true,
      data: {
        totalPartners: partners.length,
        activePartners: partners.filter((p) => p.isActive).length,
        totalTenants: tenants.length,
        totalMrr: Math.round(totalMrr * 100) / 100,
        totalCommissionDue: Math.round(totalCommissionDue * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch referral stats.' });
  }
});

/** POST /api/v1/admin/referrals/verify — public code validation */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'code is required.' });
      return;
    }
    const partner = await prisma.referralPartner.findUnique({
      where: { code: String(code).trim().toUpperCase() },
      select: { id: true, name: true, isActive: true },
    });
    if (!partner || !partner.isActive) {
      res.status(404).json({ success: false, error: 'Invalid or inactive referral code.' });
      return;
    }
    res.json({ success: true, data: { valid: true, partnerName: partner.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to verify referral code.' });
  }
});

export default router;
