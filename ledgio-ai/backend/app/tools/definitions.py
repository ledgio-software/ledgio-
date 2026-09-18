"""
MCP tool definitions passed to Claude Sonnet 4.6.
Each tool maps to a query against the tenant's isolated PostgreSQL schema (RLS-enforced).
"""

AI_TOOLS = [
    {
        "name": "get_cash_position",
        "description": (
            "Returns current cash and bank balances for the tenant. "
            "Use when the user asks about cash, bank balance, or liquidity."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "as_of_date": {
                    "type": "string",
                    "description": "ISO date YYYY-MM-DD. Defaults to today if omitted.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_outstanding_invoices",
        "description": (
            "Fetches unpaid customer invoices. "
            "Optionally filter by overdue status or customer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "overdue_only": {"type": "boolean"},
                "customer_id": {"type": "string"},
                "limit": {"type": "integer", "description": "Max records to return. Default 20."},
            },
            "required": [],
        },
    },
    {
        "name": "get_inventory_alerts",
        "description": (
            "Returns items below reorder level or nearing expiry (pharmacy). "
            "Useful for stock shortage questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "alert_type": {
                    "type": "string",
                    "enum": ["low_stock", "expiry", "all"],
                    "description": "Filter by alert category.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_profit_loss",
        "description": "Returns a P&L summary for a given period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["this_month", "last_month", "this_quarter", "this_year", "custom"],
                },
                "from_date": {"type": "string", "description": "Required when period=custom."},
                "to_date": {"type": "string", "description": "Required when period=custom."},
            },
            "required": ["period"],
        },
    },
    {
        "name": "get_vat_summary",
        "description": (
            "Returns VAT collected and reclaimable input VAT for a period. "
            "Includes GRA e-VAT compliance status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["this_month", "last_month", "this_quarter"],
                }
            },
            "required": ["period"],
        },
    },
    {
        "name": "get_payroll_summary",
        "description": (
            "Returns payroll totals, PAYE, and SSNIT liability "
            "for the current or specified month."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "YYYY-MM. Defaults to current month."}
            },
            "required": [],
        },
    },
    {
        "name": "search_transactions",
        "description": "Full-text search across ledger entries, invoices, and bills.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural-language search term."},
                "limit": {"type": "integer"},
            },
            "required": ["query"],
        },
    },
]
