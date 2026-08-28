-- Phase 2 hardening: composite indexes on hot query paths identified by route/service audit.
-- Standard CREATE INDEX (not CONCURRENTLY) is required — Prisma Migrate wraps each migration
-- in a transaction and CONCURRENTLY cannot run inside a transaction block.

-- InvoicePayment: payment history for an invoice is the most common read after recording
-- a payment. The (invoice_id) index already exists; adding (tenant_id, invoice_id) covers
-- the idempotency pre-check and the test-cleanup queries that filter on both dimensions.
CREATE INDEX IF NOT EXISTS "invoice_payments_tenant_invoice_idx"
  ON "invoice_payments"("tenant_id", "invoice_id");

-- InvoicePayment: loading payment history for the invoice detail view orders by created_at.
-- The compound (invoice_id, created_at DESC) lets the planner avoid a separate sort step.
CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_created_idx"
  ON "invoice_payments"("invoice_id", "created_at" DESC);

-- Invoice: AR aging report queries WHERE status IN ('SENT','PARTIALLY_PAID') ORDER BY due_date.
-- The existing (tenant_id, status, issue_date) index covers the filter but forces a re-sort
-- on due_date. This index matches the exact column order the aging query uses.
CREATE INDEX IF NOT EXISTS "invoices_tenant_status_due_idx"
  ON "invoices"("tenant_id", "status", "due_date");

-- VendorBill: purchase register queries WHERE tenant_id = ? AND bill_type = 'STANDARD'
-- AND bill_date BETWEEN ? AND ?. No existing index covers all three columns together.
CREATE INDEX IF NOT EXISTS "vendor_bills_tenant_type_date_idx"
  ON "vendor_bills"("tenant_id", "bill_type", "bill_date");
