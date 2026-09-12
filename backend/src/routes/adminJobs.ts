import { Router, Request, Response } from 'express';
import { listJobs, triggerJob } from '../services/cronJobRegistry';

const router = Router();

// Auth is handled upstream by adminPasscodeMiddleware — no per-route re-check needed.

router.get('/', (_req: Request, res: Response): void => {
  const jobs = listJobs();
  const failed = jobs.filter((j) => j.lastRun && !j.lastRun.success);
  res.json({ success: true, data: { jobs, failedCount: failed.length, failedJobs: failed } });
});

router.post('/:name/trigger', async (req: Request, res: Response): Promise<void> => {
  const name = decodeURIComponent(req.params.name);
  try {
    await triggerJob(name);
    res.json({ success: true, message: `Job "${name}" triggered successfully.` });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message ?? 'Trigger failed.' });
  }
});

export default router;
