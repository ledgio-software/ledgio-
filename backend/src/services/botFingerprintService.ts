/**
 * Server-side bot fingerprint analysis service.
 *
 * Receives the passive browser signal object (_bf) the login form attaches to
 * each POST, scores the signals, and writes a SECURITY.BOT_SIGNAL audit log
 * entry when the combination looks suspicious.
 *
 * Never throws into the caller — the login handler fires this as
 * fire-and-forget so it cannot delay or block a real user's session.
 *
 * Design principles:
 *   - Fail open: a missing/malformed fingerprint is not a signal by itself.
 *   - Never block: the audit log entry is the output, never a rejection.
 *   - Additive: signals accumulate; one signal alone is a weak indicator.
 */

import { logger } from '../utils/logger';
import { recordAuditLog } from './auditLogService';

// ── Fingerprint shape (mirrors frontend botFingerprint.ts) ────────────────────

interface BotFingerprint {
  wd?: boolean;       // navigator.webdriver
  ags?: boolean;      // automation globals present
  ttk?: number | null; // time-to-first-keystroke (ms since page load)
  mm?: boolean;       // mouse moved before submit
  ts?: boolean;       // touch support
  hc?: number;        // hardwareConcurrency
  sw?: number;        // screen width
  sh?: number;        // screen height
  vw?: number;        // viewport width
  vh?: number;        // viewport height
  lang?: string;      // navigator.languages[0]
  plat?: string;      // navigator.platform
  ce?: boolean;       // cookieEnabled
  ls?: boolean;       // localStorage writable
  age?: number;       // ms since page load at submit time
}

export interface FingerprintContext {
  fingerprint: BotFingerprint;
  email: string;
  ip: string;
  userAgent?: string;
}

// ── Signal scoring ────────────────────────────────────────────────────────────

interface Signal {
  code: string;
  detail: string;
  weight: number; // 1 = weak, 2 = moderate, 3 = strong
}

function scoreFingerprint(fp: BotFingerprint): Signal[] {
  const signals: Signal[] = [];

  // Strong bot indicators
  if (fp.wd === true) {
    signals.push({ code: 'WEBDRIVER', detail: 'navigator.webdriver is true', weight: 3 });
  }
  if (fp.ags === true) {
    signals.push({ code: 'AUTOMATION_GLOBALS', detail: 'Automation framework globals detected in window', weight: 3 });
  }

  // Cookie/storage disabled — headless often runs without real profile storage
  if (fp.ce === false) {
    signals.push({ code: 'COOKIES_DISABLED', detail: 'navigator.cookieEnabled is false', weight: 2 });
  }
  if (fp.ls === false) {
    signals.push({ code: 'LOCALSTORAGE_DISABLED', detail: 'localStorage is not writable', weight: 2 });
  }

  // No mouse movement — real users almost always move the cursor before clicking Login
  if (fp.mm === false) {
    signals.push({ code: 'NO_MOUSE_MOVE', detail: 'No mouse movement recorded before submit', weight: 1 });
  }

  // Time-to-first-keystroke: null means no keystroke observed before submit
  // (e.g. programmatically set values), or suspiciously fast (< 200 ms)
  if (fp.ttk === null || fp.ttk === undefined) {
    signals.push({ code: 'NO_KEYSTROKE', detail: 'No keystroke observed before form submit (fields may be programmatically filled)', weight: 2 });
  } else if (fp.ttk < 200) {
    signals.push({ code: 'INSTANT_KEYSTROKE', detail: `First keystroke at ${fp.ttk}ms — faster than human reaction time`, weight: 1 });
  }

  // Unusually fast total session age (< 1 second from page load to submit)
  if (typeof fp.age === 'number' && fp.age < 1000) {
    signals.push({ code: 'INSTANT_SUBMIT', detail: `Login submitted ${fp.age}ms after page load`, weight: 2 });
  }

  // Hardware concurrency of 0 is unusual — real browsers report ≥ 1
  if (typeof fp.hc === 'number' && fp.hc === 0) {
    signals.push({ code: 'ZERO_CPU_CORES', detail: 'navigator.hardwareConcurrency is 0', weight: 1 });
  }

  // Screen 0×0 indicates a headless environment
  if (typeof fp.sw === 'number' && typeof fp.sh === 'number' && fp.sw === 0 && fp.sh === 0) {
    signals.push({ code: 'ZERO_SCREEN', detail: 'screen dimensions are 0×0 (headless environment)', weight: 3 });
  }

  // Viewport 0×0 — same as above but window.innerWidth/Height
  if (typeof fp.vw === 'number' && typeof fp.vh === 'number' && fp.vw === 0 && fp.vh === 0) {
    signals.push({ code: 'ZERO_VIEWPORT', detail: 'viewport dimensions are 0×0', weight: 2 });
  }

  return signals;
}

// ── Public API ────────────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 3; // total weight needed to write an audit entry

export async function analyzeBotFingerprint(ctx: FingerprintContext): Promise<void> {
  try {
    const fp = ctx.fingerprint;
    if (!fp || typeof fp !== 'object') return;

    const signals = scoreFingerprint(fp);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);

    if (totalWeight < SCORE_THRESHOLD) return;

    const signalSummary = signals.map((s) => `${s.code} (${s.detail})`).join('; ');

    logger.warn('Bot fingerprint signals detected at login', {
      email: ctx.email,
      ip: ctx.ip,
      totalWeight,
      signals: signals.map((s) => s.code),
    });

    await recordAuditLog({
      action: 'SECURITY.BOT_SIGNAL',
      entity: 'User',
      actor: { userEmail: ctx.email, ipAddress: ctx.ip },
      details: `Bot/automation signals at login (score ${totalWeight}): ${signalSummary}.`,
    });

    // Optional: alert email for very high confidence detections
    if (totalWeight >= 5) {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        const { EmailService } = await import('./EmailService');
        if (EmailService.isConfigured()) {
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
              <h2 style="color:#dc2626;">🤖 Bot/automation login attempt detected</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td style="padding:4px 8px;">${ctx.email}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">IP</td><td style="padding:4px 8px;">${ctx.ip}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">User-Agent</td><td style="padding:4px 8px;">${ctx.userAgent ?? '(unknown)'}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Score</td><td style="padding:4px 8px;">${totalWeight}</td></tr>
                <tr><td style="padding:4px 8px;font-weight:bold;">Signals</td><td style="padding:4px 8px;">${signals.map((s) => s.code).join(', ')}</td></tr>
              </table>
              <p style="margin-top:16px;color:#6b7280;font-size:12px;">
                Logged at ${new Date().toISOString()} — Ledgio Security System
              </p>
            </div>
          `;
          await EmailService.sendMail(adminEmail, '[Ledgio Security] Bot login attempt detected', html);
        }
      }
    }
  } catch (err) {
    logger.error('botFingerprintService: error during analysis', { err });
  }
}
