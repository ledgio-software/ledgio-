import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import dns from 'dns';

// Force Node.js DNS resolution to prefer IPv4 over IPv6 across cloud hosts (Render/Containers)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore fallback
}
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import migrationsRouter from './routes/migrations';
import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import accountsRouter from './routes/accounts';
import journalEntriesRouter from './routes/journalEntries';
import ledgersRouter from './routes/ledgers';
import reportsRouter from './routes/reports';
import { requestLoggerMiddleware } from './middleware/requestLoggerMiddleware';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { apiRateLimiter } from './middleware/rateLimiterMiddleware';
import customFieldsRouter from './routes/customFields';
import auditLogsRouter from './routes/auditLogs';
import importRouter from './routes/import';
import aiCategorizationRouter from './routes/aiCategorization';
import scheduledReportsRouter from './routes/scheduledReports';
import bankingRouter from './routes/banking';
import invoicesRouter from './routes/invoices';
import billsRouter from './routes/bills';
import currencyRouter from './routes/currency';
import inventoryRouter from './routes/inventory';
import cashTillRouter from './routes/cashTill';
import analyticsRouter from './routes/analytics';
import notificationsRouter from './routes/notifications';
import feedbackRouter from './routes/feedback';
import adminBroadcastRouter from './routes/adminBroadcast';
import taxRatesRouter from './routes/taxRates';
import fundsRouter from './routes/funds';
import fiscalPeriodsRouter from './routes/fiscalPeriods';
import budgetsRouter from './routes/budgets';
import recurringTransactionsRouter from './routes/recurringTransactions';
import approvalWorkflowsRouter from './routes/approvalWorkflows';
import adminAuditLogsRouter from './routes/adminAuditLogs';
import adminIntegrationsRouter from './routes/adminIntegrations';
import adminFeedbackRouter from './routes/adminFeedback';
import adminAnalyticsRouter from './routes/adminAnalytics';
import adminMetricsRouter from './routes/adminMetrics';
import adminJobsRouter from './routes/adminJobs';
import adminErrorLogsRouter from './routes/adminErrorLogs';
import adminUsersRouter from './routes/adminUsers';
import adminEmergencyStopRouter from './routes/adminEmergencyStop';
import adminReferralsRouter from './routes/adminReferrals';
import adminClientHealthRouter from './routes/adminClientHealth';
import { recordError } from './services/errorLogService';
import expenseClaimsRouter from './routes/expenseClaims';
import syncRouter from './routes/sync';
import dataExportRouter from './routes/dataExport';
import complianceRouter from './routes/compliance';
import onboardingWizardRouter from './routes/onboardingWizard';
import helpAssistantRouter from './routes/helpAssistant';
import pettyCashRouter from './routes/pettyCash';
import purchaseOrdersRouter from './routes/purchaseOrders';
import salesOrdersRouter from './routes/salesOrders';
import priceListsRouter from './routes/priceLists';
import serialNumbersRouter from './routes/serialNumbers';
import jobsRouter from './routes/jobs';
import jobWorkOrdersRouter from './routes/jobWorkOrders';
import deliveryNotesRouter from './routes/deliveryNotes';
import goodsReceiptNotesRouter from './routes/goodsReceiptNotes';
import paymentBatchesRouter from './routes/paymentBatches';
import recurringInvoicesRouter from './routes/recurringInvoices';
import paystackRouter from './routes/paystack';
import fixedAssetsRouter from './routes/fixedAssets';
import payrollRouter from './routes/payroll';
import searchRouter from './routes/search';
import ocrRouter from './routes/ocr';
import subscriptionRouter from './routes/subscription';
import pharmacyRouter from './routes/pharmacy';
import costCentresRouter from './routes/costCentres';
import costCategoriesRouter from './routes/costCategories';
import scenariosRouter from './routes/scenarios';
import voucherClassesRouter from './routes/voucherClasses';
import manufacturingRouter from './routes/manufacturing';
import whtRatesRouter from './routes/whtRates';
import postDatedChequesRouter from './routes/postDatedCheques';
import interestPolicyRouter from './routes/interestPolicy';
import apiKeysRouter from './routes/apiKeys';
import externalApiRouter from './routes/externalApi';

dotenv.config();

const app: Express = express();

// Express does not trust X-Forwarded-For by default, so req.ip is the actual
// socket peer today (correct as long as nothing sits in front of this app).
// If this is ever deployed behind a reverse proxy/load balancer, req.ip would
// otherwise resolve to the proxy's own address for all traffic, collapsing
// every real user into one shared rate-limit bucket. Opt-in via TRUST_PROXY
// (number of hops to trust) rather than guessing a value - whoever sets up
// the deploy topology should set this explicitly.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// CORS is restricted to an explicit allowlist (CORS_ALLOWED_ORIGINS, comma-separated)
// rather than reflecting/allowing every origin - an open cors() lets any site make
// credentialed cross-origin requests against tenant data. Falls back to APP_URL
// (the frontend's own origin) so local dev keeps working without extra config.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.APP_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (no Origin header, e.g. curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
// This app is a pure JSON API (the React SPA is a separate deployment, never
// served from here), so there's no legitimate need for it to ever load
// scripts/styles/frames - deny by default rather than trusting helmet's
// general-purpose defaults, which are tuned for apps that also serve HTML.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// ── Observability ──────────────────────────────────────────────────────────────
// Inject X-Request-ID and structured HTTP request/latency logs on every request
app.use(requestLoggerMiddleware);
app.use(metricsMiddleware);

