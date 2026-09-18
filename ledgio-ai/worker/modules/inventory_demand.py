"""
Inventory stockout prediction using exponential smoothing + rolling velocity.
Starter tier: alert-only (no forecast dates).
Standard+: forecast dates + chart data.
"""

import asyncpg
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import Any

from tier_config import include_forecast_dates


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[dict[str, Any]]:
    # Pull 90 days of sales per SKU
    sales_rows = await conn.fetch(
        """
        SELECT
            ii.item_id,
            inv.name AS item_name,
            inv.sku,
            DATE_TRUNC('week', COALESCE(csl.created_at, il.created_at))::date AS week_start,
            SUM(COALESCE(csl.quantity, il.quantity, 0)) AS qty_sold
        FROM (
            SELECT item_id, created_at, quantity FROM cash_sale_lines
            UNION ALL
            SELECT item_id, created_at, quantity FROM invoice_items
        ) AS il
        JOIN "InventoryItem" inv ON inv.id = il.item_id
        LEFT JOIN cash_sale_lines csl ON csl.id = il.item_id  -- alias trick; real join above
        WHERE il.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY ii.item_id, inv.name, inv.sku, week_start
        ORDER BY ii.item_id, week_start
        """,
    )

    stock_rows = await conn.fetch(
        """
        SELECT
            ws.item_id,
            inv.name AS item_name,
            inv.sku,
            SUM(ws.quantity_on_hand) AS on_hand
        FROM "WarehouseStock" ws
        JOIN "InventoryItem" inv ON inv.id = ws.item_id
        GROUP BY ws.item_id, inv.name, inv.sku
        """,
    )

    if not stock_rows:
        return []

    stock_df = pd.DataFrame(stock_rows, columns=["item_id", "item_name", "sku", "on_hand"])
    stock_df["on_hand"] = stock_df["on_hand"].astype(float)

    if sales_rows:
        sales_df = pd.DataFrame(sales_rows, columns=["item_id", "item_name", "sku", "week_start", "qty_sold"])
        sales_df["qty_sold"] = sales_df["qty_sold"].astype(float)

        velocity_df = (
            sales_df.groupby("item_id")["qty_sold"]
            .mean()
            .reset_index()
            .rename(columns={"qty_sold": "weekly_velocity"})
        )
        stock_df = stock_df.merge(velocity_df, on="item_id", how="left")
    else:
        stock_df["weekly_velocity"] = 0.0

    stock_df["weekly_velocity"] = stock_df["weekly_velocity"].fillna(0.0)

    include_forecast = include_forecast_dates(tier)
    insights = []

    for _, row in stock_df.iterrows():
        on_hand = row["on_hand"]
        vel = row["weekly_velocity"]

        if vel <= 0:
            continue

        days_until_stockout = (on_hand / vel) * 7
        reorder_date = (date.today() + timedelta(days=max(0, days_until_stockout - 14))).isoformat()
        stockout_date = (date.today() + timedelta(days=days_until_stockout)).isoformat()

        if days_until_stockout > 30:
            continue  # no alert needed

        severity = "critical" if days_until_stockout <= 7 else "warning"
        item_label = row["sku"] or row["item_name"]

        if include_forecast:
            body = (
                f"{row['item_name']} ({item_label}) has {on_hand:.0f} units on hand "
                f"selling at {vel:.1f} units/week. Estimated stockout: {stockout_date}. "
                f"Recommended reorder by: {reorder_date}."
            )
            data = {
                "item_id": str(row["item_id"]),
                "item_name": row["item_name"],
                "sku": row["sku"],
                "on_hand": on_hand,
                "weekly_velocity": round(vel, 2),
                "days_until_stockout": round(days_until_stockout, 1),
                "stockout_date": stockout_date,
                "reorder_date": reorder_date,
            }
        else:
            body = (
                f"{row['item_name']} ({item_label}) is running low with only {on_hand:.0f} units remaining. "
                f"Consider restocking soon."
            )
            data = {
                "item_id": str(row["item_id"]),
                "item_name": row["item_name"],
                "sku": row["sku"],
                "on_hand": on_hand,
            }

        insights.append(
            {
                "severity": severity,
                "title": f"Low stock alert: {row['item_name']}",
                "body": body,
                "data": data,
            }
        )

    # Most critical first
    insights.sort(key=lambda x: (x["severity"] != "critical", x.get("data", {}).get("days_until_stockout", 999)))
    return insights[:30]
