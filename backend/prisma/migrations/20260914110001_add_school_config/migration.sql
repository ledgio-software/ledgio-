-- AddColumn: school_config on tenants (nullable JSON string for school module config)
ALTER TABLE "tenants" ADD COLUMN "school_config" TEXT;
