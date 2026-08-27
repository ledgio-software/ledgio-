import { Router, Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { getErrors, clearErrors } from '../services/errorLogService';

const router = Router();

function verifyPasscode(req: Request, res: Response): boolean {
  const passcode = (req.headers['x-admin-passcode'] as string | undefined) ?? '';
  if (!BroadcastService.verifyPasscode(passcode)) {
    res.status(401).json({ success: false, error: 'Invalid master passcode.' });
    return false;
  }
  return true;
}

router.get('/', (req: Request, res: Response): void => {
  if (!verifyPasscode(req, res)) return;
  const errors = getErrors();
  res.json({ success: true, data: { errors, count: errors.length } });
});

router.delete('/', (req: Request, res: Response): void => {
  if (!verifyPasscode(req, res)) return;
  clearErrors();
  res.json({ success: true, message: 'Error log cleared.' });
});

export default router;
