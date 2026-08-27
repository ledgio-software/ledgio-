import { Request, Response, NextFunction } from 'express';
import { cacheUtils } from '../config/redis';

const EMERGENCY_STOP_KEY = 'emergency_stop:all';

export async function checkEmergencyStop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reason = await cacheUtils.get<string>(EMERGENCY_STOP_KEY);
    if (reason) {
      res.status(503).json({
        success: false,
        error: `System is in emergency stop mode: ${reason}. Contact your administrator.`,
        code: 'EMERGENCY_STOP',
      });
      return;
    }
  } catch {
    // Fail open — Redis outage must not block financial operations
  }
  next();
}

export async function setEmergencyStop(reason: string, ttlSeconds?: number): Promise<void> {
  await cacheUtils.set(EMERGENCY_STOP_KEY, reason, ttlSeconds);
}

export async function clearEmergencyStop(): Promise<void> {
  await cacheUtils.del(EMERGENCY_STOP_KEY);
}

export async function getEmergencyStopState(): Promise<{ active: boolean; reason?: string }> {
  const reason = await cacheUtils.get<string>(EMERGENCY_STOP_KEY);
  return reason ? { active: true, reason } : { active: false };
}
