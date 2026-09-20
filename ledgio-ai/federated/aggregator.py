"""
FedAvg aggregator — combines per-tenant noised gradient updates into a
new global model and persists it to global_model_weights.

FedAvg update rule:
  w_new = w_old - η * (Σ n_i * g_i) / (Σ n_i)

where:
  w_old = current global weights
  g_i   = noised gradient from tenant i (already DP-privatized)
  n_i   = number of samples tenant i trained on
  η     = learning rate (0.01)
"""

import asyncpg
import numpy as np
import json
from typing import Optional


LEARNING_RATE = 0.01


async def aggregate_and_save(
    conn: asyncpg.Connection,
    contributions: list[tuple[np.ndarray, np.ndarray, int]],
    current_weights: Optional[dict],
) -> Optional[dict]:
    """
    Average noised gradients (weighted by sample count) and update global weights.

    contributions: list of (coef_gradient, intercept_gradient, n_samples)
    current_weights: dict with "coef", "intercept", "epoch"
    Returns new weights dict, or None if no valid contributions.
    """
    valid = [(gc, gi, n) for gc, gi, n in contributions if gc is not None and n > 0]
    if not valid:
        return None

    total_samples = sum(n for _, _, n in valid)

    # Weighted average of gradients
    avg_coef_grad = sum(gc * n for gc, _, n in valid) / total_samples
    avg_int_grad = sum(gi * n for _, gi, n in valid) / total_samples

    # Load or initialise current weights
    if current_weights and "coef" in current_weights:
        coef = np.array(current_weights["coef"], dtype=float)
        intercept = float(current_weights["intercept"])
        epoch = int(current_weights.get("epoch", 0)) + 1
    else:
        coef = np.zeros(4)
        intercept = 0.0
        epoch = 1

    # Gradient descent step
    coef = coef - LEARNING_RATE * avg_coef_grad
    intercept = intercept - LEARNING_RATE * float(avg_int_grad[0])

    new_weights = {
        "coef": coef.tolist(),
        "intercept": intercept,
        "epoch": epoch,
        "n_tenants": len(valid),
        "total_samples": total_samples,
    }

    await conn.execute(
        """
        INSERT INTO global_model_weights (model_name, weights, epoch)
        VALUES ('invoice_risk', $1::jsonb, $2)
        ON CONFLICT (model_name) DO UPDATE SET
          weights    = EXCLUDED.weights,
          epoch      = EXCLUDED.epoch,
          created_at = NOW()
        """,
        json.dumps(new_weights),
        epoch,
    )

    return new_weights
