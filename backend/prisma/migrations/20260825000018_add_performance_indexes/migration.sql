-- Performance index migration: composite indexes for institutional-scale query loads
-- Each index targets a specific high-frequency query pattern identified from the
-- route handlers. Standard CREATE INDEX (not CONCURRENTLY) is required here because
-- Prisma Migrate wraps each migration in a transaction and CONCURRENTLY cannot run
-- inside a transaction block. Lock duration is negligible on tables that are empty
-- or lightly populated at migration time.

-- WarehouseStock: stock level checks always filter on (tenantId, itemId, warehouseId)
CREATE INDEX IF NOT EXISTS "warehouse_stocks_tenant_item_warehouse_idx"
  ON "warehouse_stocks"("tenant_id", "item_id", "warehouse_id");

-- InventoryItem: category and name filters for inventory list/search
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_category_idx"
  ON "inventory_items"("tenant_id", "category");

CREATE INDEX IF NOT EXISTS "inventory_items_tenant_name_idx"
  ON "inventory_items"("tenant_id", "name");

-- Customer: name search and customerType filter (RETAIL/WHOLESALE)
CREATE INDEX IF NOT EXISTS "customers_tenant_name_idx"
  ON "customers"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "customers_tenant_type_idx"
  ON "customers"("tenant_id", "customer_type");

-- Vendor: name search
CREATE INDEX IF NOT EXISTS "vendors_tenant_name_idx"
  ON "vendors"("tenant_id", "name");

-- VendorBill: AP aging report needs (tenantId, status, dueDate) to find overdue bills fast
CREATE INDEX IF NOT EXISTS "vendor_bills_tenant_status_due_idx"
  ON "vendor_bills"("tenant_id", "status", "due_date");

-- BankTransaction: reconciliation view filters on (tenantId, bankAccountId, status)
CREATE INDEX IF NOT EXISTS "bank_transactions_tenant_account_status_idx"
  ON "bank_transactions"("tenant_id", "bank_account_id", "status");

-- PurchaseOrder: list view and status filter
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_status_created_idx"
  ON "purchase_orders"("tenant_id", "status", "created_at" DESC);

-- SalesOrder: list view and status filter
CREATE INDEX IF NOT EXISTS "sales_orders_tenant_status_created_idx"
  ON "sales_orders"("tenant_id", "status", "created_at" DESC);

-- Notification: unread count per user — the notification bell queries this on every page load
CREATE INDEX IF NOT EXISTS "notifications_tenant_user_read_idx"
  ON "notifications"("tenant_id", "user_id", "read");

-- StockAdjustment: movement history by item
CREATE INDEX IF NOT EXISTS "stock_adjustments_tenant_item_created_idx"
  ON "stock_adjustments"("tenant_id", "item_id", "created_at" DESC);

-- DeliveryNote: list view by status and customer
CREATE INDEX IF NOT EXISTS "delivery_notes_tenant_status_idx"
  ON "delivery_notes"("tenant_id", "status", "created_at" DESC);

-- GoodsReceiptNote: list view
CREATE INDEX IF NOT EXISTS "goods_receipt_notes_tenant_status_idx"
  ON "goods_receipt_notes"("tenant_id", "status", "created_at" DESC);

-- ExpenseClaim: claims list by status
CREATE INDEX IF NOT EXISTS "expense_claims_tenant_status_created_idx"
  ON "expense_claims"("tenant_id", "status", "created_at" DESC);
