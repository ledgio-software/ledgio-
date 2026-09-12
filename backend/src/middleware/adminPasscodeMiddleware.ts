import { Request, Response, NextFunction } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { logger } from '../utils/logger';

/**
 * Admin passcode gate for all /api/v1/admin/* routes.
 *
 * Security rules enforced here:
 * 1. Passcode is read ONLY from the x-admin-passcode header.
 *    Query-string passcodes are rejected — query strings appear in server
 *    access logs, CDN logs, and browser history, making them effectively
 *    a logged secret.
 * 2. Every failed attempt is logged (IP + path) so an operator can detect
 *    brute-force attempts in the error log dashboard.
 * 3. The actual brute-force rate limit (10 req/min per IP) is applied
 *    upstream in app.ts via adminRateLimiter before this middleware runs.
 */
export function adminPasscodeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Explicitly reject passcodes sent in the query string.
  if (req.query.passcode) {
    logger.warn('Admin passcode submitted via query string — rejected', {
      path: req.originalUrl,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress,
    });
    res.status(400).json({
      success: false,
      error: 'Passcode must be sent as the x-admin-passcode header, not a query parameter.',
    });
    return;
  }

  const passcode = req.headers['x-admin-passcode'] as string | undefined;

  if (!passcode || !BroadcastService.verifyPasscode(passcode)) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress;
    logger.warn('Admin auth failure', {
      path: req.originalUrl,
      method: req.method,
      ip,
    });
    res.status(401).json({ success: false, error: 'Unauthorized: valid master passcode required.' });
    return;
  }

  next();
}
