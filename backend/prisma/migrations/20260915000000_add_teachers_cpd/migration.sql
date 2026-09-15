-- NTC Teacher Registry and CPD Activity Tracker

CREATE TABLE IF NOT EXISTS "teachers" (
  "id"              TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"       TEXT         NOT NULL,
  "staff_id"        TEXT,
  "first_name"      TEXT         NOT NULL,
  "last_name"       TEXT         NOT NULL,
  "email"           TEXT,
  "phone"           TEXT,
  "subject"         TEXT,
  "class_name"      TEXT,
  "ntc_license_no"  TEXT,
  "ntc_issue_date"  TIMESTAMP(3),
  "ntc_expiry_date" TIMESTAMP(3),
  "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teachers_tenant_id_staff_id_key"
  ON "teachers"("tenant_id", "staff_id") WHERE "staff_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "teachers_tenant_id_idx"
  ON "teachers"("tenant_id");

CREATE TABLE IF NOT EXISTS "cpd_activities" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"   TEXT         NOT NULL,
  "teacher_id"  TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "category"    TEXT         NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "hours"       DECIMAL(5,1) NOT NULL,
  "provider"    TEXT,
  "certificate" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cpd_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cpd_activities_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "cpd_activities_tenant_id_teacher_id_idx"
  ON "cpd_activities"("tenant_id", "teacher_id");
