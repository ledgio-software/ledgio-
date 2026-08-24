-- Pharmacy Module Migration
-- Adds regulatory classification and batch tracking to inventory items,
-- and creates the prescription register and narcotics log tables.

-- Add pharmacy fields to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "regulatory_category" VARCHAR(20) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "requires_batch_tracking" BOOLEAN NOT NULL DEFAULT false;

-- Batch / lot tracking table (sub-ledger for FEFO dispensing)
CREATE TABLE IF NOT EXISTS "inventory_batches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "batch_number" TEXT NOT NULL,
  "expiry_date" TIMESTAMP(3),
  "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supplier_id" TEXT,
  "cost_price" DECIMAL(15,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_batches_tenant_id_item_id_batch_number_key" UNIQUE ("tenant_id", "item_id", "batch_number")
);

CREATE INDEX IF NOT EXISTS "inventory_batches_tenant_id_idx" ON "inventory_batches"("tenant_id");
CREATE INDEX IF NOT EXISTS "inventory_batches_item_id_idx" ON "inventory_batches"("item_id");
CREATE INDEX IF NOT EXISTS "inventory_batches_expiry_date_idx" ON "inventory_batches"("expiry_date");

-- Prescription register
CREATE TABLE IF NOT EXISTS "prescriptions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rx_number" TEXT NOT NULL,
  "patient_name" TEXT NOT NULL,
  "patient_age" INTEGER,
  "patient_phone" TEXT,
  "prescribing_doctor" TEXT NOT NULL,
  "prescription_date" TIMESTAMP(3) NOT NULL,
  "dispensed_at" TIMESTAMP(3),
  "dispensed_by_name" TEXT,
  "cash_sale_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prescriptions_tenant_id_rx_number_key" UNIQUE ("tenant_id", "rx_number")
);

CREATE INDEX IF NOT EXISTS "prescriptions_tenant_id_idx" ON "prescriptions"("tenant_id");

CREATE TABLE IF NOT EXISTS "prescription_lines" (
  "id" TEXT NOT NULL,
  "prescription_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "prescribed_qty" INTEGER NOT NULL,
  "dispensed_qty" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  CONSTRAINT "prescription_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prescription_lines_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "prescription_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "prescription_lines_prescription_id_idx" ON "prescription_lines"("prescription_id");
CREATE INDEX IF NOT EXISTS "prescription_lines_item_id_idx" ON "prescription_lines"("item_id");

-- Narcotics / controlled-substance log (Ghana FDA mandatory register)
CREATE TABLE IF NOT EXISTS "narcotics_log_entries" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "batch_number" TEXT,
  "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "patient_name" TEXT,
  "prescription_ref" TEXT,
  "supplier_ref" TEXT,
  "recorded_by_name" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "narcotics_log_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "narcotics_log_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "narcotics_log_entries_tenant_id_idx" ON "narcotics_log_entries"("tenant_id");
CREATE INDEX IF NOT EXISTS "narcotics_log_entries_item_id_idx" ON "narcotics_log_entries"("item_id");
