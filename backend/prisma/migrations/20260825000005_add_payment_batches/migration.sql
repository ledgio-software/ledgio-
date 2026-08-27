-- CreateTable: payment_batches and payment_batch_allocations for Gap #7
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "batch_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_batch_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "vendor_bill_id" TEXT,
    "allocated_amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "payment_batch_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_tenant_id_batch_number_key" ON "payment_batches"("tenant_id", "batch_number");
CREATE INDEX "payment_batches_tenant_id_idx" ON "payment_batches"("tenant_id");
CREATE INDEX "payment_batches_entity_id_idx" ON "payment_batches"("entity_id");
CREATE INDEX "payment_batch_allocations_tenant_id_idx" ON "payment_batch_allocations"("tenant_id");
CREATE INDEX "payment_batch_allocations_batch_id_idx" ON "payment_batch_allocations"("batch_id");
CREATE INDEX "payment_batch_allocations_invoice_id_idx" ON "payment_batch_allocations"("invoice_id");
CREATE INDEX "payment_batch_allocations_vendor_bill_id_idx" ON "payment_batch_allocations"("vendor_bill_id");

-- AddForeignKey
ALTER TABLE "payment_batch_allocations" ADD CONSTRAINT "payment_batch_allocations_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
