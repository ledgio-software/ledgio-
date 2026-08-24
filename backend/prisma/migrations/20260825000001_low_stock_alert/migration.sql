-- Low-stock alert guard column on inventory_items
-- Prevents repeat notifications within 24 hours for the same item.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS last_low_stock_alert_at TIMESTAMP(3);
