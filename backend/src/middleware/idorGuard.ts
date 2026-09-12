/**
 * IDOR Prevention Layer — Prisma query interceptor + Express request auditor.
 *
 * Layer 1 (Prisma $use): auto-injects the current tenant's id into queries on
 * tenant-scoped models that reach the GLOBAL prisma client without a tenantId
 * filter. This makes cross-tenant data reads impossible even when a route
 * handler forgets the filter.
 *
 *   • findUnique / findUniqueOrThrow → converted to findFirst / findFirstOrThrow
 *     and tenantId injected into where (findUnique requires a unique-constraint
 *     where clause; adding tenantId would violate that constraint unless a
 *     composite unique index exists, so we rewrite the action instead).
 *   • findFirst / findMany / count / aggregate / updateMany / deleteMany →
 *     tenantId appended to where when absent.
 *   • update / delete → these require the where clause to satisfy a unique
 *     constraint, so we cannot safely inject tenantId; a security warning is
 *     emitted to the log instead.
 *
 * Layer 2 (Express middleware): logs all parameterised resource accesses
 * (routes with :id params) to the structured logger. A high-volume scan from
 * a single session is flagged as a potential enumeration attempt.
 *
 * Fail-open design:
 *   • No tenant context active (admin routes, system processes, tests) →
 *     guard is a no-op; the query proceeds unchanged.
 *   • Any unexpected error inside the guard → logged and query proceeds.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getTenantContext } from '../context/tenantContext';

// ── Tenant-scoped model list ─────────────────────────────────────────────────
// All Prisma models that carry a tenantId column in the shared public schema.
// Update this set when new tenant-scoped models are added to schema.prisma.
const TENANT_SCOPED_MODELS = new Set([
  'ApiKey',
  'ApprovalStep',
  'ApprovalWorkflow',
  'AuditLog',
  'BankAccount',
  'BankTransaction',
  'BomLine',
  'BomTemplate',
  'Budget',
  'CashSale',
  'CashSaleLine',
  'CashTill',
  'CostCategory',
  'CostCentre',
  'CreditNote',
  'CustomField',
  'CustomFieldValue',
  'Customer',
  'DailyCloseoutReport',
  'DebitNote',
  'DeliveryNote',
  'DeliveryNoteLine',
  'DepreciationEntry',
  'ExpenseClaim',
  'Feedback',
  'FiscalPeriod',
  'FixedAsset',
  'Fund',
  'GoodsReceiptNote',
  'GoodsReceiptNoteLine',
  'HelpAssistantConversation',
  'InterestCharge',
  'InterestPolicy',
  'InventoryBatch',
  'InventoryItem',
  'Invoice',
  'InvoiceItem',
  'InvoicePayment',
  'Invitation',
  'Job',
  'JobCostLine',
  'JobWorkOrder',
  'MonthClose',
  'NarcoticsLogEntry',
  'Notification',
  'PaymentBatch',
  'PaymentBatchAllocation',
  'PaystackPaymentRequest',
  'PettyCashEntry',
  'PharmacyPatient',
  'PostDatedCheque',
  'PriceList',
  'PriceListEntry',
  'ProductionOrder',
  'Prescription',
  'PurchaseOrder',
  'PurchaseOrderLine',
  'RecurringInvoice',
  'RecurringTransaction',
  'ReportSchedule',
  'SalesOrder',
  'SalesOrderLine',
  'Scenario',
  'SerialNumber',
  'StockAdjustment',
  'StockLayer',
  'StockTransfer',
  'StockTransferItem',
  'SyncChangeLog',
  'SyncSequenceCounter',
  'TaxRate',
  'User',
  'Vendor',
  'VendorBill',
  'VendorBillLine',
  'VoucherClass',
  'Warehouse',
  'WarehouseAccess',
  'WarehouseStock',
  'WhtRate',
]);

// Actions where we can safely inject tenantId without breaking Prisma's
// unique-constraint requirement on the where clause.
const INJECTABLE_ACTIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

// Actions where we rewrite the action itself to avoid the unique-constraint
// restriction, then inject tenantId into the rewritten where clause.
const REWRITE_TO_FIRST: Record<string, string> = {
  findUnique: 'findFirst',
  findUniqueOrThrow: 'findFirstOrThrow',
};

// Actions that carry a unique-constraint where clause we cannot safely mutate.
// We emit a security warning instead of blocking.
const WARN_ONLY_ACTIONS = new Set(['update', 'delete', 'upsert']);

// ── Composite unique key expansion ──────────────────────────────────────────
// Prisma allows `{ warehouseId_itemId: { warehouseId, itemId } }` in findUnique
// but NOT in findFirst. After rewriting the action we must flatten those entries
// into individual fields. Detection heuristic: a key whose name is exactly the
// underscore-joined concatenation of the sub-object's own keys is a composite
// unique key accessor.
function expandCompositeKeys(where: Record<string, any>): Record<string, any> {
  const expanded: Record<string, any> = {};
  for (const [key, value] of Object.entries(where)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      key.includes('_')
    ) {
      const valueKeys = Object.keys(value);
      if (valueKeys.length > 1 && valueKeys.join('_') === key) {
        // This is a composite unique key accessor — spread its fields inline.
        Object.assign(expanded, value);
        continue;
      }
    }
    expanded[key] = value;
  }
  return expanded;
}

// ── Layer 1: Prisma middleware factory ───────────────────────────────────────

/**
 * Returns a Prisma $use middleware that enforces tenant isolation on the
 * global prisma client. Register with:
 *   (prisma as any).$use(buildIdorPrismaMiddleware());
 */
