import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { validateBody } from '../middleware/validateBody';
import { requireTenantContext } from '../context/tenantContext';
import { assertWarehouseAccess, getAccessibleWarehouseIds, WarehouseAccessError } from '../services/warehouseAccessService';
import { recordAuditLog, recordAuditLogTx, actorFromRequest } from '../services/auditLogService';
import { applyStockAdjustment } from '../services/stockAdjustmentService';
import { generateStockTakeSheetPdf } from '../services/pdfGenerationService';
import { checkAndAlertLowStock } from '../services/lowStockAlertService';
import { getCachedList, setCachedList, invalidateCachedList } from '../cache/listCache';

const createItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200),
  sku: z.string().max(100).optional(),
  category: z.string().max(100).default('General'),
  unitOfMeasure: z.string().max(50).default('pcs'),
  secondaryUnitOfMeasure: z.string().max(50).optional().nullable(),
  conversionFactor: z.union([z.number().positive(), z.string().transform(Number)]).optional().nullable(),
  costPrice: z.union([z.number().nonnegative('Cost price must be ≥ 0'), z.string().transform(Number)]),
  sellingPrice: z.union([z.number().nonnegative('Selling price must be ≥ 0'), z.string().transform(Number)]),
  wholesalePrice: z.union([z.number().nonnegative(), z.string().transform(Number)]).optional().nullable(),
  initialWarehouseId: z.string().uuid().optional().nullable(),
  initialQty: z.union([z.number().nonnegative(), z.string().transform(Number)]).default(0),
  reorderLevel: z.union([z.number().int().nonnegative(), z.string().transform(Number)]).default(10),
  preferredVendorId: z.string().uuid().optional().nullable(),
  regulatoryCategory: z.string().optional(),
  requiresBatchTracking: z.boolean().default(false),
  trackSerials: z.boolean().default(false),
});

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/inventory/warehouses
 * Lists all warehouses / godowns with stock counts.
 */
router.get('/warehouses', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const warehouses = await withCurrentTenantDb(prisma, async (client) => {
      const accessibleIds = await getAccessibleWarehouseIds(client, tenantId, req.user!.id, req.user!.role);
      const where: any = { tenantId };
      if (accessibleIds !== null) where.id = { in: accessibleIds };

      return (client as any).warehouse.findMany({
        where,
        include: { stocks: { include: { item: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    res.status(200).json({ success: true, data: { warehouses } });
  } catch (error: any) {
    console.error('[Inventory] Error fetching warehouses:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve warehouses.' });
  }
});

/**
 * POST /api/v1/inventory/warehouses
 * Creates a new warehouse / godown.
 */
router.post('/warehouses', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, location, managerName, isPrimary } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Warehouse name is required.' });
      return;
    }

    const code = `WH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = await withCurrentTenantDb(prisma, async (client) => {
      const created = await (client as any).warehouse.create({
        data: {
          tenantId,
          name: name.trim(),
          code,
          location: location ? location.trim() : null,
          managerName: managerName ? managerName.trim() : null,
          isPrimary: Boolean(isPrimary),
        },
      });

      await recordAuditLogTx(client, {
        action: 'WAREHOUSE.CREATED',
        entity: 'Warehouse',
        entityId: created.id,
        actor: actorFromRequest(req),
        details: `Warehouse/shop "${created.name}" created.`,
      });

      return created;
    });

    res.status(201).json({ success: true, message: 'Warehouse created successfully', data: { warehouse: created } });
  } catch (error: any) {
    console.error('[Inventory] Error creating warehouse:', error);
    res.status(500).json({ success: false, error: 'Failed to create warehouse.' });
  }
});

/**
 * GET /api/v1/inventory/warehouses/:id/stock-sheet.pdf
 * Generates a blind physical stock-count sheet for a single warehouse - no
 * system quantities shown, just a blank "Counted Qty" column to fill in by
 * hand. Access is scoped exactly like POST /adjustments and /transfers.
 */
router.get('/warehouses/:id/stock-sheet.pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, tenantName } = requireTenantContext();
    const warehouseId = req.params.id;

    const result = await withCurrentTenantDb(prisma, async (client) => {
      const warehouse = await (client as any).warehouse.findFirst({ where: { id: warehouseId, tenantId } });
      if (!warehouse) {
        throw new Error('Warehouse not found.');
      }

      await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, warehouseId);

      const stocks = await (client as any).warehouseStock.findMany({
        where: { warehouseId },
        include: { item: true },
      });

      return { warehouse, stocks };
    });

    const items = result.stocks
      .map((s: any) => ({ sku: s.item.sku, name: s.item.name, unitOfMeasure: s.item.unitOfMeasure }))
      .sort((a: any, b: any) => a.sku.localeCompare(b.sku));

    const pdfBuffer = await generateStockTakeSheetPdf(tenantName || 'Your Business', result.warehouse.name, items);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Stock-Sheet-${result.warehouse.name.replace(/[^a-zA-Z0-9-]+/g, '-')}.pdf"`
    );
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error('[Inventory] Error generating stock sheet PDF:', error);
    if (error.message === 'Warehouse not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to generate stock sheet.' });
  }
});

