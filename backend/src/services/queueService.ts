import { PgBoss } from 'pg-boss';
import { logger } from '../utils/logger';
import { registerJob, recordJobStart, recordJobEnd } from './cronJobRegistry';

const QUEUE_SCHEMA = process.env.PGBOSS_SCHEMA ?? 'pgboss';

let boss: PgBoss | null = null;

// pg-boss only allows [a-zA-Z0-9_\-./] in queue names; replace any other character with a hyphen.
function sanitizeQueueName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-.\/]/g, '-');
}

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

  const queueName = sanitizeQueueName(name);

  // Explicitly create the queue row before registering a worker or schedule.
  // boss.work() only registers a subscriber — it does NOT insert into pgboss.queue.
  // Without this row, boss.schedule() fails the FK constraint (schedule_name_fkey).
  // createQueue() is idempotent: re-deploys that find the row already present are fine.
  await boss.createQueue(queueName);

  await boss.work<{}, void>(queueName, { batchSize: 1 }, async (jobs) => {
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

  // Persist the schedule now that the queue row exists; singletonKey prevents job stacking.
  await boss.schedule(queueName, cronExpr, {}, { singletonKey: queueName });

  logger.info(`[Queue] Registered: ${name} (${cronExpr})`);
}

/** Enqueues a one-off execution of a named job (admin manual trigger). */
export async function sendJobNow(name: string): Promise<string | null> {
  if (!boss) throw new Error('[Queue] Call startQueue() before sendJobNow()');
  const queueName = sanitizeQueueName(name);
  return boss.send(queueName, {}, { singletonKey: `${queueName}-manual-${Date.now()}` });
}
