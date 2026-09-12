/**
 * Bulk export anomaly detection service.
 *
 * Runs AFTER a data export has been authorised and served — never blocks a
 * legitimate export, only surfaces signals to the audit log and fires an
 * admin alert email when something looks wrong.
 *
 * Signals detected:
 *   1. High user velocity — the same user exports more than twice in 24 hours
 *      (across any tenant or export kind they have access to).
 *   2. Off-hours export — export request arrives between 01:00 and 05:00 UTC,
 *      a window that covers dead-of-night for most operating timezones.
 *   3. New export IP — first time this user has triggered a download from the
 *      source IP (per-user known-IP set, 30-day TTL, same model as login).
 *   4. Multi-user tenant burst — two or more distinct admin accounts trigger
 *      an export from the same tenant within 15 minutes (coordinated exfil or
 *      a compromised admin roster).
 */

import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { recordAuditLog } from './auditLogService';

// ── Redis key helpers ────────────────────────────────────────────────────────
const keys = {
  userCount:    (userId: string)   => `export:user_count:${userId}`,
  userIps:      (userId: string)   => `export:user_ips:${userId}`,
  tenantUsers:  (tenantId: string) => `export:tenant_users:${tenantId}`,
};

const USER_COUNT_TTL    = 24 * 3600;   // 24-hour rolling window
const USER_IP_TTL       = 30 * 24 * 3600; // 30 days
const TENANT_BURST_TTL  = 15 * 60;    // 15-minute burst window
const VELOCITY_THRESHOLD = 2;          // flag on the 3rd+ export within 24h

// ── Fail-open Redis helpers ──────────────────────────────────────────────────
async function redisIncr(key: string, ttl: number): Promise<number> {
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttl);
    return n;
  } catch { return 0; }
}

async function redisSAdd(key: string, value: string, ttl: number): Promise<void> {
  try {
    await redis.sadd(key, value);
    await redis.expire(key, ttl);
  } catch { /* degraded gracefully */ }
}

async function redisSCard(key: string): Promise<number> {
  try { return await redis.scard(key); } catch { return 0; }
}

async function redisSIsMember(key: string, value: string): Promise<boolean> {
  try { return (await redis.sismember(key, value)) === 1; } catch { return true; }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ExportContext {
  tenantId: string;
  userId: string;
  userEmail: string;
  ip: string;
  userAgent?: string;
  exportKind: 'json' | 'csv';
}

/**
 * Call from the export handler AFTER the download has been served and the
 * standard DATA_EXPORT.DOWNLOADED audit log entry has been written.
 * Non-blocking — fires audit + alert async and never throws into the caller.
 */
export async function analyzeExportRequest(ctx: ExportContext): Promise<void> {
  const signals: string[] = [];

  try {
    // 1. User velocity — >VELOCITY_THRESHOLD exports in 24 h
    const exportCount = await redisIncr(keys.userCount(ctx.userId), USER_COUNT_TTL);
    if (exportCount > VELOCITY_THRESHOLD) {
      signals.push(
        `High export velocity: ${exportCount} exports in 24 hours by user ${ctx.userEmail}`,
      );
    }

    // 2. Off-hours export (01:00–05:00 UTC)
    const hourUtc = new Date().getUTCHours();
    if (hourUtc >= 1 && hourUtc < 5) {
      signals.push(`Off-hours export at ${hourUtc.toString().padStart(2, '0')}:xx UTC`);
    }

    // 3. New IP detection
    const isKnownIp = await redisSIsMember(keys.userIps(ctx.userId), ctx.ip);
    if (!isKnownIp) {
      signals.push(`First export from new IP ${ctx.ip} by user ${ctx.userEmail}`);
      await redisSAdd(keys.userIps(ctx.userId), ctx.ip, USER_IP_TTL);
    }

    // 4. Multi-user tenant burst within 15 minutes
    await redisSAdd(keys.tenantUsers(ctx.tenantId), ctx.userId, TENANT_BURST_TTL);
    const tenantExporters = await redisSCard(keys.tenantUsers(ctx.tenantId));
    if (tenantExporters > 1) {
      signals.push(
        `${tenantExporters} distinct users exported from tenant ${ctx.tenantId} within 15 minutes`,
      );
    }
  } catch (err) {
    logger.error('bulkExportAnomalyService: Redis error during signal detection', { err });
    return;
  }

  if (signals.length === 0) return;

  logger.warn('Bulk export anomaly signals detected', {
    userId: ctx.userId,
    email: ctx.userEmail,
    tenantId: ctx.tenantId,
    exportKind: ctx.exportKind,
    signals,
  });

  // Fire audit log + alert asynchronously — never block the export response
  fireExportAlert(ctx, signals).catch(() => {/* already logged inside */});
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function fireExportAlert(ctx: ExportContext, signals: string[]): Promise<void> {
  try {
    await recordAuditLog({
      action: 'SECURITY.EXPORT_ANOMALY',
      entity: 'Tenant',
      entityId: ctx.tenantId,
      tenantId: ctx.tenantId,
      actor: { userId: ctx.userId, userEmail: ctx.userEmail, ipAddress: ctx.ip },
      details: `Suspicious data export (${ctx.exportKind.toUpperCase()}) detected: ${signals.join('; ')}.`,
    });
  } catch (err) {
    logger.error('bulkExportAnomalyService: audit log failed', { err });
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  try {
    const { EmailService } = await import('./EmailService');
    if (!EmailService.isConfigured()) return;

    const title = `Suspicious data export detected`;
    const rows = [
      ['Tenant ID', ctx.tenantId],
      ['User', ctx.userEmail],
      ['Export kind', ctx.exportKind.toUpperCase()],
      ['Source IP', ctx.ip],
      ['User-Agent', ctx.userAgent ?? '(unknown)'],
      ['Signals', signals.join('<br/>')],
    ]
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
    logger.error('bulkExportAnomalyService: alert email failed', { err });
  }
}
