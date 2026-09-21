import {
  LayoutDashboard,
  Activity,
  ClipboardCheck,
  FileCheck,
  UserPlus,
  ScrollText,
  Gem,
  HeartPulse,
  CalendarCheck,
  Award,
  BookOpen,
  FileSpreadsheet,
  PieChart,
  Hash,
  Users,
  ShieldCheck,
  FileUp,
  Landmark,
  FileText,
  Receipt,
  Warehouse,
  Lightbulb,
  BarChart3,
  Percent,
  CalendarClock,
  Target,
  Repeat,
  ShoppingCart,
  Scale,
  Waves,
  Gauge,
  Wallet,
  TrendingUp,
  Rocket,
  Bot,
  Clock,
  Wallet2,
  Building2,
  Store,
  GitBranch,
  Anchor,
  BadgeDollarSign,
  LineChart,
  ClipboardList,
  ShieldAlert,
  AlertTriangle,
  Truck,
  CreditCard,
  Layers,
  Cog,
  Key,
  GraduationCap,
  CalendarDays,
  MessageSquare,
  BedDouble,
  LayoutGrid,
  Sparkles,
  Moon,
  WifiOff,
  Heart,
  Users2,
} from "lucide-react";

export type WorkspaceMode = 'operations' | 'business' | 'professional';

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  minTier?: number;
}

export interface NavGroup {
  sectionTitle: string;
  items: NavItem[];
  /** When set, this group is only shown for tenants whose orgType matches this value. */
  orgTypeOnly?: string;
}

// Hrefs hidden from unrestricted roles in simplified workspace modes.
// Operations = small retail starter (7 work areas per the product report).
// Business  = wholesale/distribution (11 work areas).
// Professional = unrestricted (full accounting view).
const OPERATIONS_HIDDEN: ReadonlySet<string> = new Set([
  '/accounts', '/journals', '/banking',
  '/settings/tax-rates', '/settings/fiscal-periods', '/settings/recurring-transactions', '/settings/wht-rates', '/settings/price-lists',
  '/inventory/serial-numbers',
  '/manufacturing/jobs', '/manufacturing/job-work-orders',
  '/pdc', '/reports/interest-charges',
  '/fixed-assets', '/recurring-invoices', '/cost-centres', '/manufacturing',
  '/reports/ledger', '/reports/balance-sheet', '/reports/cash-flow',
  '/reports/cash-flow-forecast', '/reports/kpis', '/reports/aging',
  '/reports/landed-costs', '/reports/budgets', '/reports/analytics', '/reports/branch-comparison',
  '/payroll/employees', '/payroll/runs', '/payroll/loans', '/payroll/leave',
  '/approvals', '/audit-logs', '/sync/failures', '/help-assistant/activity', '/import',
]);

