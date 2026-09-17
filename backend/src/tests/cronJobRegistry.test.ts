/**
 * Unit tests for cronJobRegistry.ts — Phase 5 (Queue Durability).
 *
 * wrapCronTick no longer uses Redis distributed locks; pg-boss schedules are
 * the deduplication mechanism. These tests verify run-lifecycle recording and
 * the always-run semantics of the thin wrapCronTick wrapper.
 */

import { registerJob, wrapCronTick, listJobs } from '../services/cronJobRegistry';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Run behaviour ───────────────────────────────────────────────────────────

describe('wrapCronTick — run behaviour', () => {
  it('always runs the job (no lock gate)', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await wrapCronTick('Test Job A', fn)();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-throws when the job throws', async () => {
    const wrapped = wrapCronTick('Test Job B', async () => {
      throw new Error('boom');
    });
    await expect(wrapped()).rejects.toThrow('boom');
  });

  it('invokes the job multiple times on multiple calls', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const tick = wrapCronTick('Test Job C', fn);
    await tick();
    await tick();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ── Run-lifecycle recording ─────────────────────────────────────────────────

describe('wrapCronTick — registry recording', () => {
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
