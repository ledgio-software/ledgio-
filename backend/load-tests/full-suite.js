/**
 * Full load test suite — realistic mixed workload combining OLTP writes and
 * reporting reads. Simulates concurrent usage across three user personas:
 *   - Cashier   (40 %): POS/invoice flows
 *   - Accountant (40 %): report queries
 *   - Manager   (20 %): dashboard + metrics
 *
 *   k6 run -e BASE_URL=https://api.ledgio.com \
 *           -e K6_EMAIL=test@acme.com \
 *           -e K6_PASSWORD=secret \
 *           full-suite.js
 *
 * Pass --out csv=results.csv to record raw metrics.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { getToken, authHeaders, BASE_URL_EXPORT as BASE_URL } from './helpers/auth.js';

// Custom metrics
const writeLatency  = new Trend('full_write_latency',  true);
const readLatency   = new Trend('full_read_latency',   true);
const errorRate     = new Rate('full_error_rate');

const today     = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

export const options = {
  scenarios: {
    cashier: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 8  },
        { duration: '2m',  target: 20 },
        { duration: '30s', target: 0  },
      ],
      exec: 'cashierFlow',
    },
    accountant: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 4  },
        { duration: '2m',  target: 10 },
        { duration: '30s', target: 0  },
      ],
      exec: 'accountantFlow',
    },
    manager: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 2  },
        { duration: '2m',  target: 5  },
        { duration: '30s', target: 0  },
      ],
      exec: 'managerFlow',
    },
  },
  thresholds: {
    // Overall SLA
    http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    http_req_failed:   ['rate<0.01'],
    // Per-scenario
    full_write_latency: ['p(95)<600'],
    full_read_latency:  ['p(95)<5000'],
    full_error_rate:    ['rate<0.01'],
  },
};

export function setup() {
  return { token: getToken() };
}

// ── Cashier: invoice CRUD ────────────────────────────────────────────────────
export function cashierFlow({ token: t }) {
  const headers = authHeaders(t);

  group('List invoices', () => {
    const res = http.get(`${BASE_URL}/api/v1/invoices?page=1&limit=20`, {
      headers, tags: { name: 'cashier_list' },
    });
    readLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'list 200': (r) => r.status === 200 }));
  });

  sleep(0.5);

  group('Create invoice', () => {
    const body = JSON.stringify({
      invoiceNumber: `LD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dueDate: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0],
      currency: 'GHS',
      lines: [{ description: 'Service fee', quantity: 1, unitPrice: 500, taxRate: 0 }],
    });
    const res = http.post(`${BASE_URL}/api/v1/invoices`, body, {
      headers, tags: { name: 'cashier_create' },
    });
    writeLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'create 201': (r) => r.status === 201 }));
  });

  sleep(1.5);
}

// ── Accountant: report reads ─────────────────────────────────────────────────
export function accountantFlow({ token: t }) {
  const headers = authHeaders(t);

  group('Trial balance', () => {
    const res = http.get(`${BASE_URL}/api/v1/reports/trial-balance?asOf=${today}`, {
      headers, tags: { name: 'acct_tb' }, timeout: '12s',
    });
    readLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'tb 200': (r) => r.status === 200 }));
  });

  sleep(2);

  group('P&L', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/reports/profit-loss?from=${yearStart}&to=${today}`,
      { headers, tags: { name: 'acct_pl' }, timeout: '12s' },
    );
    readLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'pl 200': (r) => r.status === 200 }));
  });

  sleep(3);
}

// ── Manager: dashboard + admin metrics ──────────────────────────────────────
export function managerFlow({ token: t }) {
  const headers = authHeaders(t);

  group('Health check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health`, {
      tags: { name: 'mgr_health' },
    });
    readLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'health 200': (r) => r.status === 200 }));
  });

  sleep(1);

  group('AR aging summary', () => {
    const res = http.get(`${BASE_URL}/api/v1/reports/ar-aging?asOf=${today}`, {
      headers, tags: { name: 'mgr_aging' }, timeout: '15s',
    });
    readLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'aging 200': (r) => r.status === 200 }));
  });

  sleep(4);
}