/**
 * GET /api/v1/inventory/items
 * Lists all inventory items across warehouses.
 */
router.get('/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const items = await withCurrentTenantDb(prisma, async (client) => {
      const accessibleIds = await getAccessibleWarehouseIds(client, tenantId, req.user!.id, req.user!.role);

      // Cache the full catalog (all warehouses) per tenant and serve it to
      // all roles. Warehouse-scoped filtering happens in memory after the
      // cache hit — nearly free vs. a second round-trip to the DB.
      let allItems: any[] = (await getCachedList<any[]>(tenantId, 'inventory-items')) ?? [];
      if (allItems.length === 0) {
        allItems = await (client as any).inventoryItem.findMany({
          where: { tenantId },
          include: { warehouseStocks: { include: { warehouse: true } } },
          orderBy: { name: 'asc' },
        });
        // Fire-and-forget; a failed cache write falls back to DB next request
        if (allItems.length > 0) setCachedList(tenantId, 'inventory-items', allItems).catch(() => {});
      }

      if (accessibleIds === null) return allItems;
      const accessibleSet = new Set(accessibleIds);
      return allItems.map((item: any) => ({
        ...item,
        warehouseStocks: item.warehouseStocks.filter((s: any) => accessibleSet.has(s.warehouseId)),
      }));
    });

    res.status(200).json({ success: true, data: { items } });
  } catch (error: any) {
    console.error('[Inventory] Error fetching items:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve inventory items.' });
  }
});

/**
 * POST /api/v1/inventory/items
 * Creates a new inventory item and assigns initial stock to a warehouse.
 */
router.post('/items', requireRole('Accountant', 'Shop Manager', 'Cashier', 'Warehouse Manager'), validateBody(createItemSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, sku, category = 'General', unitOfMeasure = 'pcs', secondaryUnitOfMeasure, conversionFactor, costPrice, sellingPrice, wholesalePrice, initialWarehouseId, initialQty = 0, reorderLevel, preferredVendorId, regulatoryCategory, requiresBatchTracking } = req.body;

    if (!name || !costPrice || !sellingPrice) {
      res.status(400).json({ success: false, error: 'Item name, cost price, and selling price are required.' });
      return;
    }

    const itemSku = sku ? sku.trim().toUpperCase() : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const createdItem = await withCurrentTenantDb(prisma, async (client) => {
      if (initialWarehouseId) {
        const warehouse = await (client as any).warehouse.findFirst({ where: { id: initialWarehouseId, tenantId } });
        if (!warehouse) {
          throw new Error('Initial warehouse not found.');
        }
        await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, initialWarehouseId);
      }
      if (preferredVendorId) {
        const vendor = await (client as any).vendor.findFirst({ where: { id: preferredVendorId, tenantId } });
        if (!vendor) {
          throw new Error('Preferred vendor not found.');
        }
      }

      const item = await (client as any).inventoryItem.create({
        data: {
          tenantId,
          sku: itemSku,
          name: name.trim(),
          category,
          unitOfMeasure,
          ...(secondaryUnitOfMeasure !== undefined && { secondaryUnitOfMeasure: secondaryUnitOfMeasure || null }),
          ...(conversionFactor !== undefined && conversionFactor !== null && conversionFactor !== '' && { conversionFactor: Number(conversionFactor) }),
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          wholesalePrice: wholesalePrice !== undefined && wholesalePrice !== null && wholesalePrice !== '' ? Number(wholesalePrice) : null,
          ...(reorderLevel !== undefined && { reorderLevel: Number(reorderLevel) }),
          preferredVendorId: preferredVendorId || null,
          ...(regulatoryCategory !== undefined && { regulatoryCategory: String(regulatoryCategory) }),
          ...(requiresBatchTracking !== undefined && { requiresBatchTracking: Boolean(requiresBatchTracking) }),
        },
      });

      // If an initial warehouse was selected, seed initial stock
      if (initialWarehouseId && initialQty > 0) {
        await (client as any).warehouseStock.create({
          data: {
            tenantId,
            warehouseId: initialWarehouseId,
            itemId: item.id,
            quantityOnHand: Number(initialQty),
          },
        });
      }

      await recordAuditLogTx(client, {
        action: 'INVENTORY_ITEM.CREATED',
        entity: 'InventoryItem',
        entityId: item.id,
        actor: actorFromRequest(req),
        details: `Item "${item.name}" (${item.sku}) created.`,
      });

      return item;
    });

    invalidateCachedList(tenantId, 'inventory-items').catch(() => {});
    res.status(201).json({ success: true, message: 'Item created successfully', data: { item: createdItem } });
  } catch (error: any) {
    console.error('[Inventory] Error creating item:', error);
    if (error.message === 'Initial warehouse not found.' || error.message === 'Preferred vendor not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create inventory item.' });
  }
});

