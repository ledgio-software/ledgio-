"""
Hybrid anomaly detection on journal entry lines.
Layer 1: Isolation Forest (statistical outliers by amount per account).
Layer 2: Autoencoder (reconstruction error for pattern breaks) — Pro tier only.
Combined score: 0.4 * isolation_score + 0.6 * reconstruction_error (if autoencoder enabled).
"""

import asyncpg
import numpy as np
import pandas as pd
from typing import Any

from tier_config import use_autoencoder


async def run(conn: asyncpg.Connection, tenant_id: str, tier: int) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT
            jel.id,
            jel.journal_entry_id,
            je.entry_number,
            je.entry_date,
            je.description AS je_description,
            jel.description AS line_description,
            a.code AS account_code,
            a.name AS account_name,
            a.type AS account_type,
            jel.debit::float AS debit,
            jel.credit::float AS credit,
            EXTRACT(DOW FROM je.entry_date)::int AS day_of_week,
            EXTRACT(HOUR FROM je.created_at)::int AS hour_of_day
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        JOIN accounts a ON a.id = jel.account_id
        WHERE je.status = 'POSTED'
          AND je.entry_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY je.entry_date DESC
        LIMIT 10000
        """,
    )

    if len(rows) < 20:
        return []

    df = pd.DataFrame(
        rows,
        columns=[
            "id", "journal_entry_id", "entry_number", "entry_date", "je_description",
            "line_description", "account_code", "account_name", "account_type",
            "debit", "credit", "day_of_week", "hour_of_day",
        ],
    )

    df["amount"] = df["debit"] + df["credit"]
    df["is_weekend"] = (df["day_of_week"].isin([0, 6])).astype(float)
    df["is_late_night"] = (df["hour_of_day"].isin(range(22, 24)) | df["hour_of_day"].isin(range(0, 6))).astype(float)

    # Per-account stats for context in reason strings
    account_stats = df.groupby("account_code")["amount"].agg(["mean", "std"]).reset_index()
    account_stats.columns = ["account_code", "acct_mean", "acct_std"]
    df = df.merge(account_stats, on="account_code", how="left")
    df["acct_std"] = df["acct_std"].fillna(0)

    # Feature matrix for Isolation Forest
    features = df[["amount", "day_of_week", "hour_of_day", "is_weekend", "is_late_night"]].values.astype(float)

    # Normalize
    col_max = features.max(axis=0)
    col_max[col_max == 0] = 1
    features_norm = features / col_max

    # Layer 1: Isolation Forest
    isolation_scores = np.zeros(len(df))
    try:
        from sklearn.ensemble import IsolationForest  # type: ignore

        iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        iso.fit(features_norm)
        raw_iso = iso.decision_function(features_norm)
        # Convert: more negative = more anomalous; map to 0-100 where 100 = most anomalous
        isolation_scores = np.clip(((-raw_iso - raw_iso.min()) / (raw_iso.max() - raw_iso.min() + 1e-9)) * 100, 0, 100)
    except Exception:
        pass

    # Layer 2: Autoencoder (Pro tier only)
    recon_scores = np.zeros(len(df))
    if use_autoencoder(tier) and len(df) >= 100:
        try:
            import torch
            import torch.nn as nn

            X = torch.tensor(features_norm, dtype=torch.float32)

            class Autoencoder(nn.Module):
                def __init__(self, in_dim: int):
                    super().__init__()
                    self.enc = nn.Sequential(nn.Linear(in_dim, 64), nn.ReLU(), nn.Linear(64, 16), nn.ReLU())
                    self.dec = nn.Sequential(nn.Linear(16, 64), nn.ReLU(), nn.Linear(64, in_dim))

                def forward(self, x: torch.Tensor) -> torch.Tensor:
                    return self.dec(self.enc(x))

            model = Autoencoder(features_norm.shape[1])
            optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
            loss_fn = nn.MSELoss()

            for _ in range(50):
                optimizer.zero_grad()
                recon = model(X)
                loss = loss_fn(recon, X)
                loss.backward()
                optimizer.step()

            model.eval()
            with torch.no_grad():
                recon = model(X)
                errors = ((recon - X) ** 2).mean(dim=1).numpy()
            recon_scores = np.clip((errors / (errors.max() + 1e-9)) * 100, 0, 100)
        except Exception:
            pass

    # Combine scores
    combined = 0.4 * isolation_scores + 0.6 * recon_scores if use_autoencoder(tier) else isolation_scores
    df["anomaly_score"] = combined

    # Surface top anomalies above threshold
    threshold = 70.0
    anomalies = df[df["anomaly_score"] >= threshold].sort_values("anomaly_score", ascending=False).head(15)

    insights = []
    for _, row in anomalies.iterrows():
        score = float(row["anomaly_score"])
        severity = "critical" if score >= 85 else "warning"
        amount = float(row["amount"])
        acct_mean = float(row["acct_mean"])

        reasons = []
        if acct_mean > 0 and amount > 2 * acct_mean:
            ratio = amount / acct_mean
            reasons.append(f"amount is {ratio:.1f}× the typical value for {row['account_name']}")
        if row["is_weekend"]:
            reasons.append("posted on a weekend")
        if row["is_late_night"]:
            reasons.append("entered late at night")

        reason_str = "; ".join(reasons) if reasons else "unusual statistical pattern detected"

        insights.append(
            {
                "severity": severity,
                "title": f"Anomaly on {row['entry_date']}: {row['entry_number']} — {row['account_name']}",
                "body": (
                    f"Journal entry {row['entry_number']} ({row['je_description'] or 'no description'}) "
                    f"has an anomaly score of {score:.0f}/100: {reason_str}. "
                    f"Amount: {amount:,.2f}."
                ),
                "data": {
                    "line_id": str(row["id"]),
                    "entry_number": row["entry_number"],
                    "entry_date": str(row["entry_date"]),
                    "account_code": row["account_code"],
                    "account_name": row["account_name"],
                    "amount": amount,
                    "anomaly_score": round(score, 1),
                    "isolation_score": round(float(isolation_scores[df.index.get_loc(row.name)]), 1),
                    "recon_score": round(float(recon_scores[df.index.get_loc(row.name)]), 1) if use_autoencoder(tier) else None,
                    "reasons": reasons,
                },
            }
        )

    return insights