// Items hidden per org type at signup — applied before tier/role/mode filtering.
// RETAIL keeps POS + Inventory; removes heavy industrial features.
// WHOLESALE removes POS; keeps Inventory + bulk-sales tooling.
// SERVICE removes POS + entire Inventory section + stock-specific reports.
// CONSTRUCTION removes POS + manufacturing; keeps Job Costing, Purchase Orders, Payroll.
// PHARMACY removes manufacturing; keeps POS + Inventory + Pharmacy section.
const ORG_TYPE_HIDDEN: Record<string, ReadonlySet<string>> = {
  RETAIL: new Set([
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/pdc', '/reports/interest-charges',
  ]),
  WHOLESALE: new Set([
    '/pos',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/pdc', '/reports/interest-charges',
  ]),
  SERVICE: new Set([
    '/pos',
    '/analytics/inventory', '/inventory/serial-numbers',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders', '/cost-categories',
    '/pdc', '/reports/interest-charges',
    '/reports/stock-movement', '/reports/stock-aging', '/reports/landed-costs',
    '/reports/sales-channel', '/reports/monthly-sales-ledger',
  ]),
  CONSTRUCTION: new Set([
    '/pos',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/pdc', '/reports/interest-charges',
    '/reports/stock-aging', '/reports/sales-channel', '/reports/monthly-sales-ledger',
  ]),
  PHARMACY: new Set([
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/pdc', '/reports/interest-charges',
  ]),
  HOSPITALITY: new Set([
    '/pos',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/pdc', '/reports/interest-charges',
    '/reports/stock-aging', '/reports/sales-channel', '/reports/monthly-sales-ledger',
    '/sales-orders', '/delivery-notes', '/recurring-invoices',
  ]),
  // SCHOOL: Fee Collection replaces Invoices; Students replaces Customers
  NONPROFIT: new Set([
    '/pos', '/sales-orders', '/delivery-notes', '/recurring-invoices',
    '/inventory', '/inventory/serial-numbers', '/analytics/inventory',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/cost-categories',
    '/invoices',
    '/purchase-orders', '/payment-matching',
    '/reports/interest-charges', '/settings/price-lists',
    '/settings/wht-rates',
    '/settings/scenarios', '/settings/voucher-classes', '/pdc',
    '/reports/monthly-sales-ledger', '/reports/sales-channel',
    '/reports/landed-costs', '/reports/stock-movement',
    '/reports/stock-aging', '/reports/registers',
    '/reports/branch-comparison',
    '/reports/vat-return',
    '/reports/analytics',
    '/reports/benford-analysis',
    '/customers',
    '/reports/executive',
    '/settings/tax-rates',
  ]),
  SCHOOL: new Set([
    '/pos', '/sales-orders', '/delivery-notes', '/recurring-invoices',
    '/inventory', '/inventory/serial-numbers', '/analytics/inventory',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/cost-categories',
    '/invoices',
    '/purchase-orders', '/payment-matching',
    '/reports/interest-charges', '/settings/price-lists',
    '/settings/wht-rates',
    '/settings/scenarios', '/settings/voucher-classes', '/pdc',
    '/reports/monthly-sales-ledger', '/reports/sales-channel',
    '/reports/landed-costs', '/reports/stock-movement',
    '/reports/stock-aging', '/reports/registers',
    '/reports/branch-comparison',
    '/reports/vat-return',
    '/reports/analytics',
    '/reports/benford-analysis',
    '/customers',
    '/reports/executive',
    '/settings/tax-rates',
  ]),
  // CHURCH / NGO: Keep invoices (donation receipts), customers (donors), purchase orders
  CHURCH: new Set([
    '/pos', '/sales-orders', '/delivery-notes', '/recurring-invoices',
    '/inventory', '/inventory/serial-numbers', '/analytics/inventory',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/cost-categories',
    '/reports/monthly-sales-ledger', '/reports/sales-channel',
    '/reports/landed-costs', '/reports/stock-movement',
    '/reports/stock-aging', '/reports/registers',
    '/reports/executive', '/reports/receipt-log',
  ]),
  NGO: new Set([
    '/pos', '/sales-orders', '/delivery-notes', '/recurring-invoices',
    '/inventory', '/inventory/serial-numbers', '/analytics/inventory',
    '/manufacturing', '/manufacturing/jobs', '/manufacturing/job-work-orders',
    '/cost-categories',
    '/reports/monthly-sales-ledger', '/reports/sales-channel',
    '/reports/landed-costs', '/reports/stock-movement',
    '/reports/stock-aging', '/reports/registers',
    '/reports/executive',
  ]),
};

const BUSINESS_HIDDEN: ReadonlySet<string> = new Set([
  '/settings/fiscal-periods', '/settings/recurring-transactions',
  '/reports/ledger', '/fixed-assets',
  '/audit-logs', '/sync/failures', '/help-assistant/activity', '/import',
]);

// Per-href display name overrides for each simplified mode.
const MODE_LABELS: Record<string, Partial<Record<WorkspaceMode, string>>> = {
  '/invoices':          { operations: 'Credit Sales',            business: 'Invoices & Credit Sales' },
  '/bills':             { operations: 'Supplier Bills',          business: 'Supplier Bills' },
  '/purchase-orders':   { operations: 'Restock Orders' },
  '/inventory':         { operations: 'Products & Stock',        business: 'Stock & Warehouses' },
  '/pos':               { operations: 'Sell / POS' },
  '/expenses':          { operations: 'Expenses' },
  '/petty-cash':        { operations: 'Petty Cash Float' },
  '/reports/executive': { operations: 'Sales & Profit Reports',  business: 'Business Reports' },
  '/reports/pnl':       { operations: 'Profit Summary' },
  '/journals':          { business:   'Finance Adjustments' },
};

