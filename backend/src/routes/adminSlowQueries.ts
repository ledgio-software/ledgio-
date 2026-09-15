import { Router, Request, Response } from 'express';
import { slowQueryBuffer } from '../config/db';

const router = Router();

/**
 * GET /admin/slow-queries?level=critical&limit=10
 * Returns the N most recent slow queries from the in-memory ring buffer.
 */
router.get('/', (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const level = req.query.level as string | undefined;

  let entries = [...slowQueryBuffer].reverse(); // newest first
  if (level) entries = entries.filter((e) => e.level === level);
  entries = entries.slice(0, limit);

  // Top 10 by duration for the "worst offenders" view
  const top10 = [...slowQueryBuffer]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      recent: entries,
      top10ByDuration: top10,
      totalCaptured: slowQueryBuffer.length,
    },
  });
});

export default router;
