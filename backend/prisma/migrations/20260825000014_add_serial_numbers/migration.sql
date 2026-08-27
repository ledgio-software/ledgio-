-- Add allowNegativeStock to tenants
ALTER TABLE "tenants" ADD COLUMN "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false;

-- Add trackSerials to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN "track_serials" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: serial_numbers
CREATE TABLE "serial_numbers" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "inventory_item_id" TEXT NOT NULL,
  "warehouse_id"      TEXT NOT NULL,
  "serial_number"     TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'AVAILABLE',
  "invoice_id"        TEXT,
  "bill_id"           TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_tenant_id_inventory_item_id_serial_number_key"
  ON "serial_numbers"("tenant_id", "inventory_item_id", "serial_number");

CREATE INDEX "serial_numbers_tenant_id_warehouse_id_inventory_item_id_status_idx"
  ON "serial_numbers"("tenant_id", "warehouse_id", "inventory_item_id", "status");

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