/**
 * PUT /api/v1/inventory/items/:id
 * Updates an item's prices, reorder threshold, and/or preferred vendor.
 */
router.put('/items/:id', requireRole('Accountant', 'Shop Manager', 'Warehouse Manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { id } = req.params;
    const { name, costPrice, sellingPrice, wholesalePrice, reorderLevel, preferredVendorId, requiresBatchTracking, secondaryUnitOfMeasure, conversionFactor } = req.body;

    const updated = await withCurrentTenantDb(prisma, async (client) => {
      const existing = await (client as any).inventoryItem.findFirst({ where: { id, tenantId } });
      if (!existing) return null;

      if (preferredVendorId) {
        const vendor = await (client as any).vendor.findFirst({ where: { id: preferredVendorId, tenantId } });
        if (!vendor) {
          throw new Error('Preferred vendor not found.');
        }
      }

      return (client as any).inventoryItem.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
          ...(sellingPrice !== undefined && { sellingPrice: Number(sellingPrice) }),
          ...(wholesalePrice !== undefined && { wholesalePrice: wholesalePrice !== null && wholesalePrice !== '' ? Number(wholesalePrice) : null }),
          ...(reorderLevel !== undefined && { reorderLevel: Number(reorderLevel) }),
          ...(preferredVendorId !== undefined && { preferredVendorId: preferredVendorId || null }),
          ...(requiresBatchTracking !== undefined && { requiresBatchTracking: Boolean(requiresBatchTracking) }),
          ...(secondaryUnitOfMeasure !== undefined && { secondaryUnitOfMeasure: secondaryUnitOfMeasure || null }),
          ...(conversionFactor !== undefined && { conversionFactor: conversionFactor !== null && conversionFactor !== '' ? Number(conversionFactor) : null }),
        },
      });
    });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Item not found.' });
      return;
    }

    invalidateCachedList(tenantId, 'inventory-items').catch(() => {});
    res.status(200).json({ success: true, data: { item: updated } });
  } catch (error: any) {
    if (error.message === 'Preferred vendor not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    console.error('[Inventory] Error updating item:', error);
    res.status(500).json({ success: false, error: 'Failed to update item.' });
  }
});

/**
 * POST /api/v1/inventory/items/bulk
 * Creates many inventory items in one request (quick-add table or CSV import
 * on the frontend both funnel through this single endpoint). Each row is
 * attempted independently rather than as one all-or-nothing transaction, so
 * a single bad row (e.g. a duplicate SKU) doesn't discard every other
 * correctly-typed row in the batch - the response reports which rows
 * succeeded and which failed (with why) so the caller can fix and retry
 * only the failed ones.
 */
