-- SSNIT Payroll Compliance

-- Extend employees table with SSNIT registration fields
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "ssnit_number"   TEXT,
  ADD COLUMN IF NOT EXISTS "tier2_scheme"   TEXT,
  ADD COLUMN IF NOT EXISTS "tier2_member_no" TEXT;

CREATE INDEX IF NOT EXISTS "employees_ssnit_number_idx" ON "employees"("ssnit_number") WHERE "ssnit_number" IS NOT NULL;

-- Monthly SSNIT submission schedules
CREATE TABLE IF NOT EXISTS "ssnit_schedules" (
  "id"                    TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"             TEXT          NOT NULL,
  "period_month"          INTEGER       NOT NULL, -- 1-12
  "period_year"           INTEGER       NOT NULL,
  "payroll_run_id"        TEXT,
  "status"                TEXT          NOT NULL DEFAULT 'DRAFT', -- DRAFT | SUBMITTED
  "submitted_at"          TIMESTAMP(3),
  "submitted_by"          TEXT,
  "total_tier1_employee"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tier1_employer"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tier2_employer"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "generated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ssnit_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ssnit_schedules_tenant_period_key"
  ON "ssnit_schedules"("tenant_id", "period_month", "period_year");
CREATE INDEX IF NOT EXISTS "ssnit_schedules_tenant_id_idx"
  ON "ssnit_schedules"("tenant_id");

-- Per-employee line items within a schedule
CREATE TABLE IF NOT EXISTS "ssnit_schedule_lines" (
  "id"                TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "schedule_id"       TEXT          NOT NULL,
  "employee_id"       TEXT          NOT NULL,
  "employee_number"   TEXT          NOT NULL,
  "first_name"        TEXT          NOT NULL,
  "last_name"         TEXT          NOT NULL,
  "ssnit_number"      TEXT,
  "gross_salary"      DECIMAL(15,2) NOT NULL,
  "tier1_employee"    DECIMAL(15,2) NOT NULL,
  "tier1_employer"    DECIMAL(15,2) NOT NULL,
  "tier2_employer"    DECIMAL(15,2) NOT NULL,
  CONSTRAINT "ssnit_schedule_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ssnit_schedule_lines_schedule_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "ssnit_schedules"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ssnit_schedule_lines_schedule_id_idx"
  ON "ssnit_schedule_lines"("schedule_id");
