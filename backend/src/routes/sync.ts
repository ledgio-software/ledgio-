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
          include: { customer: true, items: true },
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
    await redis.setex(`ws-ticket:${ticket}`, 30, JSON.stringify({
      tenantId,
      userId: user?.id,
      name: user?.name,
      email: user?.email,
      role: user?.role,
    }));
    res.json({ success: true, data: { ticket } });
  } catch (error: any) {
    console.error('[Sync] Error issuing WebSocket ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to issue WebSocket ticket.' });
  }
});

export default router;