router.post('/items/bulk', requireRole('Accountant', 'Shop Manager', 'Cashier', 'Warehouse Manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Provide a non-empty array of items to create.' });
      return;
    }
    if (items.length > 500) {
      res.status(400).json({ success: false, error: 'A maximum of 500 items can be created per bulk request.' });
      return;
    }

    // ── Phase 1: synchronous pre-validation (no DB) ─────────────────────────
    type ValidRow = {
      index: number;
      name: string;
      sku: string;
      category: string;
      unitOfMeasure: string;
      costPrice: number;
      sellingPrice: number;
      initialWarehouseId: string | null;
      initialQty: number;
    };

    const validRows: ValidRow[] = [];
    const failed: { index: number; name?: string; error: string }[] = [];
    const usedSkusThisBatch = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const row = items[i] || {};
      try {
        const { name, sku, category = 'General', unitOfMeasure = 'pcs', costPrice, sellingPrice, initialWarehouseId, initialQty = 0 } = row;

        if (!name || !String(name).trim()) throw new Error('Item name is required.');
        if (costPrice === undefined || costPrice === null || costPrice === '') throw new Error('Cost price is required.');
        if (sellingPrice === undefined || sellingPrice === null || sellingPrice === '') throw new Error('Selling price is required.');

        let itemSku = sku ? String(sku).trim().toUpperCase() : '';
        if (!itemSku) {
          do {
            itemSku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          } while (usedSkusThisBatch.has(itemSku));
        }
        if (usedSkusThisBatch.has(itemSku)) throw new Error(`Duplicate SKU "${itemSku}" within this batch.`);
        usedSkusThisBatch.add(itemSku);

        validRows.push({
          index: i,
          name: String(name).trim(),
          sku: itemSku,
          category,
          unitOfMeasure,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          initialWarehouseId: initialWarehouseId || null,
          initialQty: Number(initialQty) > 0 ? Number(initialQty) : 0,
        });
      } catch (rowError: any) {
        failed.push({ index: i, name: row?.name, error: rowError.message || 'Failed to create this item.' });
      }
    }

    // ── Phase 2: single DB session ────────────────────────────────────────────
    const created: any[] = [];

    if (validRows.length > 0) {
      await withCurrentTenantDb(prisma, async (client) => {
        // Validate unique warehouse IDs once (not once per row)
        const uniqueWarehouseIds = [...new Set(validRows.map(r => r.initialWarehouseId).filter(Boolean) as string[])];
        const validWarehouseIds = new Set<string>();
        for (const wid of uniqueWarehouseIds) {
          const wh = await (client as any).warehouse.findFirst({ where: { id: wid, tenantId } });
          if (!wh) continue;
          try {
            await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, wid);
            validWarehouseIds.add(wid);
          } catch {
            // access denied — rows referencing this warehouse will error below
          }
        }

        // Filter rows whose warehouse didn't pass validation
        const okRows: ValidRow[] = [];
        for (const row of validRows) {
          if (row.initialWarehouseId && !validWarehouseIds.has(row.initialWarehouseId)) {
            failed.push({ index: row.index, name: row.name, error: 'Warehouse not found or access denied.' });
          } else {
            okRows.push(row);
          }
        }

        if (okRows.length === 0) return;

        // Single INSERT … RETURNING for all valid rows
        const inserted: any[] = await (client as any).inventoryItem.createManyAndReturn({
          data: okRows.map(r => ({
            tenantId,
            sku: r.sku,
            name: r.name,
            category: r.category,
            unitOfMeasure: r.unitOfMeasure,
            costPrice: r.costPrice,
            sellingPrice: r.sellingPrice,
          })),
          skipDuplicates: true,
        });
        created.push(...inserted);

        // Attribute each skipped row to the specific row so callers get per-row error details
        if (inserted.length < okRows.length) {
          const insertedSkus = new Set(inserted.map((it: any) => it.sku));
          for (const row of okRows) {
            if (!insertedSkus.has(row.sku)) {
              failed.push({ index: row.index, name: row.name, error: `SKU "${row.sku}" already exists in this business.` });
            }
          }
        }

        // Stock rows for inserted items that had a warehouse + qty
        const skuToItem = new Map(inserted.map((it: any) => [it.sku, it]));
        const stockData = okRows
          .filter(r => r.initialWarehouseId && r.initialQty > 0 && skuToItem.has(r.sku))
          .map(r => ({
            tenantId,
            warehouseId: r.initialWarehouseId!,
            itemId: skuToItem.get(r.sku)!.id,
            quantityOnHand: r.initialQty,
          }));

        if (stockData.length > 0) {
          await (client as any).warehouseStock.createMany({ data: stockData, skipDuplicates: true });
        }
      });
    }

    if (created.length > 0) {
      // One summary entry per batch, not one per row - avoids flooding the
      // audit log with up to 500 entries for a single bulk-import action.
      // Best-effort, not recordAuditLogTx: this summarizes N independently
      // committed rows above, not one atomic change to pair a transaction with.
      await recordAuditLog({
        action: 'INVENTORY_ITEM.BULK_CREATED',
        entity: 'InventoryItem',
        actor: actorFromRequest(req),
        details: `${created.length} item(s) created via bulk import${failed.length > 0 ? `, ${failed.length} row(s) failed` : ''}.`,
      });
    }

    if (created.length > 0) {
      invalidateCachedList(tenantId, 'inventory-items').catch(() => {});
    }
    res.status(201).json({
      success: created.length > 0,
      message: `${created.length} item(s) created${failed.length > 0 ? `, ${failed.length} failed` : ''}.`,
      data: { importedCount: created.length, errorCount: failed.length, errors: failed, failed, created },
    });
  } catch (error: any) {
    console.error('[Inventory] Error bulk-creating items:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk-create inventory items.' });
  }
});

