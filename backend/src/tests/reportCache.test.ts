/**
 * Unit tests for the report-cache layer (src/cache/reportCache.ts).
 *
 * Redis is mocked so tests run without a real Redis instance. The assertions
 * verify that key construction, hit/miss semantics, TTL, and cache-wide
 * tenant invalidation all behave as expected.
 */

// ── Mock the Redis module before any import that pulls it in ──────────────────
const mockGet = jest.fn<Promise<unknown>, [string]>();
const mockSet = jest.fn<Promise<boolean>, [string, unknown, number?]>();
const mockDelPattern = jest.fn<Promise<number>, [string]>();

jest.mock('../config/redis', () => ({
  redis: {},
  cacheUtils: {
    get: (...args: unknown[]) => mockGet(...(args as [string])),
    set: (...args: unknown[]) => mockSet(...(args as [string, unknown, number?])),
    del: jest.fn(),
    delPattern: (...args: unknown[]) => mockDelPattern(...(args as [string])),
  },
}));

import { getCachedReport, setCachedReport, invalidateReportCache } from '../cache/reportCache';

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCachedReport', () => {
  it('returns null on a cache miss', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCachedReport(TENANT_A, 'profit-loss', { startDate: '2024-01-01' });
    expect(result).toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('returns the stored value on a cache hit', async () => {
    const payload = { totalRevenue: 50000, netProfit: 12000 };
    mockGet.mockResolvedValue(payload);
    const result = await getCachedReport<typeof payload>(TENANT_A, 'profit-loss', { startDate: '2024-01-01' });
    expect(result).toEqual(payload);
  });

  it('isolates keys by tenant: same report type returns null for a different tenant', async () => {
    // Tenant A has a cached value, Tenant B does not.
    mockGet.mockImplementation(async (key: string) =>
      key.startsWith(`report:${TENANT_A}:`) ? { totalRevenue: 1 } : null
    );
    const forA = await getCachedReport(TENANT_A, 'trial-balance', {});
    const forB = await getCachedReport(TENANT_B, 'trial-balance', {});
    expect(forA).not.toBeNull();
    expect(forB).toBeNull();
  });

  it('isolates keys by params: same tenant + type but different params are separate cache entries', async () => {
    mockGet.mockImplementation(async (key: string) =>
      key.includes('startDate%3D2024') ? { data: 'jan' } : null
    );

    // Different param hashes → different keys → one hit, one miss.
    const withDate = await getCachedReport(TENANT_A, 'trial-balance', { startDate: '2024-01-01' });
    const noDate = await getCachedReport(TENANT_A, 'trial-balance', { startDate: '' });
    // Both calls were made (two distinct keys).
    expect(mockGet).toHaveBeenCalledTimes(2);
    const [key1, key2] = mockGet.mock.calls.map((c) => c[0]);
    expect(key1).not.toEqual(key2);
  });
});

describe('setCachedReport', () => {
  it('stores the report with the 5-minute TTL', async () => {
    mockSet.mockResolvedValue(true);
    const data = { rows: [1, 2, 3] };
    await setCachedReport(TENANT_A, 'sales-register', { page: '1' }, data);
    expect(mockSet).toHaveBeenCalledTimes(1);
    const [, , ttl] = mockSet.mock.calls[0];
    expect(ttl).toBe(300); // 5 * 60 seconds
  });

  it('uses the same key structure that getCachedReport reads', async () => {
    mockSet.mockResolvedValue(true);
    mockGet.mockResolvedValue({ sentinel: true });

    await setCachedReport(TENANT_A, 'aging-ar', {}, { buckets: [] });
    const setKey = mockSet.mock.calls[0][0];

    await getCachedReport(TENANT_A, 'aging-ar', {});
    const getKey = mockGet.mock.calls[0][0];

    expect(setKey).toBe(getKey);
  });

  it('does not throw when the underlying cache write fails', async () => {
    mockSet.mockRejectedValue(new Error('Redis connection refused'));
    await expect(setCachedReport(TENANT_A, 'balance-sheet', {}, {})).resolves.not.toThrow();
  });
});

describe('invalidateReportCache', () => {
  it('calls delPattern with a tenant-scoped wildcard', async () => {
    mockDelPattern.mockResolvedValue(7);
    await invalidateReportCache(TENANT_A);
    expect(mockDelPattern).toHaveBeenCalledWith(`report:${TENANT_A}:*`);
  });

  it('only invalidates the target tenant, not others', async () => {
    mockDelPattern.mockResolvedValue(3);
    await invalidateReportCache(TENANT_A);
    const pattern = mockDelPattern.mock.calls[0][0];
    expect(pattern).not.toContain(TENANT_B);
  });
});
