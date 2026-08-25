-- CreateTable: price_lists
CREATE TABLE "price_lists" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "currency"    TEXT NOT NULL DEFAULT 'GHS',
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable: price_list_entries
CREATE TABLE "price_list_entries" (
  "id"                TEXT NOT NULL,
  "price_list_id"     TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "inventory_item_id" TEXT NOT NULL,
  "unit_price"        DECIMAL(15,2) NOT NULL,
  "min_qty"           INTEGER NOT NULL DEFAULT 1,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_list_entries_pkey" PRIMARY KEY ("id")
);

-- AddColumn: price_list_id on customers
ALTER TABLE "customers" ADD COLUMN "price_list_id" TEXT;

-- CreateIndex
CREATE INDEX "price_lists_tenant_id_idx" ON "price_lists"("tenant_id");
CREATE INDEX "price_list_entries_tenant_id_price_list_id_idx" ON "price_list_entries"("tenant_id", "price_list_id");
CREATE INDEX "price_list_entries_tenant_id_inventory_item_id_idx" ON "price_list_entries"("tenant_id", "inventory_item_id");

-- AddForeignKey
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_price_list_id_fkey"
  FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customers" ADD CONSTRAINT "customers_price_list_id_fkey"
  FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