/**
 * POST /api/v1/inventory/transfers
 * Transfers stock items between two warehouses / godowns.
 */
router.post('/transfers', requireRole('Accountant', 'Shop Manager', 'Cashier', 'Warehouse Manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { fromWarehouseId, toWarehouseId, itemId, quantity, notes } = req.body;

    if (!fromWarehouseId || !toWarehouseId || !itemId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'Origin warehouse, destination warehouse, item ID, and valid quantity are required.' });
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      res.status(400).json({ success: false, error: 'Source and destination warehouses must be different.' });
      return;
    }

    const transfer = await withCurrentTenantDb(prisma, async (client) => {
      // Verify both warehouses and the item actually belong to this tenant
      // before touching any stock, so a caller can't reference another
      // tenant's warehouse/item IDs.
      const [fromWarehouse, toWarehouse, item] = await Promise.all([
        (client as any).warehouse.findFirst({ where: { id: fromWarehouseId, tenantId } }),
        (client as any).warehouse.findFirst({ where: { id: toWarehouseId, tenantId } }),
        (client as any).inventoryItem.findFirst({ where: { id: itemId, tenantId } }),
      ]);
      if (!fromWarehouse || !toWarehouse || !item) {
        throw new Error('Warehouse or item not found.');
      }

      // A location-scoped user may only move stock between warehouses they
      // actually have access to on both ends of the transfer.
      await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, fromWarehouseId);
      await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, toWarehouseId);

      // Check source stock (existence / friendly error message only - the actual
      // deduction below is guarded atomically so concurrent transfers can't both
      // read the same stale quantity and both succeed, driving it negative).
      const sourceStock = await (client as any).warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: fromWarehouseId, itemId } },
      });

      if (!sourceStock || sourceStock.quantityOnHand < quantity) {
        throw new Error(`Insufficient stock in origin warehouse (Available: ${sourceStock?.quantityOnHand || 0} pcs).`);
      }

      // Atomic guarded decrement: only succeeds if quantityOnHand is still >= quantity
      // at the moment the row lock is acquired, so a concurrent transfer that already
      // consumed the stock causes this to affect 0 rows instead of going negative.
      const deduction = await (client as any).warehouseStock.updateMany({
        where: { id: sourceStock.id, quantityOnHand: { gte: Number(quantity) } },
        data: { quantityOnHand: { decrement: Number(quantity) } },
      });

      if (deduction.count === 0) {
        throw new Error('Insufficient stock in origin warehouse (stock changed concurrently, please retry).');
      }

      // Add to destination warehouse - atomic increment via upsert so a concurrent
      // transfer into the same (warehouse, item) pair can't overwrite this one.
      await (client as any).warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId: toWarehouseId, itemId } },
        update: { quantityOnHand: { increment: Number(quantity) } },
        create: { tenantId, warehouseId: toWarehouseId, itemId, quantityOnHand: Number(quantity) },
      });

      // Record Transfer Audit
      const transferNumber = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const transfer = await (client as any).stockTransfer.create({
        data: {
          tenantId,
          transferNumber,
          fromWarehouseId,
          toWarehouseId,
          notes,
          items: {
            create: [{ tenantId, itemId, quantity: Number(quantity) }],
          },
        },
        include: { fromWarehouse: true, toWarehouse: true, items: true },
      });

      await recordAuditLogTx(client, {
        action: 'STOCK_TRANSFER.RECORDED',
        entity: 'StockTransfer',
        entityId: transfer.id,
        actor: actorFromRequest(req),
        details: `${transfer.transferNumber}: ${quantity} unit(s) of item ${itemId} from ${transfer.fromWarehouse.name} to ${transfer.toWarehouse.name}.`,
      });

      return transfer;
    });

    // Fire-and-forget low-stock alert for the source item after transfer out.
    checkAndAlertLowStock(tenantId, itemId).catch(() => {});
    // Stock levels changed — invalidate cached item list so next read reflects new quantities
    invalidateCachedList(tenantId, 'inventory-items').catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Stock transfer completed successfully',
      data: { transfer },
    });
  } catch (error: any) {
    console.error('[Inventory] Error transferring stock:', error);
    if (error.message === 'Warehouse or item not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to execute stock transfer.' });
  }
});

