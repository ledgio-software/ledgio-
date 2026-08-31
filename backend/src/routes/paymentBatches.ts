import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { withCurrentTenantDb } from '../database/tenantClient';
import { recordInvoicePayment } from '../services/invoicePaymentService';
import { payVendorBill } from '../services/vendorBillPaymentService';
import { recordAuditLogTx, AuditActor } from '../services/auditLogService';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);
router.use(requireTier(2, 'Payment Matching'));

const allocationSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  vendorBillId: z.string().uuid().optional(),
  amount: z.number().positive(),
});

const createSchema = z.object({
  batchType: z.enum(['CUSTOMER', 'VENDOR']),
  entityId: z.string().uuid(),
  currency: z.string().default('USD'),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(allocationSchema).min(1),
});

function actorFromReq(req: any): AuditActor {
  return { userId: req.user?.id, userEmail: req.user?.email };
}

async function nextBatchNumber(tenantId: string): Promise<string> {
  const last = await (prisma as any).paymentBatch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { batchNumber: true },
  });
  if (!last) return 'PMT-0001';
  const num = parseInt(last.batchNumber.replace(/\D/g, ''), 10) || 0;
  return `PMT-${String(num + 1).padStart(4, '0')}`;
}

// GET /payment-batches — list all batches
router.get('/', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  try {
    const { batchType, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const where: any = { tenantId };
    if (batchType) where.batchType = batchType;

    const [batches, total] = await Promise.all([
      (prisma as any).paymentBatch.findMany({
        where,
        include: { allocations: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      (prisma as any).paymentBatch.count({ where }),
    ]);

    res.json({ batches, pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /payment-batches/outstanding-invoices?customerId=
router.get('/outstanding-invoices', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  const { customerId } = req.query as Record<string, string>;
  try {
    const invoices = await withCurrentTenantDb(prisma, async (client) =>
      (client as any).invoice.findMany({
        where: {
          tenantId,
          ...(customerId ? { customerId } : {}),
          status: { in: ['SENT', 'PARTIALLY_PAID'] },
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { issueDate: 'asc' },
        take: 200,
      })
    );
    res.json(invoices.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      customerId: inv.customerId,
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balance: Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100,
      currency: inv.currency,
      dueDate: inv.dueDate,
      status: inv.status,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /payment-batches/outstanding-bills?vendorId=
router.get('/outstanding-bills', requireRole('Viewer'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  const { vendorId } = req.query as Record<string, string>;
  try {
    const bills = await withCurrentTenantDb(prisma, async (client) =>
      (client as any).vendorBill.findMany({
        where: {
          tenantId,
          ...(vendorId ? { vendorId } : {}),
          status: 'UNPAID',
        },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { billDate: 'asc' },
        take: 200,
      })
    );
    res.json((bills as any[]).map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      vendorName: (b as any).vendor.name,
      vendorId: b.vendorId,
      amount: Number(b.amount),
      balance: Number(b.amount),
      currency: b.currency,
      dueDate: b.dueDate,
      status: b.status,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /payment-batches — create a payment batch and apply allocations
router.post('/', requireRole('Accountant'), async (req, res) => {
  const { tenantId } = requireTenantContext();
  const actor = actorFromReq(req);
  try {
    const body = createSchema.parse(req.body);
    const batchNumber = await nextBatchNumber(tenantId);

    const errors: string[] = [];
    const results: any[] = [];

    for (const alloc of body.allocations) {
      if (body.batchType === 'CUSTOMER' && alloc.invoiceId) {
        try {
          const updated = await recordInvoicePayment(alloc.invoiceId, actor, { amount: alloc.amount });
          results.push({ invoiceId: alloc.invoiceId, amount: alloc.amount, invoiceNumber: updated.invoiceNumber });
        } catch (e: any) {
          errors.push(`Invoice ${alloc.invoiceId}: ${e.message}`);
        }
      } else if (body.batchType === 'VENDOR' && alloc.vendorBillId) {
        try {
          await payVendorBill(tenantId, alloc.vendorBillId, actor);
          results.push({ vendorBillId: alloc.vendorBillId, amount: alloc.amount });
        } catch (e: any) {
          errors.push(`Bill ${alloc.vendorBillId}: ${e.message}`);
        }
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({ error: 'All allocations failed.', details: errors });
    }

    const batch = await (prisma as any).paymentBatch.create({
      data: {
        tenantId,
        batchNumber,
        batchType: body.batchType,
        entityId: body.entityId,
        currency: body.currency,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        notes: body.notes,
        allocations: {
          create: body.allocations.map((a) => ({
            tenantId,
            invoiceId: a.invoiceId,
            vendorBillId: a.vendorBillId,
            allocatedAmount: a.amount,
          })),
        },
      },
      include: { allocations: true },
    });

    await withCurrentTenantDb(prisma, (client) =>
      recordAuditLogTx(client, {
        action: 'PAYMENT_BATCH.CREATED',
        entity: 'PaymentBatch',
        entityId: batch.id,
        actor,
        details: `Payment batch ${batchNumber} (${body.batchType}) created with ${results.length} allocation(s).`,
      })
    );

    res.status(201).json({ batch, results, errors: errors.length > 0 ? errors : undefined });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    res.status(500).json({ error: err.message });
  }
});

export default router;
