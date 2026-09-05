-- Add pos_enabled flag to tenants (default true = POS visible, same as before)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pos_enabled BOOLEAN NOT NULL DEFAULT true;
