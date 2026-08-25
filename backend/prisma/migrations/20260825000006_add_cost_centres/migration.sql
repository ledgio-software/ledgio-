-- Gap #8: Cost Centres / Profit Centres
-- Adds public-schema cost_centres table and FK columns on invoices,
-- vendor_bills, expense_claims. Per-tenant journal_entry_lines and ledgers
-- get bare UUID cost_centre_id columns via tenant migration v19.

CREATE TABLE IF NOT EXISTS cost_centres (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL,
  name         TEXT        NOT NULL,
  code         TEXT        NOT NULL,
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_cost_centres PRIMARY KEY (id),
  CONSTRAINT uq_cost_centres_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centres_tenant ON cost_centres(tenant_id);

-- FK columns on public-schema tables (nullable, SetNull on delete)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES cost_centres(id) ON DELETE SET NULL;

ALTER TABLE vendor_bills
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES cost_centres(id) ON DELETE SET NULL;

ALTER TABLE expense_claims
  ADD COLUMN IF NOT EXISTS cost_centre_id UUID REFERENCES cost_centres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_cost_centre ON invoices(cost_centre_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_cost_centre ON vendor_bills(cost_centre_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_cost_centre ON expense_claims(cost_centre_id);
