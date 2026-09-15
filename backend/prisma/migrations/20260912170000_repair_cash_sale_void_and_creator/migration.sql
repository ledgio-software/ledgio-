-- Repair migration for 20260731121052_add_cash_sale_void_and_creator.
-- The original migration rolled back because DROP INDEX lacked IF EXISTS.
-- This migration re-applies all the same changes idempotently so partial
-- state from the failed run (e.g. the enum already created) is handled safely.

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "CashSaleStatus" AS ENUM ('COMPLETED', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex (now safe)
DROP INDEX IF EXISTS "tax_rates_code_idx";

-- AlterTable (idempotent)
ALTER TABLE "cash_sales"
  ADD COLUMN IF NOT EXISTS "created_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "CashSaleStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "void_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voided_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "voided_by_user_id" TEXT;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "cash_sales_tenant_id_created_by_user_id_idx" ON "cash_sales"("tenant_id", "created_by_user_id");
