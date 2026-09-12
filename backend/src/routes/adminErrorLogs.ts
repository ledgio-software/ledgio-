import { Router, Request, Response } from 'express';
import { getErrors, getErrorGroups, clearErrors } from '../services/errorLogService';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware.

/** GET /api/v1/admin/error-logs — individual entries, newest first */
router.get('/', (_req: Request, res: Response): void => {
  const errors = getErrors();
  res.json({ success: true, data: { errors, count: errors.length } });
});

/** GET /api/v1/admin/error-logs/grouped — grouped by error+source, sorted by frequency */
router.get('/grouped', (_req: Request, res: Response): void => {
  const groups = getErrorGroups();
  res.json({ success: true, data: { groups, count: groups.length } });
});

/** DELETE /api/v1/admin/error-logs — clear the buffer */
router.delete('/', (_req: Request, res: Response): void => {
  clearErrors();
  res.json({ success: true, message: 'Error log cleared.' });
});

export default router;
