-- CreateTable: cost_categories
CREATE TABLE "cost_categories" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add cost_category_id to journal_entry_lines
ALTER TABLE "journal_entry_lines" ADD COLUMN "cost_category_id" TEXT;

-- CreateIndex
CREATE INDEX "cost_categories_tenant_id_idx" ON "cost_categories"("tenant_id");
CREATE INDEX "journal_entry_lines_cost_category_id_idx" ON "journal_entry_lines"("cost_category_id");

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_cost_category_id_fkey"
  FOREIGN KEY ("cost_category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
