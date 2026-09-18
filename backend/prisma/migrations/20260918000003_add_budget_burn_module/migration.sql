-- Extend the ai_tenant_insights module constraint to include
-- 'budget_burn' (Phase 1.5 budget burn prediction for Pro tier).

ALTER TABLE "ai_tenant_insights"
  DROP CONSTRAINT IF EXISTS "ai_tenant_insights_module_check";

ALTER TABLE "ai_tenant_insights"
  ADD CONSTRAINT "ai_tenant_insights_module_check"
  CHECK (module IN (
    'cash_forecast',
    'invoice_risk',
    'inventory_demand',
    'anomaly',
    'next_action',
    'budget_burn'
  ));
