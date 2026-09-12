/**
 * In-memory circular buffer for per-request debug logs.
 * Captures all requests (not just errors) with timing, tenant, and error context.
 * Max 500 entries; oldest dropped when full. Entries older than 24h are pruned on access.
 */

import { randomUUID } from 'crypto';

export interface DebugLogEntry {
  id: string;           // 8-char hex debugId
  ts: string;           // ISO timestamp
  method: string;
  path: string;
  status: number;
  durationMs: number;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  ip?: string;
  errorMessage?: string;
  errorSource?: string; // first app frame from stack
  bodyKeys?: string[];  // request body keys (no values)
  level: 'ok' | 'warn' | 'error'; // ok=<400, warn=4xx, error=5xx
}

const MAX = 500;
const TTL_MS = 24 * 60 * 60 * 1000;
const buffer: DebugLogEntry[] = [];

export function generateDebugId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

export function pushDebugLog(entry: DebugLogEntry): void {
  if (buffer.length >= MAX) buffer.shift();
  buffer.push(entry);
}

function prune(): DebugLogEntry[] {
  const cutoff = Date.now() - TTL_MS;
  while (buffer.length > 0 && new Date(buffer[0].ts).getTime() < cutoff) {
    buffer.shift();
  }
  return buffer;
}

export interface DebugLogFilter {
  level?: 'ok' | 'warn' | 'error';
  tenantId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function getDebugLogs(filter: DebugLogFilter = {}): { entries: DebugLogEntry[]; total: number } {
  const all = prune().slice().reverse(); // newest first
  const { level, tenantId, search, limit = 100, offset = 0 } = filter;

  const filtered = all.filter((e) => {
    if (level && e.level !== level) return false;
    if (tenantId && e.tenantId !== tenantId) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.path.toLowerCase().includes(q) &&
        !e.id.includes(q) &&
        !(e.errorMessage ?? '').toLowerCase().includes(q) &&
        !(e.tenantId ?? '').toLowerCase().includes(q) &&
        !(e.userId ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return { entries: filtered.slice(offset, offset + limit), total: filtered.length };
}

export function clearDebugLogs(): void {
  buffer.splice(0, buffer.length);
}

export function debugLogStats(): { total: number; ok: number; warn: number; error: number } {
  const all = prune();
  return {
    total: all.length,
    ok: all.filter((e) => e.level === 'ok').length,
    warn: all.filter((e) => e.level === 'warn').length,
    error: all.filter((e) => e.level === 'error').length,
  };
}
