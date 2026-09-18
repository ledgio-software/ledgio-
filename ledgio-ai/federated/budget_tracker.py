"""
Differential privacy budget tracker.

Uses the moments accountant (Rényi DP) approximation to track per-tenant
epsilon consumption across federated rounds. Tenants whose budget is
exhausted are excluded from future rounds but still benefit from the
global model trained by other tenants.

Reference: Abadi et al. "Deep Learning with Differential Privacy" (CCS 2016)
"""

import math
import asyncpg


EPSILON_LIMIT: float = 10.0   # (ε, δ)-DP budget per tenant
DELTA: float = 1e-5            # δ — probability of privacy breach
NOISE_MULTIPLIER: float = 1.0  # σ — must match dp_mechanism.py


def epsilon_per_round(n_samples: int, noise_multiplier: float = NOISE_MULTIPLIER, delta: float = DELTA) -> float:
    """
    Estimate ε consumed by one federated round for a tenant with n_samples.

    Approximation: ε ≈ sqrt(2 * log(1/δ)) / (σ * sqrt(n_samples))
    This is the Gaussian mechanism bound for a single composition step.
    Conservative — real ε via moments accountant is lower for many rounds.
    """
    if n_samples <= 0:
        return float("inf")
    return math.sqrt(2 * math.log(1.0 / delta)) / (noise_multiplier * math.sqrt(n_samples))


async def is_budget_available(conn: asyncpg.Connection, tenant_id: str, n_samples: int) -> bool:
    """Return True if this tenant still has privacy budget for another round."""
    row = await conn.fetchrow(
        'SELECT epsilon_consumed, epsilon_limit FROM tenant_dp_budgets WHERE tenant_id = $1',
        tenant_id,
    )
    if row is None:
        return True  # New tenant — budget not yet initialised

    cost = epsilon_per_round(n_samples)
    return (row["epsilon_consumed"] + cost) <= row["epsilon_limit"]


async def record_participation(
    conn: asyncpg.Connection,
    tenant_id: str,
    n_samples: int,
) -> None:
    """
    Upsert the tenant's DP budget row, incrementing epsilon_consumed.
    Called after the tenant's gradient is included in a federated round.
    """
    cost = epsilon_per_round(n_samples)
    await conn.execute(
        """
        INSERT INTO tenant_dp_budgets
          (tenant_id, epsilon_consumed, epsilon_limit, delta, rounds_participated, last_updated)
        VALUES ($1, $2, $3, $4, 1, NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
          epsilon_consumed   = tenant_dp_budgets.epsilon_consumed + $2,
          rounds_participated = tenant_dp_budgets.rounds_participated + 1,
          last_updated       = NOW()
        """,
        tenant_id,
        cost,
        EPSILON_LIMIT,
        DELTA,
    )
