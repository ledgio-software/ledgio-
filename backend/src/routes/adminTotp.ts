/**
 * Admin TOTP routes — authenticator app setup and login.
 *
 * These endpoints sit OUTSIDE the adminPasscodeMiddleware fence because
 * they are part of the auth flow itself. The passcode is verified inline
 * before any sensitive data is returned.
 *
 * Routes (all under /api/v1/admin/totp):
 *
 *   GET  /setup   — Returns the TOTP QR code URI and plain secret so the
 *                   admin can scan it with Google Authenticator / Authy.
 *                   Requires x-admin-passcode header.
 *                   Safe to call repeatedly — the secret comes from
 *                   ADMIN_TOTP_SECRET env var; no secret is stored in the DB.
 *
 *   POST /verify  — Validates passcode + TOTP code and issues an 8-hour
 *                   admin session token. The session token is used in
 *                   x-admin-session for all subsequent admin API calls.
 */

import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { BroadcastService } from '../services/broadcastService';
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  isTotpConfigured,
  issueAdminSessionToken,
} from '../services/adminTotpService';
import { logger } from '../utils/logger';

const router = Router();

// ── GET /setup ────────────────────────────────────────────────────────────────

router.get('/setup', async (req: Request, res: Response): Promise<void> => {
  try {
    const passcode = req.headers['x-admin-passcode'] as string | undefined;
    if (!passcode || !BroadcastService.verifyPasscode(passcode)) {
      res.status(401).json({ success: false, error: 'Valid master passcode required.' });
      return;
    }

    const existingSecret = process.env.ADMIN_TOTP_SECRET;
    // Use the stored secret if present; otherwise generate a new one.
    // The operator must copy the generated secret into the ADMIN_TOTP_SECRET
    // env var and restart the server for it to persist across restarts.
    const secret = existingSecret ?? generateTotpSecret();
    const uri = getTotpUri(secret);
    const qrDataUrl = await QRCode.toDataURL(uri);

    res.json({
      success: true,
      data: {
        secret,
        uri,
        qrDataUrl,
        configured: Boolean(existingSecret),
        note: existingSecret
          ? 'TOTP is already configured. Re-scan this QR code only if you are setting up a new device.'
          : 'TOTP is not yet configured. Copy the secret into the ADMIN_TOTP_SECRET environment variable and restart the server. Then scan the QR code with your authenticator app.',
      },
    });
  } catch (err) {
    logger.error('[AdminTOTP] Setup error', { err });
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /verify ──────────────────────────────────────────────────────────────

router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const passcode = req.headers['x-admin-passcode'] as string | undefined;
    const { totpCode } = req.body as { totpCode?: string };
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket?.remoteAddress;

    if (!passcode || !totpCode) {
      res.status(400).json({ success: false, error: 'Both x-admin-passcode header and totpCode body field are required.' });
      return;
    }

    if (!BroadcastService.verifyPasscode(passcode)) {
      logger.warn('[AdminTOTP] Login failed: invalid passcode', { ip });
      res.status(401).json({ success: false, error: 'Invalid master passcode.' });
      return;
    }

    if (!isTotpConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Authenticator app is not yet configured on this server. Ask the operator to run GET /api/v1/admin/totp/setup and add ADMIN_TOTP_SECRET to the environment.',
      });
      return;
    }

    const secret = process.env.ADMIN_TOTP_SECRET!;
    if (!verifyTotpCode(secret, totpCode)) {
      logger.warn('[AdminTOTP] Login failed: invalid TOTP code', { ip });
      res.status(401).json({ success: false, error: 'Invalid authenticator code. Codes expire every 30 seconds — try again.' });
      return;
    }

    const sessionToken = issueAdminSessionToken();
    logger.info('[AdminTOTP] Admin session issued', { ip });

    res.json({
      success: true,
      message: 'Authentication successful.',
      data: { sessionToken },
    });
  } catch (err) {
    logger.error('[AdminTOTP] Verify error', { err });
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
