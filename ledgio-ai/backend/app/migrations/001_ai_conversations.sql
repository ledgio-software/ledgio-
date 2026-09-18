-- Ledgio AI: conversation storage with Row-Level Security
-- Run once against your PostgreSQL database

BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL,
  user_id          UUID NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  input_tokens     INTEGER,
  output_tokens    INTEGER,
  cached_tokens    INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant    ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation   ON ai_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_time    ON ai_conversation_messages(tenant_id, created_at DESC);

-- Row-Level Security: each tenant only sees its own data
ALTER TABLE ai_conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_ai_conversations         ON ai_conversations;
DROP POLICY IF EXISTS rls_ai_conversation_messages ON ai_conversation_messages;

CREATE POLICY rls_ai_conversations ON ai_conversations
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY rls_ai_conversation_messages ON ai_conversation_messages
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

COMMIT;
