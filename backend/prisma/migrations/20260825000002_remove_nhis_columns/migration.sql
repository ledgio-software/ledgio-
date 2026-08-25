ALTER TABLE cash_sales
  DROP COLUMN IF EXISTS nhis_claim_ref,
  DROP COLUMN IF EXISTS nhis_settled_at;
