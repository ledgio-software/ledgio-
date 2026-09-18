-- Phase 3: Federated Learning with Differential Privacy
-- Creates two public-schema tables used by the nightly federated round.
-- No RLS required — these are platform-level tables, not per-tenant.

-- Global model weights: one row per model, updated each federated round.
-- The invoice_risk logistic regression weights live here after round 1.
CREATE TABLE IF NOT EXISTS "global_model_weights" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "model_name" TEXT        NOT NULL,
  "weights"    JSONB       NOT NULL,
  "epoch"      INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "global_model_weights_pkey" PRIMARY KEY ("id")
);

-- One row per model — upsert target in aggregator.py
CREATE UNIQUE INDEX IF NOT EXISTS "global_model_weights_model_name_key"
  ON "global_model_weights"("model_name");

-- Per-tenant differential privacy budget tracking.
-- Tracks epsilon consumed per tenant; tenants exceeding epsilon_limit are
-- excluded from future rounds but still benefit from the global model.
CREATE TABLE IF NOT EXISTS "tenant_dp_budgets" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID        NOT NULL,
  "epsilon_consumed"    FLOAT       NOT NULL DEFAULT 0,
  "epsilon_limit"       FLOAT       NOT NULL DEFAULT 10.0,
  "delta"               FLOAT       NOT NULL DEFAULT 0.00001,
  "rounds_participated" INTEGER     NOT NULL DEFAULT 0,
  "last_updated"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenant_dp_budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_dp_budgets_tenant_id_key"
  ON "tenant_dp_budgets"("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_tenant_dp_budgets_lookup"
  ON "tenant_dp_budgets"("tenant_id", "epsilon_consumed");
