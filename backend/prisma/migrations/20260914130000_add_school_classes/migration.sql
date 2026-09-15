-- School Classes registry: structured class/grade management for NONPROFIT tenants

CREATE TABLE IF NOT EXISTS "school_classes" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT         NOT NULL,
  "name"       TEXT         NOT NULL,
  "level"      TEXT         NOT NULL,
  "capacity"   INTEGER      NOT NULL DEFAULT 30,
  "is_active"  BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_classes_tenant_id_name_key"
  ON "school_classes"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "school_classes_tenant_id_idx"
  ON "school_classes"("tenant_id");
