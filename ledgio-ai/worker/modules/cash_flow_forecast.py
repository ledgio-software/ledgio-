"""
Cash flow forecast using Facebook Prophet.
Predicts daily cash balance for the next 90 days and identifies the earliest
"danger day" when balance may go negative.
"""

import asyncpg
import pandas as pd
from datetime import date, timedelta
from typing import Any


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT
            je.entry_date::date AS ds,
            SUM(jel.credit - jel.debit) AS net_flow
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        JOIN accounts a ON a.id = jel.account_id
        WHERE je.status = 'POSTED'
          AND a.default_role = 'CASH'
          AND je.entry_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY je.entry_date::date
        ORDER BY ds
        """,
    )

    if len(rows) < 14:
        return []

    df = pd.DataFrame(rows, columns=["ds", "net_flow"])
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["net_flow"].astype(float).cumsum()

    try:
        from prophet import Prophet  # type: ignore

        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
            uncertainty_samples=0,
        )
        model.fit(df[["ds", "y"]])

        future = model.make_future_dataframe(periods=90)
        forecast = model.predict(future)
        future_forecast = forecast[forecast["ds"] > pd.Timestamp(date.today())][["ds", "yhat"]].copy()
        future_forecast["ds"] = future_forecast["ds"].dt.strftime("%Y-%m-%d")
    except Exception:
        return []

    current_balance = float(df["y"].iloc[-1]) if not df.empty else 0.0
    forecast_data = future_forecast.rename(columns={"yhat": "balance"}).to_dict(orient="records")

    danger_day = next(
        (r["ds"] for r in forecast_data if r["balance"] < 0),
        None,
    )

    insights = []

    if danger_day:
        days_away = (date.fromisoformat(danger_day) - date.today()).days
        insights.append(
            {
                "severity": "critical" if days_away <= 14 else "warning",
                "title": f"Cash balance may go negative in {days_away} days",
                "body": (
                    f"Based on your current spending and income patterns, your cash balance is "
                    f"projected to go negative around {danger_day}. Review your upcoming "
                    f"payables and accelerate collections where possible."
                ),
                "data": {
                    "current_balance": current_balance,
                    "danger_day": danger_day,
                    "days_away": days_away,
                    "forecast": forecast_data[:90],
                },
            }
        )
    else:
        balance_30d = next(
            (r["balance"] for r in forecast_data if r["ds"] == (date.today() + timedelta(30)).isoformat()),
            None,
        )
        if balance_30d is not None:
            insights.append(
                {
                    "severity": "info",
                    "title": "Cash flow looks healthy for the next 90 days",
                    "body": (
                        f"Projected cash balance in 30 days: {balance_30d:,.2f}. "
                        f"No negative-balance days detected in the 90-day forecast."
                    ),
                    "data": {
                        "current_balance": current_balance,
                        "danger_day": None,
                        "forecast": forecast_data[:90],
                    },
                }
            )

    return insights
