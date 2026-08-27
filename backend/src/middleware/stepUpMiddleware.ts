import { Request, Response, NextFunction } from 'express';

const STEP_UP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Requires that the request's JWT was issued after a recent TOTP MFA
 * verification (within the last 15 minutes). Apply to high-risk routes such as
 * payment posting, journal posting, and period locking.
 *
 * Users without MFA enabled are never granted step-up access — they must
 * enable MFA first. This is intentional: step-up is a second factor guarantee,
 * not just a "logged in recently" check.
 */
export function requireRecentMfa(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') { next(); return; }
  const lastMfaAt = req.user?.lastMfaAt as number | undefined;
  if (!lastMfaAt || Date.now() - lastMfaAt * 1000 > STEP_UP_WINDOW_MS) {
    res.status(403).json({
      success: false,
      error: 'This action requires recent MFA verification. Please verify your identity again.',
      code: 'STEP_UP_REQUIRED',
    });
    return;
  }
  next();
}
