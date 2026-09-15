-- Transport Management Module

CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"   TEXT         NOT NULL,
  "reg_number"  TEXT         NOT NULL,
  "make"        TEXT,
  "model"       TEXT,
  "capacity"    INTEGER,
  "fuel_type"   TEXT,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transport_vehicles_tenant_reg_key"
  ON "transport_vehicles"("tenant_id", "reg_number");
CREATE INDEX IF NOT EXISTS "transport_vehicles_tenant_id_idx"
  ON "transport_vehicles"("tenant_id");

CREATE TABLE IF NOT EXISTS "transport_drivers" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"   TEXT         NOT NULL,
  "first_name"  TEXT         NOT NULL,
  "last_name"   TEXT         NOT NULL,
  "phone"       TEXT,
  "license_no"  TEXT,
  "license_exp" TIMESTAMP(3),
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_drivers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transport_drivers_tenant_id_idx"
  ON "transport_drivers"("tenant_id");

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"     TEXT         NOT NULL,
  "name"          TEXT         NOT NULL,
  "description"   TEXT,
  "vehicle_id"    TEXT,
  "driver_id"     TEXT,
  "morning_dep"   TEXT,
  "afternoon_dep" TEXT,
  "fee"           DECIMAL(15,2),
  "is_active"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_routes_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL,
  CONSTRAINT "transport_routes_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "transport_drivers"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "transport_routes_tenant_id_idx"
  ON "transport_routes"("tenant_id");

CREATE TABLE IF NOT EXISTS "transport_stops" (
  "id"        TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "route_id"  TEXT    NOT NULL,
  "name"      TEXT    NOT NULL,
  "order"     INTEGER NOT NULL,
  "landmark"  TEXT,
  CONSTRAINT "transport_stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_stops_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "transport_stops_route_id_idx"
  ON "transport_stops"("route_id");

CREATE TABLE IF NOT EXISTS "transport_fuel_logs" (
  "id"              TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"       TEXT          NOT NULL,
  "vehicle_id"      TEXT          NOT NULL,
  "date"            TIMESTAMP(3)  NOT NULL,
  "litres"          DECIMAL(8,2)  NOT NULL,
  "cost_per_litre"  DECIMAL(10,4) NOT NULL,
  "total_cost"      DECIMAL(15,2) NOT NULL,
  "odometer"        INTEGER,
  "station"         TEXT,
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_fuel_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_fuel_logs_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "transport_fuel_logs_tenant_id_idx"
  ON "transport_fuel_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "transport_fuel_logs_tenant_vehicle_idx"
  ON "transport_fuel_logs"("tenant_id", "vehicle_id");

CREATE TABLE IF NOT EXISTS "transport_maint_logs" (
  "id"            TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"     TEXT          NOT NULL,
  "vehicle_id"    TEXT          NOT NULL,
  "date"          TIMESTAMP(3)  NOT NULL,
  "type"          TEXT          NOT NULL,
  "description"   TEXT          NOT NULL,
  "cost"          DECIMAL(15,2) NOT NULL,
  "workshop"      TEXT,
  "next_due_date" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_maint_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_maint_logs_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "transport_maint_logs_tenant_id_idx"
  ON "transport_maint_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "transport_maint_logs_tenant_vehicle_idx"
  ON "transport_maint_logs"("tenant_id", "vehicle_id");
