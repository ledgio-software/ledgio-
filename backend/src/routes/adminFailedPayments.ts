import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

/** GET /admin/failed-payments — tenants with failed or PENDING-stale Paystack requests */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // >24h PENDING = stale

    const rows = await prisma.paystackPaymentRequest.findMany({
      where: {
        OR: [
          { status: 'FAILED' },
          { status: 'PENDING', createdAt: { lt: staleCutoff } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, tenantId: true, invoiceId: true, reference: true,
        amount: true, currency: true, status: true, failureReason: true,
        createdAt: true, updatedAt: true,
        invoice: {
          select: {
            invoiceNumber: true,
            customer: { select: { name: true } },
          },
        },
      },
    });

    // Enrich with tenant names
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    // Group by tenant for the summary view
    const byTenant = new Map<string, { tenant: typeof tenants[0] | undefined; charges: typeof rows }>();
    for (const row of rows) {
      if (!byTenant.has(row.tenantId)) {
        byTenant.set(row.tenantId, { tenant: tenantMap.get(row.tenantId), charges: [] });
      }
      byTenant.get(row.tenantId)!.charges.push(row);
    }

    const data = [...byTenant.values()].map(({ tenant, charges }) => ({
      tenantId: charges[0].tenantId,
      tenantName: tenant?.name ?? charges[0].tenantId,
      tenantSlug: tenant?.slug ?? '',
      failedCount: charges.filter((c) => c.status === 'FAILED').length,
      staleCount: charges.filter((c) => c.status === 'PENDING').length,
      lastAttempt: charges[0].createdAt,
      charges,
    }));

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /admin/failed-payments/:id/retry — mark a failed request for retry (creates new one) */
router.post('/:id/retry', async (req: Request, res: Response): Promise<void> => {
  try {
    // Reset to PENDING so the Paystack webhook / reconciliation picks it up
    const updated = await prisma.paystackPaymentRequest.update({
      where: { id: req.params.id },
      data: { status: 'PENDING', failureReason: null, updatedAt: new Date() },
      select: { id: true, reference: true, status: true },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(err.code === 'P2025' ? 404 : 500).json({ success: false, error: err.message });
  }
});

export default router;
