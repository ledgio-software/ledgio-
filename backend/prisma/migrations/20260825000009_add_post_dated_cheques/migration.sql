-- Migration: add post_dated_cheques table
-- PDC register for tracking post-dated cheques received from customers
-- (RECEIVABLE) and issued to suppliers (PAYABLE).

CREATE TABLE IF NOT EXISTS post_dated_cheques (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,
  type             TEXT        NOT NULL CHECK (type IN ('RECEIVABLE', 'PAYABLE')),
  party_name       TEXT        NOT NULL,
  cheque_number    TEXT        NOT NULL,
  bank_name        TEXT        NOT NULL,
  amount           NUMERIC(15,2) NOT NULL,
  currency         TEXT        NOT NULL DEFAULT 'GHS',
  due_date         TIMESTAMPTZ NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'DEPOSITED', 'BOUNCED', 'CANCELLED')),
  invoice_id       UUID,
  bill_id          UUID,
  receipt_journal_id TEXT,
  deposit_journal_id TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_post_dated_cheques PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pdc_tenant        ON post_dated_cheques(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pdc_tenant_status ON post_dated_cheques(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pdc_due_date      ON post_dated_cheques(tenant_id, due_date);
