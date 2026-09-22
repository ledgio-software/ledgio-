import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import { initAnalytics, trackPageView } from "./lib/analytics";
import type { ErrorInfo, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useWorkspaceMode } from "./contexts/WorkspaceModeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { api } from "./lib/api";
import { TenantSettingsProvider, useTenantSettings } from "./contexts/TenantSettingsContext";
import { useSyncEngineLifecycle } from "./hooks/useSyncEngineLifecycle";
import { usePresenceLifecycle } from "./hooks/usePresenceLifecycle";
import { SETTINGS_RESTRICTED_ROLES, getVisibleHrefs } from "./lib/navigation";
import { MainLayout } from "./components/layout/MainLayout";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { CommandMenu } from "./components/ui/CommandMenu";
import {
  ShoppingCart, Package, FileText as FileTextIcon, DollarSign,
  Wallet as WalletIcon, ArrowLeftRight, ClipboardList, BarChart2,
  Receipt as ReceiptIcon, Store, AlertTriangle, CheckCircle2, TrendingUp,
  Users, GraduationCap, CalendarCheck, BookOpen, ClipboardCheck,
  FileSpreadsheet, BadgeDollarSign, HeartPulse, Award,
} from "lucide-react";
import { useProfitAndLoss } from "./hooks/useProfitAndLoss";
import { useAccounts } from "./hooks/useAccounts";

