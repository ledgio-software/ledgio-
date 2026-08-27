-- AlterTable: add idempotency_key to invoice_payments
ALTER TABLE "invoice_payments" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex: partial unique index — NULL keys are allowed to repeat (each non-null key must be unique per tenant)
CREATE UNIQUE INDEX "invoice_payments_tenant_id_idempotency_key_key"
ON "invoice_payments" ("tenant_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
