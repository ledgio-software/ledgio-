/**
 * Admin TOTP (Authenticator App) service.
 *
 * Implements RFC 6238 TOTP using Node's built-in crypto — no external TOTP
 * library needed. Compatible with Google Authenticator, Authy, and any
 * standards-compliant TOTP app.
 *
 * Environment variables:
 *   ADMIN_TOTP_SECRET   — Base32-encoded TOTP secret. Generate one with the
 *                         GET /api/v1/admin/totp/setup endpoint, copy it into
 *                         this env var, and restart the server.
 *   BROADCAST_MASTER_SECRET — also used as the signing key for admin session
 *                             tokens, so no new env var is required.
 *
 * Admin session tokens are plain HMAC-SHA256 JWTs:
 *   { admin: true, iat, exp: iat + 8h }
 * They are accepted by adminPasscodeMiddleware via x-admin-session header.
 */

import crypto from 'node:crypto';
import { logger } from '../utils/logger';

// ── Base32 codec (RFC 4648, no padding required) ─────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ── TOTP (RFC 6238) ───────────────────────────────────────────────────────────

const TOTP_STEP = 30;   // seconds per window
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;  // allow ±1 window (90 s total)

function hotp(secretBuf: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac('sha1', secretBuf).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function getTotpUri(secret: string): string {
  const params = new URLSearchParams({
    secret,
    issuer: 'Ledgio AGOD',
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/Ledgio%20AGOD:admin?${params}`;
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    const secretBuf = base32Decode(secret);
    const T = BigInt(Math.floor(Date.now() / 1000 / TOTP_STEP));
    for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
      if (hotp(secretBuf, T + BigInt(delta)) === code) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isTotpConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOTP_SECRET);
}

// ── Admin session token (HMAC-SHA256 JWT) ────────────────────────────────────

const SESSION_TTL = 8 * 60 * 60; // 8 hours in seconds

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getSessionSecret(): string {
  const s = process.env.BROADCAST_MASTER_SECRET;
  if (!s) throw new Error('BROADCAST_MASTER_SECRET not set');
  return s;
}

export function issueAdminSessionToken(): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ admin: true, iat: now, exp: now + SESSION_TTL }));
  const sig = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  try {
    const secret = getSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, payload, sig] = parts;
    const expected = b64url(
      crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
    );

    const sigBuf = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expBuf = Buffer.from(expected.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }

    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    const now = Math.floor(Date.now() / 1000);
    return decoded.admin === true && decoded.exp > now;
  } catch (err) {
    logger.debug('[AdminTOTP] Session token verification failed', { err });
    return false;
  }
}
