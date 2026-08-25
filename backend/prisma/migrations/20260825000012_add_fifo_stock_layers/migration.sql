-- Migration: FIFO stock valuation support.
-- Adds stock_valuation_method (AVERAGE|FIFO) to tenants table and creates
-- stock_layers table for per-lot cost tracking (FIFO depletion at point of sale).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stock_valuation_method TEXT NOT NULL DEFAULT 'AVERAGE';

CREATE TABLE IF NOT EXISTS stock_layers (
  id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL,
  warehouse_id  UUID         NOT NULL,
  item_id       UUID         NOT NULL,
  unit_cost     NUMERIC(15,4) NOT NULL,
  original_qty  INTEGER      NOT NULL,
  remaining_qty INTEGER      NOT NULL,
  purchased_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  source_ref    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_stock_layers PRIMARY KEY (id),
  CONSTRAINT chk_stock_layers_qty CHECK (remaining_qty >= 0 AND original_qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_layers_lookup
  ON stock_layers(tenant_id, item_id, purchased_at)
  WHERE remaining_qty > 0;
