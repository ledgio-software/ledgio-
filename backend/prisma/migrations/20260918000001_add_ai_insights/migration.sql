-- CreateTable: ai_tenant_insights
-- Stores computed intelligence insights (cash forecast, invoice risk, inventory demand,
-- anomaly detection) written by the nightly ledgio-ai worker process.
CREATE TABLE "ai_tenant_insights" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID NOT NULL,
    "module"       TEXT NOT NULL,
    "severity"     TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "data"         JSONB,
    "computed_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expires_at"   TIMESTAMPTZ,
    "dismissed_at" TIMESTAMPTZ,
    "dismissed_by" UUID,

    CONSTRAINT "ai_tenant_insights_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_tenant_insights_module_check" CHECK (
        "module" IN ('cash_flow_forecast', 'invoice_risk_score', 'inventory_demand', 'anomaly_detection', 'budget_burn')
    ),
    CONSTRAINT "ai_tenant_insights_severity_check" CHECK (
        "severity" IN ('info', 'warning', 'critical')
    )
);

CREATE INDEX "idx_ai_insights_tenant" ON "ai_tenant_insights"("tenant_id", "computed_at" DESC);
CREATE INDEX "idx_ai_insights_tenant_module" ON "ai_tenant_insights"("tenant_id", "module");

-- CreateTable: behavior_events
-- Phase 2 prep: per-tenant user behavior event log for BERT4Rec sequential modeling.
-- Populated from audit_logs by a future hourly collector job; not used in Phase 1.
CREATE TABLE "behavior_events" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL,
    "user_id"     UUID NOT NULL,
    "event_type"  TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id"   UUID,
    "metadata"    JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "behavior_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_behavior_tenant_user" ON "behavior_events"("tenant_id", "user_id", "occurred_at" DESC);
CREATE INDEX "idx_behavior_tenant_occurred" ON "behavior_events"("tenant_id", "occurred_at" DESC);
