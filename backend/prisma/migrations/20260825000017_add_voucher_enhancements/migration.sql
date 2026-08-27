-- CreateTable: scenarios
CREATE TABLE "scenarios" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: voucher_classes
CREATE TABLE "voucher_classes" (
  "id"                        TEXT NOT NULL,
  "tenant_id"                 TEXT NOT NULL,
  "name"                      TEXT NOT NULL,
  "voucher_type"              TEXT NOT NULL,
  "default_debit_account_id"  TEXT,
  "default_credit_account_id" TEXT,
  "narration_template"        TEXT,
  "is_active"                 BOOLEAN NOT NULL DEFAULT true,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voucher_classes_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add voucher fields to journal_entries
ALTER TABLE "journal_entries"
  ADD COLUMN "voucher_type"    TEXT NOT NULL DEFAULT 'JOURNAL',
  ADD COLUMN "scenario_id"     TEXT,
  ADD COLUMN "voucher_class_id" TEXT;

-- CreateIndex
CREATE INDEX "scenarios_tenant_id_idx" ON "scenarios"("tenant_id");
CREATE INDEX "voucher_classes_tenant_id_idx" ON "voucher_classes"("tenant_id");
CREATE INDEX "journal_entries_scenario_id_idx" ON "journal_entries"("scenario_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_scenario_id_fkey"
  FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_voucher_class_id_fkey"
  FOREIGN KEY ("voucher_class_id") REFERENCES "voucher_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
