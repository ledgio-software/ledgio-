/**
 * Smoke test — 1 VU, 1 iteration.
 * Verifies the API is reachable and auth returns a token.
 * Run before any load test to confirm the target is healthy.
 *
 *   k6 run -e BASE_URL=https://api.ledgio.com \
 *           -e K6_EMAIL=test@acme.com \
 *           -e K6_PASSWORD=secret \
 *           smoke.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { getToken, authHeaders, BASE_URL_EXPORT as BASE_URL } from './helpers/auth.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  // 1. Health endpoint (unauthenticated)
  const health = http.get(`${BASE_URL}/api/v1/health`, { tags: { name: 'health' } });
  check(health, {
    'health 200': (r) => r.status === 200,
    'health fast':  (r) => r.timings.duration < 300,
  });

  // 2. Login
  const token = getToken();
  check({ token }, { 'got token': (t) => !!t.token });
  if (!token) return;

  // 3. Authenticated self-lookup
  const me = http.get(`${BASE_URL}/api/v1/auth/me`, {
    headers: authHeaders(token),
    tags: { name: 'me' },
  });
  check(me, {
    'me 200': (r) => r.status === 200,
    'me has email': (r) => { try { return !!JSON.parse(r.body).data?.email; } catch { return false; } },
  });
}
