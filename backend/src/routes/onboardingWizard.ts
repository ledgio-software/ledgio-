import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { actorFromRequest } from '../services/auditLogService';
import * as onboardingWizardService from '../services/onboardingWizardService';
import { generateQuickStartGuidePdf } from '../services/pdfGenerationService';
import { prisma } from '../config/db';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/onboarding/status
 * The completion checklist the wizard (and a persistent "setup" banner
 * elsewhere in the app) renders from - computed live from real tenant data,
 * never a set-once-and-forget flag.
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const status = await onboardingWizardService.getOnboardingStatus(tenantId);
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    if (error instanceof onboardingWizardService.OnboardingWizardServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[OnboardingWizard] Error fetching status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding status.' });
  }
});

/**
 * PUT /api/v1/onboarding/business-profile
 * Step 1: business type, VAT/GRA status, currency.
 */
router.put('/business-profile', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await onboardingWizardService.updateBusinessProfile(tenantId, req.body);
    const status = await onboardingWizardService.getOnboardingStatus(tenantId);
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    if (error instanceof onboardingWizardService.OnboardingWizardServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[OnboardingWizard] Error updating business profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update business profile.' });
  }
});

/**
 * GET /api/v1/onboarding/chart-of-accounts-template
 * Step 2: the Ghana SME default chart of accounts, for the client to review
 * and edit before seeding.
 */
router.get('/chart-of-accounts-template', requireRole('Admin'), async (_req: Request, res: Response): Promise<void> => {
  const { tenantId } = requireTenantContext();
  const tenant = await (await import('../config/db')).prisma.tenant.findUnique({ where: { id: tenantId }, select: { orgType: true } });
  res.status(200).json({ success: true, data: onboardingWizardService.getChartOfAccountsTemplate(tenant?.orgType) });
});

/**
 * POST /api/v1/onboarding/chart-of-accounts/seed
 * Bulk-creates the (possibly edited) chart of accounts list.
 */
router.post('/chart-of-accounts/seed', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { accounts } = req.body;
    const result = await onboardingWizardService.seedChartOfAccounts(accounts, actorFromRequest(req));
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof onboardingWizardService.OnboardingWizardServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[OnboardingWizard] Error seeding chart of accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to seed chart of accounts.' });
  }
});

/**
 * POST /api/v1/onboarding/opening-balances
 * Step 3, the hard trial-balance gate: rejects with the exact debit/credit
 * totals unless they match exactly - see onboardingWizardService for why
 * this is not a soft warning.
 */
router.post('/opening-balances', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const result = await onboardingWizardService.postOpeningBalances(tenantId, req.body, actorFromRequest(req));
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof onboardingWizardService.OnboardingWizardServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[OnboardingWizard] Error posting opening balances:', error);
    res.status(500).json({ success: false, error: 'Failed to post opening balances.' });
  }
});

/**
 * POST /api/v1/onboarding/seed-wht-defaults
 * Seeds the default Ghana WHT5 (5%) preset if not already present.
 */
router.post('/seed-wht-defaults', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const result = await onboardingWizardService.seedWhtRateDefaults(tenantId, actorFromRequest(req));
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[OnboardingWizard] Error seeding WHT defaults:', error);
    res.status(500).json({ success: false, error: 'Failed to seed WHT rate defaults.' });
  }
});

/**
 * GET /api/v1/onboarding/quick-start-guide
 * Streams the sector-specific Quick Start Guide PDF for the authenticated tenant.
 * Any staff member can download it — no Admin role required.
 */
router.get('/quick-start-guide', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, orgType: true },
    });

    const businessName = tenant?.name ?? 'Your Business';
    const orgType = tenant?.orgType ?? 'BUSINESS';
    const recipientName = (req as any).user?.name ?? businessName;

    const pdfBuffer = await generateQuickStartGuidePdf(businessName, recipientName, orgType);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Ledgio_Quick_Start_Guide.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).end(pdfBuffer);
  } catch (error: any) {
    console.error('[OnboardingWizard] Error generating quick start guide:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Quick Start Guide.' });
  }
});

export default router;
