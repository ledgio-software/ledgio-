-- Gap #1: Withholding Tax (WHT)
-- Adds wht_rates table (public schema, tenant-scoped) and wht_rate_id / wht_amount columns to vendor_bills.

CREATE TABLE IF NOT EXISTS wht_rates (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  code        TEXT        NOT NULL,
  rate        NUMERIC(5,4) NOT NULL,
  account_id  UUID,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_wht_rates PRIMARY KEY (id),
  CONSTRAINT uq_wht_rate_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_wht_rates_tenant ON wht_rates(tenant_id);

ALTER TABLE vendor_bills
  ADD COLUMN IF NOT EXISTS wht_rate_id UUID REFERENCES wht_rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wht_amount   NUMERIC(15,2);
