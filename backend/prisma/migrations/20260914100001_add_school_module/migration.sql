-- School Module: students, academic_terms, fee_schedules

CREATE TABLE IF NOT EXISTS "students" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"      TEXT        NOT NULL,
  "student_code"   TEXT        NOT NULL,
  "first_name"     TEXT        NOT NULL,
  "last_name"      TEXT        NOT NULL,
  "class_name"     TEXT        NOT NULL,
  "guardian_name"  TEXT        NOT NULL,
  "guardian_phone" TEXT        NOT NULL,
  "guardian_email" TEXT,
  "date_of_birth"  TIMESTAMP(3),
  "is_active"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "students_tenant_id_student_code_key" ON "students"("tenant_id","student_code");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "students_tenant_id_idx" ON "students"("tenant_id");
CREATE INDEX IF NOT EXISTS "students_tenant_id_class_name_idx" ON "students"("tenant_id","class_name");

CREATE TABLE IF NOT EXISTS "academic_terms" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"    TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "academic_year" TEXT        NOT NULL,
  "start_date"   TIMESTAMP(3) NOT NULL,
  "end_date"     TIMESTAMP(3) NOT NULL,
  "is_current"   BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "academic_terms_tenant_id_idx" ON "academic_terms"("tenant_id");

CREATE TABLE IF NOT EXISTS "fee_schedules" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT         NOT NULL,
  "term_id"    TEXT         NOT NULL,
  "fee_name"   TEXT         NOT NULL,
  "class_name" TEXT,
  "amount"     DECIMAL(15,2) NOT NULL,
  "due_date"   TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_schedules_term_id_fkey" FOREIGN KEY ("term_id")
    REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "fee_schedules_tenant_id_idx" ON "fee_schedules"("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_schedules_tenant_id_term_id_idx" ON "fee_schedules"("tenant_id","term_id");
