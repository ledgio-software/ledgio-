import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { prisma } from '../config/db';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/interest-policy
 * Returns the tenant's single interest policy, or null if none configured.
 */
router.get('/', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const policy = await (prisma as any).interestPolicy.findUnique({ where: { tenantId } });
    res.status(200).json({ success: true, data: { policy } });
  } catch (error: any) {
    console.error('[InterestPolicy] GET error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve interest policy.' });
  }
});

/**
 * PUT /api/v1/interest-policy
 * Upsert the tenant's interest policy.
 */
router.put('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { annualRate, graceDays, accountId, isActive } = req.body;

    if (annualRate === undefined || annualRate === null) {
      res.status(400).json({ success: false, error: 'annualRate is required.' });
      return;
    }
    if (Number(annualRate) < 0 || Number(annualRate) > 1) {
      res.status(400).json({ success: false, error: 'annualRate must be a decimal between 0 and 1 (e.g. 0.24 for 24%).' });
      return;
    }

    const policy = await (prisma as any).interestPolicy.upsert({
      where: { tenantId },
      create: {
        tenantId,
        annualRate: Number(annualRate),
        graceDays: graceDays !== undefined ? Number(graceDays) : 0,
        accountId: accountId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      update: {
        annualRate: Number(annualRate),
        graceDays: graceDays !== undefined ? Number(graceDays) : 0,
        accountId: accountId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(200).json({ success: true, data: { policy } });
  } catch (error: any) {
    console.error('[InterestPolicy] PUT error:', error);
    res.status(500).json({ success: false, error: 'Failed to save interest policy.' });
  }
});

/**
 * GET /api/v1/interest-policy/charges
 * List interest charges for the tenant.
 */
router.get('/charges', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { invoiceId, status } = req.query as { invoiceId?: string; status?: string };

    const where: any = { tenantId };
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;

    const charges = await (prisma as any).interestCharge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.status(200).json({ success: true, data: { charges } });
  } catch (error: any) {
    console.error('[InterestPolicy] GET /charges error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve interest charges.' });
  }
});

/**
 * PATCH /api/v1/interest-policy/charges/:id/void
 * Void an interest charge.
 */
router.patch('/charges/:id/void', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const charge = await (prisma as any).interestCharge.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!charge) {
      res.status(404).json({ success: false, error: 'Interest charge not found.' });
      return;
    }
    if (charge.status === 'VOIDED') {
      res.status(409).json({ success: false, error: 'Charge is already voided.' });
      return;
    }
    const updated = await (prisma as any).interestCharge.update({
      where: { id: charge.id },
      data: { status: 'VOIDED' },
    });
    res.status(200).json({ success: true, data: { charge: updated } });
  } catch (error: any) {
    console.error('[InterestPolicy] PATCH /charges/:id/void error:', error);
    res.status(500).json({ success: false, error: 'Failed to void interest charge.' });
  }
});

export default router;
