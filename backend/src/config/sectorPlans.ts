// Source of truth for billing. Must stay in sync with ledgio-hub/src/lib/sectorPricing.ts.
// Tier numbers (1/2/3) drive feature gates and seat limits; sector only changes name + price.

export interface SectorPlan {
  tier: number;
  name: string;
  // null = custom pricing (Contact Sales), not self-serve purchasable.
  priceGhs: number | null;
  seatLimit: number;
  features: string[];
}

export const SECTOR_SLUGS = [
  'retail',
  'enterprise',
  'schools',
  'churches-ngos',
  'pharmacy',
  'manufacturing',
  'professional-services',
  'hospitality',
  'construction',
  'wholesale',
] as const;

export type SectorSlug = typeof SECTOR_SLUGS[number];

export const DEFAULT_SECTOR: SectorSlug = 'retail';

function plans(
  names: [string, string, string],
  prices: [number, number, number | null],
  seats: [number, number, number],
  features: [string[], string[], string[]],
): SectorPlan[] {
  return [0, 1, 2].map((i) => ({
    tier: i + 1,
    name: names[i],
    priceGhs: prices[i],
    seatLimit: seats[i],
    features: features[i],
  }));
}

const STD_NAMES: [string, string, string] = ['Starter', 'Standard', 'Pro'];
const STD_SEATS: [number, number, number] = [3, 10, Infinity];