export function buildIdorPrismaMiddleware() {
  return async (params: any, next: any): Promise<any> => {
    try {
      if (!params.model || !TENANT_SCOPED_MODELS.has(params.model)) {
        return next(params);
      }

      const ctx = getTenantContext();
      if (!ctx?.tenantId) {
        // No tenant context (admin route, system task, test) — pass through.
        return next(params);
      }

      const { tenantId } = ctx;
      const action: string = params.action;

      // ── Rewrite findUnique → findFirst to allow tenantId injection ──────────
      if (action in REWRITE_TO_FIRST) {
        params.action = REWRITE_TO_FIRST[action];
        const where = params.args?.where ?? {};
        if (!where.tenantId) {
          // Prisma composite unique key accessors (e.g. warehouseId_itemId: { warehouseId, itemId })
          // are only valid in findUnique. After rewriting to findFirst we must expand them into
          // their individual field equivalents so findFirst can accept the where clause.
          const expanded = expandCompositeKeys(where);
          params.args = { ...params.args, where: { ...expanded, tenantId } };
          logger.debug(`[IDORGuard] Rewrote ${action}→${params.action} and injected tenantId for ${params.model}`);
        }
        return next(params);
      }

      // ── Inject tenantId for safe bulk/list actions ───────────────────────────
      if (INJECTABLE_ACTIONS.has(action)) {
        const where = params.args?.where ?? {};
        if (!where.tenantId) {
          params.args = { ...params.args, where: { ...where, tenantId } };
          logger.debug(`[IDORGuard] Injected tenantId for ${params.model}.${action}`);
        }
        return next(params);
      }

      // ── Warn-only for update/delete (unique-constraint where clause) ─────────
      if (WARN_ONLY_ACTIONS.has(action)) {
        const where = params.args?.where ?? {};
        if (!where.tenantId) {
          logger.warn(
            `[IDORGuard] ${params.model}.${action} executed without tenantId in where clause — potential IDOR risk. Caller should add tenantId to the where clause or use withCurrentTenantDb.`,
          );
        }
      }
    } catch (err) {
      logger.error('[IDORGuard] Prisma middleware error (query allowed through)', { err });
    }

    return next(params);
  };
}

// ── Layer 2: Express middleware — ID enumeration detection ───────────────────

// Track per-session (JWT sub) how many distinct resource IDs were accessed
// in the current minute. A sudden spike in unique IDs is a sign of enumeration.
// In-process Map is sufficient — this is a soft signal for logging only.
const _sessionIdAccess = new Map<string, { minute: number; ids: Set<string> }>();

const ENUM_THRESHOLD = 50; // distinct IDs per minute before flagging

/**
 * Express middleware. Mount after authenticateJwt + tenantContextMiddleware
 * on any router that handles parameterised resource routes (e.g. /:id).
 *
 * Logs a security warning when a single authenticated session accesses more
 * than ENUM_THRESHOLD distinct resource IDs within a 60-second window —
 * a signal of automated enumeration / scraping.
 */
export function idorAuditMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const userId = (req as any).user?.id;
    const tenantId = getTenantContext()?.tenantId;

    if (!userId || !tenantId) {
      return next();
    }

    // Collect all UUID-looking path segments from the URL.
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const ids = req.path.match(uuidPattern);

    if (!ids || ids.length === 0) {
      return next();
    }

    const sessionKey = `${tenantId}:${userId}`;
    const minute = Math.floor(Date.now() / 60_000);
    let entry = _sessionIdAccess.get(sessionKey);

    if (!entry || entry.minute !== minute) {
      entry = { minute, ids: new Set() };
      _sessionIdAccess.set(sessionKey, entry);
    }

    for (const id of ids) {
      entry.ids.add(id.toLowerCase());
    }

    if (entry.ids.size === ENUM_THRESHOLD) {
      // Fire once at the threshold crossing, not on every subsequent request.
      logger.warn('[IDORGuard] Potential resource enumeration detected', {
        userId,
        tenantId,
        distinctIdsThisMinute: entry.ids.size,
        latestPath: req.path,
        method: req.method,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
    }

    // Prune stale sessions to prevent unbounded memory growth.
    if (_sessionIdAccess.size > 10_000) {
      for (const [key, val] of _sessionIdAccess) {
        if (val.minute < minute - 2) _sessionIdAccess.delete(key);
      }
    }
  } catch {
    // Guard never disrupts the request flow.
  }

  next();
}
