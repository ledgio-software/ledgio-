import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Configurable via env — defaults match the statement_timeout in DATABASE_URL (30 s),
// but fire 5 s earlier so the API returns a structured error before Postgres kills
// the connection with P2024.
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS || '25000', 10);
const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '100', 10);

// Configure Prisma with production-ready connection pool settings and query logging.
// Pool sizing, connect/pool/statement timeouts are set via DATABASE_URL query params:
// ?connection_limit=50&pool_timeout=10&connect_timeout=5&statement_timeout=30000
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// ORM-level query timeout — fires before PostgreSQL's statement_timeout so callers
// receive a descriptive Error instead of a raw Prisma P2024 connection-pool timeout.
// $use is deprecated in Prisma 5 (removed in v6); migrate to $extends at that upgrade.
(prisma as any).$use(async (params: any, next: any) => {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `DB query timed out after ${QUERY_TIMEOUT_MS}ms (${params.model}.${params.action})`,
          ),
        ),
      QUERY_TIMEOUT_MS,
    ),
  );
  return Promise.race([next(params), deadline]);
});

// Slow-query and critical-query logging.
prisma.$on('query' as any, (e: any) => {
  const { duration } = e;

  if (duration > 5000) {
    logger.error('CRITICAL: Very slow query', {
      query: e.query,
      duration,
      params: e.params,
      target: e.target,
    });
  } else if (duration > SLOW_QUERY_MS) {
    logger.warn('Slow Query Detected', {
      query: e.query,
      duration,
      params: e.params,
      target: e.target,
    });
  }

  if (process.env.NODE_ENV === 'development' && duration > 10) {
    logger.debug('Database Query', {
      query: e.query,
      duration,
      params: e.params,
    });
  }
});

prisma.$on('error' as any, (e: any) => {
  logger.error('Database Error', {
    message: e.message,
    target: e.target,
  });
});

prisma.$on('warn' as any, (e: any) => {
  logger.warn('Database Warning', {
    message: e.message,
  });
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully', {
      provider: 'postgresql',
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  } catch (error: any) {
    logger.error('Database connection failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error: any) {
    logger.error('Database disconnect failed', {
      error: error.message,
    });
  }
};
