import { Request, Response, NextFunction } from 'express';

const BUCKET_SIZE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BUCKETS = 720;               // 60 hours of history

interface Bucket {
  ts: number;       // epoch ms at bucket start (floored to BUCKET_SIZE_MS)
  requests: number;
  errors: number;
  totalMs: number;
}

const buckets: Bucket[] = [];

function getOrCreateBucket(): Bucket {
  const ts = Math.floor(Date.now() / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
  const last = buckets[buckets.length - 1];
  if (last && last.ts === ts) return last;
  const b: Bucket = { ts, requests: 0, errors: 0, totalMs: 0 };
  buckets.push(b);
  if (buckets.length > MAX_BUCKETS) buckets.shift();
  return b;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const b = getOrCreateBucket();
    b.requests++;
    if (res.statusCode >= 400) b.errors++;
    b.totalMs += ms;
  });
  next();
}

export interface MetricsSummary {
  requests: number;
  errors: number;
  errorRate: number;        // 0–100 %
  avgLatencyMs: number;
  memory: { heapUsedMb: number; rssMb: number };
  uptime: number;           // seconds
  nodeVersion: string;
  buckets: { ts: number; requests: number; errors: number; avgMs: number }[];
}

export function getMetricsSummary(windowBuckets = 12): MetricsSummary {
  const recent = buckets.slice(-windowBuckets);
  let requests = 0;
  let errors = 0;
  let totalMs = 0;
  for (const b of recent) {
    requests += b.requests;
    errors += b.errors;
    totalMs += b.totalMs;
  }
  const mem = process.memoryUsage();
  return {
    requests,
    errors,
    errorRate: requests > 0 ? Math.round((errors / requests) * 1000) / 10 : 0,
    avgLatencyMs: requests > 0 ? Math.round(totalMs / requests) : 0,
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
      rssMb: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
    },
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version,
    buckets: buckets.slice(-windowBuckets).map(b => ({
      ts: b.ts,
      requests: b.requests,
      errors: b.errors,
      avgMs: b.requests > 0 ? Math.round(b.totalMs / b.requests) : 0,
    })),
  };
}
