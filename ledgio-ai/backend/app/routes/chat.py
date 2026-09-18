from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.tenant_auth import TenantContext, get_tenant_context
from app.services.claude_service import run_chat_turn, ChatMessage, ChatContext
from app.services.conversation_service import (
    load_conversation,
    save_message,
    create_conversation,
)

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    business_name: Optional[str] = Field(None, max_length=200)


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    conversation_id = body.conversation_id
    if not conversation_id:
        conversation_id = await create_conversation(ctx.tenant_id, ctx.user_id)

    history = await load_conversation(conversation_id, ctx.tenant_id)
    await save_message(conversation_id, ctx.tenant_id, ctx.user_id, "user", body.message)

    all_messages = history + [ChatMessage(role="user", content=body.message)]

    reply = await run_chat_turn(
        messages=all_messages,
        context=ChatContext(
            tenant_id=ctx.tenant_id,
            sector=ctx.sector,
            business_name=body.business_name or "your business",
            user_tier=ctx.tier,
        ),
    )

    await save_message(conversation_id, ctx.tenant_id, ctx.user_id, "assistant", reply)

    return ChatResponse(conversation_id=conversation_id, reply=reply)


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
):
    messages = await load_conversation(conversation_id, ctx.tenant_id)
    return {"messages": [{"role": m.role, "content": m.content} for m in messages]}
