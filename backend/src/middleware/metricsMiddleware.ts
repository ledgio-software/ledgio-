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

// Per-route accumulator (since last server start — resets on deploy)
interface RouteStat { requests: number; errors: number; totalMs: number }
const routeStats = new Map<string, RouteStat>();

// Status-class distribution (since last server start)
const statusDist = { ok: 0, redirect: 0, clientErr: 0, serverErr: 0 };

/** Normalize a URL path: strip query string, replace UUID/numeric IDs with :id */
function normalizePath(url: string): string {
  const path = url.split('?')[0];
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

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

    // Time-series bucket
    const b = getOrCreateBucket();
    b.requests++;
    if (res.statusCode >= 400) b.errors++;
    b.totalMs += ms;

    // Per-route accumulator
    const route = `${req.method} ${normalizePath(req.originalUrl)}`;
    const rs = routeStats.get(route) ?? { requests: 0, errors: 0, totalMs: 0 };
    rs.requests++;
    if (res.statusCode >= 400) rs.errors++;
    rs.totalMs += ms;
    routeStats.set(route, rs);

    // Status class distribution
    if (res.statusCode < 300) statusDist.ok++;
    else if (res.statusCode < 400) statusDist.redirect++;
    else if (res.statusCode < 500) statusDist.clientErr++;
    else statusDist.serverErr++;
  });
  next();
}

export interface RouteMetric {
  route: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgMs: number;
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
  statusDist: { ok: number; redirect: number; clientErr: number; serverErr: number };
  topRoutesByTraffic: RouteMetric[];
  topRoutesByErrors: RouteMetric[];
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

  const allRoutes: RouteMetric[] = [...routeStats.entries()].map(([route, s]) => ({
    route,
    requests: s.requests,
    errors: s.errors,
    errorRate: s.requests > 0 ? Math.round((s.errors / s.requests) * 1000) / 10 : 0,
    avgMs: s.requests > 0 ? Math.round(s.totalMs / s.requests) : 0,
  }));

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
    statusDist: { ...statusDist },
    topRoutesByTraffic: [...allRoutes].sort((a, b) => b.requests - a.requests).slice(0, 15),
    topRoutesByErrors: [...allRoutes]
      .filter(r => r.errors > 0)
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 10),
  };
}
