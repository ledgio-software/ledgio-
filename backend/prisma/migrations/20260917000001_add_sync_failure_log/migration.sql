-- CreateTable: sync_failure_logs
-- Stores every client-side sync outbox failure so operators can audit
-- what failed, which device caused it, and what the server rejected.
CREATE TABLE "sync_failure_logs" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "user_id"        TEXT,
    "entity_type"    TEXT NOT NULL,
    "entity_id"      TEXT,
    "operation_kind" TEXT NOT NULL,
    "client_txn_id"  TEXT,
    "failure_reason" TEXT,
    "http_status"    INTEGER,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_failure_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "sync_failure_logs_tenant_id_idx"                ON "sync_failure_logs"("tenant_id");
CREATE INDEX "sync_failure_logs_tenant_id_entity_type_idx"    ON "sync_failure_logs"("tenant_id", "entity_type");
CREATE INDEX "sync_failure_logs_tenant_id_created_at_idx"     ON "sync_failure_logs"("tenant_id", "created_at" DESC);
