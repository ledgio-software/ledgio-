/**
 * Passive bot/automation signal collector.
 *
 * Collects observable browser signals at login time to help the backend
 * distinguish automated clients from real users. Signals are informational
 * only — the backend logs anomalies but never blocks a login based on them
 * alone, so a false-positive never locks out a legitimate user.
 *
 * Nothing here is cryptographically strong. The goal is friction and
 * signal enrichment for the audit trail, not foolproof bot detection.
 */

export interface BotFingerprint {
  /** navigator.webdriver — true for Selenium/Playwright/Puppeteer */
  wd: boolean;
  /** Any automation-specific global is defined (e.g. __webdriver_evaluate) */
  ags: boolean;
  /** Milliseconds between page load and first keystroke on the form */
  ttk: number | null;
  /** Whether the mouse moved at all before the submit */
  mm: boolean;
  /** Touch support available (mobile vs desktop signal) */
  ts: boolean;
  /** navigator.hardwareConcurrency */
  hc: number;
  /** screen.width × screen.height */
  sw: number;
  sh: number;
  /** window.innerWidth × window.innerHeight */
  vw: number;
  vh: number;
  /** navigator.languages[0] */
  lang: string;
  /** navigator.platform */
  plat: string;
  /** Cookie enabled */
  ce: boolean;
  /** localStorage writable */
  ls: boolean;
  /** Approx ms since page load at submit time (rough session duration) */
  age: number;
}

// ── Module-level state ────────────────────────────────────────────────────────
// We track interaction events from the moment this module is imported so that
// the Login component doesn't need to wire event listeners itself.

let _firstKeystrokeAt: number | null = null;
let _mouseMoved = false;
const _loadedAt = Date.now();

function onFirstKey() {
  if (_firstKeystrokeAt === null) _firstKeystrokeAt = Date.now();
}
function onMouseMove() {
  _mouseMoved = true;
}

// Attach passive listeners once; they survive re-renders.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onFirstKey, { passive: true, once: false });
  window.addEventListener('mousemove', onMouseMove, { passive: true, once: true });
}

// ── Automation global probe ───────────────────────────────────────────────────
function hasAutomationGlobals(): boolean {
  const suspects = [
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__driver_evaluate',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '_phantom',
    '__nightmare',
    'callPhantom',
    '_Selenium_IDE_Recorder',
    '__puppeteer_evaluation_script__',
  ];
  return suspects.some((k) => k in window);
}

function isLocalStorageAvailable(): boolean {
  try {
    const k = '__bf_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call just before submitting the login form. Returns the fingerprint object. */
export function collectBotFingerprint(): BotFingerprint {
  const now = Date.now();
  return {
    wd:   !!(navigator as any).webdriver,
    ags:  hasAutomationGlobals(),
    ttk:  _firstKeystrokeAt !== null ? _firstKeystrokeAt - _loadedAt : null,
    mm:   _mouseMoved,
    ts:   'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hc:   navigator.hardwareConcurrency ?? 0,
    sw:   screen.width,
    sh:   screen.height,
    vw:   window.innerWidth,
    vh:   window.innerHeight,
    lang: navigator.languages?.[0] ?? navigator.language ?? '',
    plat: navigator.platform ?? '',
    ce:   navigator.cookieEnabled,
    ls:   isLocalStorageAvailable(),
    age:  now - _loadedAt,
  };
}