// Lazy-loaded pages — each becomes its own chunk so the initial bundle stays small.
const Login = lazy(() => import("./pages/auth/Login").then(m => ({ default: m.Login })));
const Register = lazy(() => import("./pages/auth/Register").then(m => ({ default: m.Register })));
const AcceptInvitation = lazy(() => import("./pages/auth/AcceptInvitation").then(m => ({ default: m.AcceptInvitation })));
const Verification = lazy(() => import("./pages/auth/Verification").then(m => ({ default: m.Verification })));
const LandingPage = lazy(() => import("./pages/landing/LandingPage").then(m => ({ default: m.LandingPage })));
const FeaturesPage = lazy(() => import("./pages/landing/FeaturesPage").then(m => ({ default: m.FeaturesPage })));
const HowItWorksPage = lazy(() => import("./pages/landing/HowItWorksPage").then(m => ({ default: m.HowItWorksPage })));
const LegalHubPage = lazy(() => import("./pages/legal/LegalHubPage").then(m => ({ default: m.LegalHubPage })));
const LegalDocumentPage = lazy(() => import("./pages/legal/LegalDocumentPage").then(m => ({ default: m.LegalDocumentPage })));
const AdminCoreEngine = lazy(() => import("./pages/admin/AdminCoreEngine").then(m => ({ default: m.AdminCoreEngine })));
const AgodTeamLogin = lazy(() => import("./pages/admin/AgodTeamLogin").then(m => ({ default: m.AgodTeamLogin })));
const AgodTeamConsole = lazy(() => import("./pages/admin/AgodTeamConsole").then(m => ({ default: m.AgodTeamConsole })));
const ChartOfAccounts = lazy(() => import("./pages/accounts/ChartOfAccounts").then(m => ({ default: m.ChartOfAccounts })));
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard").then(m => ({ default: m.OnboardingWizard })));
const Settings = lazy(() => import("./pages/settings/Settings").then(m => ({ default: m.Settings })));
const TaxRates = lazy(() => import("./pages/settings/TaxRates").then(m => ({ default: m.TaxRates })));
const WhtRates = lazy(() => import("./pages/settings/WhtRates").then(m => ({ default: m.WhtRates })));
const PostDatedCheques = lazy(() => import("./pages/banking/PostDatedCheques").then(m => ({ default: m.PostDatedCheques })));
const InterestCharges = lazy(() => import("./pages/reports/InterestCharges").then(m => ({ default: m.InterestCharges })));
const MonthlySalesLedger = lazy(() => import("./pages/reports/MonthlySalesLedger").then(m => ({ default: m.MonthlySalesLedger })));
const Funds = lazy(() => import("./pages/settings/Funds").then(m => ({ default: m.Funds })));
const FiscalPeriods = lazy(() => import("./pages/settings/FiscalPeriods").then(m => ({ default: m.FiscalPeriods })));
const RecurringTransactions = lazy(() => import("./pages/settings/RecurringTransactions").then(m => ({ default: m.RecurringTransactions })));
const Approvals = lazy(() => import("./pages/approvals/Approvals").then(m => ({ default: m.Approvals })));
const SchoolStudents = lazy(() => import("./pages/school/Students").then(m => ({ default: m.Students })));
const SchoolTeachers = lazy(() => import("./pages/school/Teachers").then(m => ({ default: m.Teachers })));
const SchoolClasses = lazy(() => import("./pages/school/Classes").then(m => ({ default: m.Classes })));
const MomoReconciliation = lazy(() => import("./pages/school/MomoReconciliation").then(m => ({ default: m.MomoReconciliation })));
const AcademicTerms = lazy(() => import("./pages/school/AcademicTerms").then(m => ({ default: m.AcademicTerms })));
const FeeSchedules = lazy(() => import("./pages/school/FeeSchedules").then(m => ({ default: m.FeeSchedules })));
const FeeCollection = lazy(() => import("./pages/school/FeeCollection").then(m => ({ default: m.FeeCollection })));
const FeeDefaulters = lazy(() => import("./pages/school/FeeDefaulters").then(m => ({ default: m.FeeDefaulters })));
const DemandVsCollection = lazy(() => import("./pages/school/DemandVsCollection").then(m => ({ default: m.DemandVsCollection })));
const StudentLedger = lazy(() => import("./pages/school/StudentLedger").then(m => ({ default: m.StudentLedger })));
const SchoolAttendance = lazy(() => import("./pages/school/Attendance").then(m => ({ default: m.Attendance })));
const SchoolAssessments = lazy(() => import("./pages/school/Assessments").then(m => ({ default: m.Assessments })));
const SchoolReportCards = lazy(() => import("./pages/school/ReportCards").then(m => ({ default: m.ReportCards })));
const SchoolAdmissions = lazy(() => import("./pages/school/Admissions").then(m => ({ default: m.Admissions })));
const SchoolTimetable = lazy(() => import("./pages/school/Timetable").then(m => ({ default: m.Timetable })));
const SchoolCertificates = lazy(() => import("./pages/school/Certificates").then(m => ({ default: m.Certificates })));
const SchoolScholarships = lazy(() => import("./pages/school/Scholarships").then(m => ({ default: m.Scholarships })));
const SchoolStudentHealth = lazy(() => import("./pages/school/StudentHealth").then(m => ({ default: m.StudentHealth })));
const SchoolEventsPage = lazy(() => import("./pages/school/SchoolEvents").then(m => ({ default: m.SchoolEvents })));
const SchoolMIS = lazy(() => import("./pages/school/SchoolMIS").then(m => ({ default: m.SchoolMIS })));
const NasiaDashboard = lazy(() => import("./pages/school/NasiaDashboard").then(m => ({ default: m.NasiaDashboard })));
const FeePaymentPlans = lazy(() => import("./pages/school/FeePaymentPlans").then(m => ({ default: m.FeePaymentPlans })));
const SchoolTransport = lazy(() => import("./pages/school/Transport").then(m => ({ default: m.Transport })));
const ParentComms = lazy(() => import("./pages/school/ParentComms").then(m => ({ default: m.ParentComms })));
const ExpenseClaims = lazy(() => import("./pages/expenses/ExpenseClaims").then(m => ({ default: m.ExpenseClaims })));
const Budgets = lazy(() => import("./pages/reports/Budgets").then(m => ({ default: m.Budgets })));
const TeamManagement = lazy(() => import("./pages/team/TeamManagement").then(m => ({ default: m.TeamManagement })));
const AuditLogs = lazy(() => import("./pages/audit/AuditLogs").then(m => ({ default: m.AuditLogs })));
const SyncFailureLogs = lazy(() => import("./pages/sync/SyncFailureLogs").then(m => ({ default: m.SyncFailureLogs })));
const HelpAssistantActivity = lazy(() => import("./pages/help/HelpAssistantActivity").then(m => ({ default: m.HelpAssistantActivity })));
const FeedbackInbox = lazy(() => import("./pages/feedback/FeedbackInbox").then(m => ({ default: m.FeedbackInbox })));
const BulkImportWizard = lazy(() => import("./pages/import/BulkImportWizard").then(m => ({ default: m.BulkImportWizard })));
const BankReconciliation = lazy(() => import("./pages/banking/BankReconciliation").then(m => ({ default: m.BankReconciliation })));
const Invoices = lazy(() => import("./pages/invoices/Invoices").then(m => ({ default: m.Invoices })));
const Customers = lazy(() => import("./pages/customers/Customers").then(m => ({ default: m.Customers })));
const VendorBills = lazy(() => import("./pages/bills/VendorBills").then(m => ({ default: m.VendorBills })));
const WarehouseManagement = lazy(() => import("./pages/inventory/WarehouseManagement").then(m => ({ default: m.WarehouseManagement })));
const PointOfSale = lazy(() => import("./pages/pos/PointOfSale").then(m => ({ default: m.PointOfSale })));
const InventoryIntelligence = lazy(() => import("./pages/analytics/InventoryIntelligence").then(m => ({ default: m.InventoryIntelligence })));
const ExecutiveReports = lazy(() => import("./pages/reports/ExecutiveReports").then(m => ({ default: m.ExecutiveReports })));
const JournalList = lazy(() => import("./pages/journals/JournalList").then(m => ({ default: m.JournalList })));
const JournalBuilder = lazy(() => import("./components/journals/JournalBuilder").then(m => ({ default: m.JournalBuilder })));
const ContraVoucher = lazy(() => import("./pages/journals/ContraVoucher").then(m => ({ default: m.ContraVoucher })));
const GeneralLedger = lazy(() => import("./pages/reports/GeneralLedger").then(m => ({ default: m.GeneralLedger })));
const ProfitAndLoss = lazy(() => import("./pages/reports/ProfitAndLoss").then(m => ({ default: m.ProfitAndLoss })));
const BalanceSheet = lazy(() => import("./pages/reports/BalanceSheet").then(m => ({ default: m.BalanceSheet })));
const CashFlowStatement = lazy(() => import("./pages/reports/CashFlowStatement").then(m => ({ default: m.CashFlowStatement })));
const CashFlowForecast = lazy(() => import("./pages/reports/CashFlowForecast").then(m => ({ default: m.CashFlowForecast })));
const KpiDashboard = lazy(() => import("./pages/reports/KpiDashboard").then(m => ({ default: m.KpiDashboard })));
const AgingReport = lazy(() => import("./pages/reports/AgingReport").then(m => ({ default: m.AgingReport })));
const SalesChannelReport = lazy(() => import("./pages/reports/SalesChannelReport").then(m => ({ default: m.SalesChannelReport })));
const BranchComparisonReport = lazy(() => import("./pages/reports/BranchComparisonReport").then(m => ({ default: m.BranchComparisonReport })));
const LandedCostReport = lazy(() => import("./pages/reports/LandedCostReport").then(m => ({ default: m.LandedCostReport })));
const Daybook = lazy(() => import("./pages/reports/Daybook").then(m => ({ default: m.Daybook })));
const StockMovement = lazy(() => import("./pages/reports/StockMovement").then(m => ({ default: m.StockMovement })));
const Registers = lazy(() => import("./pages/reports/Registers").then(m => ({ default: m.Registers })));
const ReceiptLog = lazy(() => import("./pages/reports/ReceiptLog").then(m => ({ default: m.ReceiptLog })));
const AnalyticsDashboard = lazy(() => import("./pages/reports/AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));
const PettyCash = lazy(() => import("./pages/pettycash/PettyCash").then(m => ({ default: m.PettyCash })));
const PurchaseOrders = lazy(() => import("./pages/purchaseorders/PurchaseOrders").then(m => ({ default: m.PurchaseOrders })));
const SalesOrders = lazy(() => import("./pages/salesorders/SalesOrders").then(m => ({ default: m.SalesOrders })));
const DeliveryNotes = lazy(() => import("./pages/logistics/DeliveryNotes").then(m => ({ default: m.DeliveryNotes })));
const PaymentMatching = lazy(() => import("./pages/payments/PaymentMatching").then(m => ({ default: m.PaymentMatching })));
const RecurringInvoices = lazy(() => import("./pages/recurringinvoices/RecurringInvoices").then(m => ({ default: m.RecurringInvoices })));
const FixedAssets = lazy(() => import("./pages/fixedassets/FixedAssets").then(m => ({ default: m.FixedAssets })));
const Employees = lazy(() => import("./pages/payroll/Employees").then(m => ({ default: m.Employees })));
const PayrollRuns = lazy(() => import("./pages/payroll/PayrollRuns").then(m => ({ default: m.PayrollRuns })));
const Loans = lazy(() => import("./pages/payroll/Loans").then(m => ({ default: m.Loans })));
const Leave = lazy(() => import("./pages/payroll/Leave").then(m => ({ default: m.Leave })));
const SsnitCompliance = lazy(() => import("./pages/payroll/SsnitCompliance").then(m => ({ default: m.SsnitCompliance })));
const PaymentCallback = lazy(() => import("./pages/subscription/PaymentCallback").then(m => ({ default: m.PaymentCallback })));
const PrescriptionRegister = lazy(() => import("./pages/pharmacy/PrescriptionRegister").then(m => ({ default: m.PrescriptionRegister })));
const NarcoticsRegister = lazy(() => import("./pages/pharmacy/NarcoticsRegister").then(m => ({ default: m.NarcoticsRegister })));
const ExpiryAlerts = lazy(() => import("./pages/pharmacy/ExpiryAlerts").then(m => ({ default: m.ExpiryAlerts })));
const PharmacyPatients = lazy(() => import("./pages/pharmacy/PharmacyPatients").then(m => ({ default: m.PharmacyPatients })));
const NhisClaims = lazy(() => import("./pages/pharmacy/NhisClaims").then(m => ({ default: m.NhisClaims })));
const PharmacyInventoryMatrix = lazy(() => import("./pages/pharmacy/PharmacyInventoryMatrix").then(m => ({ default: m.PharmacyInventoryMatrix })));
const HospitalityRoomManagement = lazy(() => import("./pages/hospitality/RoomManagement").then(m => ({ default: m.RoomManagement })));
const HospitalityRoomTypes = lazy(() => import("./pages/hospitality/RoomTypes").then(m => ({ default: m.RoomTypes })));
const HospitalityReservations = lazy(() => import("./pages/hospitality/Reservations").then(m => ({ default: m.Reservations })));
const HospitalityReservationDetail = lazy(() => import("./pages/hospitality/ReservationDetail").then(m => ({ default: m.ReservationDetail })));
const HospitalityHousekeeping = lazy(() => import("./pages/hospitality/HousekeepingBoard").then(m => ({ default: m.HousekeepingBoard })));
const HospitalityNightAudit = lazy(() => import("./pages/hospitality/NightAudit").then(m => ({ default: m.NightAudit })));
const ChurchDashboard = lazy(() => import("./pages/church/Dashboard").then(m => ({ default: m.ChurchDashboard })));
const ChurchMembers = lazy(() => import("./pages/church/Members").then(m => ({ default: m.Members })));
const ChurchCellGroups = lazy(() => import("./pages/church/CellGroups").then(m => ({ default: m.CellGroups })));
const ChurchAttendance = lazy(() => import("./pages/church/Attendance").then(m => ({ default: m.Attendance })));
const ChurchPledges = lazy(() => import("./pages/church/Pledges").then(m => ({ default: m.Pledges })));
const ChurchGiving = lazy(() => import("./pages/church/Giving").then(m => ({ default: m.ChurchGiving })));
const ChurchVisitors = lazy(() => import("./pages/church/Visitors").then(m => ({ default: m.ChurchVisitors })));
const ChurchMinistries = lazy(() => import("./pages/church/Ministries").then(m => ({ default: m.ChurchMinistries })));
const ChurchEvents = lazy(() => import("./pages/church/Events").then(m => ({ default: m.ChurchEvents })));
const ChurchBranches = lazy(() => import("./pages/church/Branches").then(m => ({ default: m.ChurchBranches })));
const ChurchBranchDetail = lazy(() => import("./pages/church/BranchDetail").then(m => ({ default: m.ChurchBranchDetail })));
const ChurchSettings = lazy(() => import("./pages/church/ChurchSettings").then(m => ({ default: m.ChurchSettings })));
const ChurchReports = lazy(() => import("./pages/church/ChurchReports").then(m => ({ default: m.ChurchReports })));
const CostCentres = lazy(() => import("./pages/costcentres/CostCentres").then(m => ({ default: m.CostCentres })));
const Manufacturing = lazy(() => import("./pages/manufacturing/Manufacturing").then(m => ({ default: m.Manufacturing })));
const VatReturn = lazy(() => import("./pages/reports/VatReturn").then(m => ({ default: m.VatReturn })));
const StockAging = lazy(() => import("./pages/reports/StockAging").then(m => ({ default: m.StockAging })));
const TrialBalance = lazy(() => import("./pages/reports/TrialBalance").then(m => ({ default: m.TrialBalance })));
const FinancialRatios = lazy(() => import("./pages/reports/FinancialRatios").then(m => ({ default: m.FinancialRatios })));
const BenfordAnalysis = lazy(() => import("./pages/reports/BenfordAnalysis").then(m => ({ default: m.BenfordAnalysis })));
const FraudAlerts = lazy(() => import("./pages/reports/FraudAlerts").then(m => ({ default: m.FraudAlerts })));
const PriceLists = lazy(() => import("./pages/settings/PriceLists").then(m => ({ default: m.PriceLists })));
const SerialNumbers = lazy(() => import("./pages/inventory/SerialNumbers").then(m => ({ default: m.SerialNumbers })));
const Jobs = lazy(() => import("./pages/manufacturing/Jobs").then(m => ({ default: m.Jobs })));
const JobWorkOrders = lazy(() => import("./pages/manufacturing/JobWorkOrders").then(m => ({ default: m.JobWorkOrders })));
const CostCategories = lazy(() => import("./pages/costcentres/CostCategories").then(m => ({ default: m.CostCategories })));
const Scenarios = lazy(() => import("./pages/settings/Scenarios").then(m => ({ default: m.Scenarios })));
const VoucherClasses = lazy(() => import("./pages/settings/VoucherClasses").then(m => ({ default: m.VoucherClasses })));
const ApiKeys = lazy(() => import("./pages/settings/ApiKeys").then(m => ({ default: m.ApiKeys })));

// "What happened today?" quick-action grid shown in Operations and Business modes.
const GUIDED_ACTIONS_OPS = [
  { label: "Made a sale",           icon: ShoppingCart,  href: "/pos",              color: "emerald" },
  { label: "Received stock",        icon: Package,       href: "/purchase-orders",  color: "blue"    },
  { label: "Paid a supplier",       icon: ReceiptIcon,   href: "/bills",            color: "orange"  },
  { label: "Customer paid me",      icon: DollarSign,    href: "/invoices",         color: "green"   },
  { label: "Paid an expense",       icon: WalletIcon,    href: "/expenses",         color: "red"     },
  { label: "Moved stock",           icon: ArrowLeftRight,href: "/inventory",        color: "purple"  },
  { label: "Counted stock",         icon: ClipboardList, href: "/inventory",        color: "indigo"  },
  { label: "View today's sales",    icon: BarChart2,     href: "/reports/executive",color: "teal"    },
];

const GUIDED_ACTIONS_BIZ = [
  ...GUIDED_ACTIONS_OPS,
  { label: "Create invoice",        icon: FileTextIcon,  href: "/invoices",         color: "sky"     },
];

const ACTION_COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
  blue:    "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50",
  orange:  "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50",
  green:   "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50",
  red:     "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50",
  purple:  "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50",
  indigo:  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50",
  teal:    "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50",
  sky:     "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50",
};

function GuidedOperationsPanel({ mode }: { mode: "operations" | "business" }) {
  const actions = mode === "business" ? GUIDED_ACTIONS_BIZ : GUIDED_ACTIONS_OPS;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-secondary-900 dark:text-secondary-50">
          What happened today?
        </CardTitle>
        <p className="text-xs text-secondary-500 dark:text-secondary-400">
          Tap an action to record it — the books update automatically.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map(({ label, icon: Icon, href, color }) => (
            <Link
              key={label + href}
              to={href}
              className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all duration-150 ${ACTION_COLOR_CLASSES[color] ?? ACTION_COLOR_CLASSES.blue}`}
            >
              <Icon className="h-6 w-6 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Pages
const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { totalRevenue, totalExpense, netIncome, refetch: refetchPnL } = useProfitAndLoss();
  const { accounts } = useAccounts();
  const { settings } = useTenantSettings();
  const { mode } = useWorkspaceMode();

  // Roles with a reduced nav (Shop Manager, Cashier, HR, Auditor, Teacher, etc.)
  // don't have backend read access to company-wide P&L/ledger data
  // (rbacMiddleware.ts's scoped-role rules) - the underlying hooks above still
  // fire regardless (rules of hooks), but their 403s are swallowed by the
  // hooks' own catch/console.error, so just skip rendering these cards rather
  // than showing stale/zeroed figures.
  const isRestrictedRole = getVisibleHrefs((user?.role || "").toLowerCase().trim()) !== null;
  const isSchool = user?.orgType === 'NONPROFIT' || user?.orgType === 'SCHOOL';
  const role = (user?.role || '').toLowerCase().trim();
  const isSchoolRestrictedRole = isSchool && (role === 'teacher' || role === 'class teacher');

  const showGuidedPanel = !isRestrictedRole && !isSchool && (mode === "operations" || mode === "business");

  // One-time self-heal for tenants with POS sales recorded before revenue
  // posting existed (see routes/cashTill.ts POST /tills/sales) - an old
  // COMPLETED sale's journalId stays null forever unless something actively
  // backfills it, so a returning Admin/Accountant would otherwise see a
  // permanently-understated Total Revenue with no way to fix it themselves.
  // Idempotent on the backend (already-posted sales are skipped), and this
  // ref guards against firing more than once per mount (StrictMode's double
  // effect included) - not per every render.
  const backfillAttempted = useRef(false);
  useEffect(() => {
    if (isRestrictedRole || isSchool || backfillAttempted.current) return;
    backfillAttempted.current = true;
    api.post('/tills/backfill-revenue')
      .then((response) => {
        const { backfilled } = response.data?.data || {};
        if (backfilled > 0) {
          showToast(
            `Synced ${backfilled} POS sale${backfilled === 1 ? '' : 's'} recorded before revenue tracking was fixed - your totals are now up to date.`,
            'success'
          );
          refetchPnL();
        }
      })
      .catch((error) => {
        // Non-Admin/Accountant roles 403 here (route is role-gated) - not an
        // error worth surfacing, same silent-skip as the other company-wide
        // hooks on this page for restricted roles.
        console.error('Failed to check for missing POS revenue postings:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedRole]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings.baseCurrency,
    }).format(amount);
  };

  // Compact formatter for KPI tiles so large numbers (e.g. GHS 3.12B) don't overflow cards.
  const fmtKpi = (amount: number) => {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    const sym = settings.baseCurrency === 'GHS' ? 'GHS ' : (settings.baseCurrency + ' ');
    if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000)     return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)         return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
    return formatCurrency(amount);
  };

  const headerSubtitle = isSchool
    ? isSchoolRestrictedRole
      ? "Welcome back. Use the quick links below to get started."
      : "School overview — fees, enrolment, and academic progress at a glance."
    : mode === "operations"
      ? "Here's your business at a glance. Tap a quick action below to get started."
      : mode === "business"
      ? "Sales, purchases, and finance — all in one place."
      : "Welcome back. Here's what's happening with your accounts today.";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
            Dashboard
          </h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            {headerSubtitle}
          </p>
        </div>
        {!isRestrictedRole && !isSchool && mode === "professional" && (
          <Button variant="primary" onClick={() => navigate("/journals/new")}>
            New Voucher
          </Button>
        )}
      </div>

      {showGuidedPanel && (
        <GuidedOperationsPanel mode={mode as "operations" | "business"} />
      )}

      {!isRestrictedRole && !isSchool && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate"
                title={formatCurrency(totalRevenue)}
              >
                {fmtKpi(totalRevenue)}
              </div>
              <p className="text-xs text-secondary-400 mt-0.5 truncate" title={formatCurrency(totalRevenue)}>
                {formatCurrency(totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-amber-600 dark:text-amber-400 truncate"
                title={formatCurrency(totalExpense)}
              >
                {fmtKpi(totalExpense)}
              </div>
              <p className="text-xs text-secondary-400 mt-0.5 truncate" title={formatCurrency(totalExpense)}>
                {formatCurrency(totalExpense)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold truncate ${netIncome >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}`}
                title={formatCurrency(netIncome)}
              >
                {fmtKpi(netIncome)}
              </div>
              <p className="text-xs text-secondary-400 mt-0.5 truncate" title={formatCurrency(netIncome)}>
                {formatCurrency(netIncome)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* School-specific dashboards take over for school tenants */}
      {isSchoolRestrictedRole && <TeacherDashboard />}
      {isSchool && !isSchoolRestrictedRole && !isRestrictedRole && <SchoolAdminDashboard />}
      {/* Retail/general restricted roles (Shop Manager, Cashier, etc.) */}
      {!isSchool && isRestrictedRole && <ShopManagerDashboard />}
      {/* Full finance widgets for unrestricted non-school roles */}
      {!isSchool && !isRestrictedRole && <DashboardFinanceWidgets currency={settings.baseCurrency} />}
    </div>
  );
};

// ── Donut chart (pure SVG, no external deps) ──────────────────────────────────
function DonutChart({ segments, size = 110 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 14} fill="none" stroke="#e5e7eb" strokeWidth={20} />
      </svg>
    );
  }
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const len = (seg.value / total) * circ;
        const dash = `${len} ${circ - len}`;
        const offset = -acc;
        acc += len;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={seg.color} strokeWidth={20}
            strokeDasharray={dash} strokeDashoffset={offset} />
        );
      })}
    </svg>
  );
}

