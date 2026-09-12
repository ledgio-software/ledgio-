import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { recordAuditLog } from './auditLogService';

// --- Constants ---
const MAX_FAILED_ATTEMPTS = 5;           // lockout after this many consecutive failures
const LOCKOUT_SECONDS = 15 * 60;         // 15-minute lockout window
const FAIL_WINDOW_SECONDS = 15 * 60;     // rolling window for counting failures
const VELOCITY_WINDOW_SECONDS = 10 * 60; // impossible velocity window (10 min)
const BURST_WINDOW_SECONDS = 60;         // IP burst detection window
const MAX_BURST_FROM_IP = 20;            // max login attempts per IP per minute
const KNOWN_IP_TTL_SECONDS = 30 * 24 * 3600; // remember IPs for 30 days

export interface LoginContext {
  userId: string;
  email: string;
  tenantId: string | null;
  ip: string;
  userAgent?: string;
}

export interface FailedLoginContext {
  userId?: string;
  email: string;
  tenantId?: string | null;
  ip: string;
}

export interface AnomalyResult {
  blocked: boolean;        // true → reject the request entirely (lockout / IP burst)
  signals: string[];       // human-readable flags written to audit log
}

// --- Redis key helpers ---
const keys = {
  failCount:   (userId: string) => `login:fail_count:${userId}`,
  lockout:     (userId: string) => `login:lockout:${userId}`,
  lastSeen:    (userId: string) => `login:last_seen:${userId}`,
  knownIps:    (userId: string) => `login:known_ips:${userId}`,
  ipBurst:     (ip: string)     => `login:ip_burst:${ip}`,
};

