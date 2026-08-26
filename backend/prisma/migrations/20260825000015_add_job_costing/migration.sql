-- CreateTable: jobs
CREATE TABLE "jobs" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "job_number"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "customer_id" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',
  "start_date"  TIMESTAMP(3),
  "end_date"    TIMESTAMP(3),
  "description" TEXT,
  "invoice_id"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_cost_lines
CREATE TABLE "job_cost_lines" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "job_id"      TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity"    DECIMAL(15,4) NOT NULL,
  "unit_cost"   DECIMAL(15,4) NOT NULL,
  "amount"      DECIMAL(15,2) NOT NULL,
  "account_id"  TEXT,
  "journal_id"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_work_orders
CREATE TABLE "job_work_orders" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "job_id"      TEXT,
  "type"        TEXT NOT NULL,
  "vendor_id"   TEXT,
  "item_id"     TEXT,
  "quantity"    DECIMAL(15,4) NOT NULL,
  "due_date"    TIMESTAMP(3),
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "bill_id"     TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_tenant_id_idx" ON "jobs"("tenant_id");
CREATE INDEX "jobs_tenant_id_status_idx" ON "jobs"("tenant_id", "status");
CREATE INDEX "job_cost_lines_tenant_id_job_id_idx" ON "job_cost_lines"("tenant_id", "job_id");
CREATE INDEX "job_work_orders_tenant_id_idx" ON "job_work_orders"("tenant_id");
CREATE INDEX "job_work_orders_tenant_id_job_id_idx" ON "job_work_orders"("tenant_id", "job_id");

-- AddForeignKey
ALTER TABLE "job_cost_lines" ADD CONSTRAINT "job_cost_lines_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
