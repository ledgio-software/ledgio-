CREATE INDEX IF NOT EXISTS "notifications_tenant_id_user_id_created_at_idx"
  ON "notifications" ("tenant_id", "user_id", "created_at" DESC);