const ADJUSTMENT_MODES = new Set(['add', 'remove', 'set']);

/**
 * POST /api/v1/inventory/adjustments
 * Manually corrects an item's quantity in a warehouse - covers both
 * restocking an existing item (mode='add', e.g. a new supplier delivery)
 * and fixing a mistaken over/under-entry (mode='remove' to subtract units,
 * or mode='set' to declare the true, physically-counted quantity outright).
 * A reason is required and every adjustment is permanently recorded in
 * StockAdjustment for audit purposes - this is the same underlying action
 * as a stock transfer's audit trail, just for a single-warehouse correction
 * rather than a movement between two warehouses.
 */
router.post('/adjustments', requireRole('Accountant', 'Shop Manager', 'Cashier', 'Warehouse Manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { warehouseId, itemId, mode, quantity, reason } = req.body;

    if (!warehouseId || !itemId) {
      res.status(400).json({ success: false, error: 'Warehouse ID and item ID are required.' });
      return;
    }
    if (!ADJUSTMENT_MODES.has(mode)) {
      res.status(400).json({ success: false, error: "Mode must be one of 'add', 'remove', or 'set'." });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || (mode !== 'set' && qty === 0)) {
      res.status(400).json({ success: false, error: 'Quantity must be a whole number (greater than zero for add/remove).' });
      return;
    }
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ success: false, error: 'A reason is required for every stock adjustment.' });
      return;
    }

    const adjustedByName = req.user?.name || req.user?.email || 'Unknown';

    const result = await withCurrentTenantDb(prisma, async (client) => {
      const [warehouse, item] = await Promise.all([
        (client as any).warehouse.findFirst({ where: { id: warehouseId, tenantId } }),
        (client as any).inventoryItem.findFirst({ where: { id: itemId, tenantId } }),
      ]);
      if (!warehouse || !item) {
        throw new Error('Warehouse or item not found.');
      }

      await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, warehouseId);

      const { adjustment, previousQty, newQty } = await applyStockAdjustment(client, {
        tenantId,
        warehouseId,
        itemId,
        mode,
        quantity: qty,
        reason,
        adjustedByName,
      });

      // Same transaction as the stock write above, so the audit trail can
      // never desync from the quantity change it describes.
      await recordAuditLogTx(client, {
        action: 'STOCK_ADJUSTMENT.RECORDED',
        entity: 'StockAdjustment',
        entityId: adjustment.id,
        actor: actorFromRequest(req),
        changes: { quantityOnHand: { from: previousQty, to: newQty } },
        details: `${item.name} in ${warehouse.name}: ${mode} ${qty} (${reason}).`,
      });

      return { adjustment, warehouse, item, newQty, previousQty };
    });

    // Fire-and-forget low-stock alert when stock is removed or set to a low value.
    if (mode === 'remove' || mode === 'set') {
      checkAndAlertLowStock(tenantId, itemId).catch(() => {});
    }
    invalidateCachedList(tenantId, 'inventory-items').catch(() => {});

    res.status(201).json({
      success: true,
      message: `Stock adjusted: ${result.item.name} in ${result.warehouse.name} is now ${result.newQty} ${result.item.unitOfMeasure}.`,
      data: { adjustment: result.adjustment },
    });
  } catch (error: any) {
    console.error('[Inventory] Error adjusting stock:', error);
    if (error.message === 'Warehouse or item not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(400).json({ success: false, error: error.message || 'Failed to adjust stock.' });
  }
});

/**
 * GET /api/v1/inventory/adjustments
 * Lists stock adjustment history (most recent first), optionally filtered
 * to a single item and/or warehouse, so a business can see exactly who
 * corrected what, when, and why.
 */
router.get('/adjustments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { itemId, warehouseId, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const adjustments = await withCurrentTenantDb(prisma, async (client) => {
      const where: any = { tenantId };
      if (itemId) where.itemId = itemId;

      if (warehouseId) {
        await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, warehouseId as string);
        where.warehouseId = warehouseId;
      } else {
        const accessibleIds = await getAccessibleWarehouseIds(client, tenantId, req.user!.id, req.user!.role);
        if (accessibleIds !== null) where.warehouseId = { in: accessibleIds };
      }

      return (client as any).stockAdjustment.findMany({
        where,
        include: { item: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      });
    });

    res.status(200).json({ success: true, data: { adjustments, page: pageNum, limit: limitNum } });
  } catch (error: any) {
    console.error('[Inventory] Error fetching stock adjustments:', error);
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to retrieve stock adjustment history.' });
  }
});

