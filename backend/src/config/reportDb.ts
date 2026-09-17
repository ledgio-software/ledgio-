import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { buildIdorPrismaMiddleware } from '../middleware/idorGuard';

// Heavy report queries need a longer statement_timeout than OLTP writes.
// REPORT_DATABASE_URL can point to a read replica; falls back to OLTP pool.
const REPORT_QUERY_TIMEOUT_MS = parseInt(process.env.REPORT_QUERY_TIMEOUT_MS || '55000', 10);
const REPORT_SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '500', 10);

const reportDbUrl = process.env.REPORT_DATABASE_URL || process.env.DATABASE_URL;

export const reportPrisma = new PrismaClient({
  datasources: { db: { url: reportDbUrl } },
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'query' },
  ],
});

// ORM-level timeout — fires before PostgreSQL's statement_timeout so callers
// receive a descriptive error instead of a raw P2024 pool timeout.
(reportPrisma as any).$use(async (params: any, next: any) => {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Report query timed out after ${REPORT_QUERY_TIMEOUT_MS}ms (${params.model}.${params.action})`)),
      REPORT_QUERY_TIMEOUT_MS,
    ),
  );
  return Promise.race([next(params), deadline]);
});

// IDOR prevention — same tenant guard as the OLTP client.
(reportPrisma as any).$use(buildIdorPrismaMiddleware());

reportPrisma.$on('query' as any, (e: any) => {
  if (e.duration > REPORT_SLOW_QUERY_MS) {
    logger.warn('[Report] Slow report query', { query: e.query, durationMs: e.duration, target: e.target });
  }
});

reportPrisma.$on('error' as any, (e: any) => {
  logger.error('[Report] Database error', { message: e.message, target: e.target });
});

reportPrisma.$on('warn' as any, (e: any) => {
  logger.warn('[Report] Database warning', { message: e.message });
});
