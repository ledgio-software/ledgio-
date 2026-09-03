/**
 * Unit tests for cronJobRegistry.ts — focuses on the distributed-lock and
 * run-lifecycle behaviour added in Phase 5 (Queue Durability).
 *
 * Redis is mocked so tests run without a real Redis instance.
 */

// ── Mock ioredis before any import that pulls it in ────────────────────────
const mockSet = jest.fn<Promise<string | null>, [string, string, string, number, string]>();
const mockDel = jest.fn<Promise<number>, [string]>();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: (...args: unknown[]) => mockSet(args[0] as any, args[1] as any, args[2] as any, args[3] as any, args[4] as any),
    del: (...args: unknown[]) => mockDel(args[0] as any),
    on: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    connect: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue('redis_version:7.0.0'),
  }));
});

import { registerJob, wrapCronTick, listJobs } from '../services/cronJobRegistry';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Lock acquisition ────────────────────────────────────────────────────────

describe('wrapCronTick — distributed lock', () => {
  it('runs the job when the lock is acquired (SET NX returns OK)', async () => {
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);

    const fn = jest.fn().mockResolvedValue(undefined);
    await wrapCronTick('Test Job A', fn)();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('skips the job when the lock is already held (SET NX returns null)', async () => {
    mockSet.mockResolvedValue(null); // lock not acquired
    const fn = jest.fn().mockResolvedValue(undefined);
    await wrapCronTick('Test Job B', fn)();
    expect(fn).not.toHaveBeenCalled();
  });

  it('releases the lock (DEL) after a successful run', async () => {
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);

    await wrapCronTick('Test Job C', jest.fn().mockResolvedValue(undefined))();
    expect(mockDel).toHaveBeenCalledTimes(1);
    const [deletedKey] = mockDel.mock.calls[0];
    expect(deletedKey).toMatch(/^cronlock:/);
  });

  it('releases the lock even when the job throws', async () => {
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);

    const wrapped = wrapCronTick('Test Job D', async () => {
      throw new Error('boom');
    });
    await expect(wrapped()).rejects.toThrow('boom');
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('runs the job when Redis is unavailable (fail-open)', async () => {
    mockSet.mockRejectedValue(new Error('Redis connection refused'));
    mockDel.mockResolvedValue(1);

    const fn = jest.fn().mockResolvedValue(undefined);
    await wrapCronTick('Test Job E', fn)();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses a lock key derived from the job name', async () => {
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);

    await wrapCronTick('Recurring Invoices', jest.fn().mockResolvedValue(undefined))();

    const setArgs = mockSet.mock.calls[0];
    expect(setArgs[0]).toBe('cronlock:recurring-invoices');
    expect(setArgs[2]).toBe('EX');
    expect(typeof setArgs[3]).toBe('number');
    expect(setArgs[4]).toBe('NX');
  });
});

// ── Run-lifecycle recording ─────────────────────────────────────────────────

describe('wrapCronTick — registry recording', () => {
  beforeEach(() => {
    // Allow the lock to be acquired for all recording tests.
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);
  });

  it('records a successful run in the registry', async () => {
    registerJob('Record Success Job', '0 * * * *', 'test', jest.fn());
    await wrapCronTick('Record Success Job', async () => {})();
    const [job] = listJobs().filter((j) => j.name === 'Record Success Job');
    expect(job.lastRun?.success).toBe(true);
    expect(job.lastRun?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records a failed run with the error message', async () => {
    registerJob('Record Fail Job', '0 * * * *', 'test', jest.fn());
    const wrapped = wrapCronTick('Record Fail Job', async () => {
      throw new Error('disk full');
    });
    await expect(wrapped()).rejects.toThrow('disk full');
    const [job] = listJobs().filter((j) => j.name === 'Record Fail Job');
    expect(job.lastRun?.success).toBe(false);
    expect(job.lastRun?.errorMsg).toBe('disk full');
  });
});
