"""
Budget Burn Prediction — Pro tier only.

For each open fiscal period with budgets, computes:
- Burn rate: how much of the budget has been spent so far
- Projected spend at period end (linear extrapolation)
- Days remaining and estimated overrun amount

Emits one insight per account that is trending toward overrun,
plus a summary insight if multiple accounts are at risk.
"""

import asyncpg
from datetime import date, datetime
from typing import Any


# Minimum budget amount to bother reporting (avoids noise on $1 test budgets)
MIN_BUDGET = 100.0
# Warn when projected spend exceeds budget by this fraction
WARN_THRESHOLD = 0.90   # 90% consumed → warning
CRIT_THRESHOLD = 1.00   # 100% consumed / over → critical


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[dict[str, Any]]:
    today = date.today()

    rows = await conn.fetch(
        """
        SELECT
            b.id            AS budget_id,
            a.name          AS account_name,
            a.code          AS account_code,
            fp.name         AS period_name,
            fp.start_date::date AS period_start,
            fp.end_date::date   AS period_end,
            b.budget_amount::float AS budget_amount,
            b.actual_amount::float AS actual_amount
        FROM budgets b
        JOIN accounts a          ON a.id  = b.account_id
        JOIN fiscal_periods fp   ON fp.id = b.fiscal_period_id
        WHERE b.tenant_id  = $1::uuid
          AND fp.tenant_id = $1::uuid
          AND fp.status    = 'OPEN'
          AND fp.start_date <= CURRENT_DATE
          AND fp.end_date   >= CURRENT_DATE
          AND b.budget_amount > $2
        ORDER BY (b.actual_amount / NULLIF(b.budget_amount, 0)) DESC NULLS LAST
        """,
        tenant_id,
        MIN_BUDGET,
    )

    if not rows:
        return []

    insights: list[dict[str, Any]] = []

    for row in rows:
        budget_amount: float = row["budget_amount"]
        actual_amount: float = row["actual_amount"]
        period_start: date = row["period_start"]
        period_end: date = row["period_end"]
        account_name: str = row["account_name"]
        account_code: str = row["account_code"]
        period_name: str = row["period_name"]

        period_days = max((period_end - period_start).days, 1)
        elapsed_days = max((today - period_start).days, 1)
        remaining_days = max((period_end - today).days, 0)

        burn_rate_per_day = actual_amount / elapsed_days
        projected_total = burn_rate_per_day * period_days
        projected_overrun = projected_total - budget_amount
        burn_pct = actual_amount / budget_amount if budget_amount > 0 else 0.0
        projected_pct = projected_total / budget_amount if budget_amount > 0 else 0.0

        # Only surface accounts that are at least approaching the warning threshold
        if projected_pct < WARN_THRESHOLD and burn_pct < WARN_THRESHOLD:
            continue

        severity = "critical" if projected_pct >= CRIT_THRESHOLD or burn_pct >= CRIT_THRESHOLD else "warning"

        if burn_pct >= 1.0:
            title = f"{account_name} has exceeded its budget"
            body = (
                f"{account_name} ({account_code}) has spent {_fmt(actual_amount)} against "
                f"a {_fmt(budget_amount)} budget in {period_name} — "
                f"{_fmt(actual_amount - budget_amount)} over budget with {remaining_days} day(s) remaining."
            )
        elif projected_pct >= CRIT_THRESHOLD:
            title = f"{account_name} is on track to exceed budget"
            body = (
                f"At the current burn rate of {_fmt(burn_rate_per_day)}/day, "
                f"{account_name} ({account_code}) is projected to reach {_fmt(projected_total)} "
                f"against a {_fmt(budget_amount)} budget by end of {period_name} "
                f"(~{_fmt(projected_overrun)} overrun)."
            )
        else:
            body = (
                f"{account_name} ({account_code}) has consumed {burn_pct:.0%} of its "
                f"{_fmt(budget_amount)} budget with {remaining_days} day(s) remaining in {period_name}. "
                f"Projected spend: {_fmt(projected_total)}."
            )
            title = f"{account_name} nearing budget limit ({burn_pct:.0%} used)"

        insights.append({
            "module": "budget_burn",
            "severity": severity,
            "title": title,
            "body": body,
            "data": {
                "account_code": account_code,
                "account_name": account_name,
                "period_name": period_name,
                "budget_amount": budget_amount,
                "actual_amount": actual_amount,
                "projected_total": round(projected_total, 2),
                "projected_overrun": round(projected_overrun, 2),
                "burn_pct": round(burn_pct * 100, 1),
                "projected_pct": round(projected_pct * 100, 1),
                "days_remaining": remaining_days,
                "burn_rate_per_day": round(burn_rate_per_day, 2),
            },
        })

    return insights


def _fmt(amount: float) -> str:
    return f"${amount:,.2f}"
