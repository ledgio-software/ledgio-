/**
 * Reports load test — exercises the heavy aggregation endpoints.
 * These run against the dedicated reportPrisma pool (Phase 4) and should
 * not starve OLTP writes even under concurrency.
 *
 *   k6 run -e BASE_URL=https://api.ledgio.com \
 *           -e K6_EMAIL=test@acme.com \
 *           -e K6_PASSWORD=secret \
 *           reports.js
 *
 * Thresholds (reporting queries are slow by nature):
 *   - p(95) trial balance  < 5 000 ms
 *   - p(95) P&L            < 5 000 ms
 *   - p(95) aging          < 8 000 ms
 *   - error rate           < 1 %
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { getToken, authHeaders, BASE_URL_EXPORT as BASE_URL } from './helpers/auth.js';

const tbDuration      = new Trend('report_trial_balance_duration',   true);
const plDuration      = new Trend('report_profit_loss_duration',     true);
const agingDuration   = new Trend('report_aging_duration',           true);
const reportErrRate   = new Rate('report_error_rate');

const today     = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

export const options = {
  // Lower concurrency: reports are CPU/DB heavy
  stages: [
    { duration: '20s', target: 3  },
    { duration: '1m',  target: 6  },
    { duration: '20s', target: 0  },
  ],
  thresholds: {
    report_trial_balance_duration: ['p(95)<5000'],
    report_profit_loss_duration:   ['p(95)<5000'],
    report_aging_duration:         ['p(95)<8000'],
    report_error_rate:             ['rate<0.01'],
    http_req_failed:               ['rate<0.01'],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function ({ token: t }) {
  const headers = authHeaders(t);

  group('Trial Balance', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/reports/trial-balance?asOf=${today}`,
      { headers, tags: { name: 'trial_balance' }, timeout: '10s' },
    );
    tbDuration.add(res.timings.duration);
    reportErrRate.add(!check(res, { 'tb 200': (r) => r.status === 200 }));
  });

  sleep(1);

  group('Profit & Loss', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/reports/profit-loss?from=${yearStart}&to=${today}`,
      { headers, tags: { name: 'profit_loss' }, timeout: '10s' },
    );
    plDuration.add(res.timings.duration);
    reportErrRate.add(!check(res, { 'pl 200': (r) => r.status === 200 }));
  });

  sleep(1);

  group('AR Aging', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/reports/ar-aging?asOf=${today}`,
      { headers, tags: { name: 'ar_aging' }, timeout: '15s' },
    );
    agingDuration.add(res.timings.duration);
    reportErrRate.add(!check(res, { 'aging 200': (r) => r.status === 200 }));
  });

  sleep(2);
}
