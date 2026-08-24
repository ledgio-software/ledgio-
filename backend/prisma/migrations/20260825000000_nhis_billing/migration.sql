-- NHIS / Insurance billing columns on cash_sales
-- Added as raw SQL (same pattern as customer_name/customer_phone in migration 016)
-- to avoid regenerating the Prisma client for a simple column addition.
ALTER TABLE cash_sales
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS nhis_claim_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nhis_settled_at TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS idx_cash_sales_payment_method ON cash_sales(tenant_id, payment_method);
