import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import * as accountRepository from '../repository/accountRepository';
import { getCurrentSequence, getChangesSince, pruneChangesBefore } from '../services/syncChangeLogService';
import { requireRole } from '../middleware/rbacMiddleware';
import { redis } from '../config/redis';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/sync/bootstrap
 * Full current-state snapshot of every syncable entity (local-first sync
 * pilot: Chart of Accounts + Invoices - see STATUS.md), for a device's first
 * login or a from-scratch resync. Pairs with GET /sync/changes for ongoing
 * catch-up so a client never has to re-fetch everything on every login.
 */
router.get('/bootstrap', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const { accounts, invoices, customers, inventoryItems, sequence } = await withCurrentTenantDb(prisma, async (client) => {
      const [accountRows, invoiceRows, customerRows, itemRows, seq] = await Promise.all([
        accountRepository.listAccounts(client),
        (client as any).invoice.findMany({
          where: { tenantId },
          // customer is omitted here — the full customers list is already returned
          // separately below, so clients join by customerId to avoid a redundant JOIN
          // on every invoice row (previously doubled round-trip cost for large sets).
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        }),
        (client as any).customer.findMany({
          where: { tenantId },
          select: { id: true, name: true, customerType: true, creditLimit: true },
          orderBy: { name: 'asc' },
        }),
        (client as any).inventoryItem.findMany({
          where: { tenantId },
          select: { id: true, sku: true, name: true, sellingPrice: true, wholesalePrice: true, reorderLevel: true },
          orderBy: { name: 'asc' },
        }),
        getCurrentSequence(client, tenantId),
      ]);
      return { accounts: accountRows, invoices: invoiceRows, customers: customerRows, inventoryItems: itemRows, sequence: seq };
    });

    res.status(200).json({
      success: true,
      data: {
        sequence: sequence.toString(),
        accounts,
        invoices,
        customers,
        inventoryItems,
      },
    });
  } catch (error: any) {
    console.error('[Sync] Error building bootstrap snapshot:', error);
    res.status(500).json({ success: false, error: 'Failed to build sync bootstrap snapshot.' });
  }
});

/**
 * GET /api/v1/sync/changes?since=<sequence>[&limit=<n>]
 * Everything appended to this tenant's change log after `since`, oldest
 * first. `limit` caps the page size (1–2000, default 500). When `hasMore`
 * is true the caller should advance `since` to the last returned sequence
 * and repeat until `hasMore` is false.
 */
router.get('/changes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '0';
    if (!/^\d+$/.test(sinceRaw)) {
      res.status(400).json({ success: false, error: '"since" must be a non-negative integer sequence number.' });
      return;
    }
    const since = BigInt(sinceRaw);

    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '500';
    if (!/^\d+$/.test(limitRaw)) {
      res.status(400).json({ success: false, error: '"limit" must be a positive integer.' });
      return;
    }
    const limitNum = Math.min(Math.max(parseInt(limitRaw, 10) || 500, 1), 2000);

    // Fetch one extra row to detect whether a next page exists without a
    // separate COUNT query.
    const allRows = await withCurrentTenantDb(prisma, async (client) => {
      return getChangesSince(client, tenantId, since, limitNum + 1);
    });

    const hasMore = allRows.length > limitNum;
    const changes = hasMore ? allRows.slice(0, limitNum) : allRows;
    const newSequence = changes.length > 0 ? changes[changes.length - 1].sequence : sinceRaw;

    res.status(200).json({
      success: true,
      data: {
        sequence: newSequence,
        hasMore,
        changes,
      },
    });
  } catch (error: any) {
    console.error('[Sync] Error fetching changes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sync changes.' });
  }
});

/**
 * DELETE /api/v1/sync/prune?beforeSequence=<n>
 * Removes change-log entries with sequence < beforeSequence for this tenant.
 * Admin-only: a prune cannot be undone and permanently removes catch-up data
 * for any client that hasn't yet applied those entries. Operators should only
 * prune after verifying all clients are caught up to at least beforeSequence.
 */
router.delete('/prune', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const beforeRaw = typeof req.query.beforeSequence === 'string' ? req.query.beforeSequence : '';
    if (!beforeRaw || !/^\d+$/.test(beforeRaw)) {
      res.status(400).json({ success: false, error: '"beforeSequence" must be a non-negative integer sequence number.' });
      return;
    }
    const beforeSequence = BigInt(beforeRaw);

    const deleted = await withCurrentTenantDb(prisma, async (client) => {
      return pruneChangesBefore(client, tenantId, beforeSequence);
    });

    res.status(200).json({ success: true, data: { deleted } });
  } catch (error: any) {
    console.error('[Sync] Error pruning change log:', error);
    res.status(500).json({ success: false, error: 'Failed to prune sync change log.' });
  }
});

