-- CreateTable
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigned_to" TEXT,
    "tenant_id" TEXT,
    "tenant_name" TEXT,
    "error_log_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");
CREATE INDEX IF NOT EXISTS "support_tickets_tenant_id_idx" ON "support_tickets"("tenant_id");
