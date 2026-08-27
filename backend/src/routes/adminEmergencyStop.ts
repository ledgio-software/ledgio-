import { Router, Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import {
  setEmergencyStop,
  clearEmergencyStop,
  getEmergencyStopState,
} from '../middleware/emergencyStopMiddleware';

const router = Router();

function verifyPasscode(req: Request, res: Response): boolean {
  const passcode = (req.headers['x-admin-passcode'] as string | undefined) ?? '';
  if (!BroadcastService.verifyPasscode(passcode)) {
    res.status(401).json({ success: false, error: 'Invalid master passcode.' });
    return false;
  }
  return true;
}

/**
 * GET /api/v1/admin/emergency-stop
 * Returns current emergency stop state.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyPasscode(req, res)) return;
  try {
    const state = await getEmergencyStopState();
    res.json({ success: true, data: state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to get emergency stop state.' });
  }
});

/**
 * POST /api/v1/admin/emergency-stop
 * Body: { reason: string, ttlSeconds?: number }
 * Activates the emergency stop, halting all financial movement operations.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyPasscode(req, res)) return;
  const { reason, ttlSeconds } = req.body as { reason?: string; ttlSeconds?: number };
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    res.status(400).json({ success: false, error: 'reason is required.' });
    return;
  }
  try {
    await setEmergencyStop(reason.trim(), ttlSeconds ? Number(ttlSeconds) : undefined);
    res.json({ success: true, data: { active: true, reason: reason.trim() } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to activate emergency stop.' });
  }
});

/**
 * DELETE /api/v1/admin/emergency-stop
 * Clears the emergency stop and resumes normal operations.
 */
router.delete('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyPasscode(req, res)) return;
  try {
    await clearEmergencyStop();
    res.json({ success: true, data: { active: false } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to clear emergency stop.' });
  }
});

export default router;
