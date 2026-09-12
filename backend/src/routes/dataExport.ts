import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import { prisma } from '../config/db';
import { redis } from '../config/redis';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { buildCsv } from '../utils/csvExport';
import { recordAuditLog, actorFromRequest } from '../services/auditLogService';
import { EXPORT_TABLES, collectTenantExportData, rowsToCsvTable } from '../services/dataExportService';
import { analyzeExportRequest } from '../services/bulkExportAnomalyService';

const EXPORT_COOLDOWN_SECONDS = 3600; // 1 hour between exports per tenant

/**
 * Enforces a per-tenant cooldown on data exports.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 *
 * Uses Redis SET NX EX so the check-and-set is atomic — no race condition
 * between two simultaneous export requests from the same tenant.
 */
async function checkExportCooldown(
  tenantId: string,
  kind: 'json' | 'csv',
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const key = `export_cooldown:${kind}:${tenantId}`;
  try {
    // SET key 1 EX cooldown NX returns 'OK' if set (first request), null if already set
    const result = await redis.set(key, '1', 'EX', EXPORT_COOLDOWN_SECONDS, 'NX');
    if (result === 'OK') return { allowed: true };
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : EXPORT_COOLDOWN_SECONDS };
  } catch {
    // Redis unavailable — fail open (allow the export) rather than blocking
    // a legitimate user. The audit log still captures every export.
    return { allowed: true };
  }
}

// Deliberately NOT behind tierEnforcementMiddleware and NOT rate-limited
// beyond the tenant's normal authenticated-request budget - full data export
// is core to the trust positioning (audit trail + easy export, no lock-in),
// not a feature to gate behind a pricing tier or a cooldown. Restricted to
// Admin/Owner only because this dumps the whole company's financial data and
// team roster in one request, the same access level Settings already uses.
const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

function buildReadmeText(tenantName: string, exportedAt: Date): string {
  const lines = [
    `Ledgio full data export - ${tenantName}`,
    `Generated: ${exportedAt.toISOString()}`,
    '',
    'This export contains every table Ledgio stores for your business, one CSV',
    'file per table, so your data is usable outside Ledgio - no proprietary',
    'format, no partial export, and nothing held back.',
    '',
    'Files in this export:',
    '',
  ];
  for (const table of EXPORT_TABLES) {
    lines.push(`  ${table.key}.csv`);
    lines.push(`    ${table.label} - ${table.description}`);
    lines.push('');
  }
  lines.push('Notes:');
  lines.push('  - Monetary amounts are plain decimal numbers (no currency symbol).');
  lines.push('  - Timestamps are in UTC, ISO 8601 format (e.g. 2026-08-10T12:00:00.000Z).');
  lines.push('  - team_members.csv never includes password hashes or verification tokens.');
  lines.push('  - Rows reference each other by their `id` column (e.g. journal_entry_lines.journalEntryId -> journal_entries.id).');
  lines.push('  - audit_logs.csv is the full, tamper-evident change history described in Ledgio\'s audit trail.');
  return lines.join('\n');
}

/**
 * GET /api/v1/data-export/manifest
 * Lists every table this export includes, with a plain-language description
 * of each - the "what's in this export" reference, available without
 * actually downloading anything.
 */
router.get('/manifest', requireRole('Admin'), async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: EXPORT_TABLES.map((t) => ({ key: t.key, label: t.label, description: t.description })),
  });
});

/**
 * GET /api/v1/data-export/json
 * A single structured JSON dump of every table for this tenant - the
 * machine-readable counterpart to the CSV export below.
 */
router.get('/json', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, tenantName } = requireTenantContext();

    const cooldown = await checkExportCooldown(tenantId, 'json');
    if (!cooldown.allowed) {
      res.setHeader('Retry-After', String(cooldown.retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: `Data exports are limited to once per hour. Try again in ${Math.ceil(cooldown.retryAfterSeconds / 60)} minute(s).`,
        retryAfterSeconds: cooldown.retryAfterSeconds,
      });
      return;
    }

    const tables = await withCurrentTenantDb(prisma, async (client) => {
      return collectTenantExportData(client, tenantId);
    });

    await recordAuditLog({
      action: 'DATA_EXPORT.DOWNLOADED',
      entity: 'Tenant',
      entityId: tenantId,
      actor: actorFromRequest(req),
      details: 'Full tenant data export downloaded (JSON).',
    });

    // Async anomaly detection — never blocks the response
    analyzeExportRequest({
      tenantId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      exportKind: 'json',
    }).catch(() => {/* already logged inside service */});

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ledgio-export-${Date.now()}.json"`);
    res.status(200).json({
      exportedAt: new Date().toISOString(),
      tenant: { id: tenantId, name: tenantName },
      tables,
    });
  } catch (error: any) {
    console.error('[DataExport] JSON export error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate data export.' });
  }
});

/**
 * GET /api/v1/data-export/csv
 * A ZIP containing one CSV per table plus a README describing what's in it -
 * the primary "download all my data" entry point from Settings.
 */
router.get('/csv', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, tenantName } = requireTenantContext();

    const cooldown = await checkExportCooldown(tenantId, 'csv');
    if (!cooldown.allowed) {
      res.setHeader('Retry-After', String(cooldown.retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: `Data exports are limited to once per hour. Try again in ${Math.ceil(cooldown.retryAfterSeconds / 60)} minute(s).`,
        retryAfterSeconds: cooldown.retryAfterSeconds,
      });
      return;
    }

    const name = tenantName || 'Business';

    const tables = await withCurrentTenantDb(prisma, async (client) => {
      return collectTenantExportData(client, tenantId);
    });

    await recordAuditLog({
      action: 'DATA_EXPORT.DOWNLOADED',
      entity: 'Tenant',
      entityId: tenantId,
      actor: actorFromRequest(req),
      details: 'Full tenant data export downloaded (CSV/ZIP).',
    });

    // Async anomaly detection — never blocks the response
    analyzeExportRequest({
      tenantId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      exportKind: 'csv',
    }).catch(() => {/* already logged inside service */});

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="ledgio-export-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('[DataExport] Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to build export archive.' });
      } else {
        res.end();
      }
    });
    archive.pipe(res);

    archive.append(buildReadmeText(name, new Date()), { name: 'README.txt' });
    for (const table of EXPORT_TABLES) {
      const { headers, rows } = rowsToCsvTable(tables[table.key] || []);
      const csv = headers.length > 0 ? buildCsv(headers, rows) : '';
      archive.append(csv, { name: `${table.key}.csv` });
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('[DataExport] CSV export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to generate data export.' });
    }
  }
});

export default router;
