-- CreateTable: sales_orders and sales_order_lines for Gap #5 (Sales Orders)
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "so_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- Add salesOrderId back-link to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sales_order_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_tenant_id_so_number_key" ON "sales_orders"("tenant_id", "so_number");
CREATE INDEX "sales_orders_tenant_id_idx" ON "sales_orders"("tenant_id");
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");
CREATE INDEX "sales_order_lines_tenant_id_idx" ON "sales_order_lines"("tenant_id");
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines"("sales_order_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey"
    FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
