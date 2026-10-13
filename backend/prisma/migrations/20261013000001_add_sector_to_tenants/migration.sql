-- Sector slug (matches ledgio-hub sectorPricing.ts) drives per-sector plan names and prices.
ALTER TABLE "public"."tenants"
  ADD COLUMN IF NOT EXISTS "sector" TEXT NOT NULL DEFAULT 'retail';

-- Backfill existing tenants from org_type so they keep a sensible sector.
UPDATE "public"."tenants" SET "sector" = CASE "org_type"
  WHEN 'SCHOOL'       THEN 'schools'
  WHEN 'NONPROFIT'    THEN 'churches-ngos'
  WHEN 'CHURCH'       THEN 'churches-ngos'
  WHEN 'NGO'          THEN 'churches-ngos'
  WHEN 'PHARMACY'     THEN 'pharmacy'
  WHEN 'HOSPITALITY'  THEN 'hospitality'
  WHEN 'WHOLESALE'    THEN 'wholesale'
  WHEN 'CONSTRUCTION' THEN 'construction'
  WHEN 'SERVICE'      THEN 'professional-services'
  ELSE 'retail'
END;
