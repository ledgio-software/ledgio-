import { Router, Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { getMetricsSummary } from '../middleware/metricsMiddleware';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const passcode = (req.headers['x-admin-passcode'] as string | undefined) ?? '';
  if (!BroadcastService.verifyPasscode(passcode)) {
    res.status(401).json({ success: false, error: 'Invalid master passcode.' });
    return;
  }
  const window = Math.min(720, Math.max(1, Number(req.query.window) || 12));
  res.json({ success: true, data: getMetricsSummary(window) });
});

export default router;