// Per-mode section title overrides (only override what changes).
const MODE_SECTION_TITLES: Record<WorkspaceMode, Partial<Record<string, string>>> = {
  operations: {
    'INVENTORY & GODOWNS':  'PRODUCTS & STOCK',
    'SALES & PURCHASES':    'SALES & EXPENSES',
    'REPORTS & ANALYTICS':  'REPORTS',
    'ADMINISTRATION':       'TEAM',
  },
  business: {
    'INVENTORY & GODOWNS':  'INVENTORY & WAREHOUSES',
    'ADMINISTRATION':       'ADMIN',
  },
  professional: {},
};

// Single source of truth for "what pages exist" - shared by Sidebar.tsx and
// CommandMenu.tsx so the two navigation surfaces can never drift apart.
export const navigationGroups: NavGroup[] = [
  {
    sectionTitle: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Guided Setup", href: "/onboarding", icon: Rocket },
    ],
  },
  {
    sectionTitle: "INVENTORY & GODOWNS",
    items: [
      { name: "Warehouses & Stock", href: "/inventory", icon: Warehouse },
      { name: "Stock Intelligence", href: "/analytics/inventory", icon: Lightbulb, minTier: 2 },
      { name: "Serial Numbers", href: "/inventory/serial-numbers", icon: Hash, minTier: 2 },
    ],
  },
  {
    sectionTitle: "SALES & PURCHASES",
    items: [
      { name: "Point of Sale", href: "/pos", icon: ShoppingCart },
      { name: "Invoices (AR)", href: "/invoices", icon: FileText },
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Vendor Bills (AP)", href: "/bills", icon: Receipt },
      { name: "Purchase Orders", href: "/purchase-orders", icon: FileSpreadsheet, minTier: 2 },
      { name: "Sales Orders", href: "/sales-orders", icon: FileSpreadsheet, minTier: 2 },
      { name: "Delivery Notes & GRN", href: "/delivery-notes", icon: Truck, minTier: 2 },
      { name: "Payment Matching", href: "/payment-matching", icon: CreditCard, minTier: 2 },
      { name: "Recurring Invoices", href: "/recurring-invoices", icon: Repeat, minTier: 2 },
      { name: "Expense Claims", href: "/expenses", icon: Wallet },
      { name: "Petty Cash", href: "/petty-cash", icon: Wallet2 },
    ],
  },
  {
    sectionTitle: "FINANCE & BANKING",
    items: [
      { name: "Chart of Accounts", href: "/accounts", icon: BookOpen },
      { name: "Journal Vouchers", href: "/journals", icon: FileSpreadsheet },
      { name: "Banking & Feeds", href: "/banking", icon: Landmark, minTier: 2 },
      { name: "Tax Rates", href: "/settings/tax-rates", icon: Percent },
      { name: "Fiscal Periods", href: "/settings/fiscal-periods", icon: CalendarClock },
      { name: "Recurring Transactions", href: "/settings/recurring-transactions", icon: Repeat, minTier: 2 },
      { name: "Fixed Assets", href: "/fixed-assets", icon: Building2, minTier: 2 },
      { name: "Cost Centres", href: "/cost-centres", icon: Layers, minTier: 2 },
      { name: "Manufacturing", href: "/manufacturing", icon: Cog, minTier: 2 },
      { name: "Withholding Tax", href: "/settings/wht-rates", icon: Percent, minTier: 2 },
      { name: "Price Lists", href: "/settings/price-lists", icon: BadgeDollarSign, minTier: 2 },
      { name: "Job Costing", href: "/manufacturing/jobs", icon: ClipboardList, minTier: 2 },
      { name: "Job Work Orders", href: "/manufacturing/job-work-orders", icon: Truck, minTier: 2 },
      { name: "Cost Categories", href: "/cost-categories", icon: Layers, minTier: 2 },
      { name: "Scenarios", href: "/settings/scenarios", icon: GitBranch, minTier: 2 },
      { name: "Voucher Classes", href: "/settings/voucher-classes", icon: FileSpreadsheet, minTier: 2 },
      { name: "Post-Dated Cheques", href: "/pdc", icon: CreditCard, minTier: 2 },
      { name: "Interest Charges", href: "/reports/interest-charges", icon: TrendingUp, minTier: 2 },
    ],
  },
  {
    sectionTitle: "REPORTS & ANALYTICS",
    items: [
      { name: "Monthly Sales Ledger", href: "/reports/monthly-sales-ledger", icon: CalendarClock },
      { name: "Executive Reports", href: "/reports/executive", icon: BarChart3 },
      { name: "General Ledger", href: "/reports/ledger", icon: BookOpen, minTier: 2 },
      { name: "Trial Balance", href: "/reports/trial-balance", icon: Scale, minTier: 2 },
      { name: "Profit & Loss", href: "/reports/pnl", icon: PieChart },
      { name: "Balance Sheet", href: "/reports/balance-sheet", icon: Scale },
      { name: "Cash Flow Statement", href: "/reports/cash-flow", icon: Waves },
      { name: "Cash Flow Forecast", href: "/reports/cash-flow-forecast", icon: TrendingUp, minTier: 2 },
      { name: "KPI Dashboard", href: "/reports/kpis", icon: Gauge, minTier: 2 },
      { name: "AP/AR Aging", href: "/reports/aging", icon: Clock, minTier: 2 },
      { name: "Sales Channel Report", href: "/reports/sales-channel", icon: Store, minTier: 2 },
      { name: "Branch Comparison", href: "/reports/branch-comparison", icon: GitBranch, minTier: 2 },
      { name: "Landed Cost", href: "/reports/landed-costs", icon: Anchor, minTier: 2 },
      { name: "Budgets", href: "/reports/budgets", icon: Target, minTier: 2 },
      { name: "Analytics Dashboard", href: "/reports/analytics", icon: LineChart, minTier: 2 },
      { name: "Daybook", href: "/reports/daybook", icon: BookOpen, minTier: 2 },
      { name: "Stock Movement", href: "/reports/stock-movement", icon: TrendingUp, minTier: 2 },
      { name: "Purchase & Sales Registers", href: "/reports/registers", icon: FileSpreadsheet, minTier: 2 },
      { name: "Receipt Audit Log", href: "/reports/receipt-log", icon: Receipt },
      { name: "VAT Return", href: "/reports/vat-return", icon: Percent, minTier: 2 },
      { name: "Stock Aging", href: "/reports/stock-aging", icon: Clock, minTier: 2 },
      { name: "Financial Ratios", href: "/reports/financial-ratios", icon: BarChart3, minTier: 2 },
      { name: "Benford Analysis", href: "/reports/benford-analysis", icon: ShieldAlert, minTier: 2 },
      { name: "Fraud Alerts", href: "/reports/fraud-alerts", icon: AlertTriangle, minTier: 2 },
    ],
  },
  {
    sectionTitle: "PAYROLL",
    items: [
      { name: "Employees", href: "/payroll/employees", icon: Users, minTier: 2 },
      { name: "Payroll Runs", href: "/payroll/runs", icon: BadgeDollarSign, minTier: 2 },
      { name: "Employee Loans", href: "/payroll/loans", icon: Landmark, minTier: 2 },
      { name: "Leave Management", href: "/payroll/leave", icon: CalendarClock, minTier: 2 },
      { name: "SSNIT Compliance", href: "/payroll/ssnit", icon: ShieldCheck, minTier: 2 },
    ],
  },
  {
    sectionTitle: "ADMINISTRATION",
    items: [
      { name: "Approvals", href: "/approvals", icon: ShieldCheck, minTier: 2 },
      { name: "Audit Trail", href: "/audit-logs", icon: ShieldCheck },
      { name: "Sync Failures", href: "/sync/failures", icon: WifiOff },
      { name: "AI Assistant Activity", href: "/help-assistant/activity", icon: Bot },
      { name: "Bulk Data Import", href: "/import", icon: FileUp },
      { name: "Team Management", href: "/team", icon: Users },
      { name: "API Keys", href: "/settings/api-keys", icon: Key, minTier: 2 },
    ],
  },
  {
    sectionTitle: "SCHOOL",
    orgTypeOnly: "SCHOOL",
    items: [
      { name: "Teachers", href: "/school/teachers", icon: GraduationCap },
      { name: "Classes", href: "/school/classes", icon: Layers },
      { name: "Students", href: "/school/students", icon: Users },
      { name: "Academic Terms", href: "/school/terms", icon: CalendarDays },
      { name: "Fee Schedules", href: "/school/fee-schedules", icon: Receipt },
      { name: "Fee Collection", href: "/school/fee-collection", icon: BookOpen },
      { name: "Payment Plans", href: "/school/fee-payment-plans", icon: CalendarDays },
      { name: "MoMo Reconciliation", href: "/school/momo-reconciliation", icon: Wallet2 },
      { name: "Fee Defaulters", href: "/school/fee-defaulters", icon: AlertTriangle },
      { name: "Demand vs Collection", href: "/school/demand-vs-collection", icon: BarChart3 },
      { name: "Student Ledger", href: "/school/student-ledger", icon: ClipboardList },
      { name: "Attendance", href: "/school/attendance", icon: ClipboardCheck },
      { name: "Assessments", href: "/school/assessments", icon: FileCheck },
      { name: "Report Cards", href: "/school/report-cards", icon: ScrollText },
      { name: "Admissions", href: "/school/admissions", icon: UserPlus },
      { name: "Timetable", href: "/school/timetable", icon: Activity },
      { name: "Certificates", href: "/school/certificates", icon: Gem },
      { name: "Scholarships", href: "/school/scholarships", icon: Award },
      { name: "Health Records", href: "/school/health", icon: HeartPulse },
      { name: "Events & Calendar", href: "/school/events", icon: CalendarCheck },
      { name: "MIS Dashboard", href: "/school/mis", icon: LayoutDashboard },
      { name: "NaSIA Dashboard", href: "/school/nasia", icon: ClipboardList },
      { name: "Transport", href: "/school/transport", icon: Truck },
      { name: "Parent Comms", href: "/school/parent-comms", icon: MessageSquare },
    ],
  },
  {
    sectionTitle: "HOSPITALITY",
    orgTypeOnly: "HOSPITALITY",
    items: [
      { name: "Reservations",  href: "/hospitality/reservations",  icon: CalendarDays },
      { name: "Rooms",         href: "/hospitality/rooms",         icon: BedDouble },
      { name: "Room Types",    href: "/hospitality/room-types",    icon: LayoutGrid },
      { name: "Housekeeping",  href: "/hospitality/housekeeping",  icon: Sparkles },
      { name: "Night Audit",   href: "/hospitality/night-audit",   icon: Moon },
    ],
  },
  {
    sectionTitle: "PHARMACY",
    orgTypeOnly: "PHARMACY",
    items: [
      { name: "Prescription Register", href: "/pharmacy/prescriptions", icon: ClipboardList },
      { name: "Patient Registry", href: "/pharmacy/patients", icon: Users },
      { name: "NHIS Claims", href: "/pharmacy/nhis-claims", icon: CreditCard },
      { name: "Inventory Matrix", href: "/pharmacy/inventory-matrix", icon: BarChart3 },
      { name: "Narcotics Register", href: "/pharmacy/narcotics", icon: ShieldAlert },
      { name: "Expiry Alerts", href: "/pharmacy/expiry", icon: AlertTriangle },
    ],
  },
  {
    sectionTitle: "CHURCH",
    orgTypeOnly: "CHURCH",
    items: [
      { name: "Dashboard",   href: "/church/dashboard",   icon: LayoutDashboard },
      { name: "Members",     href: "/church/members",     icon: Users },
      { name: "Cell Groups", href: "/church/cell-groups", icon: Users2 },
      { name: "Attendance",  href: "/church/attendance",  icon: CalendarCheck },
      { name: "Pledges",     href: "/church/pledges",     icon: Heart },
      { name: "Giving",      href: "/church/giving",      icon: TrendingUp },
      { name: "Visitors",    href: "/church/visitors",    icon: UserPlus },
      { name: "Ministries",  href: "/church/ministries",  icon: Layers },
      { name: "Events",      href: "/church/events",      icon: CalendarDays },
      { name: "Branches",    href: "/church/branches",    icon: GitBranch },
    ],
  },
];

