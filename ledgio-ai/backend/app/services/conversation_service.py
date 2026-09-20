"""
Stores and retrieves AI conversation history from PostgreSQL.
All queries are protected by Row-Level Security (tenant-scoped).
"""

import uuid
from app.tools.executor import pool
from app.services.claude_service import ChatMessage


async def load_conversation(conversation_id: str, tenant_id: str) -> list[ChatMessage]:
    """Loads the last 20 messages for a conversation, scoped to the tenant."""
    db = await pool()
    async with db.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, true)", tenant_id
        )
        rows = await conn.fetch(
            """SELECT role, content
               FROM ai_conversation_messages
               WHERE conversation_id = $1
               ORDER BY created_at ASC
               LIMIT 20""",
            conversation_id,
        )
    return [ChatMessage(role=r["role"], content=r["content"]) for r in rows]


async def save_message(
    conversation_id: str,
    tenant_id: str,
    user_id: str,
    role: str,
    content: str,
) -> None:
    db = await pool()
    async with db.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, true)", tenant_id
        )
        await conn.execute(
            """INSERT INTO ai_conversation_messages
                 (id, conversation_id, tenant_id, user_id, role, content)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            str(uuid.uuid4()), conversation_id, tenant_id, user_id, role, content,
        )
        await conn.execute(
            "UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1",
            conversation_id,
        )


async def create_conversation(tenant_id: str, user_id: str) -> str:
    conversation_id = str(uuid.uuid4())
    db = await pool()
    async with db.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, true)", tenant_id
        )
        await conn.execute(
            "INSERT INTO ai_conversations (id, tenant_id, user_id) VALUES ($1, $2, $3)",
            conversation_id, tenant_id, user_id,
        )
    return conversation_id
