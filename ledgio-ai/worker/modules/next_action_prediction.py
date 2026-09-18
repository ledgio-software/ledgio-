"""
Next-Action Prediction module (Phase 2).

Reads the last 90 days of behavior_events for a tenant, builds a per-user
first-order Markov transition matrix, and predicts the top-3 next actions
for each active user (one with ≥ 2 events in the last 7 days).

Outputs ai_tenant_insights rows with module='next_action' so the existing
AiInsightsBanner and QuickSuggestionsBar can surface them.
"""

from __future__ import annotations

import asyncpg
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any


# Human-readable labels and frontend routes for each event type.
ACTION_META: dict[str, dict[str, str]] = {
    "invoice_created":      {"label": "Create Invoice",       "route": "/invoices"},
    "invoice_viewed":       {"label": "View Invoices",         "route": "/invoices"},
    "payment_recorded":     {"label": "Record Payment",        "route": "/invoices"},
    "invoice_voided":       {"label": "Void Invoice",          "route": "/invoices"},
    "bill_created":         {"label": "Create Vendor Bill",    "route": "/vendor-bills"},
    "bill_updated":         {"label": "Update Vendor Bill",    "route": "/vendor-bills"},
    "bill_payment_recorded":{"label": "Pay Vendor Bill",       "route": "/vendor-bills"},
    "journal_entry_created":{"label": "New Journal Entry",     "route": "/journal-entries"},
    "journal_entry_posted": {"label": "Post Journal Entry",    "route": "/journal-entries"},
    "journal_entry_voided": {"label": "Void Journal Entry",    "route": "/journal-entries"},
    "customer_created":     {"label": "Add Customer",          "route": "/customers"},
    "customer_opened":      {"label": "View Customers",        "route": "/customers"},
    "customer_updated":     {"label": "Update Customer",       "route": "/customers"},
    "report_generated":     {"label": "Run Report",            "route": "/reports"},
    "cash_sale_created":    {"label": "Record Cash Sale",      "route": "/pos"},
    "payroll_run":          {"label": "Process Payroll",       "route": "/payroll"},
    "inventory_adjusted":   {"label": "Adjust Inventory",      "route": "/inventory"},
    "stock_transfer":       {"label": "Transfer Stock",        "route": "/inventory"},
    "inventory_item_created":{"label": "Add Inventory Item",   "route": "/inventory"},
    "asset_created":        {"label": "Register Fixed Asset",  "route": "/fixed-assets"},
    "asset_updated":        {"label": "Update Fixed Asset",    "route": "/fixed-assets"},
    "budget_created":       {"label": "Create Budget",         "route": "/budgets"},
    "budget_updated":       {"label": "Update Budget",         "route": "/budgets"},
}

LOOKBACK_DAYS = 90
ACTIVE_DAYS = 7       # a user is "active" if they had an event in the last 7 days
MIN_TRANSITIONS = 3   # need at least this many transitions to produce a suggestion
TOP_K = 3             # max suggestions per user
MAX_INSIGHTS = 50     # cap total insights per tenant per run


AiInsight = dict[str, Any]


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[AiInsight]:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    active_cutoff = datetime.now(tz=timezone.utc) - timedelta(days=ACTIVE_DAYS)

    rows = await conn.fetch(
        """
        SELECT user_id::text, event_type, occurred_at
        FROM   behavior_events
        WHERE  tenant_id = $1::uuid
          AND  occurred_at >= $2
        ORDER  BY user_id, occurred_at ASC
        """,
        tenant_id,
        cutoff,
    )

    if not rows:
        return []

    # Group events into per-user sequences.
    user_sequences: dict[str, list[str]] = defaultdict(list)
    user_latest: dict[str, datetime] = {}
    for r in rows:
        uid = r["user_id"]
        user_sequences[uid].append(r["event_type"])
        user_latest[uid] = r["occurred_at"]

    # Build tenant-wide transition counts (pooled across all users for better statistics).
    tenant_transitions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for seq in user_sequences.values():
        for a, b in zip(seq, seq[1:]):
            tenant_transitions[a][b] += 1

    def top_next(current: str, k: int = TOP_K) -> list[tuple[str, float]]:
        nexts = tenant_transitions.get(current, {})
        total = sum(nexts.values())
        if total == 0:
            return []
        ranked = sorted(nexts.items(), key=lambda x: x[1], reverse=True)[:k]
        return [(evt, cnt / total) for evt, cnt in ranked]

    insights: list[AiInsight] = []
    for uid, seq in user_sequences.items():
        # Only suggest for users active in the last ACTIVE_DAYS.
        if user_latest[uid] < active_cutoff:
            continue
        if len(seq) < 2:
            continue

        current = seq[-1]
        transitions_total = sum(tenant_transitions.get(current, {}).values())
        if transitions_total < MIN_TRANSITIONS:
            continue

        predictions = top_next(current)
        if not predictions:
            continue

        # One insight per user — top suggestion as the insight body,
        # remaining suggestions in the data JSONB for the chips UI.
        top_evt, top_prob = predictions[0]
        meta = ACTION_META.get(top_evt, {"label": top_evt.replace("_", " ").title(), "route": "/"})

        all_suggestions = [
            {
                "event_type": evt,
                "label": ACTION_META.get(evt, {"label": evt.replace("_", " ").title()})["label"],
                "route": ACTION_META.get(evt, {"route": "/"})["route"],
                "probability": round(prob, 3),
            }
            for evt, prob in predictions
        ]

        insights.append({
            "module": "next_action",
            "severity": "info",
            "title": "Suggested Next Step",
            "body": f"Based on your recent activity, consider: {meta['label']}.",
            "data": {
                "user_id": uid,
                "current_event": current,
                "suggestions": all_suggestions,
                "based_on_transitions": transitions_total,
            },
        })

        if len(insights) >= MAX_INSIGHTS:
            break

    return insights
