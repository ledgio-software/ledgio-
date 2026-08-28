import { randomUUID } from 'crypto';

export interface ErrorEntry {
  id: string;
  ts: string;
  method: string;
  path: string;         // req.originalUrl — full URL including query string
  status: number;
  error: string;
  stack?: string;
  source?: string;      // first app frame: "src/routes/invoices.ts:45:12"
  fn?: string;          // function name from that frame
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  bodyKeys?: string[];  // keys present in request body (no values — safe to log)
  count: number;        // identical error+source combos deduplicated
  lastSeen: string;     // ts of most recent occurrence when count > 1
}

/** Extract the first stack frame that points to app source code (not node_modules or Node internals). */
function parseSourceFrame(stack?: string): { source?: string; fn?: string } {
  if (!stack) return {};
  const lines = stack.split('\n');
  for (const line of lines.slice(1)) {
    const t = line.trim();
    if (!t.startsWith('at ')) continue;
    if (t.includes('node_modules') || t.includes('node:') || t.includes('(node:')) continue;
    // Matches both "at FnName (path:line:col)" and "at path:line:col"
    const withParen = t.match(/^at\s+([^\s(]+)\s+\(([^)]+)\)$/);
    const withoutParen = t.match(/^at\s+(.+:\d+:\d+)$/);
    let loc: string | undefined;
    let fn: string | undefined;
    if (withParen) {
      fn = withParen[1];
      loc = withParen[2];
    } else if (withoutParen) {
      loc = withoutParen[1];
    }
    if (loc) {
      // Shorten to relative path starting at src/
      const srcIdx = loc.indexOf('/src/');
      const distIdx = loc.indexOf('/dist/');
      const rel = srcIdx >= 0 ? loc.slice(srcIdx + 1)
                : distIdx >= 0 ? loc.slice(distIdx + 1)
                : loc;
      return { source: rel, fn: fn && fn !== 'Object.<anonymous>' ? fn : undefined };
    }
  }
  return {};
}

/** Deduplication key: same error message + same source location = same problem. */
function dedupKey(entry: Omit<ErrorEntry, 'id' | 'count' | 'lastSeen'>): string {
  return `${entry.status}::${entry.method}::${entry.error}::${entry.source ?? ''}`;
}

const MAX = 200;
const buffer: ErrorEntry[] = [];

export function recordError(entry: Omit<ErrorEntry, 'id' | 'count' | 'lastSeen' | 'source' | 'fn'>): void {
  const { source, fn } = parseSourceFrame(entry.stack);
  const full: ErrorEntry = { ...entry, id: randomUUID(), source, fn, count: 1, lastSeen: entry.ts };
  const key = dedupKey(full);

  // Deduplicate: if same error from same place appeared in last 10 min, just bump count.
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const existing = buffer.findIndex(
    (e) => dedupKey(e) === key && new Date(e.lastSeen).getTime() > tenMinutesAgo
  );
  if (existing >= 0) {
    buffer[existing].count += 1;
    buffer[existing].lastSeen = entry.ts;
    return;
  }

  if (buffer.length >= MAX) buffer.shift();
  buffer.push(full);
}

export function getErrors(): ErrorEntry[] {
  return [...buffer].reverse();
}

export interface ErrorGroup {
  key: string;
  status: number;
  method: string;
  error: string;
  source?: string;
  fn?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sample: ErrorEntry;
}

export function getErrorGroups(): ErrorGroup[] {
  const map = new Map<string, ErrorGroup>();
  for (const e of buffer) {
    const k = `${e.status}::${e.method}::${e.error}::${e.source ?? ''}`;
    const existing = map.get(k);
    if (existing) {
      existing.count += e.count;
      if (e.lastSeen > existing.lastSeen) existing.lastSeen = e.lastSeen;
      if (e.ts < existing.firstSeen) existing.firstSeen = e.ts;
    } else {
      map.set(k, {
        key: k,
        status: e.status,
        method: e.method,
        error: e.error,
        source: e.source,
        fn: e.fn,
        count: e.count,
        firstSeen: e.ts,
        lastSeen: e.lastSeen,
        sample: e,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function clearErrors(): void {
  buffer.length = 0;
}
