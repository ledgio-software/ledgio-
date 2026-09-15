import { cacheUtils, redis } from '../config/redis';

function revokedTokenKey(tokenHash: string): string {
  return `revoked:token:${tokenHash}`;
}

function credentialVersionKey(userId: string): string {
  return `user_cred_version:${userId}`;
}

// How long to keep a user's credential version in Redis after we bump it.
// Should be at least as long as the longest-lived JWT (currently 24 h = 86400 s).
const CRED_VERSION_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Marks a specific token (by its hash) as revoked until it would have
 * naturally expired anyway - the Redis key self-expires at that point,
 * so this never grows unbounded.
 */
export async function revokeToken(tokenHash: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  await cacheUtils.set(revokedTokenKey(tokenHash), true, ttlSeconds);
}

/**
 * Checks whether a token (by its hash) has been revoked. Fails open (returns
 * false) on a Redis error, matching this codebase's established fail-open
 * behavior for caching/rate-limiting - a Redis outage must not take down
 * authentication entirely. cacheUtils.get() already logs the underlying error.
 */
export async function isTokenRevoked(tokenHash: string): Promise<boolean> {
  const revoked = await cacheUtils.get<boolean>(revokedTokenKey(tokenHash));
  return revoked === true;
}

/**
 * Returns the current credential version for a user. A mismatch between this
 * value and the version embedded in a JWT means the token was issued before
 * a credential-changing event (password reset, role change, deletion) and
 * must be rejected. Returns 0 when no version is stored (token predates this
 * feature — treated as unversioned and allowed through).
 */
export async function getCredentialVersion(userId: string): Promise<number> {
  try {
    const val = await redis.get(credentialVersionKey(userId));
    return val ? parseInt(val, 10) : 0;
  } catch {
    // Redis unavailable — fail open; individual-token revocation still works.
    return 0;
  }
}

/**
 * Increments the credential version for a user, instantly invalidating all
 * JWTs previously issued for them. Call this on:
 * - Admin-initiated password reset
 * - Role change
 * - Member deletion
 * - Future: self-service password change
 *
 * Uses Redis INCR so concurrent calls are safe. The TTL is extended to 7 days
 * on each bump so the key outlives any outstanding JWT.
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  try {
    await redis.incr(credentialVersionKey(userId));
    await redis.expire(credentialVersionKey(userId), CRED_VERSION_TTL);
  } catch {
    // Redis unavailable — log but continue; the password/role change still
    // persists in the DB; the user's old JWT will be invalid once they try
    // to use an action gated on the updated role/password anyway.
  }
}
