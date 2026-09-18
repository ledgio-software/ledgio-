"""
Federated Learning Round — Phase 3 entry point.

Runs nightly (01:30 UTC) after the main intelligence worker.
For each eligible Standard+ tenant:
  1. Check DP budget availability
  2. Compute local gradient on tenant's invoice history (RLS-scoped)
  3. Privatize gradient (clip + Gaussian noise)
  4. Collect contribution
Aggregates all contributions via FedAvg and saves updated global weights.
"""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from worker.db import get_pool, tenant_conn, get_active_tenants, close_pool
from federated.local_trainer import load_global_weights, compute_local_gradient
from federated.dp_mechanism import privatize_gradient
from federated.budget_tracker import is_budget_available, record_participation
from federated.aggregator import aggregate_and_save

logging.basicConfig(level=logging.INFO, format="%(asctime)s [federated] %(message)s")
log = logging.getLogger(__name__)

# Only Standard (tier 2) and Pro (tier 3) tenants participate in training
MIN_TIER_TO_PARTICIPATE = 2


async def run_round() -> None:
    pool = await get_pool()

    # Load current global weights (shared connection — public schema, no RLS needed)
    async with pool.acquire() as pub_conn:
        current_weights = await load_global_weights(pub_conn)

    epoch = (current_weights.get("epoch", 0) if current_weights else 0) + 1
    log.info("Starting federated round %d", epoch)

    tenants = await get_active_tenants()
    eligible = [t for t in tenants if t["tier"] >= MIN_TIER_TO_PARTICIPATE]
    log.info("%d/%d tenants eligible (Standard+)", len(eligible), len(tenants))

    contributions = []

    for tenant in eligible:
        tid = str(tenant["id"])
        try:
            async with tenant_conn(tid) as conn:
                # Check DP budget before loading data
                # We use a preliminary check with placeholder n=50; real check after query
                if not await is_budget_available(conn, tid, n_samples=50):
                    log.info("Tenant %s budget exhausted — skipping", tid)
                    continue

                coef_grad, int_grad, n_samples = await compute_local_gradient(
                    conn, current_weights
                )

                if coef_grad is None or n_samples == 0:
                    log.info("Tenant %s insufficient data (%d samples) — skipping", tid, n_samples)
                    continue

                # Final budget check with actual sample count
                if not await is_budget_available(conn, tid, n_samples=n_samples):
                    log.info("Tenant %s budget would be exhausted by this round — skipping", tid)
                    continue

                # Apply DP-SGD: clip + noise
                dp_coef_grad = privatize_gradient(coef_grad)
                dp_int_grad = privatize_gradient(int_grad)

                contributions.append((dp_coef_grad, dp_int_grad, n_samples))

                # Record budget consumption
                await record_participation(conn, tid, n_samples)
                log.info("Tenant %s contributed %d samples to round %d", tid, n_samples, epoch)

        except Exception as exc:
            log.error("Tenant %s failed in federated round: %s", tid, exc)
            continue

    if not contributions:
        log.info("No contributions this round — global model unchanged")
        await close_pool()
        return

    # Aggregate and save
    async with pool.acquire() as pub_conn:
        new_weights = await aggregate_and_save(pub_conn, contributions, current_weights)

    if new_weights:
        log.info(
            "Round %d complete: %d tenants, %d total samples, epoch %d saved",
            epoch,
            new_weights["n_tenants"],
            new_weights["total_samples"],
            new_weights["epoch"],
        )
    else:
        log.warning("Aggregation produced no weights this round")

    await close_pool()


if __name__ == "__main__":
    asyncio.run(run_round())
