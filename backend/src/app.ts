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
import { adminPasscodeMiddleware } from './middleware/adminPasscodeMiddleware';
import { idorAuditMiddleware } from './middleware/idorGuard';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { apiRateLimiter, adminRateLimiter } from './middleware/rateLimiterMiddleware';
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
import adminChurnRiskRouter from './routes/adminChurnRisk';
import adminOnboardingRouter from './routes/adminOnboarding';
import adminRevenueRouter from './routes/adminRevenue';
import adminTotpRouter from './routes/adminTotp';
import adminDebugLogsRouter from './routes/adminDebugLogs';
import adminTeamAuthRouter from './routes/adminTeamAuth';
import adminTenantInspectorRouter from './routes/adminTenantInspector';
import adminFailedPaymentsRouter from './routes/adminFailedPayments';
import adminSupportQueueRouter from './routes/adminSupportQueue';
import adminSlowQueriesRouter from './routes/adminSlowQueries';
import adminCohortRouter from './routes/adminCohort';
import adminSchemaDiffRouter from './routes/adminSchemaDiff';
import { debugContextMiddleware } from './middleware/debugContextMiddleware';
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
import schoolClassesRouter from './routes/schoolClasses';
import schoolStudentsRouter from './routes/schoolStudents';
import schoolTermsRouter from './routes/schoolTerms';
import schoolFeeSchedulesRouter from './routes/schoolFeeSchedules';
import schoolFeeCollectionRouter from './routes/schoolFeeCollection';
import schoolReportsRouter from './routes/schoolReports';
import schoolAttendanceRouter from './routes/schoolAttendance';
import schoolAssessmentsRouter from './routes/schoolAssessments';
import schoolReportCardsRouter from './routes/schoolReportCards';
import schoolAdmissionsRouter from './routes/schoolAdmissions';
import schoolTimetableRouter from './routes/schoolTimetable';
import schoolCertificatesRouter from './routes/schoolCertificates';
import schoolScholarshipsRouter from './routes/schoolScholarships';
import schoolHealthRouter from './routes/schoolHealth';
import schoolEventsRouter from './routes/schoolEvents';
import schoolMISRouter from './routes/schoolMIS';
import schoolTeachersRouter from './routes/schoolTeachers';
import schoolNasiaRouter from './routes/schoolNasia';
import schoolFeePaymentPlansRouter from './routes/schoolFeePaymentPlans';
import schoolTransportRouter from './routes/schoolTransport';
import schoolParentCommsRouter from './routes/schoolParentComms';
import ssnitRouter from './routes/ssnit';
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
import honeypotProbesRouter from './routes/honeypotProbes';

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
app.use(debugContextMiddleware);
app.use(metricsMiddleware);

// ── Traffic Protection ──────────────────────────────────────────────────────────
// Global API rate limiter (100 req/min per tenant or IP)
app.use('/api/', apiRateLimiter);

// IDOR enumeration detection — logs when a session accesses an unusual number
// of distinct resource IDs within a short window. Runs after rate limiting so
// it only sees requests that cleared the rate gate.
app.use('/api/v1/', idorAuditMiddleware);

// TOTP auth routes — mounted BEFORE the rate limiter and passcode gate because
// they are part of the login flow itself. The verify endpoint does its own
// inline passcode check; the setup endpoint also checks the passcode inline.
// The rate limiter is applied separately to this prefix below.
app.use('/api/v1/admin/totp', adminRateLimiter, adminTotpRouter);

// Team auth routes — mounted BEFORE the passcode gate because GET /members and
// POST /login are public (used by the team login page). CRUD routes inside the
// router self-protect via isMasterAdmin(), so no global gate is needed here.
app.use('/api/v1/admin/team', adminRateLimiter, adminTeamAuthRouter);


// Strict admin rate limiter (10 req/min per IP) — applied before any admin
// handler so brute-forcing the master passcode is not feasible.
app.use('/api/v1/admin/', adminRateLimiter);

// Passcode / session token gate for all admin routes. Applied after the rate
// limiter so failed guesses are counted before reaching the auth check.
app.use('/api/v1/admin/', adminPasscodeMiddleware);

// Metrics endpoint (no auth required for Prometheus scraping)
app.use('/metrics', metricsRouter);

// Honeypot probe endpoints — convincing-looking responses for paths attackers
// enumerate (/.env, /admin, /wp-login.php, etc.). Mounted before all real routes
// so the trap fires first. Every hit is logged and triggers an alert email.
app.use(honeypotProbesRouter);

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

