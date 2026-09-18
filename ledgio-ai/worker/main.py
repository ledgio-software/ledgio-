"""
Ledgio Intelligence Worker — entry point.

Usage:
  python main.py --all                   # process all active tenants
  python main.py --tenant-id <uuid>      # process one tenant

Runs all insight modules that are enabled for each tenant's tier,
writes results to ai_tenant_insights, and exits.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Make worker root importable from submodules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import db as db_module
from writer import upsert_insights
from tier_config import get_modules_for_tier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("intelligence_worker")


MODULE_MAP = {
    "cash_flow_forecast": "modules.cash_flow_forecast",
    "invoice_risk_score": "modules.invoice_risk_score",
    "inventory_demand": "modules.inventory_demand",
    "anomaly_detection": "modules.anomaly_detection",
    "next_action_prediction": "modules.next_action_prediction",
}


async def process_tenant(tenant: dict) -> None:
    tenant_id = str(tenant["id"])
    tier = int(tenant.get("tier", 1))
    name = tenant.get("name", tenant_id)
    log.info("Processing tenant %s (tier=%d)", name, tier)

    enabled_modules = get_modules_for_tier(tier)

    async with db_module.tenant_conn(tenant_id) as conn:
        for module_name in enabled_modules:
            import_path = MODULE_MAP.get(module_name)
            if not import_path:
                continue
            try:
                import importlib
                mod = importlib.import_module(import_path)
                insights = await mod.run(conn, tenant_id, tier)
                await upsert_insights(tenant_id, module_name, insights)
                log.info("  %s → %d insight(s)", module_name, len(insights))
            except Exception as exc:
                log.exception("  %s failed: %s", module_name, exc)


async def run_all() -> None:
    tenants = await db_module.get_active_tenants()
    log.info("Found %d active tenants", len(tenants))
    for tenant in tenants:
        try:
            await process_tenant(tenant)
        except Exception as exc:
            log.exception("Tenant %s failed: %s", tenant.get("id"), exc)
    await db_module.close_pool()


async def run_single(tenant_id: str) -> None:
    pool = await db_module.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT t.id, t.name, t.sector,
                   COALESCE(s.tier, 1) AS tier
            FROM "Tenant" t
            LEFT JOIN "Subscription" s ON s.tenant_id = t.id
            WHERE t.id = $1::uuid
            """,
            tenant_id,
        )
    if not row:
        log.error("Tenant %s not found", tenant_id)
        sys.exit(1)
    await process_tenant(dict(row))
    await db_module.close_pool()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ledgio Intelligence Worker")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Process all active tenants")
    group.add_argument("--tenant-id", metavar="UUID", help="Process a single tenant")
    args = parser.parse_args()

    if args.all:
        asyncio.run(run_all())
    else:
        asyncio.run(run_single(args.tenant_id))


if __name__ == "__main__":
    main()
