import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTier } from '../middleware/tierEnforcementMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { encryptCredential } from '../utils/credentialEncryption';
import * as accountService from '../services/accountService';
import * as journalService from '../services/journalEntryService';
import * as invoicePaymentService from '../services/invoicePaymentService';
import { actorFromRequest } from '../services/auditLogService';
import { invalidateCachedList } from '../cache/listCache';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * POST /api/v1/import/accounts
 * Imports array of account records into Chart of Accounts.
 * Access: Accountant role or higher.
 */
router.post('/accounts', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { accounts } = req.body;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      res.status(400).json({
        success: false,
        error: 'An array of accounts is required for import.',
      });
      return;
    }

    const createdAccounts = [];
    const errors = [];

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      try {
        const created = await accountService.createAccount({
          code: String(acc.code).trim(),
          name: String(acc.name).trim(),
          type: String(acc.type).toUpperCase() as any,
          currency: acc.currency || 'USD',
        });
        createdAccounts.push(created);
      } catch (err: any) {
        errors.push({ row: i + 1, code: acc.code, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Imported ${createdAccounts.length} accounts. ${errors.length} errors.`,
      data: {
        importedCount: createdAccounts.length,
        errorCount: errors.length,
        errors,
      },
    });
  } catch (error: any) {
    console.error('[Import] Account import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete account import.',
    });
  }
});

/**
 * POST /api/v1/import/journals
 * Imports array of journal entries.
 * Access: Accountant role or higher.
 */
router.post('/journals', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({
        success: false,
        error: 'An array of journal entries is required for import.',
      });
      return;
    }

    const createdEntries = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        const created = await journalService.createJournalEntry({
          entryDate: entry.entryDate || new Date().toISOString(),
          description: entry.description,
          lines: entry.lines.map((line: any) => ({
            accountId: line.accountId,
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            description: line.description,
          })),
        });
        createdEntries.push(created);
      } catch (err: any) {
        errors.push({ row: i + 1, description: entry.description, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Imported ${createdEntries.length} journal entries. ${errors.length} errors.`,
      data: {
        importedCount: createdEntries.length,
        errorCount: errors.length,
        errors,
      },
    });
  } catch (error: any) {
    console.error('[Import] Journal import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete journal import.',
    });
  }
});

/**
 * POST /api/v1/import/customers
 * Bulk-creates customers from CSV data.
 * CSV columns: Name, Email, Phone, Address, CreditLimit, TIN, Type
 */
router.post('/customers', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { customers } = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      res.status(400).json({ success: false, error: 'An array of customers is required for import.' });
      return;
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      try {
        if (!c.name || !String(c.name).trim()) throw new Error('Customer name is required.');

        const resolvedType = String(c.type || '').toUpperCase() === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';

        const result = await withCurrentTenantDb(prisma, (client) =>
          (client as any).customer.create({
            data: {
              tenantId,
              name: String(c.name).trim(),
              email: c.email ? encryptCredential(String(c.email).trim().toLowerCase()) : encryptCredential(`import-${Date.now()}-${i}@placeholder.local`),
              phone: c.phone ? encryptCredential(String(c.phone).trim()) : null,
              address: c.address || null,
              creditLimit: c.creditlimit ? Number(c.creditlimit) : null,
              tin: c.tin ? encryptCredential(String(c.tin).trim()) : null,
              customerType: resolvedType,
            },
          })
        );
        created.push(result);
      } catch (err: any) {
        errors.push({ row: i + 1, name: c.name, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      data: { importedCount: created.length, errorCount: errors.length, errors },
    });
  } catch (error: any) {
    console.error('[Import] Customer import error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete customer import.' });
  }
});

/**
 * POST /api/v1/import/inventory-items
 * Bulk-creates inventory items from CSV data.
 *
 * Performance: all valid rows are inserted in ONE withCurrentTenantDb call
 * using createManyAndReturn (single SQL INSERT … RETURNING), avoiding the
 * 50× BEGIN/SET LOCAL/COMMIT overhead that caused the "freeze" with the old
 * per-row loop.
 */
