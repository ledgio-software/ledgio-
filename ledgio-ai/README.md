# Ledgio AI

Claude-powered financial assistant embedded in the Ledgio accounting platform.

## Stack

| Layer | Technology |
|---|---|
| AI Model | Claude Sonnet 4.6 (Anthropic) |
| Backend | Python 3.11 + FastAPI |
| Database | PostgreSQL with Row-Level Security |
| Frontend | React + TypeScript (chat widget) |

## Structure

```
ledgio-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI application entry point
│   │   ├── routes/
│   │   │   ├── chat.py               # POST /api/ai/chat
│   │   │   └── health.py             # GET /health
│   │   ├── services/
│   │   │   ├── claude_service.py     # Claude API + agentic tool loop
│   │   │   └── conversation_service.py  # Conversation history (PostgreSQL)
│   │   ├── tools/
│   │   │   ├── definitions.py        # Tool schemas sent to Claude
│   │   │   └── executor.py           # Tool query implementations
│   │   ├── middleware/
│   │   │   └── tenant_auth.py        # JWT → TenantContext
│   │   ├── prompts/
│   │   │   └── base_system_prompt.py # Cached system prompt
│   │   └── migrations/
│   │       └── 001_ai_conversations.sql
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── hooks/useLedgioAI.ts      # Chat state + API calls
        └── components/LedgioAIChat.tsx  # Chat UI widget
```

## Running locally

```bash
cd ledgio-ai/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY and DATABASE_URL
uvicorn app.main:app --reload --port 4000
```

## Key design decisions

- **Prompt caching**: The static system prompt is sent with `cache_control: ephemeral`, reducing token costs by up to 90% on repeat requests
- **RLS tenant isolation**: Every DB query sets `app.tenant_id` before execution so PostgreSQL RLS ensures tenants never see each other's data
- **Agentic tool loop**: Claude calls tools (inventory, invoices, P&L, VAT, payroll) autonomously until it has enough data to answer the user
- **JWT passthrough**: Ledgio AI never stores credentials — it decodes the JWT from the main auth service to extract `tenantId`, `sector`, and `tier`