// --- Low-level Redis helpers (never throw) ---
async function redisGet(key: string): Promise<string | null> {
  try { return await redis.get(key); } catch { return null; }
}
async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  try { await redis.setex(key, ttl, value); } catch { /* degraded gracefully */ }
}
async function redisDel(key: string): Promise<void> {
  try { await redis.del(key); } catch { /* degraded gracefully */ }
}
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
async function redisSIsMember(key: string, value: string): Promise<boolean> {
  try { return (await redis.sismember(key, value)) === 1; } catch { return true; } // fail-open for IPs
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call BEFORE password verification on every login attempt.
 * Returns { blocked: true } when the account is locked out or the source IP
 * is bursting — the caller should return 429/423 immediately without
 * checking the password (prevents timing oracle on locked accounts).
 */
export async function preLoginCheck(email: string, userId: string | undefined, ip: string): Promise<{ blocked: boolean; reason?: string }> {
  // 1. IP burst guard (bot / credential stuffing)
  const burstCount = await redisIncr(keys.ipBurst(ip), BURST_WINDOW_SECONDS);
  if (burstCount > MAX_BURST_FROM_IP) {
    logger.warn('Login IP burst detected', { ip, burstCount });
    return { blocked: true, reason: 'Too many login attempts from your network. Try again in 60 seconds.' };
  }

  // 2. Per-account lockout
  if (userId) {
    const locked = await redisGet(keys.lockout(userId));
    if (locked) {
      return { blocked: true, reason: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' };
    }
  }

  return { blocked: false };
}

/**
 * Call AFTER a confirmed password failure (user exists, wrong password).
 * Increments the failure counter; locks the account when the threshold is hit.
 */
export async function recordFailedLogin(ctx: FailedLoginContext): Promise<void> {
  if (!ctx.userId) return;

  const failCount = await redisIncr(keys.failCount(ctx.userId), FAIL_WINDOW_SECONDS);

  await recordAuditLog({
    action: 'AUTH.LOGIN_FAILED',
    entity: 'User',
    entityId: ctx.userId,
    tenantId: ctx.tenantId ?? null,
    actor: { userEmail: ctx.email, ipAddress: ctx.ip },
    details: `Failed login attempt ${failCount}/${MAX_FAILED_ATTEMPTS} from IP ${ctx.ip}.`,
  });

  if (failCount >= MAX_FAILED_ATTEMPTS) {
    await redisSet(keys.lockout(ctx.userId), '1', LOCKOUT_SECONDS);
    await redisDel(keys.failCount(ctx.userId));

    logger.warn('Account locked after repeated failures', { userId: ctx.userId, email: ctx.email, ip: ctx.ip });

    await recordAuditLog({
      action: 'SECURITY.ACCOUNT_LOCKED',
      entity: 'User',
      entityId: ctx.userId,
      tenantId: ctx.tenantId ?? null,
      actor: { userEmail: ctx.email, ipAddress: ctx.ip },
      details: `Account locked for ${LOCKOUT_SECONDS / 60} minutes after ${MAX_FAILED_ATTEMPTS} consecutive failed logins from IP ${ctx.ip}.`,
    });

    // Fire security alert email asynchronously — never block the login response
    sendSecurityAlertEmail(ctx.email, 'Account Locked', [
      `Your Ledgio account was temporarily locked after ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts.`,
      `Source IP: ${ctx.ip}`,
      'If this was not you, change your password immediately and enable two-factor authentication.',
    ]).catch((err) => logger.error('Failed to send account-locked alert', { err }));
  }
}

/**
 * Call AFTER a successful login (post-password-check, before issuing JWT).
 * Detects anomalies and returns signals to embed in the audit log.
 * Never blocks a successful login — signals are informational.
 */
export async function analyzeSuccessfulLogin(ctx: LoginContext): Promise<AnomalyResult> {
  const signals: string[] = [];

  // Clear failure counter on successful auth
  await redisDel(keys.failCount(ctx.userId));
  await redisDel(keys.lockout(ctx.userId));

  // 1. New IP detection
  const isKnownIp = await redisSIsMember(keys.knownIps(ctx.userId), ctx.ip);
  if (!isKnownIp) {
    signals.push(`First login from new IP ${ctx.ip}`);
    await redisSAdd(keys.knownIps(ctx.userId), ctx.ip, KNOWN_IP_TTL_SECONDS);
  }

  // 2. Impossible velocity (same user, different IP, within 10-min window)
  const lastSeenRaw = await redisGet(keys.lastSeen(ctx.userId));
  if (lastSeenRaw) {
    try {
      const lastSeen: { ip: string; at: number } = JSON.parse(lastSeenRaw);
      const secondsAgo = Math.floor(Date.now() / 1000) - lastSeen.at;
      if (lastSeen.ip !== ctx.ip && secondsAgo < VELOCITY_WINDOW_SECONDS) {
        signals.push(
          `Impossible velocity: previous session from ${lastSeen.ip} was ${Math.round(secondsAgo / 60)} min ago`
        );
      }
    } catch { /* malformed entry — ignore */ }
  }

  // Update last-seen (24h TTL — long enough for next-day velocity checks)
  await redisSet(
    keys.lastSeen(ctx.userId),
    JSON.stringify({ ip: ctx.ip, at: Math.floor(Date.now() / 1000) }),
    24 * 3600
  );

  if (signals.length > 0) {
    logger.warn('Login anomaly signals detected', { userId: ctx.userId, email: ctx.email, signals });

    await recordAuditLog({
      action: 'SECURITY.LOGIN_ANOMALY',
      entity: 'User',
      entityId: ctx.userId,
      tenantId: ctx.tenantId,
      actor: { userId: ctx.userId, userEmail: ctx.email, ipAddress: ctx.ip },
      details: `Login anomaly detected: ${signals.join('; ')}.`,
    });

    // Non-blocking security email
    sendSecurityAlertEmail(ctx.email, 'Unusual Login Detected', [
      'A login to your Ledgio account was flagged as unusual.',
      ...signals,
      'If this was not you, change your password immediately and contact your administrator.',
    ]).catch((err) => logger.error('Failed to send login-anomaly alert', { err }));
  }

  return { blocked: false, signals };
}

/**
 * Returns true if the account is currently in lockout.
 * Use in password-reset and MFA flows to surface the same message.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const locked = await redisGet(keys.lockout(userId));
  return locked !== null;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function sendSecurityAlertEmail(to: string, title: string, lines: string[]): Promise<void> {
  try {
    const { EmailService } = await import('./EmailService');
    if (!EmailService.isConfigured()) return;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">⚠️ Security Alert: ${title}</h2>
        <p style="color:#374151;">The following was detected on your Ledgio account:</p>
        <ul style="color:#374151;line-height:1.8;">
          ${lines.map((l) => `<li>${l}</li>`).join('')}
        </ul>
        <p style="color:#374151;">
          If you recognise this activity, no action is needed.<br/>
          If you do not recognise it, <strong>change your password immediately</strong> and enable
          two-factor authentication in Settings → Security.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">
          This alert was sent automatically by Ledgio. Do not reply to this email.
        </p>
      </div>
    `;

    await EmailService.sendMail(to, `[Ledgio Security] ${title}`, html);
  } catch (err) {
    logger.error('Security alert email failed', { to, title, err });
  }
}
