import { Router, Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { getErrors, getErrorGroups, clearErrors } from '../services/errorLogService';

const router = Router();

function verifyPasscode(req: Request, res: Response): boolean {
  const passcode = (req.headers['x-admin-passcode'] as string | undefined) ?? '';
  if (!BroadcastService.verifyPasscode(passcode)) {
    res.status(401).json({ success: false, error: 'Invalid master passcode.' });
    return false;
  }
  return true;
}

/** GET /api/v1/admin/error-logs — individual entries, newest first */
router.get('/', (req: Request, res: Response): void => {
  if (!verifyPasscode(req, res)) return;
  const errors = getErrors();
  res.json({ success: true, data: { errors, count: errors.length } });
});

/** GET /api/v1/admin/error-logs/grouped — grouped by error+source, sorted by frequency */
router.get('/grouped', (req: Request, res: Response): void => {
  if (!verifyPasscode(req, res)) return;
  const groups = getErrorGroups();
  res.json({ success: true, data: { groups, count: groups.length } });
});

/** DELETE /api/v1/admin/error-logs — clear the buffer */
router.delete('/', (req: Request, res: Response): void => {
  if (!verifyPasscode(req, res)) return;
  clearErrors();
  res.json({ success: true, message: 'Error log cleared.' });
});

export default router;
