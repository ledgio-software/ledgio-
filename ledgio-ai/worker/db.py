"""
Async PostgreSQL connection pool with RLS activation helper.
Reuses the same set_config pattern as ledgio-ai/backend/app/tools/executor.py.
"""

import os
import asyncpg
from typing import AsyncIterator
from contextlib import asynccontextmanager

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.environ["DATABASE_URL"],
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def tenant_conn(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Acquire a connection with RLS activated for the given tenant."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, true)", tenant_id
        )
        yield conn


async def get_active_tenants() -> list[dict]:
    """Return all tenants with an active or trial subscription."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT t.id, t.name, t.sector,
                   COALESCE(s.tier, 1) AS tier
            FROM "Tenant" t
            LEFT JOIN "Subscription" s ON s.tenant_id = t.id
            WHERE t."isActive" = true
              AND (s.state IN ('ACTIVE', 'TRIAL') OR s.state IS NULL)
            ORDER BY t.id
            """
        )
    return [dict(r) for r in rows]
