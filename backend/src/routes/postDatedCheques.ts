import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import * as pdcService from '../services/pdcService';
import { PDCServiceError } from '../services/pdcService';
import { actorFromRequest } from '../services/auditLogService';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

function handleError(res: Response, error: any, fallback: string): void {
  if (error instanceof PDCServiceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  console.error('[PDC] Error:', error);
  res.status(500).json({ success: false, error: fallback });
}

/**
 * GET /api/v1/pdc
 * Lists post-dated cheques. Filter by ?type=RECEIVABLE|PAYABLE and ?status=PENDING|...
 */
router.get('/', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { type, status } = req.query as { type?: string; status?: string };
    const pdcs = await pdcService.listPDCs(tenantId, { type, status });
    res.status(200).json({ success: true, data: { pdcs } });
  } catch (error: any) {
    handleError(res, error, 'Failed to retrieve post-dated cheques.');
  }
});

/**
 * GET /api/v1/pdc/:id
 */
router.get('/:id', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const pdc = await pdcService.getPDCById(tenantId, req.params.id);
    if (!pdc) {
      res.status(404).json({ success: false, error: 'Post-dated cheque not found.' });
      return;
    }
    res.status(200).json({ success: true, data: { pdc } });
  } catch (error: any) {
    handleError(res, error, 'Failed to retrieve post-dated cheque.');
  }
});

/**
 * POST /api/v1/pdc
 * Creates a PDC. Optionally posts a receipt/issuance journal when postJournal=true.
 */
router.post('/', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const pdc = await pdcService.createPDC(tenantId, req.body, actorFromRequest(req));
    res.status(201).json({ success: true, message: 'Post-dated cheque created successfully', data: { pdc } });
  } catch (error: any) {
    handleError(res, error, 'Failed to create post-dated cheque.');
  }
});

/**
 * PATCH /api/v1/pdc/:id/deposit
 * Marks the cheque DEPOSITED and posts the clearing journal.
 */
router.patch('/:id/deposit', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const pdc = await pdcService.depositPDC(tenantId, req.params.id, actorFromRequest(req));
    res.status(200).json({ success: true, message: 'Cheque marked as deposited', data: { pdc } });
  } catch (error: any) {
    handleError(res, error, 'Failed to deposit post-dated cheque.');
  }
});

/**
 * PATCH /api/v1/pdc/:id/bounce
 * Marks the cheque BOUNCED and posts a reversal journal for RECEIVABLE cheques.
 */
router.patch('/:id/bounce', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const pdc = await pdcService.bouncePDC(tenantId, req.params.id, actorFromRequest(req));
    res.status(200).json({ success: true, message: 'Cheque marked as bounced', data: { pdc } });
  } catch (error: any) {
    handleError(res, error, 'Failed to bounce post-dated cheque.');
  }
});

/**
 * PATCH /api/v1/pdc/:id/cancel
 * Marks the cheque CANCELLED. No journal entry.
 */
router.patch('/:id/cancel', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const pdc = await pdcService.cancelPDC(tenantId, req.params.id);
    res.status(200).json({ success: true, message: 'Cheque cancelled', data: { pdc } });
  } catch (error: any) {
    handleError(res, error, 'Failed to cancel post-dated cheque.');
  }
});

export default router;
