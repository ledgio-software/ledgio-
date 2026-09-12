import { Router, Request, Response } from 'express';
import { getMetricsSummary } from '../middleware/metricsMiddleware';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware.

router.get('/', (req: Request, res: Response): void => {
  const window = Math.min(720, Math.max(1, Number(req.query.window) || 12));
  res.json({ success: true, data: getMetricsSummary(window) });
});

export default router;
