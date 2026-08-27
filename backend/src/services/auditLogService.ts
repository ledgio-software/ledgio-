import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db';
import { getTenantContext } from '../context/tenantContext';
import { logger } from '../utils/logger';

export interface AuditActor {
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
}

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export interface RecordAuditLogInput {
  action: string;
  entity: string;
  entityId?: string | null;
  tenantId?: string | null;
  actor?: AuditActor;
  changes?: AuditChanges | null;
  details?: string | null;
}

/**
 * Computes the next hash in the audit log chain.
 * Input: SHA-256(prevHash + action + entityId + createdAtISO)
 * The first row for a tenant seeds with SHA-256('GENESIS').
 */
function computeAuditHash(prevHash: string, action: string, entityId: string | null, createdAt: Date): string {
  return createHash('sha256')
    .update(prevHash + action + (entityId ?? '') + createdAt.toISOString())
    .digest('hex');
}

async function getLastAuditHash(tenantId: string | null): Promise<string> {
  try {
    const last = await prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { prevHash: true, action: true, entityId: true, createdAt: true },
    });
    if (!last) return createHash('sha256').update('GENESIS').digest('hex');
    // The stored prevHash on the last row is the hash of the row before it.
    // We re-derive the last row's own hash to chain from it.
    return computeAuditHash(last.prevHash ?? createHash('sha256').update('GENESIS').digest('hex'), last.action, last.entityId, last.createdAt);
  } catch {
    return createHash('sha256').update('GENESIS').digest('hex');
  }
}

/**
 * Single write path for AuditLog rows. Never throws - a failed audit write
 * must not fail or roll back the business operation it describes - but logs
 * loudly instead of swallowing silently, so a systemic failure is visible.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    const tenantId = input.tenantId ?? getTenantContext()?.tenantId ?? null;
    const prevHash = await getLastAuditHash(tenantId);
    const now = new Date();
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        details: input.details ?? null,
        userId: input.actor?.userId ?? null,
        userEmail: input.actor?.userEmail ?? null,
        ipAddress: input.actor?.ipAddress ?? null,
        changes: (input.changes ?? undefined) as any,
        prevHash,
        createdAt: now,
      },
    });
  } catch (err: any) {
    logger.error('[AuditLogService] Failed to write audit log entry', {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      error: err?.message,
      stack: err?.stack,
    });
  }
}

/**
 * Transactional write path for AuditLog rows, for security-critical mutations
 * (ledger entries, vouchers, masters) where the audit entry must never be able
 * to drift out of sync with the data change it describes. Pass the same
 * `client` the caller is already using inside `withTenantDb`/`withCurrentTenantDb`
 * (its transaction-scoped `SET LOCAL search_path` still resolves `audit_logs`
 * via the `public` fallback) so this insert commits or rolls back atomically
 * with the business write. Unlike `recordAuditLog`, this throws on failure -
 * that's the point: a failed audit write must abort the whole transaction
 * rather than let an unaudited change land.
 */
export async function recordAuditLogTx(
  client: Pick<PrismaClient, 'auditLog'>,
  input: RecordAuditLogInput
): Promise<void> {
  const tenantId = input.tenantId ?? getTenantContext()?.tenantId ?? null;
  // Best-effort hash chain inside a transaction; if fetching the last hash fails
  // (e.g. concurrent inserts), we fall back to GENESIS rather than aborting the tx.
  const prevHash = await getLastAuditHash(tenantId);
  const now = new Date();
  await client.auditLog.create({
    data: {
      tenantId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
      userId: input.actor?.userId ?? null,
      userEmail: input.actor?.userEmail ?? null,
      ipAddress: input.actor?.ipAddress ?? null,
      changes: (input.changes ?? undefined) as any,
      prevHash,
      createdAt: now,
    },
  });
}

/** Extracts actor identity (who/from-where) from an authenticated request. */
export function actorFromRequest(req: Request): AuditActor {
  return {
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? null,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
  };
}

/** Builds a { field: {from, to} } diff, including only fields that actually changed. */
export function diffFields<T extends Record<string, any>>(
  before: T | null | undefined,
  after: T | null | undefined,
  fields: string[]
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (from !== to) {
      changes[field] = { from, to };
    }
  }
  return changes;
}
