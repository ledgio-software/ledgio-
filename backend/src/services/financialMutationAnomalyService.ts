/**
 * Financial mutation anomaly detection service.
 *
 * Fires as fire-and-forget after journal entry creation and posting operations.
 * Detects accounting-specific fraud patterns and writes SECURITY.FINANCIAL_ANOMALY
 * audit log entries when suspicious signals are found.
 *
 * Never throws into the caller — always fire with .catch(() => {}).
 *
 * Signals detected:
 *   LARGE_AMOUNT        — entry total >10× tenant's rolling 30-day average
 *   OFF_HOURS           — mutation posted between 01:00–05:00 UTC
 *   HIGH_VELOCITY       — user created >20 entries in the last 10 minutes
 *   ROUND_NUMBER_LARGE  — large amount (>10k) ending in ≥3 trailing zeros
 *   THRESHOLD_CREEP     — amount within 5% below an approval threshold
 *   BACKDATED_ENTRY     — entry date >30 days before today
 */

import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { recordAuditLog } from './auditLogService';
import { prisma } from '../config/db';
import { getTenantContext } from '../context/tenantContext';

// ── Thresholds ────────────────────────────────────────────────────────────────

const LARGE_AMOUNT_MULTIPLIER = 10;   // flag if amount > avg * this
const OFF_HOURS_START = 1;            // 01:00 UTC
const OFF_HOURS_END   = 5;            // 05:00 UTC (exclusive)
const VELOCITY_WINDOW_SECONDS = 600;  // 10-minute rolling window
const VELOCITY_MAX_ENTRIES = 20;      // entries per window before flagging
const ROUND_NUMBER_THRESHOLD = 10_000; // minimum amount to check trailing zeros
const ROUND_TRAILING_ZEROS = 3;       // number of trailing zeros to flag
const THRESHOLD_CREEP_PCT = 0.05;     // within 5% below approval threshold
const BACKDATED_DAYS = 30;            // entry date this many days before today
const SCORE_THRESHOLD = 2;            // minimum weight before writing audit log

// Typical approval workflow thresholds (configurable per deployment).
// These are the common breakpoints above which a second approval is required.
const APPROVAL_THRESHOLDS = [
  5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
];

// ── Signal type ───────────────────────────────────────────────────────────────

interface Signal {
  code: string;
  detail: string;
  weight: number;
}

// ── Redis helpers (never throw) ───────────────────────────────────────────────

async function redisIncr(key: string, ttl: number): Promise<number> {
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttl);
    return n;
  } catch { return 0; }
}

// ── Rolling average helper ─────────────────────────────────────────────────────

