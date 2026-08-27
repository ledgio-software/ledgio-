-- Add prev_hash column to audit_logs for tamper-evident hash chaining.
-- Nullable so existing rows are unaffected; new rows will have a hash.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS prev_hash TEXT;
