import { Router, Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { listJobs, triggerJob } from '../services/cronJobRegistry';

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
  const jobs = listJobs();
  const failed = jobs.filter((j) => j.lastRun && !j.lastRun.success);
  res.json({ success: true, data: { jobs, failedCount: failed.length, failedJobs: failed } });
});

router.post('/:name/trigger', async (req: Request, res: Response): Promise<void> => {
  if (!verifyPasscode(req, res)) return;
  const name = decodeURIComponent(req.params.name);
  try {
    await triggerJob(name);
    res.json({ success: true, message: `Job "${name}" triggered successfully.` });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message ?? 'Trigger failed.' });
  }
});

export default router;