// Roles scoped to their own reduced set of screens - anything not listed
// here (Admin, Accountant, Viewer, or any legacy free-text worker title) is
// unrestricted and sees the full navigation, matching pre-existing behavior.
// Shop Manager/Cashier are already warehouse-scoped by the backend
// (assertWarehouseAccess) - this just keeps navigation from advertising
// screens (Settings, Finance, Team Management) they have no real use for
// and whose write actions the backend rejects anyway. HR gets a
// Team-Management-only screen; Auditor gets a read-focused financial
// review set with no operational entry points (POS, Inventory writes,
// Settings, Team Management).
export const RESTRICTED_ROLE_NAV: Record<string, string[]> = {
  "shop manager": ["/dashboard", "/inventory", "/analytics/inventory", "/pos", "/invoices", "/bills", "/expenses"],
  cashier: ["/dashboard", "/inventory", "/pos", "/expenses"],
  "warehouse manager": ["/dashboard", "/inventory", "/analytics/inventory", "/purchase-orders", "/expenses"],
  hr: ["/dashboard", "/team", "/expenses", "/payroll/employees", "/payroll/runs", "/payroll/loans", "/payroll/leave"],
  // School-specific restricted roles — see to full school module set they teach/manage.
  // Admin (Head Teacher) and Accountant (Bursar) are unrestricted so they see the full nav.
  teacher: [
    "/dashboard",
    "/school/students",
    "/school/attendance",
    "/school/assessments",
    "/school/report-cards",
    "/school/timetable",
    "/school/events",
  ],
  "class teacher": [
    "/dashboard",
    "/school/students",
    "/school/attendance",
    "/school/assessments",
    "/school/report-cards",
    "/school/timetable",
    "/school/events",
    "/school/health",
    "/school/certificates",
  ],
  "payroll officer": ["/dashboard", "/payroll/employees", "/payroll/runs", "/payroll/loans", "/payroll/leave", "/expenses"],
  "payroll approver": ["/dashboard", "/payroll/employees", "/payroll/runs", "/payroll/loans", "/payroll/leave", "/expenses"],
  "accounts payable clerk": ["/dashboard", "/bills", "/purchase-orders", "/delivery-notes", "/payment-matching", "/expenses", "/inventory", "/vendors"],
  "accounts receivable clerk": ["/dashboard", "/invoices", "/sales-orders", "/delivery-notes", "/payment-matching", "/recurring-invoices", "/customers", "/expenses"],
  "external accountant": [
    "/dashboard",
    "/accounts",
    "/journals",
    "/banking",
    "/fixed-assets",
    "/invoices",
    "/bills",
    "/sales-orders",
    "/delivery-notes",
    "/payment-matching",
    "/expenses",
    "/cost-centres",
    "/manufacturing",
    "/reports/executive",
    "/reports/ledger",
    "/reports/pnl",
    "/reports/balance-sheet",
    "/reports/cash-flow",
    "/reports/kpis",
    "/reports/aging",
    "/reports/budgets",
    "/reports/daybook",
    "/reports/stock-movement",
    "/reports/registers",
  ],
  viewer: [
    "/dashboard",
    "/reports/executive",
    "/reports/pnl",
    "/reports/balance-sheet",
    "/reports/cash-flow",
    "/reports/kpis",
  ],
  auditor: [
    "/dashboard",
    "/accounts",
    "/journals",
    "/banking",
    "/fixed-assets",
    "/invoices",
    "/sales-orders",
    "/delivery-notes",
    "/bills",
    "/recurring-invoices",
    "/expenses",
    "/reports/executive",
    "/reports/ledger",
    "/reports/pnl",
    "/reports/balance-sheet",
    "/reports/cash-flow",
    "/reports/cash-flow-forecast",
    "/reports/kpis",
    "/reports/aging",
    "/reports/sales-channel",
    "/reports/branch-comparison",
    "/reports/landed-costs",
    "/reports/budgets",
    "/reports/analytics",
    "/reports/daybook",
    "/reports/stock-movement",
    "/reports/registers",
    "/audit-logs",
    "/sync/failures",
    "/help-assistant/activity",
    "/feedback",
    "/reports/benford-analysis",
    "/reports/fraud-alerts",
  ],
};

