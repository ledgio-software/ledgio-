"""
Executes tool calls requested by Claude.
All queries are scoped to the tenant's PostgreSQL schema via Row-Level Security.
"""

import asyncpg
import os
from datetime import date, datetime
from typing import Any


async def get_db_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(os.environ["DATABASE_URL"])


_pool: asyncpg.Pool | None = None


async def pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    return _pool


async def execute_tool(tool_name: str, tool_input: dict, tenant_id: str) -> Any:
    """Routes tool calls to the correct query function."""
    db = await pool()
    async with db.acquire() as conn:
        # Activate Row-Level Security for this tenant
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, true)", tenant_id
        )
        handlers = {
            "get_cash_position": _get_cash_position,
            "get_outstanding_invoices": _get_outstanding_invoices,
            "get_inventory_alerts": _get_inventory_alerts,
            "get_profit_loss": _get_profit_loss,
            "get_vat_summary": _get_vat_summary,
            "get_payroll_summary": _get_payroll_summary,
            "search_transactions": _search_transactions,
        }
        handler = handlers.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        return await handler(conn, tool_input)


async def _get_cash_position(conn: asyncpg.Connection, inp: dict) -> dict:
    as_of = inp.get("as_of_date", date.today().isoformat())
    rows = await conn.fetch(
        """SELECT account_name, balance
           FROM chart_of_accounts
           WHERE account_type IN ('cash', 'bank')
             AND effective_date <= $1
           ORDER BY account_name""",
        as_of,
    )
    return {"as_of": as_of, "accounts": [dict(r) for r in rows]}


async def _get_outstanding_invoices(conn: asyncpg.Connection, inp: dict) -> dict:
    limit = inp.get("limit", 20)
    overdue_only = inp.get("overdue_only", False)
    customer_id = inp.get("customer_id")

    conditions = ["i.status = 'unpaid'"]
    params: list[Any] = [limit]

    if overdue_only:
        conditions.append("i.due_date < CURRENT_DATE")
    if customer_id:
        params.append(customer_id)
        conditions.append(f"i.customer_id = ${len(params)}")

    where = " AND ".join(conditions)
    rows = await conn.fetch(
        f"""SELECT i.id, i.invoice_number, c.name AS customer,
                   i.total_amount, i.due_date,
                   (CURRENT_DATE - i.due_date) AS days_overdue
            FROM invoices i
            JOIN customers c ON c.id = i.customer_id
            WHERE {where}
            ORDER BY i.due_date ASC
            LIMIT $1""",
        *params,
    )
    return {"invoices": [dict(r) for r in rows], "count": len(rows)}


async def _get_inventory_alerts(conn: asyncpg.Connection, inp: dict) -> dict:
    alert_type = inp.get("alert_type", "all")
    if alert_type == "low_stock":
        where = "WHERE quantity_on_hand <= reorder_level"
    elif alert_type == "expiry":
        where = "WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'"
    else:
        where = "WHERE quantity_on_hand <= reorder_level OR expiry_date <= CURRENT_DATE + INTERVAL '30 days'"

    rows = await conn.fetch(
        f"""SELECT product_name, quantity_on_hand, reorder_level, expiry_date
            FROM inventory_items
            {where}
            ORDER BY expiry_date ASC NULLS LAST, quantity_on_hand ASC
            LIMIT 50"""
    )
    return {"alerts": [dict(r) for r in rows]}


async def _get_profit_loss(conn: asyncpg.Connection, inp: dict) -> dict:
    period = inp["period"]
    today = date.today()

    if period == "this_month":
        from_date = today.replace(day=1).isoformat()
        to_date = today.isoformat()
    elif period == "last_month":
        first_of_this = today.replace(day=1)
        last_of_prev = (first_of_this - __import__("datetime").timedelta(days=1))
        from_date = last_of_prev.replace(day=1).isoformat()
        to_date = last_of_prev.isoformat()
    elif period == "this_year":
        from_date = today.replace(month=1, day=1).isoformat()
        to_date = today.isoformat()
    else:
        from_date = inp.get("from_date", today.isoformat())
        to_date = inp.get("to_date", today.isoformat())

    row = await conn.fetchrow(
        """SELECT
             SUM(CASE WHEN account_type = 'revenue' THEN amount ELSE 0 END) AS total_revenue,
             SUM(CASE WHEN account_type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
             SUM(CASE WHEN account_type = 'revenue' THEN amount ELSE -amount END) AS net_profit
           FROM journal_lines jl
           JOIN chart_of_accounts coa ON coa.id = jl.account_id
           WHERE jl.transaction_date BETWEEN $1 AND $2
             AND coa.account_type IN ('revenue', 'expense')""",
        from_date,
        to_date,
    )
    return {"period": {"from": from_date, "to": to_date}, **(dict(row) if row else {})}


async def _get_vat_summary(conn: asyncpg.Connection, inp: dict) -> dict:
    return {
        "period": inp.get("period"),
        "output_vat": None,
        "input_vat": None,
        "net_vat_payable": None,
        "note": "VAT module integration pending GRA e-VAT VSDC API setup",
    }


async def _get_payroll_summary(conn: asyncpg.Connection, inp: dict) -> dict:
    month = inp.get("month", datetime.today().strftime("%Y-%m"))
    row = await conn.fetchrow(
        """SELECT
             COUNT(*) AS employee_count,
             SUM(gross_salary) AS total_gross,
             SUM(paye_tax) AS total_paye,
             SUM(ssnit_employee) AS total_ssnit_employee,
             SUM(ssnit_employer) AS total_ssnit_employer,
             SUM(net_salary) AS total_net
           FROM payroll_runs
           WHERE pay_month = $1""",
        month,
    )
    return {"month": month, **(dict(row) if row else {})}


async def _search_transactions(conn: asyncpg.Connection, inp: dict) -> dict:
    rows = await conn.fetch(
        """SELECT id, transaction_date, description, amount, account_name
           FROM ledger_entries_view
           WHERE to_tsvector('english', description) @@ plainto_tsquery('english', $1)
           ORDER BY transaction_date DESC
           LIMIT $2""",
        inp["query"],
        inp.get("limit", 20),
    )
    return {"results": [dict(r) for r in rows], "count": len(rows)}
