-- CreateTable: referral_partners
CREATE TABLE "referral_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "contacts" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_partners_code_key" ON "referral_partners"("code");

-- AlterTable: add referral_code to tenants
ALTER TABLE "tenants" ADD COLUMN "referral_code" TEXT;

-- CreateIndex
CREATE INDEX "tenants_referral_code_idx" ON "tenants"("referral_code");