router.post('/inventory-items', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'An array of inventory items is required for import.' });
      return;
    }
    if (items.length > 10_000) {
      res.status(400).json({ success: false, error: 'Maximum 10,000 items per import batch.' });
      return;
    }

    // ── Phase 1: synchronous pre-validation (no DB) ──────────────────────
    type ValidRow = {
      rowNum: number;
      name: string;
      sku: string;
      category: string;
      unitOfMeasure: string;
      costPrice: number;
      sellingPrice: number;
      wholesalePrice: number | null;
      reorderLevel: number | null;
      warehouseName: string;
      initialQty: number;
      batchNumber: string;
      expiryDate: string;
    };

    const validRows: ValidRow[] = [];
    const errors: any[] = [];
    const usedSkus = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !String(row.name).trim()) throw new Error('Item name is required.');

        const costPrice = row.costprice ?? row['costPrice'];
        const sellingPrice = row.sellingprice ?? row['sellingPrice'];
        const wholesalePrice = row.wholesaleprice ?? row['wholesalePrice'];
        const reorderLevel = row.reorderlevel ?? row['reorderLevel'];
        const unitOfMeasure = (row.unit ?? row.unitofmeasure ?? row['unitOfMeasure'] ?? 'pcs') as string;
        const warehouseName: string = (row.warehousename ?? row['warehouseName'] ?? '').trim();
        const initialQty = row.initialqty ?? row['initialQty'];
        const batchNumber: string = (row.batchnumber ?? row['batchNumber'] ?? '').trim();
        const expiryDate: string = (row.expirydate ?? row['expiryDate'] ?? '').trim();

        if (costPrice === undefined || costPrice === null || costPrice === '') throw new Error('Cost price is required.');
        if (sellingPrice === undefined || sellingPrice === null || sellingPrice === '') throw new Error('Selling price is required.');

        let sku = row.sku ? String(row.sku).trim().toUpperCase() : '';
        if (!sku) {
          sku = `SKU-${Date.now().toString(36).toUpperCase()}-${i}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        if (usedSkus.has(sku)) throw new Error(`Duplicate SKU "${sku}" in this batch.`);
        usedSkus.add(sku);

        validRows.push({
          rowNum: i + 1,
          name: String(row.name).trim(),
          sku,
          category: row.category || 'General',
          unitOfMeasure,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
          reorderLevel: reorderLevel ? Number(reorderLevel) : null,
          warehouseName,
          initialQty: initialQty && Number(initialQty) > 0 ? Number(initialQty) : 0,
          batchNumber,
          expiryDate,
        });
      } catch (err: any) {
        errors.push({ row: i + 1, name: row.name, error: err.message });
      }
    }

    if (validRows.length === 0) {
      res.status(200).json({ success: true, data: { importedCount: 0, errorCount: errors.length, errors } });
      return;
    }

    // ── Phase 2: single DB session — resolve warehouses + bulk insert ────
    let importedCount = 0;
    let skippedDuplicates = 0;

    await withCurrentTenantDb(prisma, async (client) => {
      // Resolve all unique warehouse names in one pass
      const uniqueWarehouseNames = [...new Set(validRows.map(r => r.warehouseName).filter(Boolean))];
      const warehouseMap = new Map<string, string>();
      for (const wname of uniqueWarehouseNames) {
        const wh = await (client as any).warehouse.findFirst({ where: { tenantId, name: wname } });
        if (wh) warehouseMap.set(wname, (wh as any).id);
      }

      // Filter out rows where warehouse wasn't found
      const okRows: ValidRow[] = [];
      for (const row of validRows) {
        if (row.warehouseName && !warehouseMap.has(row.warehouseName)) {
          errors.push({ row: row.rowNum, name: row.name, error: `Warehouse "${row.warehouseName}" not found. Create it first.` });
        } else {
          okRows.push(row);
        }
      }

      if (okRows.length === 0) return;

      // createManyAndReturn: one SQL INSERT … RETURNING for all rows
      const created: any[] = await (client as any).inventoryItem.createManyAndReturn({
        data: okRows.map(r => ({
          tenantId,
          name: r.name,
          sku: r.sku,
          category: r.category,
          unitOfMeasure: r.unitOfMeasure,
          costPrice: r.costPrice,
          sellingPrice: r.sellingPrice,
          wholesalePrice: r.wholesalePrice,
          reorderLevel: r.reorderLevel,
          requiresBatchTracking: !!r.batchNumber,
        })),
        skipDuplicates: true,
      });

      importedCount = created.length;
      skippedDuplicates = okRows.length - created.length;

      // Build warehouse stock rows for items that actually got inserted
      const skuToCreated = new Map(created.map((c: any) => [c.sku, c]));
      const stockData = okRows
        .filter(r => r.warehouseName && r.initialQty > 0 && skuToCreated.has(r.sku))
        .map(r => ({
          tenantId,
          warehouseId: warehouseMap.get(r.warehouseName)!,
          itemId: skuToCreated.get(r.sku)!.id,
          quantityOnHand: r.initialQty,
        }));

      if (stockData.length > 0) {
        await (client as any).warehouseStock.createMany({ data: stockData, skipDuplicates: true });
      }

      // Create InventoryBatch records for pharmacy rows that supplied a batch number
      const batchData = okRows
        .filter(r => r.batchNumber && r.warehouseName && r.initialQty > 0 && skuToCreated.has(r.sku))
        .map(r => ({
          tenantId,
          itemId: skuToCreated.get(r.sku)!.id,
          warehouseId: warehouseMap.get(r.warehouseName)!,
          batchNumber: r.batchNumber,
          expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
          quantityOnHand: r.initialQty,
          costPrice: r.costPrice,
        }));

      if (batchData.length > 0) {
        await (client as any).inventoryBatch.createMany({ data: batchData, skipDuplicates: true });
      }
    });

    if (skippedDuplicates > 0) {
      errors.push({ row: 0, name: '(multiple)', error: `${skippedDuplicates} item(s) skipped — SKU already exists in this tenant.` });
    }

    if (importedCount > 0) {
      invalidateCachedList(tenantId, 'inventory-items').catch(() => {});
    }
    res.status(200).json({
      success: true,
      data: { importedCount, errorCount: errors.length, errors },
    });
  } catch (error: any) {
    console.error('[Import] Inventory item import error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete inventory item import.' });
  }
});

/**
 * POST /api/v1/import/invoices
 * Bulk-creates invoices from CSV data. Customers are matched by name
 * (case-insensitive) and auto-created if not found.
 * Access: Accountant role or higher.
 */
router.post('/invoices', requireRole('Accountant'), requireTier(2, 'Bulk Invoice Import'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { invoices } = req.body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      res.status(400).json({ success: false, error: 'An array of invoices is required for import.' });
      return;
    }
    if (invoices.length > 5_000) {
      res.status(400).json({ success: false, error: 'Maximum 5,000 invoices per import batch.' });
      return;
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      try {
        if (!inv.customerName || !String(inv.customerName).trim()) throw new Error('customerName is required.');
        if (!inv.description || !String(inv.description).trim()) throw new Error('description is required.');
        const qty = Number(inv.quantity);
        if (!qty || qty <= 0) throw new Error('quantity must be a positive number.');
        const price = Number(inv.unitPrice);
        if (isNaN(price) || price < 0) throw new Error('unitPrice must be a non-negative number.');

        const customerName = String(inv.customerName).trim();

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
                email: encryptCredential(`import-${Date.now()}-${i}@placeholder.local`),
                phone: phone ? encryptCredential(phone) : null,
                customerType: 'RETAIL',
              },
            })
          );
        }

        const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const subtotal = Math.round(qty * price * 100) / 100;
        const issueDate = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(issueDate.getTime() + 30 * 86_400_000);
        const currency = inv.currency || 'GHS';

        const result = await withCurrentTenantDb(prisma, (client) =>
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
              items: {
                create: [{
                  tenantId,
                  description: String(inv.description).trim(),
                  quantity: qty,
                  unitPrice: price,
                  total: subtotal,
                }],
              },
            },
          })
        );
        created.push(result);
      } catch (err: any) {
        errors.push({ row: i + 1, name: inv.customerName, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      data: { importedCount: created.length, errorCount: errors.length, errors },
    });
  } catch (error: any) {
    console.error('[Import] Invoice import error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete invoice import.' });
  }
});

/**
 * POST /api/v1/import/payments
 * Bulk-posts payments against existing open invoices by invoice number.
 * Calls the existing recordInvoicePayment service to ensure proper journal
 * entry posting, balance updates, and status transitions.
 * Access: Accountant role or higher.
 */
router.post('/payments', requireRole('Accountant'), requireTier(2, 'Bulk Payment Import'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const actor = actorFromRequest(req);
    const { payments } = req.body;

    if (!Array.isArray(payments) || payments.length === 0) {
      res.status(400).json({ success: false, error: 'An array of payments is required for import.' });
      return;
    }
    if (payments.length > 5_000) {
      res.status(400).json({ success: false, error: 'Maximum 5,000 payments per import batch.' });
      return;
    }

    let importedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      try {
        if (!p.invoiceNumber || !String(p.invoiceNumber).trim()) throw new Error('invoiceNumber is required.');

        const invoiceNumber = String(p.invoiceNumber).trim();

        const invoice: any = await withCurrentTenantDb(prisma, (client) =>
          (client as any).invoice.findFirst({ where: { tenantId, invoiceNumber } })
        );

        if (!invoice) throw new Error(`Invoice "${invoiceNumber}" not found.`);
        if (invoice.status === 'PAID') throw new Error(`Invoice "${invoiceNumber}" is already fully paid.`);
        if (invoice.status === 'DRAFT') throw new Error(`Invoice "${invoiceNumber}" is in DRAFT — send it first.`);

        await invoicePaymentService.recordInvoicePayment(invoice.id, actor, {
          amount: p.amount ? Number(p.amount) : undefined,
          description: p.reference ? `Bulk import payment — ref: ${p.reference}` : undefined,
        });

        importedCount++;
      } catch (err: any) {
        errors.push({ row: i + 1, invoiceNumber: p.invoiceNumber, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      data: { importedCount, errorCount: errors.length, errors },
    });
  } catch (error: any) {
    console.error('[Import] Payment import error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete payment import.' });
  }
});

export default router;
