-- CreateTable: delivery_notes, delivery_note_lines, goods_receipt_notes, goods_receipt_note_lines
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dn_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "sales_order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dispatch_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_note_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "delivery_note_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_receipt_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "grn_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "vendor_bill_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "receipt_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipt_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_receipt_note_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "goods_receipt_note_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "goods_receipt_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_tenant_id_dn_number_key" ON "delivery_notes"("tenant_id", "dn_number");
CREATE INDEX "delivery_notes_tenant_id_idx" ON "delivery_notes"("tenant_id");
CREATE INDEX "delivery_notes_customer_id_idx" ON "delivery_notes"("customer_id");
CREATE INDEX "delivery_notes_status_idx" ON "delivery_notes"("status");
CREATE INDEX "delivery_note_lines_tenant_id_idx" ON "delivery_note_lines"("tenant_id");
CREATE INDEX "delivery_note_lines_delivery_note_id_idx" ON "delivery_note_lines"("delivery_note_id");

CREATE UNIQUE INDEX "goods_receipt_notes_tenant_id_grn_number_key" ON "goods_receipt_notes"("tenant_id", "grn_number");
CREATE INDEX "goods_receipt_notes_tenant_id_idx" ON "goods_receipt_notes"("tenant_id");
CREATE INDEX "goods_receipt_notes_vendor_id_idx" ON "goods_receipt_notes"("vendor_id");
CREATE INDEX "goods_receipt_notes_status_idx" ON "goods_receipt_notes"("status");
CREATE INDEX "goods_receipt_note_lines_tenant_id_idx" ON "goods_receipt_note_lines"("tenant_id");
CREATE INDEX "goods_receipt_note_lines_goods_receipt_note_id_idx" ON "goods_receipt_note_lines"("goods_receipt_note_id");

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_delivery_note_id_fkey"
    FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_note_lines" ADD CONSTRAINT "goods_receipt_note_lines_goods_receipt_note_id_fkey"
    FOREIGN KEY ("goods_receipt_note_id") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