// Roles blocked from Settings screens (Workspace Settings, Tax Rates,
// Fiscal Periods, Recurring Transactions) - both the route guard (App.tsx)
// and any UI entry point into /settings (Header's profile menu, etc.) must
// check this same set so a restricted role never sees a link that just
// bounces them back to /dashboard.
export const SETTINGS_RESTRICTED_ROLES = new Set([
  "shop manager", "cashier", "warehouse manager",
  "hr", "payroll officer", "payroll approver",
  "accounts payable clerk", "accounts receivable clerk",
  "auditor", "external accountant", "viewer",
  "teacher", "class teacher",
]);

export function isSettingsRestricted(role: string | undefined): boolean {
  return SETTINGS_RESTRICTED_ROLES.has((role || "").toLowerCase().trim());
}

export function getVisibleHrefs(role: string | undefined): Set<string> | null {
  if (!role) return null;
  const allowed = RESTRICTED_ROLE_NAV[role.toLowerCase().trim()];
  return allowed ? new Set(allowed) : null;
}

/**
 * Filters navigationGroups down to what a given role/org-type/mode/tier can
 * actually see, dropping any now-empty group.
 *
 * Priority order:
 * 1. Org-type filtering (NONPROFIT hides POS/Inventory, adds Funds).
 * 2. Plan tier filtering (tier 1 = Starter plan hides items with minTier > 1).
 * 3. Role-based filtering (restricted roles like Cashier/Shop Manager/HR/
 *    Auditor see a fixed allowlist from RESTRICTED_ROLE_NAV — workspace mode
 *    is ignored for these roles since their nav is already minimal).
 * 4. Workspace mode filtering (Operations → simplified retail; Business →
 *    wholesale; Professional → full view). Only applies to unrestricted roles.
 */