// ── Dashboard finance widgets (AR/AP aging donuts + KPI cards) ────────────────
function DashboardFinanceWidgets({ currency }: { currency: string }) {
  const { settings, isLoading: isLoadingTenantSettings } = useTenantSettings();
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  type AgingTotals = { current: number; days1to30: number; days31to60: number; days61to90: number; days90plus: number; total: number };
  const [arTotals, setArTotals] = useState<AgingTotals | null>(null);
  const [apTotals, setApTotals] = useState<AgingTotals | null>(null);
  const [agingError, setAgingError] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('dash-widgets-hidden') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    if (isLoadingTenantSettings || (settings?.tier ?? 1) < 2) return;
    api.get('/reports/aging/ar')
      .then(r => setArTotals(r.data.data?.totals ?? null))
      .catch((e) => { setAgingError(e?.response?.status ?? 0); });
    api.get('/reports/aging/ap')
      .then(r => setApTotals(r.data.data?.totals ?? null))
      .catch(() => {});
  }, [isLoadingTenantSettings, settings?.tier]);

  const toggleWidget = (key: string) => {
    setHidden(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('dash-widgets-hidden', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const AR_SEGMENTS = arTotals ? [
    { value: arTotals.current,    color: '#10b981', label: 'Current' },
    { value: arTotals.days1to30,  color: '#f59e0b', label: '1–30 days' },
    { value: arTotals.days31to60, color: '#f97316', label: '31–60 days' },
    { value: arTotals.days61to90, color: '#ef4444', label: '61–90 days' },
    { value: arTotals.days90plus, color: '#991b1b', label: '90+ days' },
  ] : [];

  const AP_SEGMENTS = apTotals ? [
    { value: apTotals.current,    color: '#10b981', label: 'Current' },
    { value: apTotals.days1to30,  color: '#f59e0b', label: '1–30 days' },
    { value: apTotals.days31to60, color: '#f97316', label: '31–60 days' },
    { value: apTotals.days61to90, color: '#ef4444', label: '61–90 days' },
    { value: apTotals.days90plus, color: '#991b1b', label: '90+ days' },
  ] : [];

  const arOverdue = arTotals ? arTotals.days1to30 + arTotals.days31to60 + arTotals.days61to90 + arTotals.days90plus : 0;
  const arOver30  = arTotals ? arTotals.days31to60 + arTotals.days61to90 + arTotals.days90plus : 0;
  const arOver90  = arTotals ? arTotals.days90plus : 0;

  if ((settings?.tier ?? 1) < 2) {
    return (
      <div className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/40 p-6 text-center text-sm text-secondary-500 dark:text-secondary-400">
        AR/AP aging reports and KPI widgets are available on the <span className="font-semibold text-secondary-700 dark:text-secondary-300">Business</span> plan and above.
        Upgrade your plan to unlock these insights.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Customize toggle */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-secondary-400">Show/hide:</span>
        {[{ key: 'kpi', label: 'AR KPIs' }, { key: 'ar', label: 'AR Aging' }, { key: 'ap', label: 'AP Aging' }].map(w => (
          <button key={w.key} onClick={() => toggleWidget(w.key)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${hidden[w.key] ? 'text-secondary-400 border-secondary-200 dark:border-secondary-700' : 'text-primary-600 border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'}`}>
            {w.label}
          </button>
        ))}
      </div>

      {/* MFA / auth error banner */}
      {agingError === 403 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Dashboard widgets are unavailable — your account requires two-factor authentication.
            {' '}<Link to="/settings?tab=security" className="underline font-medium">Enable MFA in Settings → Security</Link> to restore access.
          </span>
        </div>
      )}
      {agingError !== null && agingError !== 403 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Could not load dashboard data. Please refresh the page.
        </div>
      )}

      {/* AR KPI cards */}
      {!hidden['kpi'] && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Unpaid Invoices',      value: arTotals?.total ?? null,  color: 'text-secondary-800 dark:text-secondary-100' },
            { label: 'Overdue',              value: arOverdue,                 color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Overdue 30+ Days',     value: arOver30,                  color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Overdue 90+ Days',     value: arOver90,                  color: 'text-red-600 dark:text-red-400' },
          ].map(card => (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${card.color}`}>
                  {card.value === null ? '–' : fmt(card.value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Aging donut charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* AR donut */}
        {!hidden['ar'] && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Accounts Receivable Aging</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <DonutChart segments={AR_SEGMENTS} size={110} />
                <div className="space-y-1.5 flex-1 min-w-0">
                  {AR_SEGMENTS.map(s => (
                    <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="tabular-nums font-medium shrink-0">{fmt(s.value)}</span>
                    </div>
                  ))}
                  <div className="border-t dark:border-secondary-700 pt-1.5 flex justify-between text-xs font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmt(arTotals?.total ?? 0)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AP donut */}
        {!hidden['ap'] && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Accounts Payable Aging</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <DonutChart segments={AP_SEGMENTS} size={110} />
                <div className="space-y-1.5 flex-1 min-w-0">
                  {AP_SEGMENTS.map(s => (
                    <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="tabular-nums font-medium shrink-0">{fmt(s.value)}</span>
                    </div>
                  ))}
                  <div className="border-t dark:border-secondary-700 pt-1.5 flex justify-between text-xs font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmt(apTotals?.total ?? 0)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── School Admin / Bursar dashboard (orgType === NONPROFIT, unrestricted role) ─
function SchoolAdminDashboard() {
  const { settings } = useTenantSettings();
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.baseCurrency }).format(n);
  const [data, setData] = useState<{
    studentCount: number | null;
    activeTerm: string | null;
    feesCollectedTerm: number | null;
    feesOutstandingTerm: number | null;
  }>({ studentCount: null, activeTerm: null, feesCollectedTerm: null, feesOutstandingTerm: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/school/students?limit=1'),
      api.get('/school/terms'),
      api.get('/school/fee-collection/info'),
    ]).then(([studentsRes, termsRes, feeRes]) => {
      let studentCount: number | null = null;
      let activeTerm: string | null = null;
      let activeTermId: string | null = null;

      if (studentsRes.status === 'fulfilled') {
        studentCount = studentsRes.value.data?.data?.students?.length ?? null;
        // Re-fetch without limit to get real count
        api.get('/school/students').then((r) => {
          setData((d) => ({ ...d, studentCount: r.data?.data?.students?.length ?? 0 }));
        }).catch(() => {});
      }
      if (termsRes.status === 'fulfilled') {
        const terms: any[] = termsRes.value.data?.data?.terms ?? [];
        const active = terms.find((t: any) => t.isActive) ?? terms[0];
        if (active) { activeTerm = active.name; activeTermId = active.id; }
      }
      setData((d) => ({ ...d, studentCount: studentCount ?? d.studentCount, activeTerm }));

      if (activeTermId && feeRes.status === 'fulfilled') {
        const info = feeRes.value.data?.data ?? {};
        setData((d) => ({
          ...d,
          feesCollectedTerm: info.totalCollected != null ? Number(info.totalCollected) : null,
          feesOutstandingTerm: info.totalOutstanding != null ? Number(info.totalOutstanding) : null,
        }));
      }
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SCHOOL_QUICK_ACTIONS = [
    { label: 'Collect Fees',       href: '/school/fee-collection',  icon: BadgeDollarSign, color: 'emerald' },
    { label: 'Mark Attendance',    href: '/school/attendance',      icon: CalendarCheck,   color: 'blue'    },
    { label: 'Enter Assessments',  href: '/school/assessments',     icon: ClipboardCheck,  color: 'purple'  },
    { label: 'View Students',      href: '/school/students',        icon: Users,           color: 'indigo'  },
    { label: 'Report Cards',       href: '/school/report-cards',    icon: FileSpreadsheet, color: 'orange'  },
    { label: 'Fee Defaulters',     href: '/school/fee-defaulters',  icon: AlertTriangle,   color: 'red'     },
    { label: 'School MIS',         href: '/school/mis',             icon: BarChart2,       color: 'teal'    },
    { label: 'Admissions',         href: '/school/admissions',      icon: GraduationCap,   color: 'sky'     },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-secondary-100 dark:bg-secondary-800" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.studentCount ?? '—'}</div>
            <p className="text-xs text-secondary-500 mt-1">Active enrolments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Term</CardTitle>
            <BookOpen className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{data.activeTerm ?? '—'}</div>
            <p className="text-xs text-secondary-500 mt-1">Active academic term</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Collected</CardTitle>
            <BadgeDollarSign className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.feesCollectedTerm != null ? fmt(data.feesCollectedTerm) : '—'}
            </div>
            <p className="text-xs text-secondary-500 mt-1">This term</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Fees</CardTitle>
            <AlertTriangle className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data.feesOutstandingTerm ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-secondary-900 dark:text-secondary-50'}`}>
              {data.feesOutstandingTerm != null ? fmt(data.feesOutstandingTerm) : '—'}
            </div>
            <p className="text-xs text-secondary-500 mt-1">This term</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick-action tiles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-secondary-900 dark:text-secondary-50">Quick Actions</CardTitle>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">Jump to the most-used school modules.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SCHOOL_QUICK_ACTIONS.map(({ label, href, icon: Icon, color }) => (
              <Link key={label} to={href} className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all duration-150 ${ACTION_COLOR_CLASSES[color] ?? ACTION_COLOR_CLASSES.blue}`}>
                <Icon className="h-6 w-6 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Teacher / Class Teacher dashboard (school restricted role) ─────────────────
function TeacherDashboard() {
  const { user } = useAuth();
  const isClassTeacher = (user?.role || '').toLowerCase().trim() === 'class teacher';

  const TEACHER_ACTIONS = [
    { label: 'Mark Attendance',   href: '/school/attendance',   icon: CalendarCheck,  color: 'blue'    },
    { label: 'Enter Assessments', href: '/school/assessments',  icon: ClipboardCheck, color: 'purple'  },
    { label: 'Report Cards',      href: '/school/report-cards', icon: FileSpreadsheet, color: 'orange' },
    { label: 'Timetable',         href: '/school/timetable',    icon: BookOpen,       color: 'teal'    },
    { label: 'Students',          href: '/school/students',     icon: Users,          color: 'indigo'  },
    { label: 'School Events',     href: '/school/events',       icon: Award,          color: 'emerald' },
    ...(isClassTeacher ? [
      { label: 'Student Health',  href: '/school/health',       icon: HeartPulse,     color: 'red'     },
      { label: 'Certificates',    href: '/school/certificates',  icon: GraduationCap, color: 'sky'     },
    ] : []),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-secondary-900 dark:text-secondary-50">
            {isClassTeacher ? 'Class Teacher Portal' : 'Teacher Portal'}
          </CardTitle>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {isClassTeacher
              ? 'Manage attendance, assessments, report cards, and health records for your class.'
              : 'Record attendance, enter assessment scores, and generate report cards.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEACHER_ACTIONS.map(({ label, href, icon: Icon, color }) => (
              <Link key={label} to={href} className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all duration-150 ${ACTION_COLOR_CLASSES[color] ?? ACTION_COLOR_CLASSES.blue}`}>
                <Icon className="h-6 w-6 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ShopManagerDashboard() {
  const { settings } = useTenantSettings();
  const [tillStatus, setTillStatus] = useState<{ status: string; cashSalesTotal: number } | null>(null);
  const [todaySales, setTodaySales] = useState<{ total: number; count: number } | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [lastDiscrepancy, setLastDiscrepancy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.baseCurrency }).format(n);

  useEffect(() => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    Promise.allSettled([
      api.get('/tills/current'),
      api.get(`/tills/closeouts?startDate=${today}&endDate=${today}&limit=50`),
      api.get('/inventory/warehouses'),
    ]).then(([tillRes, closeoutRes, whRes]) => {
      if (tillRes.status === 'fulfilled') {
        const t = tillRes.value.data?.data?.till;
        setTillStatus(t ? { status: t.status, cashSalesTotal: Number(t.cashSalesTotal ?? 0) } : null);
      }
      if (closeoutRes.status === 'fulfilled') {
        const rows: any[] = closeoutRes.value.data?.data?.closeouts ?? [];
        const total = rows.reduce((s: number, r: any) => s + Number(r.cashSalesTotal ?? 0), 0);
        setTodaySales({ total, count: rows.reduce((s: number, r: any) => s + (r.totalTransactions ?? 0), 0) });
        if (rows.length > 0) setLastDiscrepancy(Number(rows[0].discrepancy ?? 0));
      }
      if (whRes.status === 'fulfilled') {
        const warehouses: any[] = whRes.value.data?.data?.warehouses ?? [];
        let low = 0;
        for (const wh of warehouses) {
          for (const s of (wh.stocks ?? [])) {
            if (s.quantityOnHand <= (s.reorderLevel ?? 0)) low++;
          }
        }
        setLowStockCount(low);
      }
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-secondary-100 dark:bg-secondary-800" />)}</div>;
  }

  const tillOpen = tillStatus?.status === 'OPEN';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Till Status</CardTitle>
            <Store className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${tillOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-secondary-500'}`}>
              {tillStatus ? (tillOpen ? 'OPEN' : 'CLOSED') : 'No Till'}
            </div>
            {tillOpen && (
              <p className="text-xs text-secondary-500 mt-1">Sales today: {fmt(tillStatus!.cashSalesTotal)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {todaySales ? fmt(todaySales.total) : fmt(0)}
            </div>
            {todaySales && (
              <p className="text-xs text-secondary-500 mt-1">{todaySales.count} transaction{todaySales.count !== 1 ? 's' : ''}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${(lowStockCount ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-secondary-900 dark:text-secondary-50'}`}>
              {lowStockCount ?? 0}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              {(lowStockCount ?? 0) > 0 ? 'Items at or below reorder level' : 'All items stocked'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Closeout</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${lastDiscrepancy !== null && lastDiscrepancy !== 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {lastDiscrepancy !== null ? (lastDiscrepancy === 0 ? 'Balanced' : fmt(lastDiscrepancy)) : '—'}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              {lastDiscrepancy !== null && lastDiscrepancy !== 0 ? 'Discrepancy detected' : 'No discrepancy'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Open / Close Till', href: '/pos', icon: Store, color: 'emerald' },
          { label: 'Make a Sale', href: '/pos', icon: ShoppingCart, color: 'blue' },
          { label: 'View Inventory', href: '/inventory', icon: Package, color: 'purple' },
        ].map(({ label, href, icon: Icon, color }) => (
          <Link key={label} to={href} className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all duration-150 ${ACTION_COLOR_CLASSES[color] ?? ACTION_COLOR_CLASSES.blue}`}>
            <Icon className="h-6 w-6 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardRoute() {
  const { user } = useAuth();
  if (user?.orgType === "CHURCH") return <Navigate to="/church/dashboard" replace />;
  return <MainLayout><Dashboard /></MainLayout>;
}

function ProtectedRoute({ children, blockedRoles, allowedOrgTypes }: { children: React.ReactNode; blockedRoles?: Set<string>; allowedOrgTypes?: string[] }) {
  const { token, isLoading, user } = useAuth();
  // Also wait on tenant settings (only once a token exists - no point waiting
  // when we're about to redirect to /login anyway) so pages never paint the
  // hardcoded USD default before flipping to the tenant's real currency.
  const { isLoading: settingsLoading } = useTenantSettings();
  const location = useLocation();

  if (isLoading || (token && settingsLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const role = (user?.role || "").toLowerCase().trim();

  if (blockedRoles && blockedRoles.has(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedOrgTypes && !allowedOrgTypes.includes(user?.orgType ?? "")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Generic allowlist enforcement for any role with a reduced nav
  // (RESTRICTED_ROLE_NAV in navigation.ts - Shop Manager, Cashier, HR,
  // Auditor) - covers every route automatically, including ones added
  // later, rather than relying on each route remembering to opt into
  // `blockedRoles`. Real enforcement is still server-side (rbacMiddleware);
  // this just keeps a restricted role from landing on a page shell whose
  // every action would 403 anyway.
  const visibleHrefs = getVisibleHrefs(role);
  if (visibleHrefs && !visibleHrefs.has(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Mounted once at the app root (not per-route, unlike ProtectedRoute) so the
// local-first sync engine's login/logout lifecycle only fires on an actual
// auth change, never on ordinary navigation between pages.
function SyncEngineLifecycleMount() {
  useSyncEngineLifecycle();
  return null;
}

// Same mounting rationale as SyncEngineLifecycleMount - unconditional for
// every role (not just Admin), since the presence roster needs everyone
// actually connected to be accurate, even though only the Admin-only Team
// Management page displays it.
function PresenceLifecycleMount() {
  usePresenceLifecycle();
  return null;
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-950 p-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50 mb-2">Something went wrong</h1>
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RouteLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
  </div>
);

function App() {
  useEffect(() => { initAnalytics(); }, []);

  return (
    <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="accountgo-theme">
      <ToastProvider>
      <AuthProvider>
      <TenantSettingsProvider>
        <SyncEngineLifecycleMount />
        <PresenceLifecycleMount />
        <BrowserRouter>
          <PageViewTracker />
          <CommandMenu />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/accept-invite" element={<AcceptInvitation />} />
              <Route path="/verify-account" element={<Verification />} />
              <Route path="/verify" element={<PaymentCallback />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/legal" element={<LegalHubPage />} />
              <Route path="/legal/:policyName" element={<LegalDocumentPage />} />
              <Route path="/admin/core-engine" element={<AdminCoreEngine />} />
              <Route path="/agod/login" element={<AgodTeamLogin />} />
              <Route path="/agod/console" element={<AgodTeamConsole />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardRoute /></ProtectedRoute>} />
              <Route path="/accounts" element={<ProtectedRoute><MainLayout><ChartOfAccounts /></MainLayout></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><OnboardingWizard /></MainLayout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/security" element={<Navigate to="/settings?tab=security" replace />} />
              <Route path="/settings/tax-rates" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><TaxRates /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/wht-rates" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><WhtRates /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/funds" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><Funds /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/fiscal-periods" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><FiscalPeriods /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/recurring-transactions" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><RecurringTransactions /></MainLayout></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><MainLayout><Approvals /></MainLayout></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><MainLayout><ExpenseClaims /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/budgets" element={<ProtectedRoute><MainLayout><Budgets /></MainLayout></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><MainLayout><TeamManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><MainLayout><AuditLogs /></MainLayout></ProtectedRoute>} />
              <Route path="/sync/failures" element={<ProtectedRoute><MainLayout><SyncFailureLogs /></MainLayout></ProtectedRoute>} />
              <Route path="/help-assistant/activity" element={<ProtectedRoute><MainLayout><HelpAssistantActivity /></MainLayout></ProtectedRoute>} />
              <Route path="/feedback" element={<ProtectedRoute><MainLayout><FeedbackInbox /></MainLayout></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><MainLayout><BulkImportWizard /></MainLayout></ProtectedRoute>} />
              <Route path="/banking" element={<ProtectedRoute><MainLayout><BankReconciliation /></MainLayout></ProtectedRoute>} />
              <Route path="/pdc" element={<ProtectedRoute><MainLayout><PostDatedCheques /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/interest-charges" element={<ProtectedRoute><MainLayout><InterestCharges /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/monthly-sales-ledger" element={<ProtectedRoute><MainLayout><MonthlySalesLedger /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><MainLayout><VendorBills /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><MainLayout><WarehouseManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute><MainLayout><PointOfSale /></MainLayout></ProtectedRoute>} />
              <Route path="/analytics/inventory" element={<ProtectedRoute><MainLayout><InventoryIntelligence /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/executive" element={<ProtectedRoute><MainLayout><ExecutiveReports /></MainLayout></ProtectedRoute>} />
              <Route path="/journals" element={<ProtectedRoute><MainLayout><JournalList /></MainLayout></ProtectedRoute>} />
              <Route path="/journals/new" element={<ProtectedRoute><MainLayout><JournalBuilder /></MainLayout></ProtectedRoute>} />
              <Route path="/journals/contra" element={<ProtectedRoute><MainLayout><ContraVoucher /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/ledger" element={<ProtectedRoute><MainLayout><GeneralLedger /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/pnl" element={<ProtectedRoute><MainLayout><ProfitAndLoss /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/balance-sheet" element={<ProtectedRoute><MainLayout><BalanceSheet /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/cash-flow" element={<ProtectedRoute><MainLayout><CashFlowStatement /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/cash-flow-forecast" element={<ProtectedRoute><MainLayout><CashFlowForecast /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/kpis" element={<ProtectedRoute><MainLayout><KpiDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/aging" element={<ProtectedRoute><MainLayout><AgingReport /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/sales-channel" element={<ProtectedRoute><MainLayout><SalesChannelReport /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/branch-comparison" element={<ProtectedRoute><MainLayout><BranchComparisonReport /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/landed-costs" element={<ProtectedRoute><MainLayout><LandedCostReport /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/analytics" element={<ProtectedRoute><MainLayout><AnalyticsDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/daybook" element={<ProtectedRoute><MainLayout><Daybook /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/stock-movement" element={<ProtectedRoute><MainLayout><StockMovement /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/registers" element={<ProtectedRoute><MainLayout><Registers /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/receipt-log" element={<ProtectedRoute><MainLayout><ReceiptLog /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/vat-return" element={<ProtectedRoute><MainLayout><VatReturn /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/stock-aging" element={<ProtectedRoute><MainLayout><StockAging /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/trial-balance" element={<ProtectedRoute><MainLayout><TrialBalance /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/financial-ratios" element={<ProtectedRoute><MainLayout><FinancialRatios /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/benford-analysis" element={<ProtectedRoute><MainLayout><BenfordAnalysis /></MainLayout></ProtectedRoute>} />
              <Route path="/reports/fraud-alerts" element={<ProtectedRoute><MainLayout><FraudAlerts /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/price-lists" element={<ProtectedRoute><MainLayout><PriceLists /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/serial-numbers" element={<ProtectedRoute><MainLayout><SerialNumbers /></MainLayout></ProtectedRoute>} />
              <Route path="/petty-cash" element={<ProtectedRoute><MainLayout><PettyCash /></MainLayout></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute><MainLayout><PurchaseOrders /></MainLayout></ProtectedRoute>} />
              <Route path="/sales-orders" element={<ProtectedRoute><MainLayout><SalesOrders /></MainLayout></ProtectedRoute>} />
              <Route path="/delivery-notes" element={<ProtectedRoute><MainLayout><DeliveryNotes /></MainLayout></ProtectedRoute>} />
              <Route path="/payment-matching" element={<ProtectedRoute><MainLayout><PaymentMatching /></MainLayout></ProtectedRoute>} />
              <Route path="/recurring-invoices" element={<ProtectedRoute><MainLayout><RecurringInvoices /></MainLayout></ProtectedRoute>} />
              <Route path="/fixed-assets" element={<ProtectedRoute><MainLayout><FixedAssets /></MainLayout></ProtectedRoute>} />
              <Route path="/payroll/employees" element={<ProtectedRoute><MainLayout><Employees /></MainLayout></ProtectedRoute>} />
              <Route path="/payroll/runs" element={<ProtectedRoute><MainLayout><PayrollRuns /></MainLayout></ProtectedRoute>} />
              <Route path="/payroll/loans" element={<ProtectedRoute><MainLayout><Loans /></MainLayout></ProtectedRoute>} />
              <Route path="/payroll/leave" element={<ProtectedRoute><MainLayout><Leave /></MainLayout></ProtectedRoute>} />
              <Route path="/payroll/ssnit" element={<ProtectedRoute><MainLayout><SsnitCompliance /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/prescriptions" element={<ProtectedRoute><MainLayout><PrescriptionRegister /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/patients" element={<ProtectedRoute><MainLayout><PharmacyPatients /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/nhis-claims" element={<ProtectedRoute><MainLayout><NhisClaims /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/inventory-matrix" element={<ProtectedRoute><MainLayout><PharmacyInventoryMatrix /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/narcotics" element={<ProtectedRoute><MainLayout><NarcoticsRegister /></MainLayout></ProtectedRoute>} />
              <Route path="/pharmacy/expiry" element={<ProtectedRoute><MainLayout><ExpiryAlerts /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/rooms" element={<ProtectedRoute><MainLayout><HospitalityRoomManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/room-types" element={<ProtectedRoute><MainLayout><HospitalityRoomTypes /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/reservations" element={<ProtectedRoute><MainLayout><HospitalityReservations /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/reservations/:id" element={<ProtectedRoute><MainLayout><HospitalityReservationDetail /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/housekeeping" element={<ProtectedRoute><MainLayout><HospitalityHousekeeping /></MainLayout></ProtectedRoute>} />
              <Route path="/hospitality/night-audit" element={<ProtectedRoute><MainLayout><HospitalityNightAudit /></MainLayout></ProtectedRoute>} />
              <Route path="/church/dashboard" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/church/members" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchMembers /></MainLayout></ProtectedRoute>} />
              <Route path="/church/cell-groups" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchCellGroups /></MainLayout></ProtectedRoute>} />
              <Route path="/church/attendance" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchAttendance /></MainLayout></ProtectedRoute>} />
              <Route path="/church/pledges" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchPledges /></MainLayout></ProtectedRoute>} />
              <Route path="/church/giving" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchGiving /></MainLayout></ProtectedRoute>} />
              <Route path="/church/visitors" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchVisitors /></MainLayout></ProtectedRoute>} />
              <Route path="/church/ministries" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchMinistries /></MainLayout></ProtectedRoute>} />
              <Route path="/church/events" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchEvents /></MainLayout></ProtectedRoute>} />
              <Route path="/church/branches" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchBranches /></MainLayout></ProtectedRoute>} />
              <Route path="/church/branches/:id" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchBranchDetail /></MainLayout></ProtectedRoute>} />
              <Route path="/church/settings" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchSettings /></MainLayout></ProtectedRoute>} />
              <Route path="/church/reports" element={<ProtectedRoute allowedOrgTypes={["CHURCH"]}><MainLayout><ChurchReports /></MainLayout></ProtectedRoute>} />
              <Route path="/school/teachers" element={<ProtectedRoute><MainLayout><SchoolTeachers /></MainLayout></ProtectedRoute>} />
              <Route path="/school/classes" element={<ProtectedRoute><MainLayout><SchoolClasses /></MainLayout></ProtectedRoute>} />
              <Route path="/school/momo-reconciliation" element={<ProtectedRoute><MainLayout><MomoReconciliation /></MainLayout></ProtectedRoute>} />
              <Route path="/school/students" element={<ProtectedRoute><MainLayout><SchoolStudents /></MainLayout></ProtectedRoute>} />
              <Route path="/school/terms" element={<ProtectedRoute><MainLayout><AcademicTerms /></MainLayout></ProtectedRoute>} />
              <Route path="/school/fee-schedules" element={<ProtectedRoute><MainLayout><FeeSchedules /></MainLayout></ProtectedRoute>} />
              <Route path="/school/fee-collection" element={<ProtectedRoute><MainLayout><FeeCollection /></MainLayout></ProtectedRoute>} />
              <Route path="/school/fee-defaulters" element={<ProtectedRoute><MainLayout><FeeDefaulters /></MainLayout></ProtectedRoute>} />
              <Route path="/school/demand-vs-collection" element={<ProtectedRoute><MainLayout><DemandVsCollection /></MainLayout></ProtectedRoute>} />
              <Route path="/school/student-ledger" element={<ProtectedRoute><MainLayout><StudentLedger /></MainLayout></ProtectedRoute>} />
              <Route path="/school/attendance" element={<ProtectedRoute><MainLayout><SchoolAttendance /></MainLayout></ProtectedRoute>} />
              <Route path="/school/assessments" element={<ProtectedRoute><MainLayout><SchoolAssessments /></MainLayout></ProtectedRoute>} />
              <Route path="/school/report-cards" element={<ProtectedRoute><MainLayout><SchoolReportCards /></MainLayout></ProtectedRoute>} />
              <Route path="/school/admissions" element={<ProtectedRoute><MainLayout><SchoolAdmissions /></MainLayout></ProtectedRoute>} />
              <Route path="/school/timetable" element={<ProtectedRoute><MainLayout><SchoolTimetable /></MainLayout></ProtectedRoute>} />
              <Route path="/school/certificates" element={<ProtectedRoute><MainLayout><SchoolCertificates /></MainLayout></ProtectedRoute>} />
              <Route path="/school/scholarships" element={<ProtectedRoute><MainLayout><SchoolScholarships /></MainLayout></ProtectedRoute>} />
              <Route path="/school/health" element={<ProtectedRoute><MainLayout><SchoolStudentHealth /></MainLayout></ProtectedRoute>} />
              <Route path="/school/events" element={<ProtectedRoute><MainLayout><SchoolEventsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/school/mis" element={<ProtectedRoute><MainLayout><SchoolMIS /></MainLayout></ProtectedRoute>} />
              <Route path="/school/nasia" element={<ProtectedRoute><MainLayout><NasiaDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/school/fee-payment-plans" element={<ProtectedRoute><MainLayout><FeePaymentPlans /></MainLayout></ProtectedRoute>} />
              <Route path="/school/transport" element={<ProtectedRoute><MainLayout><SchoolTransport /></MainLayout></ProtectedRoute>} />
              <Route path="/school/parent-comms" element={<ProtectedRoute><MainLayout><ParentComms /></MainLayout></ProtectedRoute>} />
              <Route path="/cost-centres" element={<ProtectedRoute><MainLayout><CostCentres /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing" element={<ProtectedRoute><MainLayout><Manufacturing /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/jobs" element={<ProtectedRoute><MainLayout><Jobs /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/job-work-orders" element={<ProtectedRoute><MainLayout><JobWorkOrders /></MainLayout></ProtectedRoute>} />
              <Route path="/cost-categories" element={<ProtectedRoute><MainLayout><CostCategories /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/scenarios" element={<ProtectedRoute><MainLayout><Scenarios /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/voucher-classes" element={<ProtectedRoute><MainLayout><VoucherClasses /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/api-keys" element={<ProtectedRoute blockedRoles={SETTINGS_RESTRICTED_ROLES}><MainLayout><ApiKeys /></MainLayout></ProtectedRoute>} />
              <Route path="/reports" element={<Navigate to="/reports/pnl" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TenantSettingsProvider>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
