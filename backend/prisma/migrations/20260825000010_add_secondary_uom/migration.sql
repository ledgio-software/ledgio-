-- Migration: add secondary unit of measure and conversion factor to inventory_items.
-- Enables dual UoM: e.g. primary = "pcs", secondary = "Carton" with factor 12
-- means 1 Carton = 12 pcs. Purchase orders and receiving can enter quantity
-- in secondary UoM and the system auto-converts before writing stock.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS secondary_unit_of_measure TEXT,
  ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(10, 4);
