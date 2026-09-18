"""
Writes insight results to the ai_tenant_insights table.
Deletes stale insights for a module before inserting fresh ones so
the table always reflects the latest computation.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

from db import get_pool


InsightRow = dict[str, Any]


async def upsert_insights(tenant_id: str, module: str, insights: list[InsightRow]) -> None:
    """Replace all active insights for a tenant+module with the new batch."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Remove previous run's results for this module/tenant
            await conn.execute(
                """
                DELETE FROM ai_tenant_insights
                WHERE tenant_id = $1::uuid AND module = $2
                """,
                tenant_id,
                module,
            )

            if not insights:
                return

            expires_at = datetime.now(timezone.utc) + timedelta(hours=26)

            await conn.executemany(
                """
                INSERT INTO ai_tenant_insights
                    (tenant_id, module, severity, title, body, data, computed_at, expires_at)
                VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, NOW(), $7)
                """,
                [
                    (
                        tenant_id,
                        module,
                        row["severity"],
                        row["title"],
                        row["body"],
                        json.dumps(row.get("data")),
                        expires_at,
                    )
                    for row in insights
                ],
            )
