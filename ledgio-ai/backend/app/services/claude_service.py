"""
Claude Sonnet 4.6 integration with agentic tool-use loop.
Uses Anthropic Prompt Caching on the static system prompt.
"""

import json
import os
from dataclasses import dataclass
from typing import Any

import anthropic

from app.tools.definitions import AI_TOOLS
from app.tools.executor import execute_tool
from app.prompts.base_system_prompt import build_system_prompt

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


@dataclass
class ChatMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class ChatContext:
    tenant_id: str
    sector: str
    business_name: str
    user_tier: str


async def run_chat_turn(messages: list[ChatMessage], context: ChatContext) -> str:
    """
    Runs one conversational turn with Claude Sonnet 4.6.
    Includes the full agentic tool-use loop — Claude calls tools until it
    produces a final text response.
    """
    system_prompt = build_system_prompt(context.sector, context.business_name)

    anthropic_messages: list[dict[str, Any]] = [
        {"role": m.role, "content": m.content} for m in messages
    ]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                # Cache the static system prompt — saves up to 90% on repeated requests
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=AI_TOOLS,
        messages=anthropic_messages,
    )

    # Agentic loop: keep calling tools until Claude stops with end_turn
    while response.stop_reason == "tool_use":
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        tool_results = []
        for tool_use in tool_use_blocks:
            result = await execute_tool(
                tool_name=tool_use.name,
                tool_input=tool_use.input,
                tenant_id=context.tenant_id,
            )
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": json.dumps(result, default=str),
                }
            )

        anthropic_messages.append({"role": "assistant", "content": response.content})
        anthropic_messages.append({"role": "user", "content": tool_results})

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=AI_TOOLS,
            messages=anthropic_messages,
        )

    # Extract the final text block
    for block in response.content:
        if block.type == "text":
            return block.text

    return "I was unable to generate a response. Please try again."
