import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

/**
 * Authenticates with the API and returns the Bearer token.
 * Requires K6_EMAIL, K6_PASSWORD environment variables.
 * Optionally reads K6_TENANT_SLUG (needed when the account belongs to a tenant
 * other than the default resolved from the email domain).
 */
export function getToken() {
  const payload = JSON.stringify({
    email: __ENV.K6_EMAIL || 'test@example.com',
    password: __ENV.K6_PASSWORD || 'TestPassword123!',
    ...__ENV.K6_TENANT_SLUG ? { tenantSlug: __ENV.K6_TENANT_SLUG } : {},
  });

  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });

  check(res, {
    'login 200': (r) => r.status === 200,
    'token present': (r) => {
      try { return !!JSON.parse(r.body).data?.token; } catch { return false; }
    },
  });

  try {
    return JSON.parse(res.body).data?.token ?? null;
  } catch {
    return null;
  }
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export const BASE_URL_EXPORT = BASE_URL;
