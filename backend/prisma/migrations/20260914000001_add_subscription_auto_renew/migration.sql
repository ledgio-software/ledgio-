-- Add auto-renewal fields to tenants table.
-- Stores the Paystack reusable authorization captured after first payment so
-- the daily cron can charge the saved card or MoMo without the user having
-- to initiate another checkout.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "paystack_auth_code"    TEXT,
  ADD COLUMN IF NOT EXISTS "paystack_auth_channel" TEXT,
  ADD COLUMN IF NOT EXISTS "paystack_auth_summary" TEXT,
  ADD COLUMN IF NOT EXISTS "auto_renew_enabled"    BOOLEAN NOT NULL DEFAULT TRUE;
