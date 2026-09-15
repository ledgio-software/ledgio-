import { Request, Response, NextFunction } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { verifyAdminSessionToken } from '../services/adminTotpService';
import { verifyTeamToken } from '../services/teamMemberService';
import { logger } from '../utils/logger';

/**
 * Admin passcode gate for all /api/v1/admin/* routes.
 *
 * Accepts one of two credentials:
 *   1. x-admin-session header — a short-lived session token issued by
 *      POST /api/v1/admin/totp/verify after passcode + TOTP verification.
 *      This is the preferred flow when TOTP is configured.
 *   2. x-admin-passcode header — the raw master passcode (BROADCAST_MASTER_SECRET).
 *      Accepted as a fallback for tooling/scripts when TOTP is not configured.
 *
 * Security rules enforced here:
 * 1. Credentials are read ONLY from headers — never from the query string.
 *    Query strings appear in server access logs, CDN logs, and browser history,
 *    making them effectively logged secrets.
 * 2. Every failed attempt is logged (IP + path) so an operator can detect
 *    brute-force attempts in the error log dashboard.
 * 3. The actual brute-force rate limit (10 req/min per IP) is applied
 *    upstream in app.ts via adminRateLimiter before this middleware runs.
 */
export function adminPasscodeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Explicitly reject credentials sent in the query string.
  if (req.query.passcode || req.query.session) {
    logger.warn('Admin credential submitted via query string — rejected', {
      path: req.originalUrl,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress,
    });
    res.status(400).json({
      success: false,
      error: 'Admin credentials must be sent as request headers, not query parameters.',
    });
    return;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
    req.socket?.remoteAddress;

  // ── Team member token path ───────────────────────────────────────────────────
  const teamToken = req.headers['x-team-token'] as string | undefined;
  if (teamToken) {
    if (verifyTeamToken(teamToken)) {
      return next();
    }
    logger.warn('Team auth failure: invalid or expired team token', { path: req.originalUrl, ip });
    res.status(401).json({ success: false, error: 'Team token is invalid or expired. Please sign in again.' });
    return;
  }

  // ── Preferred path: session token from authenticator-app login ──────────────
  const sessionToken = req.headers['x-admin-session'] as string | undefined;
  if (sessionToken) {
    if (verifyAdminSessionToken(sessionToken)) {
      return next();
    }
    logger.warn('Admin auth failure: invalid or expired session token', { path: req.originalUrl, ip });
    res.status(401).json({ success: false, error: 'Admin session token is invalid or expired. Please log in again.' });
    return;
  }

  // ── Fallback path: raw passcode (for scripts / TOTP not yet configured) ─────
  const passcode = req.headers['x-admin-passcode'] as string | undefined;
  if (!passcode || !BroadcastService.verifyPasscode(passcode)) {
    logger.warn('Admin auth failure', { path: req.originalUrl, method: req.method, ip });
    res.status(401).json({ success: false, error: 'Unauthorized: valid admin session token or master passcode required.' });
    return;
  }

  next();
}