export const SECTOR_PLANS: Record<SectorSlug, SectorPlan[]> = {
  retail: plans(STD_NAMES, [105, 205, 350], STD_SEATS, [
    ['Point of Sale (1 till)', 'Basic inventory management', 'Invoices & Bills', 'Expense claims', 'Sales reports', 'Dedicated database schema'],
    ['Everything in Starter', 'Multiple POS tills', 'Mobile Money collections', 'Bank reconciliation', 'SMS shortage alerts', 'Customer & supplier management'],
    ['Everything in Standard', 'Multi-warehouse / godown', 'Payroll management', 'Budgets & variance tracking', 'Advanced analytics dashboard', 'Priority support'],
  ]),
  enterprise: plans(['Starter', 'Standard', 'Enterprise'], [350, 600, null], [10, Infinity, Infinity], [
    ['Multi-branch POS', 'Consolidated reporting', 'Multi-warehouse inventory', 'Approval workflows', 'Bank reconciliation'],
    ['Everything in Starter', 'Unlimited branches & warehouses', 'Payroll management', 'Advanced budgeting', 'SMS alerts at every branch', 'Analytics dashboard'],
    ['Everything in Standard', 'Dedicated account manager', 'SLA-backed support', 'Custom reporting & exports', 'White-glove onboarding'],
  ]),
  schools: plans(STD_NAMES, [250, 450, 700], STD_SEATS, [
    ['Student admissions & register', 'Student ledger & fee collection', 'GES-aligned chart of accounts', 'Income & Expenditure report', 'Weekly I&E email'],
    ['Everything in Starter', 'Student health records', 'Fund accounting by term', 'Budgets by department', 'Expense claims & approvals', 'Approval workflows'],
    ['Everything in Standard', 'Multi-campus management', 'Payroll for all staff', 'Full audit trail', 'Advanced analytics', 'Priority support'],
  ]),
  'churches-ngos': plans(['Starter', 'Business', 'Professional'], [105, 305, 510], STD_SEATS, [
    ['Tithes & Offerings Tracking', 'Restricted & Unrestricted Funds', 'Income & Expenditure Reports', 'Supplier Bills & Expenses', 'MoMo / Bank Reconciliation', 'Church Branding & Settings', 'Weekly I&E Email'],
    ['Everything in Starter', 'Member Registry & Profiles', 'Attendance Tracking (Services & Events)', 'First-Timers & Visitor Follow-up CRM', 'Events & Programs Management', 'Ministries & Departments', 'Pledges Tracking', 'Approval Workflows', 'Budgeting per Department / Fund', 'SMS / Email Notifications'],
    ['Everything in Business', 'Multi-Branch / District Management', 'Branch Leaderboard & Comparison Reports', 'Grant & Project Fund Tracking', 'Custom Financial Statements', 'Advanced Reporting Dashboard', 'Full Audit Trail', 'Priority Support'],
  ]),
  pharmacy: plans(STD_NAMES, [350, 600, 900], STD_SEATS, [
    ['Prescription register', 'Drug interaction checks', 'Patient registry', 'NHIS claims management', 'Basic invoicing & accounts'],
    ['Everything in Starter', 'GRA e-VAT integration', 'NEPP verification', 'Barcode enforcement at dispense', 'SMS refill reminders', 'ABC-FSN inventory matrix'],
    ['Everything in Standard', 'Multi-location dispensing', 'Payroll management', 'Advanced NHIS reporting', 'Full audit trail', 'Priority support'],
  ]),
  manufacturing: plans(STD_NAMES, [300, 500, 800], STD_SEATS, [
    ['Job costing', 'WIP tracking', 'Bill of Materials', 'Raw material inventory', 'Basic invoicing & accounts'],
    ['Everything in Starter', 'COGS automation', 'Multi-warehouse support', 'Vendor bills & purchase orders', 'Approval workflows', 'Job profitability reports'],
    ['Everything in Standard', 'Payroll & labour cost allocation', 'Advanced budgeting', 'Multi-stage production workflows', 'Analytics dashboard', 'Priority support'],
  ]),
  'professional-services': plans(STD_NAMES, [150, 300, 500], STD_SEATS, [
    ['Client invoicing', 'Client ledger', 'Expense management', 'Vendor bills', 'Basic P&L reporting'],
    ['Everything in Starter', 'Retainer management', 'Approval workflows', 'Payroll management', 'Bank reconciliation', 'Budgets by department'],
    ['Everything in Standard', 'Recurring transactions', 'Advanced analytics', 'Full audit trail', 'Role-based access', 'Priority support'],
  ]),
  hospitality: plans(STD_NAMES, [200, 400, 650], STD_SEATS, [
    ['Room & rate management', 'Reservation system', 'Guest folio & billing', 'Expense tracking', 'Basic revenue reports'],
    ['Everything in Starter', 'Housekeeping board', 'Night audit & RevPAR', 'Guest history & profiles', 'GRA e-VAT clearance', 'Bank reconciliation'],
    ['Everything in Standard', 'Multi-property management (coming soon)', 'Conference & banquet revenue', 'Staff payroll', 'Advanced analytics', 'Priority support'],
  ]),
  construction: plans(STD_NAMES, [250, 450, 750], STD_SEATS, [
    ['Job costing (up to 5 active jobs)', 'Retention tracking', 'Progress billing', 'Supplier invoices', 'Basic P&L reporting'],
    ['Everything in Starter', 'Unlimited active jobs', 'Site payroll', 'Subcontractor management', 'WHT certificates', 'Approval workflows'],
    ['Everything in Standard', 'Budget vs actual tracking', 'Plant & equipment costing', 'Advanced profitability reports', 'Analytics dashboard', 'Priority support'],
  ]),
  wholesale: plans(STD_NAMES, [200, 400, 700], STD_SEATS, [
    ['Customer credit limits', 'Basic inventory management', 'Invoicing & bills', 'Accounts receivable aging', 'Basic reporting'],
    ['Everything in Starter', 'Multi-warehouse inventory', 'Bulk invoicing', 'Mobile Money collections', 'Purchase orders & receiving', 'Bank reconciliation'],
    ['Everything in Standard', 'Route-based sales', 'Payroll management', 'Stock valuation methods', 'Advanced analytics', 'Priority support'],
  ]),
};

const ORG_TYPE_TO_SECTOR: Record<string, SectorSlug> = {
  SCHOOL: 'schools',
  NONPROFIT: 'churches-ngos',
  CHURCH: 'churches-ngos',
  NGO: 'churches-ngos',
  PHARMACY: 'pharmacy',
  HOSPITALITY: 'hospitality',
  WHOLESALE: 'wholesale',
  CONSTRUCTION: 'construction',
  SERVICE: 'professional-services',
  RETAIL: 'retail',
};

export function isValidSector(value: unknown): value is SectorSlug {
  return typeof value === 'string' && (SECTOR_SLUGS as readonly string[]).includes(value);
}

export function sectorFromOrgType(orgType?: string | null): SectorSlug {
  return (orgType && ORG_TYPE_TO_SECTOR[orgType]) || DEFAULT_SECTOR;
}

export function getPlansForSector(sector?: string | null): SectorPlan[] {
  return SECTOR_PLANS[isValidSector(sector) ? sector : DEFAULT_SECTOR];
}

export function getSectorPlan(sector: string | null | undefined, tier: number): SectorPlan | undefined {
  return getPlansForSector(sector).find((p) => p.tier === tier);
}
