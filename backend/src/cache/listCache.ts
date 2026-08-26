import { cacheUtils } from '../config/redis';

// Short TTL: fast lists like inventory items and customers change infrequently
// but we still want near-real-time accuracy. 2 minutes is the sweet spot —
// a new item shows up within 2 min without a manual reload, but 50 concurrent
// users on the invoice form don't each hammer the DB for the same item list.
const LIST_TTL_SECONDS = 2 * 60;

// Tax rates and accounts change very rarely — 10 minutes is safe
const LOOKUP_TTL_SECONDS = 10 * 60;

function key(tenantId: string, namespace: string, suffix: string = ''): string {
  return `list:${tenantId}:${namespace}${suffix ? ':' + suffix : ''}`;
}

export async function getCachedList<T>(tenantId: string, namespace: string, suffix?: string): Promise<T | null> {
  return cacheUtils.get<T>(key(tenantId, namespace, suffix));
}

export async function setCachedList(
  tenantId: string,
  namespace: string,
  data: unknown,
  ttl: number = LIST_TTL_SECONDS,
  suffix?: string,
): Promise<void> {
  await cacheUtils.set(key(tenantId, namespace, suffix), data, ttl);
}

export async function invalidateCachedList(tenantId: string, namespace: string): Promise<void> {
  await cacheUtils.delPattern(`list:${tenantId}:${namespace}*`);
}

export { LIST_TTL_SECONDS, LOOKUP_TTL_SECONDS };
