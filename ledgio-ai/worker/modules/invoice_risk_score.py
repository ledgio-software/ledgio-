"""
Invoice payment risk scoring using logistic regression.
Scores each unpaid invoice 0-100 and labels it on-time / at-risk / high-risk.
"""

import asyncpg
import numpy as np
import pandas as pd
from typing import Any


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[dict[str, Any]]:
    history_rows = await conn.fetch(
        """
        SELECT
            i.customer_id,
            i.total_amount::float AS amount,
            (ip.payment_date - i.due_date)::int AS days_late,
            i.due_date,
            i.created_at
        FROM "Invoice" i
        JOIN "InvoicePayment" ip ON ip.invoice_id = i.id
        WHERE i.status = 'PAID'
          AND i.created_at >= NOW() - INTERVAL '2 years'
        LIMIT 5000
        """,
    )

    unpaid_rows = await conn.fetch(
        """
        SELECT
            i.id,
            i.invoice_number,
            i.customer_id,
            c.name AS customer_name,
            i.total_amount::float AS amount,
            i.due_date,
            (NOW()::date - i.due_date)::int AS days_outstanding,
            i.created_at
        FROM "Invoice" i
        JOIN "Customer" c ON c.id = i.customer_id
        WHERE i.status IN ('SENT', 'OVERDUE')
        ORDER BY i.due_date
        LIMIT 200
        """,
    )

    if not unpaid_rows:
        return []

    hist_df = pd.DataFrame(history_rows, columns=["customer_id", "amount", "days_late", "due_date", "created_at"])
    unpaid_df = pd.DataFrame(
        unpaid_rows,
        columns=["id", "invoice_number", "customer_id", "customer_name", "amount", "days_outstanding", "due_date", "created_at"],
    )

    # Build per-customer features from payment history
    if not hist_df.empty:
        cust_stats = (
            hist_df.groupby("customer_id")
            .agg(
                avg_days_late=("days_late", "mean"),
                past_late_count=("days_late", lambda x: (x > 0).sum()),
                invoice_count=("days_late", "count"),
            )
            .reset_index()
        )
        unpaid_df = unpaid_df.merge(cust_stats, on="customer_id", how="left")
    else:
        unpaid_df["avg_days_late"] = 0.0
        unpaid_df["past_late_count"] = 0
        unpaid_df["invoice_count"] = 0

    unpaid_df = unpaid_df.fillna({"avg_days_late": 0.0, "past_late_count": 0, "invoice_count": 0})

    # Feature matrix
    X = unpaid_df[["amount", "days_outstanding", "avg_days_late", "past_late_count"]].values.astype(float)

    # Normalize
    col_max = X.max(axis=0)
    col_max[col_max == 0] = 1
    X_norm = X / col_max

    # Simple weighted risk score (0–100) — no model fitting needed when history is thin
    weights = np.array([0.1, 0.4, 0.35, 0.15])
    raw_scores = (X_norm @ weights) * 100
    raw_scores = np.clip(raw_scores, 0, 100)

    # Prefer the federated global model if available; fall back to local logistic regression
    global_weights_row = await conn.fetchrow(
        "SELECT weights FROM global_model_weights WHERE model_name = 'invoice_risk' LIMIT 1"
    )

    if global_weights_row:
        try:
            import json as _json
            gw = global_weights_row["weights"] if isinstance(global_weights_row["weights"], dict) else _json.loads(global_weights_row["weights"])
            coef = np.array(gw["coef"], dtype=float)
            intercept = float(gw["intercept"])
            Xu = unpaid_df[["avg_days_late", "past_late_count", "amount", "days_outstanding"]].values.astype(float)
            Xu_norm = Xu / (Xu.max(axis=0) + 1e-9)
            # Pad or trim to 4 features
            if Xu_norm.shape[1] < 4:
                Xu_norm = np.pad(Xu_norm, ((0, 0), (0, 4 - Xu_norm.shape[1])))
            elif Xu_norm.shape[1] > 4:
                Xu_norm = Xu_norm[:, :4]
            z = Xu_norm @ coef + intercept
            fed_proba = 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500))) * 100
            raw_scores = 0.4 * raw_scores + 0.6 * fed_proba
        except Exception:
            pass  # Fall through to local model

    elif len(hist_df) >= 30:
        # If we have enough history and no global model, fit local logistic regression
        try:
            from sklearn.linear_model import LogisticRegression  # type: ignore

            hist_df["late_flag"] = (hist_df["days_late"] > 0).astype(int)
            hist_df = hist_df.merge(
                cust_stats[["customer_id", "avg_days_late", "past_late_count", "invoice_count"]],
                on="customer_id",
                how="left",
            ).fillna(0)
            Xh = hist_df[["amount", "avg_days_late", "past_late_count"]].values.astype(float)
            Xh_norm = Xh / (Xh.max(axis=0) + 1e-9)
            yh = hist_df["late_flag"].values
            if yh.sum() > 0 and yh.sum() < len(yh):
                lr = LogisticRegression(max_iter=200)
                lr.fit(Xh_norm, yh)
                Xu = unpaid_df[["amount", "avg_days_late", "past_late_count"]].values.astype(float)
                Xu_norm = Xu / (Xu.max(axis=0) + 1e-9)
                lr_proba = lr.predict_proba(Xu_norm)[:, 1] * 100
                raw_scores = 0.5 * raw_scores + 0.5 * lr_proba
        except Exception:
            pass

    high_risk = []
    for i, row in unpaid_df.iterrows():
        score = float(raw_scores[i])
        if score < 40:
            continue  # on-time — no alert needed
        label = "high risk" if score >= 70 else "at risk"
        severity = "critical" if score >= 70 else "warning"
        high_risk.append(
            {
                "severity": severity,
                "title": f"Invoice {row['invoice_number']} — {label} of late payment (score {score:.0f}/100)",
                "body": (
                    f"{row['customer_name']} has a payment risk score of {score:.0f}/100. "
                    f"Invoice amount: {row['amount']:,.2f}, outstanding {int(row['days_outstanding'])} days. "
                    + (f"This customer has been late {int(row['past_late_count'])} times before." if row["past_late_count"] > 0 else "")
                ).strip(),
                "data": {
                    "invoice_id": str(row["id"]),
                    "invoice_number": row["invoice_number"],
                    "customer_name": row["customer_name"],
                    "score": round(score, 1),
                    "label": label,
                    "amount": row["amount"],
                    "days_outstanding": int(row["days_outstanding"]),
                },
            }
        )

    return high_risk[:20]  # cap at 20 alerts per run