/**
 * GET /api/v1/sync/failures
 * Paginated list of sync outbox failures for the active tenant.
 * Supports optional filters: entityType (substring), operationKind (substring),
 * userId (exact), dateFrom/dateTo (YYYY-MM-DD, inclusive).
 * Access: Admin or Auditor role.
 */
const FAILURES_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

router.get('/failures', requireRole('Auditor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { limit = '50', page = '1', entityType, operationKind, userId, dateFrom, dateTo } = req.query;

    const take = Math.min(parseInt(limit as string, 10) || 50, 200);
    const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

    if (dateFrom && !FAILURES_DATE_FORMAT.test(String(dateFrom))) {
      res.status(400).json({ success: false, error: 'Invalid dateFrom format. Expected YYYY-MM-DD.' });
      return;
    }
    if (dateTo && !FAILURES_DATE_FORMAT.test(String(dateTo))) {
      res.status(400).json({ success: false, error: 'Invalid dateTo format. Expected YYYY-MM-DD.' });
      return;
    }

    const where: Record<string, any> = { tenantId };
    if (entityType) where.entityType = { contains: String(entityType), mode: 'insensitive' };
    if (operationKind) where.operationKind = { contains: String(operationKind), mode: 'insensitive' };
    if (userId) where.userId = String(userId);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const [failures, total] = await withCurrentTenantDb(prisma, (client) =>
      Promise.all([
        (client as any).syncFailureLog.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
        (client as any).syncFailureLog.count({ where }),
      ])
    );

    res.status(200).json({
      success: true,
      data: {
        failures,
        pagination: {
          total,
          page: Math.max(parseInt(page as string, 10) || 1, 1),
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error: any) {
    console.error('[Sync] Error fetching sync failure logs:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve sync failure logs.' });
  }
});

/**
 * POST /api/v1/sync/failures
 * Records a client-side sync outbox failure so operators can audit what went
 * wrong on which device. Accepts the failure metadata from the frontend's
 * markEntityFailed path; intentionally fire-and-forget from the client's
 * perspective (a 5xx here must never surface to the user).
 */
router.post('/failures', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const user = (req as any).user;
    const {
      entityType,
      entityId,
      operationKind,
      clientTxnId,
      failureReason,
      httpStatus,
    } = req.body || {};

    if (!entityType || !operationKind) {
      res.status(400).json({ success: false, error: 'entityType and operationKind are required.' });
      return;
    }

    await withCurrentTenantDb(prisma, (client) =>
      (client as any).syncFailureLog.create({
        data: {
          tenantId,
          userId: user?.id ?? null,
          entityType: String(entityType),
          entityId: entityId ? String(entityId) : null,
          operationKind: String(operationKind),
          clientTxnId: clientTxnId ? String(clientTxnId) : null,
          failureReason: failureReason ? String(failureReason).slice(0, 2000) : null,
          httpStatus: typeof httpStatus === 'number' ? httpStatus : null,
        },
      })
    );

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[Sync] Error recording sync failure log:', error);
    res.status(500).json({ success: false, error: 'Failed to record sync failure.' });
  }
});

/**
 * POST /api/v1/sync/ticket
 * Exchanges a valid JWT session for a 30-second single-use WebSocket ticket.
 * The ticket goes in the WS URL (?ticket=...) instead of the raw JWT, keeping
 * bearer tokens out of server/proxy access logs.
 */
router.post('/ticket', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const user = (req as any).user;
    const ticket = crypto.randomBytes(24).toString('hex');
    try {
      await redis.setex(`ws-ticket:${ticket}`, 30, JSON.stringify({
        tenantId,
        userId: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
      }));
    } catch (redisErr: any) {
      // Redis unavailable — ticket cannot be stored, so WS auth would fail anyway.
      // Return 503 so the client knows this is a transient infrastructure issue
      // rather than a bug (avoids misleading 500 in error-rate metrics).
      console.error('[Sync] Redis unavailable when issuing WebSocket ticket:', redisErr);
      res.status(503).json({ success: false, error: 'Real-time service temporarily unavailable. Please try again shortly.' });
      return;
    }
    res.json({ success: true, data: { ticket } });
  } catch (error: any) {
    console.error('[Sync] Error issuing WebSocket ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to issue WebSocket ticket.' });
  }
});

export default router;