// ── Traffic Protection ──────────────────────────────────────────────────────────
// Global API rate limiter (100 req/min per tenant or IP)
app.use('/api/', apiRateLimiter);

// Metrics endpoint (no auth required for Prometheus scraping)
app.use('/metrics', metricsRouter);

// Root HEAD handler for uptime monitors that probe HEAD /
app.head('/', (_req, res) => res.sendStatus(200));

// Health check endpoints
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Auth endpoints. The strict 10-req/min brute-force limiter is applied
// per-route inside auth.ts, only to the unauthenticated credential-guessing
// surface (login, MFA verification, registration, invitation acceptance) -
// not the whole router. It previously covered already-authenticated routes
// too (GET /me, POST /mfa/setup, etc.), which don't need pre-auth brute-force
// protection and could 429 a legitimate user mid-session (e.g. enabling MFA,
// logging out, logging back in, then disabling it all within one minute).
app.use('/api/v1/auth', authRouter);

// Tenant onboarding & management endpoints. The strict 5-req/min onboarding
// limiter is applied per-route (POST /onboard, POST /admin-onboard) inside
// tenants.ts, not to the whole router - it previously throttled unrelated
// reads on this router too (GET / tenant roster, GET /current, GET /members,
// etc.), so routine admin dashboard use could 429 after a handful of loads.
app.use('/api/v1/tenants', tenantsRouter);

// Chart of Accounts CRUD endpoints
app.use('/api/v1/accounts', accountsRouter);

// Journal Entries API endpoints
app.use('/api/v1/journal-entries', journalEntriesRouter);

// Ledger Accounts & Transaction History API endpoints
app.use('/api/v1/ledgers', ledgersRouter);

// Financial Reporting API endpoints
app.use('/api/v1/reports', reportsRouter);

// Scheduled reports endpoints
app.use('/api/v1/reports', scheduledReportsRouter);

// Connected Banking & Reconciliation endpoints
app.use('/api/v1/banking', bankingRouter);

// Invoicing & AR endpoints
app.use('/api/v1/invoices', invoicesRouter);

// Vendor Bills & AP endpoints
app.use('/api/v1/bills', billsRouter);

// Multi-Currency & FX endpoints
app.use('/api/v1/currency', currencyRouter);

// Multi-Warehouse & Inventory Logistics (Godowns) endpoints
app.use('/api/v1/inventory', inventoryRouter);

// Cash Till & Daily Closeout endpoints
app.use('/api/v1/tills', cashTillRouter);

// Pharmacy module (PHARMACY org-type tenants only - gated inside the router)
app.use('/api/v1/pharmacy', pharmacyRouter);

// Cost Centres / Profit Centres (departmental/branch P&L segmentation)
app.use('/api/v1/cost-centres', costCentresRouter);
app.use('/api/v1/cost-categories', costCategoriesRouter);
app.use('/api/v1/scenarios', scenariosRouter);
app.use('/api/v1/voucher-classes', voucherClassesRouter);

// Manufacturing / Bill of Materials (BOM templates + production orders)
app.use('/api/v1/manufacturing', manufacturingRouter);

// Withholding Tax rates (WHT) - GRA-mandated deductions on contractor/rent payments
app.use('/api/v1/wht-rates', whtRatesRouter);
app.use('/api/v1/pdc', postDatedChequesRouter);
// Interest policy & charges for overdue receivables
app.use('/api/v1/interest-policy', interestPolicyRouter);

// Intelligent Analytics & Decision Engine endpoints
app.use('/api/v1/analytics', analyticsRouter);

// In-app Help Assistant endpoints
app.use('/api/v1/help-assistant', helpAssistantRouter);

// Petty cash log endpoints
app.use('/api/v1/petty-cash', pettyCashRouter);

// Purchase Order endpoints
app.use('/api/v1/purchase-orders', purchaseOrdersRouter);

// Sales Order endpoints
app.use('/api/v1/sales-orders', salesOrdersRouter);

// Price List endpoints
app.use('/api/v1/price-lists', priceListsRouter);

// Serial Number endpoints
app.use('/api/v1/serial-numbers', serialNumbersRouter);

// Job Costing endpoints
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/job-work-orders', jobWorkOrdersRouter);

// Delivery Note & Goods Receipt Note endpoints
app.use('/api/v1/delivery-notes', deliveryNotesRouter);
app.use('/api/v1/goods-receipt-notes', goodsReceiptNotesRouter);

