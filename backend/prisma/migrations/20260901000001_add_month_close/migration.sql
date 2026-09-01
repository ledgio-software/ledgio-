-- CreateTable
CREATE TABLE "month_closes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by_user_id" TEXT,
    "closed_by_name" TEXT,
    "total_sales" DECIMAL(15,2) NOT NULL,
    "total_cash_sales" DECIMAL(15,2) NOT NULL,
    "total_credit_sales" DECIMAL(15,2) NOT NULL,
    "transaction_count" INTEGER NOT NULL,
    "top_products" JSONB NOT NULL,
    "summary" JSONB NOT NULL,

    CONSTRAINT "month_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "month_closes_tenant_id_idx" ON "month_closes"("tenant_id");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "month_closes_tenant_id_year_month_key" ON "month_closes"("tenant_id", "year", "month");
