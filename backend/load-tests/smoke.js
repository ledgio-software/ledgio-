/**
 * k6 smoke / baseline load test for the Ledgio backend API.
 *
 * Covers the 6 highest-traffic endpoints:
 *   GET  /health                           (unauthenticated)
 *   POST /api/v1/auth/login                (authentication)
 *   GET  /api/v1/accounts                  (chart of accounts)
 *   GET  /api/v1/journal-entries           (ledger list)
 *   GET  /api/v1/reports/aging/ar          (cached report)
 *   GET  /api/v1/reports/cash-flow         (expensive aggregation)
 *
 * Usage:
 *   k6 run \
 *     -e BASE_URL=https://your-backend.onrender.com \
 *     -e TENANT_SLUG=your-tenant-slug \
 *     -e EMAIL=admin@example.com \
 *     -e PASSWORD=YourPassword123! \
 *     backend/load-tests/smoke.js
 *
 * Pass --vus and --duration to override defaults (10 VUs, 30 s).
 *
 * Requirements: k6 >= 0.47   (https://k6.io/docs/getting-started/installation/)
 * Do NOT run in CI — this is a manual pre-release check.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────

const errorRate        = new Rate('http_error_rate');
const loginLatency     = new Trend('login_latency_ms',   true);
const accountsLatency  = new Trend('accounts_latency_ms', true);
const ledgerLatency    = new Trend('ledger_latency_ms',  true);
const agingLatency     = new Trend('aging_latency_ms',   true);
const cashFlowLatency  = new Trend('cash_flow_latency_ms', true);

// ── Test options ──────────────────────────────────────────────────────────────

export const options = {
  vus:      10,
  duration: '30s',

  thresholds: {
    // Overall p95 across all requests must be under 500 ms.
    http_req_duration: ['p(95)<500'],

    // Individual endpoint p95 targets (ms).
    login_latency_ms:     ['p(95)<800'],  // login involves bcrypt
    accounts_latency_ms:  ['p(95)<300'],
    ledger_latency_ms:    ['p(95)<400'],
    aging_latency_ms:     ['p(95)<500'],  // first hit uncached, rest cached
    cash_flow_latency_ms: ['p(95)<600'],  // full-ledger aggregation

    // Fewer than 2 % of requests should be HTTP 4xx/5xx.
    http_error_rate: ['rate<0.02'],
  },
};

// ── Environment ───────────────────────────────────────────────────────────────

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:3001';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'dev-tenant';
const EMAIL       = __ENV.EMAIL       || 'admin@example.com';
const PASSWORD    = __ENV.PASSWORD    || 'Password123!';

// ── Setup: authenticate once, share token across VUs ─────────────────────────

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_SLUG } },
  );

  if (res.status !== 200) {
    console.error(`Setup login failed: ${res.status} — ${res.body}`);
    // Return empty token; per-VU login will fail gracefully via error rate.
    return { token: '' };
  }

  const body = JSON.parse(res.body);
  const token = body?.data?.token ?? body?.token ?? '';
  console.log(`Setup: authenticated as ${EMAIL}, token length=${token.length}`);
  return { token };
}

// ── Main VU scenario ──────────────────────────────────────────────────────────

export default function main({ token }) {
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID':   TENANT_SLUG,
    'Content-Type':  'application/json',
  };

  // 1. Health probe — unauthenticated, should always be fast.
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`);
    const ok = check(res, { 'health: status 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.2);

  // 2. Login (warm path — token already held, but exercises the auth route).
  group('login', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_SLUG } },
    );
    const ok = check(res, { 'login: status 200': (r) => r.status === 200 });
    loginLatency.add(res.timings.duration);
    errorRate.add(!ok);
  });

  sleep(0.2);

  // 3. Chart of accounts — small cacheable list, very common in the UI.
  group('accounts', () => {
    const res = http.get(`${BASE_URL}/api/v1/accounts`, { headers: authHeaders });
    const ok = check(res, { 'accounts: status 200': (r) => r.status === 200 });
    accountsLatency.add(res.timings.duration);
    errorRate.add(!ok);
  });

  sleep(0.2);

  // 4. Journal entries list — paginated, hits the per-tenant schema.
  group('journal-entries', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/journal-entries?limit=20&page=1`,
      { headers: authHeaders },
    );
    const ok = check(res, { 'journal-entries: status 200': (r) => r.status === 200 });
    ledgerLatency.add(res.timings.duration);
    errorRate.add(!ok);
  });

  sleep(0.2);

  // 5. AR aging report — first VU hit is a cold query; subsequent ones are
  //    served from Redis cache. Exercises both paths under concurrent load.
  group('aging-ar', () => {
    const res = http.get(`${BASE_URL}/api/v1/reports/aging/ar`, { headers: authHeaders });
    const ok = check(res, { 'aging-ar: status 200': (r) => r.status === 200 });
    agingLatency.add(res.timings.duration);
    errorRate.add(!ok);
  });

  sleep(0.2);

  // 6. Cash flow statement — the heaviest report; multi-table aggregation.
  group('cash-flow', () => {
    const res = http.get(`${BASE_URL}/api/v1/reports/cash-flow`, { headers: authHeaders });
    const ok = check(res, { 'cash-flow: status 200': (r) => r.status === 200 });
    cashFlowLatency.add(res.timings.duration);
    errorRate.add(!ok);
  });

  sleep(0.5);
}
