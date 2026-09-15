import { Router, Request, Response } from 'express';
import { getDebugLogs, clearDebugLogs, debugLogStats, DebugLogFilter } from '../services/debugLogService';

const router = Router();

/** GET /api/v1/admin/debug/logs */
router.get('/logs', (req: Request, res: Response): void => {
  const { level, tenantId, search, limit, offset } = req.query as Record<string, string | undefined>;

  const filter: DebugLogFilter = {
    level: level as DebugLogFilter['level'],
    tenantId,
    search,
    limit: limit ? Math.min(parseInt(limit, 10), 200) : 100,
    offset: offset ? parseInt(offset, 10) : 0,
  };

  const { entries, total } = getDebugLogs(filter);
  const stats = debugLogStats();

  res.json({ success: true, data: { entries, total, stats } });
});

/** DELETE /api/v1/admin/debug/logs */
router.delete('/logs', (_req: Request, res: Response): void => {
  clearDebugLogs();
  res.json({ success: true, message: 'Debug log buffer cleared.' });
});

export default router;
