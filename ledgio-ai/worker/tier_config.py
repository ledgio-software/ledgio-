"""
Maps subscription tier (1=Starter, 2=Standard, 3=Pro/Enterprise) to
the set of insight modules that are enabled for that tenant.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from modules.base import BaseModule

# Tier constants matching the main backend subscription tiers
STARTER = 1
STANDARD = 2
PRO = 3

MODULES_BY_TIER: dict[int, list[str]] = {
    STARTER: ["inventory_demand"],
    STANDARD: ["inventory_demand", "cash_flow_forecast", "invoice_risk_score", "anomaly_detection"],
    PRO: ["inventory_demand", "cash_flow_forecast", "invoice_risk_score", "anomaly_detection", "budget_burn"],
}

AUTOENCODER_TIERS = {PRO}  # only Pro gets the deep autoencoder anomaly layer
INVENTORY_FORECAST_TIERS = {STANDARD, PRO}  # Starter gets alert-only


def get_modules_for_tier(tier: int) -> list[str]:
    if tier >= PRO:
        return MODULES_BY_TIER[PRO]
    if tier >= STANDARD:
        return MODULES_BY_TIER[STANDARD]
    return MODULES_BY_TIER[STARTER]


def use_autoencoder(tier: int) -> bool:
    return tier in AUTOENCODER_TIERS


def include_forecast_dates(tier: int) -> bool:
    return tier in INVENTORY_FORECAST_TIERS