export function getVisibleNavGroups(
  role: string | undefined,
  orgType?: string,
  mode: WorkspaceMode = 'professional',
  tier: number = 1,
  posEnabled: boolean = true,
): NavGroup[] {
  // Filter groups restricted to a specific org type (e.g. PHARMACY section)
  let groups = navigationGroups.filter(
    (group) => !group.orgTypeOnly || group.orgTypeOnly === orgType
  );

  const NONPROFIT_FAMILY = new Set(["NONPROFIT", "SCHOOL", "CHURCH", "NGO"]);
  if (NONPROFIT_FAMILY.has(orgType ?? "")) {
    groups = groups
      .map((group) => {
        // Inventory irrelevant for all nonprofit types
        if (group.sectionTitle === "INVENTORY & GODOWNS") return null;
        // Add Funds to Finance & Banking for grant/endowment/donor-fund tracking
        if (group.sectionTitle === "FINANCE & BANKING") {
          return { ...group, items: [...group.items, { name: "Funds", href: "/settings/funds", icon: Landmark }] };
        }
        return group;
      })
      .filter((group): group is NavGroup => group !== null);
  }

  // SERVICE orgs carry no physical stock — remove the entire inventory section.
  if (orgType === "SERVICE") {
    groups = groups.filter((group) => group.sectionTitle !== "INVENTORY & GODOWNS");
  }

  // Apply per-org-type item hiding (RETAIL / WHOLESALE / SERVICE / CONSTRUCTION / PHARMACY).
  const orgHidden = orgType ? ORG_TYPE_HIDDEN[orgType] : undefined;
  if (orgHidden) {
    groups = groups
      .map((group) => ({ ...group, items: group.items.filter((item) => !orgHidden.has(item.href)) }))
      .filter((group) => group.items.length > 0);
  }

  // POS toggle: when posEnabled is false, hide /pos from BUSINESS tenants.
  // Types that already hide POS via ORG_TYPE_HIDDEN or NONPROFIT_FAMILY block are unaffected.
  if (!posEnabled && !NONPROFIT_FAMILY.has(orgType ?? "")) {
    groups = groups
      .map((group) =>
        group.sectionTitle === "SALES & PURCHASES"
          ? { ...group, items: group.items.filter((item) => item.href !== "/pos") }
          : group
      )
      .filter((group) => group.items.length > 0);
  }

  // Plan tier gate: hide items that require a higher-tier plan.
  groups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.minTier || item.minTier <= tier) }))
    .filter((group) => group.items.length > 0);

  // Restricted roles use the existing role allowlist only — mode doesn't apply.
  const visibleHrefs = getVisibleHrefs(role);
  if (visibleHrefs) {
    return groups
      .map((group) => ({ ...group, items: group.items.filter((item) => visibleHrefs.has(item.href)) }))
      .filter((group) => group.items.length > 0);
  }

  // Unrestricted roles: apply workspace mode filtering + label/section overrides.
  if (mode !== 'professional') {
    const hidden = mode === 'operations' ? OPERATIONS_HIDDEN : BUSINESS_HIDDEN;
    const sectionOverrides = MODE_SECTION_TITLES[mode];
    groups = groups
      .map((group) => {
        const items = group.items
          .filter((item) => !hidden.has(item.href))
          .map((item) => ({
            ...item,
            name: MODE_LABELS[item.href]?.[mode] ?? item.name,
          }));
        if (items.length === 0) return null;
        const sectionTitle = sectionOverrides[group.sectionTitle] ?? group.sectionTitle;
        return { sectionTitle, items };
      })
      .filter((group): group is NavGroup => group !== null);
  }

  return groups;
}
