-- Extend the ai_tenant_insights module constraint to include
-- 'next_action' (Phase 2 behavioral next-action prediction).

ALTER TABLE "ai_tenant_insights"
  DROP CONSTRAINT IF EXISTS "ai_tenant_insights_module_check";

ALTER TABLE "ai_tenant_insights"
  ADD CONSTRAINT "ai_tenant_insights_module_check"
  CHECK (module IN (
    'cash_forecast',
    'invoice_risk',
    'inventory_demand',
    'anomaly',
    'next_action'
  ));
