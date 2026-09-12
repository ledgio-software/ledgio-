/**
 * Honeypot detection service — deception-based attacker identification.
 *
 * Three traps:
 *   1. Honeypot login credentials — fake emails/passwords no real user would try.
 *      Any login attempt against them is a credential-stuffing or enumeration attack.
 *   2. Honeypot tenant slugs — fake org identifiers attackers probe when scanning
 *      for admin panels, internal orgs, or default accounts.
 *   3. (Applied in honeypotRoutes.ts) Fake probe endpoints — common paths attackers
 *      enumerate (/.env, /admin/config, /api/internal/dump) return convincing 200s
 *      while logging the access.
 *
 * All traps return responses indistinguishable from real failures so the attacker
 * gets no signal that the trap fired. Detection is always written to the audit log
 * and triggers a platform-wide security alert email (async, non-blocking).
 */

import { logger } from '../utils/logger';
import { recordAuditLog } from './auditLogService';

// ---------------------------------------------------------------------------
// 1. Honeypot login credentials
// ---------------------------------------------------------------------------
// These look like plausible "default" or "privileged" accounts that a credential-
// stuffing bot or an attacker who obtained a partial user list might try first.
// They must never correspond to real user records in the database.
const HONEYPOT_EMAILS = new Set([
  'admin@ledgio.io',
  'root@ledgio.io',
  'support@ledgio.io',
  'superadmin@ledgio.io',
  'system@ledgio.io',
  'administrator@ledgio.io',
  'admin@internal.ledgio',
  'api@ledgio.io',
  'noreply@ledgio.io',
  'test@ledgio.io',
  'demo@ledgio.io',
  'info@ledgio.io',
]);

// ---------------------------------------------------------------------------
// 2. Honeypot tenant identifiers
// ---------------------------------------------------------------------------
// Common slugs attackers probe when looking for admin orgs, default accounts,
// or leftover dev/internal tenants.
const HONEYPOT_TENANT_SLUGS = new Set([
  'admin',
  'superadmin',
  'root',
  'internal',
  'platform',
  'system',
  'ledgio',
  'ledgio-admin',
  'ledgio-internal',
  'ledgio-platform',
  'test',
  'demo',
  'dev',
  'staging',
  'master',
  'default',
  'public',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HoneypotContext {
  ip: string;
  userAgent?: string;
  tenantId?: string | null;
}

/**
 * Call from the login handler BEFORE looking up the user in the database.
 * Returns true when the attempt is a honeypot hit (caller should return a
 * realistic 401 without revealing the trap).
 */
export async function checkHoneypotLogin(
  email: string,
  ctx: HoneypotContext,
): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  if (!HONEYPOT_EMAILS.has(normalised)) return false;

  logger.warn('Honeypot login credential triggered', {
    email: normalised,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Fire audit log + alert without blocking the response
  fireHoneypotAlert('SECURITY.HONEYPOT_LOGIN', {
    email: normalised,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    tenantId: ctx.tenantId ?? null,
    details: `Honeypot login attempt for privileged address "${normalised}" from IP ${ctx.ip}.`,
  }).catch(() => {/* already logged inside */});

  return true;
}

/**
 * Call from the tenant context middleware BEFORE querying the database.
 * Returns true when the identifier matches a honeypot slug (caller should
 * return a realistic 404 without revealing the trap).
 */
export async function checkHoneypotTenant(
  rawIdentifier: string,
  ctx: HoneypotContext,
): Promise<boolean> {
  const normalised = rawIdentifier.trim().toLowerCase();
  if (!HONEYPOT_TENANT_SLUGS.has(normalised)) return false;

  logger.warn('Honeypot tenant slug triggered', {
    identifier: normalised,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  fireHoneypotAlert('SECURITY.HONEYPOT_TENANT', {
    identifier: normalised,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    tenantId: null,
    details: `Honeypot tenant slug "${normalised}" probed from IP ${ctx.ip}.`,
  }).catch(() => {/* already logged inside */});

  return true;
}

/**
 * Call from honeypot probe-endpoint handlers for paths attackers commonly
 * enumerate (/.env, /admin/config, /debug, etc.).
 */
export async function recordProbeEndpointHit(
  path: string,
  ctx: HoneypotContext,
): Promise<void> {
  logger.warn('Honeypot probe endpoint hit', { path, ip: ctx.ip, userAgent: ctx.userAgent });

  fireHoneypotAlert('SECURITY.HONEYPOT_PROBE', {
    path,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    tenantId: null,
    details: `Honeypot probe endpoint "${path}" accessed from IP ${ctx.ip}.`,
  }).catch(() => {/* already logged inside */});
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AlertPayload {
  email?: string;
  identifier?: string;
  path?: string;
  ip: string;
  userAgent?: string;
  tenantId: string | null;
  details: string;
}

async function fireHoneypotAlert(action: string, payload: AlertPayload): Promise<void> {
  try {
    await recordAuditLog({
      action,
      entity: 'Security',
      tenantId: payload.tenantId,
      actor: { ipAddress: payload.ip },
      details: payload.details,
    });
  } catch (err) {
    logger.error('Honeypot audit log failed', { action, err });
  }

  // Best-effort email to the platform admin address (ADMIN_ALERT_EMAIL env var)
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  try {
    const { EmailService } = await import('./EmailService');
    if (!EmailService.isConfigured()) return;

    const title = `Honeypot triggered: ${action}`;
    const rows = Object.entries(payload)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:bold;">${k}</td><td style="padding:4px 8px;">${v}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">🚨 ${title}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows}
        </table>
        <p style="margin-top:16px;color:#6b7280;font-size:12px;">
          Logged at ${new Date().toISOString()} — Ledgio Security System
        </p>
      </div>
    `;

    await EmailService.sendMail(adminEmail, `[Ledgio Security] ${title}`, html);
  } catch (err) {
    logger.error('Honeypot alert email failed', { action, err });
  }
}
