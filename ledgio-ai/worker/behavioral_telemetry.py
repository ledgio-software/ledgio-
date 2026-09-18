"""
Hourly behavioral telemetry collector.

Reads audit_logs (public schema) since the last run per tenant and
transforms each entry into a behavior_events row for downstream ML.
Run as a standalone script — no --tenant-id flag; always processes all tenants.
"""

import asyncio
import os
from datetime import datetime, timezone

import asyncpg
from dotenv import load_dotenv

load_dotenv()

# Map (action_upper, entity) → event_type.  None means skip the entry.
EVENT_MAP: dict[tuple[str, str], str] = {
    ("CREATE", "Invoice"): "invoice_created",
    ("UPDATE", "Invoice"): "invoice_updated",
    ("VIEW", "Invoice"): "invoice_viewed",
    ("PAY", "Invoice"): "payment_recorded",
    ("PAYMENT_RECORDED", "Invoice"): "payment_recorded",
    ("VOID", "Invoice"): "invoice_voided",
    ("CREATE", "VendorBill"): "bill_created",
    ("UPDATE", "VendorBill"): "bill_updated",
    ("PAY", "VendorBill"): "bill_payment_recorded",
    ("PAYMENT_RECORDED", "VendorBill"): "bill_payment_recorded",
    ("CREATE", "JournalEntry"): "journal_entry_created",
    ("POST", "JournalEntry"): "journal_entry_posted",
    ("VOID", "JournalEntry"): "journal_entry_voided",
    ("CREATE", "Customer"): "customer_created",
    ("VIEW", "Customer"): "customer_opened",
    ("UPDATE", "Customer"): "customer_updated",
    ("GENERATE", "Report"): "report_generated",
    ("VIEW", "Report"): "report_generated",
    ("CREATE", "CashSale"): "cash_sale_created",
    ("CREATE", "Payroll"): "payroll_run",
    ("RUN", "Payroll"): "payroll_run",
    ("ADJUST", "InventoryItem"): "inventory_adjusted",
    ("TRANSFER", "InventoryItem"): "stock_transfer",
    ("CREATE", "InventoryItem"): "inventory_item_created",
    ("CREATE", "FixedAsset"): "asset_created",
    ("UPDATE", "FixedAsset"): "asset_updated",
    ("CREATE", "Budget"): "budget_created",
    ("UPDATE", "Budget"): "budget_updated",
}

ENTITY_MAP: dict[str, str] = {
    "Invoice": "invoice",
    "VendorBill": "vendor_bill",
    "JournalEntry": "journal_entry",
    "Customer": "customer",
    "Report": "report",
    "CashSale": "cash_sale",
    "Payroll": "payroll",
    "InventoryItem": "inventory_item",
    "FixedAsset": "fixed_asset",
    "Budget": "budget",
}

BATCH_SIZE = 500


async def get_pool() -> asyncpg.Pool:
    url = os.environ.get("DATABASE_URL", "")
    return await asyncpg.create_pool(url, min_size=2, max_size=5)


async def get_active_tenant_ids(conn: asyncpg.Connection) -> list[str]:
    rows = await conn.fetch(
        """
        SELECT t.id::text
        FROM   "Tenant"   t
        JOIN   "Subscription" s ON s."tenantId" = t.id
        WHERE  t."isActive" = true
          AND  s.state IN ('ACTIVE', 'TRIAL')
        """
    )
    return [r["id"] for r in rows]


async def get_watermark(conn: asyncpg.Connection, tenant_id: str) -> datetime:
    """Latest occurred_at already in behavior_events for this tenant, or epoch."""
    row = await conn.fetchrow(
        'SELECT MAX(occurred_at) AS ts FROM behavior_events WHERE tenant_id = $1::uuid',
        tenant_id,
    )
    ts = row["ts"] if row else None
    return ts if ts else datetime(2000, 1, 1, tzinfo=timezone.utc)


async def collect_for_tenant(
    conn: asyncpg.Connection, tenant_id: str, watermark: datetime
) -> int:
    rows = await conn.fetch(
        """
        SELECT id, action, entity, "entityId", "userId", created_at
        FROM   audit_logs
        WHERE  "tenantId" = $1
          AND  created_at > $2
          AND  "userId" IS NOT NULL
        ORDER  BY created_at ASC
        LIMIT  5000
        """,
        tenant_id,
        watermark,
    )
    if not rows:
        return 0

    events: list[tuple] = []
    for r in rows:
        action = (r["action"] or "").upper()
        entity = r["entity"] or ""
        event_type = EVENT_MAP.get((action, entity))
        if not event_type:
            continue
        entity_type = ENTITY_MAP.get(entity)
        entity_id = r["entityId"]
        events.append(
            (
                tenant_id,
                r["userId"],
                event_type,
                entity_type,
                entity_id,
                r["created_at"],
            )
        )

    if not events:
        return 0

    # Bulk insert — skip duplicates by checking we don't re-insert the same
    # audit_log timestamp window (watermark guarantees no overlap).
    for i in range(0, len(events), BATCH_SIZE):
        batch = events[i : i + BATCH_SIZE]
        await conn.executemany(
            """
            INSERT INTO behavior_events
                (tenant_id, user_id, event_type, entity_type, entity_id, occurred_at)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)
            ON CONFLICT DO NOTHING
            """,
            batch,
        )

    return len(events)


async def main() -> None:
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            tenant_ids = await get_active_tenant_ids(conn)

        total = 0
        for tid in tenant_ids:
            async with pool.acquire() as conn:
                watermark = await get_watermark(conn, tid)
                n = await collect_for_tenant(conn, tid, watermark)
                if n:
                    print(f"[BehavioralTelemetry] tenant={tid[:8]} +{n} events")
                    total += n

        print(f"[BehavioralTelemetry] Done. {len(tenant_ids)} tenants, {total} new events.")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
