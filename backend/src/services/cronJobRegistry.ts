import { redis } from '../config/redis';

// A lock held for up to 30 minutes guards against two failure modes:
// (1) a cron tick fires while the previous run is still in progress
//     (can happen for the hourly recurring-transactions sweep under heavy load);
// (2) multiple pods scheduling the same job simultaneously on horizontal scale-out.
// On Redis unavailability the lock is skipped (fail-open) so jobs still run.
const CRON_LOCK_TTL_SECONDS = 30 * 60;

function lockKey(name: string): string {
  return `cronlock:${name.toLowerCase().replace(/\s+/g, '-')}`;
}

async function acquireCronLock(name: string): Promise<boolean> {
  try {
    const result = await redis.set(lockKey(name), '1', 'EX', CRON_LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch {
    // Redis unavailable — fail open so the job still runs on a single instance.
    return true;
  }
}

async function releaseCronLock(name: string): Promise<void> {
  try {
    await redis.del(lockKey(name));
  } catch {
    // Best-effort; the TTL will evict the key regardless.
  }
}

export interface JobLastRun {
  startedAt: string;
  finishedAt: string;
  success: boolean;
  errorMsg?: string;
  durationMs: number;
}

export interface JobRecord {
  name: string;
  schedule: string;
  description?: string;
  lastRun?: JobLastRun;
  runOnce?: () => Promise<void>;  // callable for manual trigger
}

const registry = new Map<string, JobRecord & { _startedAt?: number }>();

export function registerJob(name: string, schedule: string, description?: string, runOnce?: () => Promise<void>): void {
  const existing = registry.get(name);
  registry.set(name, { ...(existing ?? {}), name, schedule, description, runOnce });
}

export function recordJobStart(name: string): void {
  const job = registry.get(name);
  if (!job) return;
  (job as any)._startedAt = Date.now();
}

export function recordJobEnd(name: string, success: boolean, errorMsg?: string): void {
  const job = registry.get(name) as any;
  if (!job) return;
  const startedAt: number = job._startedAt ?? Date.now();
  const finishedAt = Date.now();
  job.lastRun = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    success,
    errorMsg,
    durationMs: finishedAt - startedAt,
  };
  delete job._startedAt;
}

export function listJobs(): Omit<JobRecord, 'runOnce'>[] {
  return Array.from(registry.values()).map(({ runOnce: _r, ...rest }) => rest);
}

/**
 * Wraps a cron tick function so that:
 * - A Redis distributed lock prevents overlapping runs (on restart or multi-pod).
 * - Start/end timestamps are recorded in the in-memory registry for the admin dashboard.
 */
export function wrapCronTick(name: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const acquired = await acquireCronLock(name);
    if (!acquired) {
      console.log(`[CronJobRegistry] Skipping "${name}" — a run is already in progress.`);
      return;
    }
    recordJobStart(name);
    try {
      await fn();
      recordJobEnd(name, true);
    } catch (e: any) {
      recordJobEnd(name, false, e?.message ?? 'Unknown error');
      throw e;
    } finally {
      await releaseCronLock(name);
    }
  };
}

export async function triggerJob(name: string): Promise<void> {
  const job = registry.get(name);
  if (!job) throw new Error(`Job "${name}" not registered.`);
  if (!job.runOnce) throw new Error(`Job "${name}" does not support manual triggering.`);
  recordJobStart(name);
  try {
    await job.runOnce();
    recordJobEnd(name, true);
  } catch (e: any) {
    recordJobEnd(name, false, e?.message ?? 'Unknown error');
    throw e;
  }
}
