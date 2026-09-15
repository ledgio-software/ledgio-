-- Parent Communication Portal

CREATE TABLE IF NOT EXISTS "parent_messages" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"    TEXT         NOT NULL,
  "student_id"   TEXT         NOT NULL,
  "type"         TEXT         NOT NULL,
  "channel"      TEXT         NOT NULL,
  "recipient"    TEXT         NOT NULL,
  "message"      TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'SENT',
  "sent_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_by"      TEXT,
  "reference_id" TEXT,
  CONSTRAINT "parent_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "parent_messages_tenant_id_idx"
  ON "parent_messages"("tenant_id");
CREATE INDEX IF NOT EXISTS "parent_messages_tenant_student_idx"
  ON "parent_messages"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "parent_messages_tenant_type_idx"
  ON "parent_messages"("tenant_id", "type");