async function getTenantRollingAverage(tenantId: string): Promise<number | null> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    // Use the tenant-scoped prisma through raw query average
    const result = await prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(total_amount) as avg
      FROM journal_entries
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${thirtyDaysAgo}
        AND status = 'POSTED'
    `;
    return result[0]?.avg ?? null;
  } catch {
    return null;
  }
}

// ── Signal scoring ────────────────────────────────────────────────────────────

async function scoreEntry(ctx: FinancialMutationContext): Promise<Signal[]> {
  const signals: Signal[] = [];
  const { amount, entryDate, userId, tenantId } = ctx;

  // ── LARGE_AMOUNT: compare to 30-day rolling average ───────────────────────
  if (amount > 0) {
    const avg = await getTenantRollingAverage(tenantId);
    if (avg !== null && avg > 0 && amount > avg * LARGE_AMOUNT_MULTIPLIER) {
      signals.push({
        code: 'LARGE_AMOUNT',
        detail: `Amount ${amount.toLocaleString()} is ${(amount / avg).toFixed(1)}× the 30-day tenant average (${avg.toFixed(2)})`,
        weight: 3,
      });
    }
  }

  // ── OFF_HOURS: check UTC hour at mutation time ────────────────────────────
  const nowHour = new Date().getUTCHours();
  if (nowHour >= OFF_HOURS_START && nowHour < OFF_HOURS_END) {
    signals.push({
      code: 'OFF_HOURS',
      detail: `Financial mutation recorded at ${nowHour.toString().padStart(2, '0')}:xx UTC (off-hours window ${OFF_HOURS_START}:00–${OFF_HOURS_END}:00)`,
      weight: 2,
    });
  }

  // ── HIGH_VELOCITY: count entries this user created in the last 10 min ─────
  const velocityKey = `fin:velocity:${tenantId}:${userId}`;
  const count = await redisIncr(velocityKey, VELOCITY_WINDOW_SECONDS);
  if (count > VELOCITY_MAX_ENTRIES) {
    signals.push({
      code: 'HIGH_VELOCITY',
      detail: `User created ${count} journal entries in the last ${VELOCITY_WINDOW_SECONDS / 60} minutes`,
      weight: 2,
    });
  }

  // ── ROUND_NUMBER_LARGE: large round amounts are common in fraud ───────────
  if (amount >= ROUND_NUMBER_THRESHOLD) {
    const zeros = amount.toString().match(/0+$/)?.[0]?.length ?? 0;
    if (zeros >= ROUND_TRAILING_ZEROS) {
      signals.push({
        code: 'ROUND_NUMBER_LARGE',
        detail: `Large round amount: ${amount.toLocaleString()} (${zeros} trailing zeros)`,
        weight: 1,
      });
    }
  }

  // ── THRESHOLD_CREEP: just below an approval threshold ─────────────────────
  for (const threshold of APPROVAL_THRESHOLDS) {
    const gap = threshold - amount;
    if (gap > 0 && gap / threshold <= THRESHOLD_CREEP_PCT) {
      signals.push({
        code: 'THRESHOLD_CREEP',
        detail: `Amount ${amount.toLocaleString()} is ${gap.toLocaleString()} below approval threshold of ${threshold.toLocaleString()} (${(gap / threshold * 100).toFixed(1)}% below)`,
        weight: 2,
      });
      break; // report the first matching threshold only
    }
  }

  // ── BACKDATED_ENTRY: entry date significantly before today ────────────────
  if (entryDate) {
    const daysDiff = Math.floor((Date.now() - new Date(entryDate).getTime()) / (24 * 3600 * 1000));
    if (daysDiff > BACKDATED_DAYS) {
      signals.push({
        code: 'BACKDATED_ENTRY',
        detail: `Entry date ${entryDate} is ${daysDiff} days in the past`,
        weight: 2,
      });
    }
  }

  return signals;
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface FinancialMutationContext {
  /** Numeric total of the journal entry (sum of debits or credits). */
  amount: number;
  /** ISO date string of the entry date (the accounting date, not created_at). */
  entryDate: string;
  /** ID of the user who created or posted the entry. */
  userId: string;
  /** Email of the user (for audit log). */
  userEmail: string;
  /** Tenant ID the entry belongs to. */
  tenantId: string;
  /** Entry number or ID for traceability. */
  entryRef: string;
  /** 'create' or 'post' — which operation triggered this check. */
  operation: 'create' | 'post';
  /** IP address of the requesting client. */
  ip: string;
}

/**
 * Analyse a financial mutation for anomaly signals.
 * Call fire-and-forget immediately after a successful journal entry
 * create or post operation:
 *
 *   analyzeFinancialMutation(ctx).catch(() => {});
 */
export async function analyzeFinancialMutation(ctx: FinancialMutationContext): Promise<void> {
  try {
    const signals = await scoreEntry(ctx);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);

    if (totalWeight < SCORE_THRESHOLD) return;

    const signalCodes = signals.map((s) => s.code);
    const signalSummary = signals.map((s) => `${s.code} (${s.detail})`).join('; ');

    logger.warn('Financial mutation anomaly detected', {
      entryRef: ctx.entryRef,
      operation: ctx.operation,
      amount: ctx.amount,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      ip: ctx.ip,
      totalWeight,
      signals: signalCodes,
    });

    await recordAuditLog({
      action: 'SECURITY.FINANCIAL_ANOMALY',
      entity: 'JournalEntry',
      entityId: ctx.entryRef,
      actor: { userId: ctx.userId, userEmail: ctx.userEmail, ipAddress: ctx.ip },
      details: `Financial anomaly on ${ctx.operation} (score ${totalWeight}): ${signalSummary}.`,
    });

    if (totalWeight >= 5) {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        const { EmailService } = await import('./EmailService');
        if (EmailService.isConfigured()) {
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
              <h2 style="color:#dc2626;">⚠️ Financial mutation anomaly detected</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:4px 8px;font-weight:bold;">Entry</td><td style="padding:4px 8px;">${ctx.entryRef}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Operation</td><td style="padding:4px 8px;">${ctx.operation}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Amount</td><td style="padding:4px 8px;">${ctx.amount.toLocaleString()}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">User</td><td style="padding:4px 8px;">${ctx.userEmail}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Tenant</td><td style="padding:4px 8px;">${ctx.tenantId}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">IP</td><td style="padding:4px 8px;">${ctx.ip}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Score</td><td style="padding:4px 8px;">${totalWeight}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Signals</td><td style="padding:4px 8px;">${signalCodes.join(', ')}</td></tr>
              </table>
              <p style="margin-top:16px;color:#6b7280;font-size:12px;">
                Logged at ${new Date().toISOString()} — Ledgio Security System
              </p>
            </div>
          `;
          await EmailService.sendMail(adminEmail, '[Ledgio Security] Financial anomaly detected', html);
        }
      }
    }
  } catch (err) {
    logger.error('financialMutationAnomalyService: error during analysis', { err });
  }
}