// Public referral code verification — used by the registration page to
// validate a code before form submission. No admin auth required.
// The full adminReferralsRouter is also mounted under /api/v1/admin/referrals
// (behind the passcode gate) for all other CRUD operations.
app.post('/api/v1/referrals/verify', async (req, res): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'code is required.' });
      return;
    }
    const { prisma } = await import('./config/db');
    const partner = await prisma.referralPartner.findUnique({
      where: { code: String(code).trim().toUpperCase() },
      select: { id: true, name: true, isActive: true },
    });
    if (!partner || !partner.isActive) {
      res.status(404).json({ success: false, error: 'Invalid or inactive referral code.' });
      return;
    }
    res.json({ success: true, data: { valid: true, partnerName: partner.name } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to verify referral code.' });
  }
});

// Public partner portal — secured by partner UUID (hard to guess, no password).
// Returns the list of referred tenants for that partner.
app.get('/api/v1/referrals/portal/:partnerId', async (req, res): Promise<void> => {
  try {
    const { prisma } = await import('./config/db');
    const partner = await prisma.referralPartner.findUnique({
      where: { id: req.params.partnerId },
      select: { id: true, name: true, code: true, commissionRate: true, isActive: true },
    });
    if (!partner || !partner.isActive) {
      res.status(404).json({ success: false, error: 'Partner not found.' });
      return;
    }
    const tenants = await prisma.tenant.findMany({
      where: { referralCode: partner.code },
      select: {
        id: true,
        name: true,
        orgType: true,
        tier: true,
        subscriptionStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const TIER_LABEL: Record<number, string> = { 0: 'Free', 1: 'Starter', 2: 'Professional', 3: 'Enterprise' };
    res.json({
      success: true,
      data: {
        partner: { name: partner.name, code: partner.code, commissionRate: Number(partner.commissionRate) },
        tenants: tenants.map(t => ({
          id: t.id,
          name: t.name,
          orgType: t.orgType,
          tier: TIER_LABEL[t.tier] ?? `Tier ${t.tier}`,
          subscriptionStatus: t.subscriptionStatus,
          joinedAt: t.createdAt,
        })),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load portal data.' });
  }
});

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

// School module (NONPROFIT/SCHOOL org-type tenants)
app.use('/api/v1/school/classes', schoolClassesRouter);
app.use('/api/v1/school/students', schoolStudentsRouter);
app.use('/api/v1/school/terms', schoolTermsRouter);
app.use('/api/v1/school/fee-schedules', schoolFeeSchedulesRouter);
app.use('/api/v1/school/fee-collection', schoolFeeCollectionRouter);
app.use('/api/v1/school/reports', schoolReportsRouter);
app.use('/api/v1/school/attendance', schoolAttendanceRouter);
app.use('/api/v1/school/assessments', schoolAssessmentsRouter);
app.use('/api/v1/school/report-cards', schoolReportCardsRouter);
app.use('/api/v1/school/admissions', schoolAdmissionsRouter);
app.use('/api/v1/school/timetable', schoolTimetableRouter);
app.use('/api/v1/school/certificates', schoolCertificatesRouter);
app.use('/api/v1/school/scholarships', schoolScholarshipsRouter);
app.use('/api/v1/school/health', schoolHealthRouter);
app.use('/api/v1/school/events', schoolEventsRouter);
app.use('/api/v1/school/mis', schoolMISRouter);
app.use('/api/v1/school/teachers', schoolTeachersRouter);
app.use('/api/v1/school/nasia', schoolNasiaRouter);
app.use('/api/v1/school/fee-payment-plans', schoolFeePaymentPlansRouter);
app.use('/api/v1/school/transport', schoolTransportRouter);
app.use('/api/v1/school/parent-comms', schoolParentCommsRouter);
app.use('/api/v1/ssnit', ssnitRouter);

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
app.use('/api/v1/admin/churn-risk', adminChurnRiskRouter);
app.use('/api/v1/admin/onboarding', adminOnboardingRouter);
app.use('/api/v1/admin/revenue', adminRevenueRouter);
app.use('/api/v1/admin/debug', adminDebugLogsRouter);
app.use('/api/v1/admin/tenants', adminTenantInspectorRouter);
app.use('/api/v1/admin/failed-payments', adminFailedPaymentsRouter);
app.use('/api/v1/admin/support-queue', adminSupportQueueRouter);
app.use('/api/v1/admin/slow-queries', adminSlowQueriesRouter);
app.use('/api/v1/admin/cohort', adminCohortRouter);
app.use('/api/v1/admin/schema-diff', adminSchemaDiffRouter);


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
    // Strip stack traces in production: they expose internal file paths and
    // library versions that make targeted CVE attacks easier. Keep them in
    // non-production so developers can debug locally.
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    tenantId: (req as any).tenantId ?? (req as any).user?.tenantId,
    userId: (req as any).user?.id,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    bodyKeys: bodyKeys?.length ? bodyKeys : undefined,
  });
  next(err);
});

export default app;


