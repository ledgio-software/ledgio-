-- Migration: interest_policies and interest_charges tables.
-- One policy per tenant (annualRate, graceDays, optional GL account).
-- Daily cron accrues interest on overdue invoices and writes a charge row.

CREATE TABLE IF NOT EXISTS interest_policies (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  annual_rate NUMERIC(5,4) NOT NULL,
  grace_days  INTEGER     NOT NULL DEFAULT 0,
  account_id  UUID,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_interest_policies    PRIMARY KEY (id),
  CONSTRAINT uq_interest_policy_tenant UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS interest_charges (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL,
  invoice_id   UUID        NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  journal_id   TEXT,
  status       TEXT        NOT NULL DEFAULT 'POSTED'
                           CHECK (status IN ('POSTED', 'VOIDED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_interest_charges PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_interest_charges_tenant    ON interest_charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interest_charges_invoice   ON interest_charges(tenant_id, invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interest_charge_invoice_period
  ON interest_charges(tenant_id, invoice_id, period_start);
