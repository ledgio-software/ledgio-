import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import {
  getCachedNotifications,
  setCachedNotifications,
  invalidateNotificationCache,
  invalidateAllNotificationCaches,
} from '../cache/notificationCache';

// In-process fallback cache so notification polls are fast even when Redis is unavailable.
// TTL is 30 s — matches the frontend poll interval with a comfortable buffer.
const MEM_TTL_MS = 300_000; // 5 minutes; write-path invalidation handles freshness
const memCache = new Map<string, { data: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data as T;
}
function memSet(key: string, data: unknown): void {
  memCache.set(key, { data, expiresAt: Date.now() + MEM_TTL_MS });
}
function memDel(key: string): void {
  memCache.delete(key);
}
function memDelPattern(prefix: string): void {
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
}

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/notifications
 * Fetches notifications for the active user/tenant.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const userId = (req as any).user?.id;
    const cacheKey = `notif:${tenantId}:${userId}`;

    type NotifPayload = { notifications: any[]; unreadCount: number };

    // 1. Try in-process cache first — zero latency, avoids Redis round-trip on every poll
    const memCached = memGet<NotifPayload>(cacheKey);
    if (memCached) {
      res.status(200).json({ success: true, data: memCached });
      return;
    }

    // 2. Try Redis (shared across instances; warm mem cache on hit)
    const redisCached = await getCachedNotifications<NotifPayload>(tenantId, userId);
    if (redisCached) {
      memSet(cacheKey, redisCached);
      res.status(200).json({ success: true, data: redisCached });
      return;
    }

    // 3. DB query — only on cache miss (Notification is a public-schema model; no withCurrentTenantDb needed)
    const notifications = await (prisma as any).notification.findMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const unreadCount = notifications.filter((n: any) => !n.read).length;
    const payload: NotifPayload = { notifications, unreadCount };

    void setCachedNotifications(tenantId, userId, payload);
    memSet(cacheKey, payload);
    res.status(200).json({ success: true, data: payload });
  } catch (error: any) {
    console.error('[Notifications] Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
  }
});

/**
 * POST /api/v1/notifications
 * Creates a notification.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { title, message, type = 'SYSTEM', link, userId } = req.body;

    if (!title || !message) {
      res.status(400).json({ success: false, error: 'Title and message are required.' });
      return;
    }

    const created = await (prisma as any).notification.create({
      data: {
        tenantId,
        title,
        message,
        type,
        link,
        userId: userId || null,
      },
    });

    // Broadcast notification: wipe all per-user caches for this tenant
    void invalidateAllNotificationCaches(tenantId);
    memDelPattern(`notif:${tenantId}:`);
    res.status(201).json({ success: true, message: 'Notification created', data: { notification: created } });
  } catch (error: any) {
    console.error('[Notifications] Error creating notification:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification.' });
  }
});

/**
 * PUT /api/v1/notifications/:id/read
 * Marks a single notification as read.
 */
router.put('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const existing = await (prisma as any).notification.findFirst({
      where: { id, tenantId, OR: [{ userId: null }, { userId }] },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }
    const updated = await (prisma as any).notification.update({
      where: { id },
      data: { read: true },
    });

    void invalidateNotificationCache(tenantId, userId);
    memDel(`notif:${tenantId}:${userId}`);
    res.status(200).json({ success: true, data: { notification: updated } });
  } catch (error: any) {
    console.error('[Notifications] Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification.' });
  }
});

/**
 * PUT /api/v1/notifications/read-all
 * Marks all notifications as read.
 */
router.put('/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const userId = (req as any).user?.id;

    await (prisma as any).notification.updateMany({
      where: {
        tenantId,
        read: false,
        OR: [{ userId: null }, { userId }],
      },
      data: { read: true },
    });

    void invalidateNotificationCache(tenantId, userId);
    memDel(`notif:${tenantId}:${userId}`);
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('[Notifications] Error marking all as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read.' });
  }
});

export default router;
