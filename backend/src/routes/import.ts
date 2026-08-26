import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { encryptCredential } from '../utils/credentialEncryption';
import * as accountService from '../services/accountService';
import * as journalService from '../services/journalEntryService';

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
 * CSV columns: Name, SKU, Category, Unit, CostPrice, SellingPrice, WholesalePrice, ReorderLevel
 */
router.post('/inventory-items', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'An array of inventory items is required for import.' });
      return;
    }
    if (items.length > 500) {
      res.status(400).json({ success: false, error: 'Maximum 500 items per import batch.' });
      return;
    }

    const created: any[] = [];
    const errors: any[] = [];
    const usedSkus = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !String(row.name).trim()) throw new Error('Item name is required.');
        if (!row.costprice && row.costprice !== 0) throw new Error('Cost price is required.');
        if (!row.sellingprice && row.sellingprice !== 0) throw new Error('Selling price is required.');

        let sku = row.sku ? String(row.sku).trim().toUpperCase() : '';
        if (!sku) {
          sku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        if (usedSkus.has(sku)) throw new Error(`Duplicate SKU "${sku}" in this batch.`);
        usedSkus.add(sku);

        const result = await withCurrentTenantDb(prisma, (client) =>
          (client as any).inventoryItem.create({
            data: {
              tenantId,
              name: String(row.name).trim(),
              sku,
              category: row.category || 'General',
              unitOfMeasure: row.unit || 'pcs',
              costPrice: Number(row.costprice),
              sellingPrice: Number(row.sellingprice),
              wholesalePrice: row.wholesaleprice ? Number(row.wholesaleprice) : null,
              reorderLevel: row.reorderlevel ? Number(row.reorderlevel) : null,
            },
          })
        );
        created.push(result);
      } catch (err: any) {
        errors.push({ row: i + 1, name: row.name, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      data: { importedCount: created.length, errorCount: errors.length, errors },
    });
  } catch (error: any) {
    console.error('[Import] Inventory item import error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete inventory item import.' });
  }
});

export default router;
