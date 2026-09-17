/**
 * Invoice flow load test — list + create invoices at steady-state load.
 *
 *   k6 run -e BASE_URL=https://api.ledgio.com \
 *           -e K6_EMAIL=test@acme.com \
 *           -e K6_PASSWORD=secret \
 *           invoices.js
 *
 * Thresholds:
 *   - p(95) list response < 400 ms
 *   - p(95) create response < 600 ms
 *   - error rate < 1 %
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { getToken, authHeaders, BASE_URL_EXPORT as BASE_URL } from './helpers/auth.js';

const listDuration   = new Trend('invoice_list_duration',   true);
const createDuration = new Trend('invoice_create_duration', true);
const errorRate      = new Rate('invoice_error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 20 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    invoice_list_duration:   ['p(95)<400'],
    invoice_create_duration: ['p(95)<600'],
    invoice_error_rate:      ['rate<0.01'],
    http_req_failed:         ['rate<0.01'],
  },
};

// One token per VU (setup runs once, shared across iterations via __ITER on a single VU).
let token = null;

export function setup() {
  return { token: getToken() };
}

export default function ({ token: t }) {
  const headers = authHeaders(t);

  group('List invoices', () => {
    const res = http.get(`${BASE_URL}/api/v1/invoices?page=1&limit=20`, {
      headers,
      tags: { name: 'list_invoices' },
    });
    listDuration.add(res.timings.duration);
    const ok = check(res, {
      'list 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('Create draft invoice', () => {
    const body = JSON.stringify({
      invoiceNumber: `LOAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customerId: null,
      dueDate: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0],
      currency: 'GHS',
      lines: [
        { description: 'Load test item', quantity: 1, unitPrice: 100, taxRate: 0 },
      ],
    });
    const res = http.post(`${BASE_URL}/api/v1/invoices`, body, {
      headers,
      tags: { name: 'create_invoice' },
    });
    createDuration.add(res.timings.duration);
    const ok = check(res, {
      'create 201': (r) => r.status === 201,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}
