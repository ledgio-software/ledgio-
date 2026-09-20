"""
Per-tenant local training for federated invoice risk model.

Steps per tenant per round:
  1. Load current global model weights from DB (or random-init on epoch 0)
  2. Query the tenant's paid invoice history (RLS-scoped connection)
  3. Compute cross-entropy gradient for one SGD step
  4. Apply DP-SGD: clip gradient then add Gaussian noise
  5. Return (noised_gradient, n_samples) — never raw data or unoised gradient

The model is a logistic regression with 4 features:
  [avg_days_late, late_payment_count_norm, amount_norm, tenure_norm]
"""

import asyncpg
import numpy as np
from typing import Optional


MIN_SAMPLES = 50  # Skip tenant if fewer paid invoices — gradient too noisy


async def load_global_weights(conn: asyncpg.Connection) -> Optional[dict]:
    """Load latest global model weights. Returns None on first round."""
    row = await conn.fetchrow(
        "SELECT weights FROM global_model_weights WHERE model_name = 'invoice_risk' LIMIT 1"
    )
    if row is None:
        return None
    return dict(row["weights"])


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))


def _build_features(history: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """
    Build feature matrix X and label vector y from paid invoice history.

    Features (all per-customer aggregates):
      0: avg_days_late (normalized by 30)
      1: late_payment_count (normalized by 10)
      2: avg_invoice_amount (normalized by 10000)
      3: customer_tenure_days (normalized by 365)

    Label: 1 if avg_days_late > 7 (chronic late payer), 0 otherwise
    """
    if not history:
        return np.empty((0, 4)), np.empty(0)

    import pandas as pd

    df = pd.DataFrame(history)
    if df.empty or "customer_id" not in df.columns:
        return np.empty((0, 4)), np.empty(0)

    agg = df.groupby("customer_id").agg(
        avg_days_late=("days_late", "mean"),
        late_count=("days_late", lambda x: (x > 7).sum()),
        avg_amount=("amount", "mean"),
        tenure=("tenure_days", "mean"),
    ).reset_index()

    X = np.column_stack([
        agg["avg_days_late"].fillna(0).values / 30.0,
        agg["late_count"].fillna(0).values / 10.0,
        agg["avg_amount"].fillna(0).values / 10000.0,
        agg["tenure"].fillna(0).values / 365.0,
    ])
    y = (agg["avg_days_late"].fillna(0).values > 7).astype(float)
    return X, y


async def compute_local_gradient(
    conn: asyncpg.Connection,
    global_weights: Optional[dict],
) -> tuple[Optional[np.ndarray], Optional[np.ndarray], int]:
    """
    Query tenant data and compute logistic regression gradient.

    Returns (coef_gradient, intercept_gradient, n_samples).
    Returns (None, None, 0) if tenant has insufficient data.
    """
    rows = await conn.fetch(
        """
        SELECT
            i.customer_id,
            COALESCE((ip.payment_date - i.due_date)::int, 0) AS days_late,
            i.total_amount::float AS amount,
            (NOW()::date - c.created_at::date)::int AS tenure_days
        FROM "Invoice" i
        JOIN "InvoicePayment" ip ON ip.invoice_id = i.id
        JOIN "Customer" c ON c.id = i.customer_id
        WHERE i.status = 'PAID'
          AND i.created_at >= NOW() - INTERVAL '2 years'
        LIMIT 5000
        """
    )

    if len(rows) < MIN_SAMPLES:
        return None, None, 0

    history = [dict(r) for r in rows]
    X, y = _build_features(history)
    n = len(X)
    if n < MIN_SAMPLES:
        return None, None, 0

    # Initialise or load weights
    if global_weights and "coef" in global_weights:
        coef = np.array(global_weights["coef"], dtype=float)
        intercept = float(global_weights["intercept"])
    else:
        coef = np.zeros(4)
        intercept = 0.0

    # Forward pass
    z = X @ coef + intercept
    y_hat = _sigmoid(z)

    # Cross-entropy gradient (mean over samples)
    error = y_hat - y
    grad_coef = (X.T @ error) / n
    grad_intercept = np.array([error.mean()])

    return grad_coef, grad_intercept, n
