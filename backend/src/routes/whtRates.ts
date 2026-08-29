import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import * as whtRateService from '../services/whtRateService';
import { WhtRateServiceError } from '../services/whtRateService';
import { actorFromRequest } from '../services/auditLogService';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

function handleError(res: Response, error: any, fallbackMessage: string): void {
  if (error instanceof WhtRateServiceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error('[WhtRates] Error:', error);
  res.status(500).json({ success: false, error: fallbackMessage });
}

/**
 * GET /api/v1/wht-rates
 * Lists all WHT rates for the active tenant.
 */
router.get('/', requireRole('Viewer', 'Cashier', 'Shop Manager', 'HR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const whtRates = await whtRateService.listWhtRates(tenantId);
    res.status(200).json({ success: true, data: { whtRates } });
  } catch (error: any) {
    handleError(res, error, 'Failed to retrieve WHT rates.');
  }
});

/**
 * GET /api/v1/wht-rates/:id
 */
router.get('/:id', requireRole('Viewer', 'Cashier', 'Shop Manager', 'HR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const whtRate = await whtRateService.getWhtRateById(tenantId, req.params.id);
    if (!whtRate) {
      res.status(404).json({ success: false, error: `WHT rate with ID "${req.params.id}" not found.` });
      return;
    }
    res.status(200).json({ success: true, data: { whtRate } });
  } catch (error: any) {
    handleError(res, error, 'Failed to retrieve WHT rate.');
  }
});

/**
 * POST /api/v1/wht-rates
 * Creates a new WHT rate. Access: Accountant role or higher.
 */
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const whtRate = await whtRateService.createWhtRate(tenantId, req.body, actorFromRequest(req));
    res.status(201).json({ success: true, message: 'WHT rate created successfully', data: { whtRate } });
  } catch (error: any) {
    handleError(res, error, 'Failed to create WHT rate.');
  }
});

/**
 * PUT /api/v1/wht-rates/:id
 * Access: Accountant role or higher.
 */
router.put('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const whtRate = await whtRateService.updateWhtRate(tenantId, req.params.id, req.body, actorFromRequest(req));
    res.status(200).json({ success: true, message: 'WHT rate updated successfully', data: { whtRate } });
  } catch (error: any) {
    handleError(res, error, 'Failed to update WHT rate.');
  }
});

/**
 * DELETE /api/v1/wht-rates/:id
 * Blocked if any vendor bills reference it. Access: Accountant role or higher.
 */
router.delete('/:id', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    await whtRateService.deleteWhtRate(tenantId, req.params.id, actorFromRequest(req));
    res.status(200).json({ success: true, message: 'WHT rate deleted successfully' });
  } catch (error: any) {
    handleError(res, error, 'Failed to delete WHT rate.');
  }
});

export default router;