/**
 * POST /api/v1/inventory/stock-take
 * Reconciles a batch of physically-counted quantities against the system's
 * current stock for a single warehouse. Every item whose counted quantity
 * differs from the system quantity gets a mode='set' StockAdjustment (the
 * same authoritative-recount primitive POST /adjustments uses for a single
 * item); items that match need no write. All adjustments in the batch share
 * a generated reference embedded in their reason string for grouping, plus
 * one summary AuditLog entry for the whole reconciliation.
 */
router.post('/stock-take', requireRole('Accountant', 'Shop Manager', 'Cashier', 'Warehouse Manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { warehouseId, counts, reason } = req.body;

    if (!warehouseId) {
      res.status(400).json({ success: false, error: 'Warehouse ID is required.' });
      return;
    }
    if (!Array.isArray(counts) || counts.length === 0) {
      res.status(400).json({ success: false, error: 'At least one counted item is required.' });
      return;
    }
    for (const row of counts) {
      if (!row || typeof row.itemId !== 'string' || !row.itemId) {
        res.status(400).json({ success: false, error: 'Every counted row must include an item ID.' });
        return;
      }
      if (!Number.isInteger(row.countedQty) || row.countedQty < 0) {
        res.status(400).json({
          success: false,
          error: `Invalid counted quantity for item ${row.itemId} - must be a non-negative whole number.`,
        });
        return;
      }
    }

    const stockTakeRef = crypto.randomUUID();
    const dateLabel = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    const adjustedByName = req.user?.name || req.user?.email || 'Unknown';

    const result = await withCurrentTenantDb(prisma, async (client) => {
      const warehouse = await (client as any).warehouse.findFirst({ where: { id: warehouseId, tenantId } });
      if (!warehouse) {
        throw new Error('Warehouse not found.');
      }

      await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, warehouseId);

      const itemIds = counts.map((c: any) => c.itemId);
      const items = await (client as any).inventoryItem.findMany({ where: { id: { in: itemIds }, tenantId } });
      const itemsById = new Map(items.map((i: any) => [i.id, i]));

      const stocks = await (client as any).warehouseStock.findMany({
        where: { warehouseId, itemId: { in: itemIds } },
      });
      const stockByItemId = new Map(stocks.map((s: any) => [s.itemId, s]));

      const applied: any[] = [];
      const unchanged: any[] = [];
      const notFound: string[] = [];

      for (const row of counts) {
        const item = itemsById.get(row.itemId);
        if (!item) {
          notFound.push(row.itemId);
          continue;
        }
        const currentQty = (stockByItemId.get(row.itemId) as any)?.quantityOnHand || 0;
        if (row.countedQty === currentQty) {
          unchanged.push({ itemId: row.itemId, sku: (item as any).sku, quantity: currentQty });
          continue;
        }

        const { adjustment, previousQty, newQty } = await applyStockAdjustment(client, {
          tenantId,
          warehouseId,
          itemId: row.itemId,
          mode: 'set',
          quantity: row.countedQty,
          reason: reason
            ? String(reason).trim()
            : `Stock take (${warehouse.name}, ${dateLabel}) — ref:${stockTakeRef.slice(0, 8)}`,
          adjustedByName,
        });
        applied.push({ itemId: row.itemId, sku: (item as any).sku, previousQty, newQty, adjustmentId: adjustment.id });
      }

      if (applied.length > 0) {
        // Same transaction as every stock adjustment applied above.
        await recordAuditLogTx(client, {
          action: 'STOCK_TAKE.RECONCILED',
          entity: 'StockTake',
          entityId: stockTakeRef,
          actor: actorFromRequest(req),
          changes: { itemsAdjusted: { from: null, to: applied.map((a: any) => a.itemId) } },
          details: `Stock take reconciled for ${warehouse.name}: ${applied.length} item(s) adjusted, ${unchanged.length} unchanged.`,
        });
      }

      return { warehouse, applied, unchanged, notFound };
    });

    res.status(200).json({
      success: true,
      data: {
        stockTakeRef,
        applied: result.applied,
        unchanged: result.unchanged,
        notFound: result.notFound,
      },
    });
  } catch (error: any) {
    console.error('[Inventory] Error reconciling stock take:', error);
    if (error.message === 'Warehouse not found.') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    if (error instanceof WarehouseAccessError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(400).json({ success: false, error: error.message || 'Failed to reconcile stock take.' });
  }
});

