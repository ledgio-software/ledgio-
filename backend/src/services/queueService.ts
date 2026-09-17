import { PgBoss } from 'pg-boss';
import { logger } from '../utils/logger';
import { registerJob, recordJobStart, recordJobEnd } from './cronJobRegistry';

const QUEUE_SCHEMA = process.env.PGBOSS_SCHEMA ?? 'pgboss';

let boss: PgBoss | null = null;

export async function startQueue(): Promise<void> {
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: QUEUE_SCHEMA,
    // Dedicated pool of 3 connections; separate from the Prisma OLTP pool.
    max: 3,
  });

  boss.on('error', (err: Error) => logger.error('[Queue] pg-boss error', { error: err.message }));

  await boss.start();
  logger.info('[Queue] pg-boss started');
}

export async function stopQueue(): Promise<void> {
  if (!boss) return;
  await boss.stop();
  logger.info('[Queue] pg-boss stopped');
  boss = null;
}

/**
 * Registers a durable recurring schedule with pg-boss and wires up a worker.
 * Job schedule is stored in PostgreSQL — it survives server restarts.
 * pg-boss uses a singleton key so a new job is not queued while the previous
 * run is still active (equivalent to the old Redis distributed lock).
 */
export async function scheduleJob(
  name: string,
  cronExpr: string,
  handler: () => Promise<void>,
  description?: string,
): Promise<void> {
  if (!boss) throw new Error('[Queue] Call startQueue() before scheduleJob()');

  registerJob(name, cronExpr, description, handler);

  // Persist the schedule in PostgreSQL; singletonKey prevents job stacking.
  await boss.schedule(name, cronExpr, {}, { singletonKey: name });

  await boss.work<{}, void>(name, { batchSize: 1 }, async (jobs) => {
    for (const _job of jobs) {
      recordJobStart(name);
      try {
        await handler();
        recordJobEnd(name, true);
      } catch (e: any) {
        recordJobEnd(name, false, e?.message ?? 'Unknown error');
        logger.error(`[Queue] Job "${name}" failed`, { error: e?.message });
        throw e;
      }
    }
  });

  logger.info(`[Queue] Registered: ${name} (${cronExpr})`);
}

/** Enqueues a one-off execution of a named job (admin manual trigger). */
export async function sendJobNow(name: string): Promise<string | null> {
  if (!boss) throw new Error('[Queue] Call startQueue() before sendJobNow()');
  return boss.send(name, {}, { singletonKey: `${name}-manual-${Date.now()}` });
}
