import { Router, Request, Response } from 'express';
import { withCurrentTenantDb } from '../database/tenantClient';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';
import { encryptCredential } from '../utils/credentialEncryption';
import * as invoicePaymentService from '../services/invoicePaymentService';
import { authenticateApiKey } from '../middleware/apiKeyMiddleware';
import { requireTier } from '../middleware/tierEnforcementMiddleware';

const router = Router();

router.use(authenticateApiKey);
router.use(requireTier(2, 'External API Integration'));

/**
 * POST /api/external/v1/invoices
 * Creates one or more invoices from an external system. Customers are matched
 * by name and auto-created if not found. Supports idempotency via externalRef.
 */
router.post('/invoices', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const payload = req.body;

    // Accept single object or array
    const items: any[] = Array.isArray(payload) ? payload : [payload];

    if (items.length === 0) {
      res.status(400).json({ success: false, error: 'At least one invoice is required.' });
      return;
    }
    if (items.length > 100) {
      res.status(400).json({ success: false, error: 'Maximum 100 invoices per API call.' });
      return;
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const inv = items[i];
      try {
        if (!inv.customerName || !String(inv.customerName).trim()) throw new Error('customerName is required.');
        if (!inv.items || !Array.isArray(inv.items) || inv.items.length === 0) {
          throw new Error('items array with at least one line is required.');
        }

        const customerName = String(inv.customerName).trim();

        // Idempotency: return existing invoice if externalRef already seen
        if (inv.externalRef) {
          const existing: any = await withCurrentTenantDb(prisma, (client) =>
            (client as any).invoice.findFirst({
              where: { tenantId, clientTxnId: String(inv.externalRef) },
              include: { customer: true },
            })
          );
          if (existing) {
            results.push({ invoiceId: existing.id, invoiceNumber: existing.invoiceNumber, customer: existing.customer?.name, existing: true });
            continue;
          }
        }

        // Find or create customer
        let customer: any = await withCurrentTenantDb(prisma, (client) =>
          (client as any).customer.findFirst({
            where: { tenantId, name: { equals: customerName, mode: 'insensitive' } },
          })
        );

        if (!customer) {
          const phone = inv.customerPhone ? String(inv.customerPhone).trim() : null;
          customer = await withCurrentTenantDb(prisma, (client) =>
            (client as any).customer.create({
              data: {
                tenantId,
                name: customerName,
                email: encryptCredential(`ext-${Date.now()}-${i}@placeholder.local`),
                phone: phone ? encryptCredential(phone) : null,
                customerType: 'RETAIL',
              },
            })
          );
        }

        const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const issueDate = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(issueDate.getTime() + 30 * 86_400_000);
        const currency = inv.currency || 'GHS';

        const subtotal = inv.items.reduce((sum: number, line: any) => {
          return sum + Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100;
        }, 0);

        const result: any = await withCurrentTenantDb(prisma, (client) =>
          (client as any).invoice.create({
            data: {
              tenantId,
              invoiceNumber,
              customerId: customer.id,
              issueDate,
              dueDate,
              currency,
              subtotal,
              tax: 0,
              total: subtotal,
              status: 'SENT',
              clientTxnId: inv.externalRef ? String(inv.externalRef) : null,
              items: {
                create: inv.items.map((line: any) => ({
                  tenantId,
                  description: String(line.description || '').trim() || 'Item',
                  quantity: Number(line.quantity) || 1,
                  unitPrice: Number(line.unitPrice) || 0,
                  total: Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100,
                })),
              },
            },
          })
        );

        results.push({ invoiceId: result.id, invoiceNumber: result.invoiceNumber, customer: customerName });
      } catch (err: any) {
        errors.push({ index: i, customerName: inv.customerName, error: err.message });
      }
    }

    const success = errors.length === 0;
    res.status(success ? 201 : 207).json({
      success,
      data: { created: results, errors },
    });
  } catch (err: any) {
    console.error('[ExternalApi] Invoice error:', err);
    res.status(500).json({ success: false, error: 'Failed to process invoice request.' });
  }
});

/**
 * POST /api/external/v1/payments
 * Posts one or more payments against existing open invoices.
 * Looks up invoice by invoiceNumber, delegates to recordInvoicePayment.
 */
router.post('/payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const payload = req.body;

    const items: any[] = Array.isArray(payload) ? payload : [payload];

    if (items.length === 0) {
      res.status(400).json({ success: false, error: 'At least one payment is required.' });
      return;
    }
    if (items.length > 100) {
      res.status(400).json({ success: false, error: 'Maximum 100 payments per API call.' });
      return;
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Build a system actor for journal entries (external API calls have no JWT user)
    const actor = { userId: 'api', userEmail: 'api@external', tenantId };

    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      try {
        if (!p.invoiceNumber) throw new Error('invoiceNumber is required.');

        const invoice: any = await withCurrentTenantDb(prisma, (client) =>
          (client as any).invoice.findFirst({ where: { tenantId, invoiceNumber: String(p.invoiceNumber).trim() } })
        );

        if (!invoice) throw new Error(`Invoice "${p.invoiceNumber}" not found.`);
        if (invoice.status === 'PAID') throw new Error(`Invoice "${p.invoiceNumber}" is already fully paid.`);
        if (invoice.status === 'DRAFT') throw new Error(`Invoice "${p.invoiceNumber}" is a draft. Send it first.`);

        await invoicePaymentService.recordInvoicePayment(invoice.id, actor, {
          amount: p.amount ? Number(p.amount) : undefined,
          description: p.reference ? `Payment via API — ref: ${p.reference}` : undefined,
        });

        const updated: any = await withCurrentTenantDb(prisma, (client) =>
          (client as any).invoice.findFirst({ where: { id: invoice.id } })
        );

        results.push({
          invoiceNumber: p.invoiceNumber,
          amountPaid: updated?.amountPaid,
          status: updated?.status,
          remainingBalance: Math.round((Number(updated?.total) - Number(updated?.amountPaid)) * 100) / 100,
        });
      } catch (err: any) {
        errors.push({ index: i, invoiceNumber: p.invoiceNumber, error: err.message });
      }
    }

    const success = errors.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      data: { posted: results, errors },
    });
  } catch (err: any) {
    console.error('[ExternalApi] Payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to process payment request.' });
  }
});

export default router;
