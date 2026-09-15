-- Flexible Fee Payment Plans

CREATE TABLE IF NOT EXISTS "fee_payment_plans" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"    TEXT         NOT NULL,
  "student_id"   TEXT         NOT NULL,
  "term_id"      TEXT         NOT NULL,
  "schedule_id"  TEXT         NOT NULL,
  "total_amount" DECIMAL(15,2) NOT NULL,
  "notes"        TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'ACTIVE',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_payment_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fee_payment_plans_tenant_id_idx"
  ON "fee_payment_plans"("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_payment_plans_tenant_student_idx"
  ON "fee_payment_plans"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "fee_payment_plans_tenant_term_idx"
  ON "fee_payment_plans"("tenant_id", "term_id");

CREATE TABLE IF NOT EXISTS "fee_installments" (
  "id"            TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "plan_id"       TEXT          NOT NULL,
  "due_date"      TIMESTAMP(3)  NOT NULL,
  "amount"        DECIMAL(15,2) NOT NULL,
  "amount_paid"   DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status"        TEXT          NOT NULL DEFAULT 'PENDING',
  "paid_at"       TIMESTAMP(3),
  "payment_mode"  TEXT,
  "notes"         TEXT,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_installments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_installments_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "fee_payment_plans"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "fee_installments_plan_id_idx"
  ON "fee_installments"("plan_id");