// ─── Inventory Batch Endpoints ───────────────────────────────────────────────

/**
 * GET /api/v1/inventory/batches
 * Lists inventory batches. Optional ?itemId=, ?warehouseId=, ?expiringSoon=N (days).
 */
router.get('/batches', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { itemId, warehouseId, expiringSoon } = req.query;

    const where: any = { tenantId };
    if (itemId) where.itemId = String(itemId);
    if (warehouseId) where.warehouseId = String(warehouseId);
    if (expiringSoon) {
      const days = parseInt(String(expiringSoon), 10) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      where.expiryDate = { not: null, lte: cutoff };
    }

    const batches = await withCurrentTenantDb(prisma, async (client) => {
      return (client as any).inventoryBatch.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      });
    });

    res.status(200).json({ success: true, data: { batches } });
  } catch (error: any) {
    console.error('[Inventory] Error fetching batches:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve inventory batches.' });
  }
});

/**
 * POST /api/v1/inventory/batches
 * Receives a new batch for a batch-tracked item. Upserts the InventoryBatch row and
 * increments warehouseStock.quantityOnHand. For CONTROLLED items, also posts a
 * narcotics log RECEIVED entry.
 */
router.post(
  '/batches',
  requireRole('Accountant', 'Warehouse Manager', 'Shop Manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { itemId, warehouseId, batchNumber, expiryDate, quantity, costPrice, supplierId } = req.body;

      if (!itemId || !warehouseId || !batchNumber || quantity === undefined || costPrice === undefined) {
        res.status(400).json({ success: false, error: 'itemId, warehouseId, batchNumber, quantity, and costPrice are required.' });
        return;
      }
      const qty = parseInt(String(quantity), 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        res.status(400).json({ success: false, error: 'quantity must be a positive integer.' });
        return;
      }

      const result = await withCurrentTenantDb(prisma, async (client) => {
        const item = await (client as any).inventoryItem.findFirst({ where: { id: itemId, tenantId } });
        if (!item) throw new Error('Item not found.');

        const warehouse = await (client as any).warehouse.findFirst({ where: { id: warehouseId, tenantId } });
        if (!warehouse) throw new Error('Warehouse not found.');

        await assertWarehouseAccess(client, tenantId, req.user!.id, req.user!.role, warehouseId);

        // Upsert the batch row
        const existingBatch = await (client as any).inventoryBatch.findFirst({
          where: { tenantId, itemId, batchNumber },
        });

        let batch: any;
        if (existingBatch) {
          batch = await (client as any).inventoryBatch.update({
            where: { id: existingBatch.id },
            data: { quantityOnHand: { increment: qty } },
          });
        } else {
          batch = await (client as any).inventoryBatch.create({
            data: {
              tenantId,
              itemId,
              warehouseId,
              batchNumber: String(batchNumber).trim(),
              expiryDate: expiryDate ? new Date(expiryDate) : null,
              quantityOnHand: qty,
              supplierId: supplierId || null,
              costPrice: Number(costPrice),
            },
          });
        }

        // Increment the warehouseStock total (the authoritative quantity)
        await (client as any).warehouseStock.upsert({
          where: { warehouseId_itemId: { warehouseId, itemId } },
          create: { tenantId, warehouseId, itemId, quantityOnHand: qty },
          update: { quantityOnHand: { increment: qty } },
        });

        // Narcotics auto-log for CONTROLLED items
        if (item.regulatoryCategory === 'CONTROLLED') {
          const lastEntry = await (client as any).narcoticsLogEntry.findFirst({
            where: { tenantId, itemId },
            orderBy: { entryDate: 'desc' },
          });
          const balanceAfter = (lastEntry ? lastEntry.balanceAfter : 0) + qty;
          await (client as any).narcoticsLogEntry.create({
            data: {
              tenantId,
              itemId,
              batchNumber: String(batchNumber).trim(),
              operationType: 'RECEIVED',
              quantity: qty,
              balanceAfter,
              supplierRef: supplierId || null,
              recordedByName: req.user?.name || req.user?.email || 'Unknown',
            },
          });
        }

        return { batch, item, warehouse };
      });

      res.status(201).json({ success: true, message: 'Batch received successfully.', data: { batch: result.batch } });
    } catch (error: any) {
      console.error('[Inventory] Error receiving batch:', error);
      if (error.message === 'Item not found.' || error.message === 'Warehouse not found.') {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WarehouseAccessError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      res.status(500).json({ success: false, error: 'Failed to receive batch.' });
    }
  }
);

export default router;