// Payment Batch (bill-by-bill settlement / payment matching) endpoints
app.use('/api/v1/payment-batches', paymentBatchesRouter);
app.use('/api/v1/recurring-invoices', recurringInvoicesRouter);
app.use('/api/v1/paystack', paystackRouter);
app.use('/api/v1/fixed-assets', fixedAssetsRouter);

// Real-Time & Persistent Notifications endpoints
app.use('/api/v1/notifications', notificationsRouter);

// User Feedback endpoints (every role can submit; Admin/Auditor review)
app.use('/api/v1/feedback', feedbackRouter);

// System-wide Admin Broadcast endpoints (Encrypted Footer Gate)
app.use('/api/v1/admin/broadcast', adminBroadcastRouter);

// AI Categorization endpoints
app.use('/api/v1/ai', aiCategorizationRouter);

// Audit logs API endpoints
app.use('/api/v1/audit-logs', auditLogsRouter);

// Bulk data import API endpoints
app.use('/api/v1/import', importRouter);

// API key management (generate/revoke keys for machine-to-machine integration)
app.use('/api/v1/api-keys', apiKeysRouter);

// External API endpoints — authenticated by X-API-Key, no JWT required
app.use('/api/external/v1', externalApiRouter);

// Migration admin endpoints
app.use('/api/v1/admin/migrations', migrationsRouter);

// Custom fields endpoints (Tier 2 Customization Enforcement Showcase)
app.use('/api/v1/custom-fields', customFieldsRouter);

app.use('/api/v1/tax-rates', taxRatesRouter);
app.use('/api/v1/funds', fundsRouter);
app.use('/api/v1/fiscal-periods', fiscalPeriodsRouter);
app.use('/api/v1/budgets', budgetsRouter);
app.use('/api/v1/recurring-transactions', recurringTransactionsRouter);
app.use('/api/v1/approval-workflows', approvalWorkflowsRouter);
app.use('/api/v1/admin/audit-logs', adminAuditLogsRouter);
app.use('/api/v1/admin/integrations', adminIntegrationsRouter);
app.use('/api/v1/admin/feedback', adminFeedbackRouter);
app.use('/api/v1/admin/analytics', adminAnalyticsRouter);
app.use('/api/v1/admin/metrics', adminMetricsRouter);
app.use('/api/v1/admin/jobs', adminJobsRouter);
app.use('/api/v1/admin/error-logs', adminErrorLogsRouter);
app.use('/api/v1/admin/users', adminUsersRouter);
app.use('/api/v1/admin/emergency-stop', adminEmergencyStopRouter);
app.use('/api/v1/admin/referrals', adminReferralsRouter);
app.use('/api/v1/admin/client-health', adminClientHealthRouter);

// Employee Expense Claims (submit/approve/reimburse) endpoints
app.use('/api/v1/expense-claims', expenseClaimsRouter);
app.use('/api/v1/sync', syncRouter);

// Full-tenant data export (Phase 2 trust feature) - CSV/ZIP and JSON dumps of
// every table, no pricing-tier gate and no cooldown, see dataExportService.ts.
app.use('/api/v1/data-export', dataExportRouter);

// Phase 4 trust feature - a provable "last compliance update" timestamp,
// not just a claimed one. See ComplianceUpdate in schema.prisma.
app.use('/api/v1/compliance', complianceRouter);

// Phase 3 trust feature - guided onboarding wizard (business profile -> COA
// -> opening balances with a hard trial-balance gate -> completion checklist).
app.use('/api/v1/onboarding', onboardingWizardRouter);

// Ghana Payroll (PAYE, SSNIT, payslips, journal posting).
app.use('/api/v1/payroll', payrollRouter);

// Cross-entity keyword search (customers, invoices, accounts, items, etc.).
app.use('/api/v1/search', searchRouter);

// Receipt / vendor-bill OCR (Claude vision → pre-fill expense & bill forms).
app.use('/api/v1/ocr', ocrRouter);

// Subscription billing: free trial → MoMo / Visa payment via Paystack.
// No subscription enforcement on this router — expired tenants must still
// be able to reach the payment endpoints (enforcement is applied inside
// tenantContextMiddleware for all other tenant-scoped routes).
app.use('/api/v1/subscription', subscriptionRouter);

// Rejected CORS requests otherwise fall through to Express's default HTML
// error handler, which leaks a stack trace and breaks the API's JSON contract.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ success: false, error: 'Origin not allowed by CORS policy.' });
    return;
  }
  const status = (err as any).status || (err as any).statusCode || 500;
  // Capture body keys only (never values) so we can see what kind of request
  // caused the error without logging any sensitive data.
  const bodyKeys = req.body && typeof req.body === 'object'
    ? Object.keys(req.body).filter((k) => !['password', 'token', 'secret', 'key'].includes(k.toLowerCase()))
    : undefined;
  recordError({
    ts: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl ?? req.path,
    status,
    error: err.message ?? 'Unknown error',
    stack: err.stack,
    tenantId: (req as any).tenantId ?? (req as any).user?.tenantId,
    userId: (req as any).user?.id,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    bodyKeys: bodyKeys?.length ? bodyKeys : undefined,
  });
  next(err);
});

export default app;


