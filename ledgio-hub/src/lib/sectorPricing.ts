export interface PlanTier {
  slug: string;
  name: string;
  price: string;
  period: string;
  seats: string;
  description: string;
  features: string[];
  highlight: boolean;
  enterprise?: boolean;
}

export interface SectorPricing {
  sectorSlug: string;
  label: string;
  tiers: PlanTier[];
}

export const SECTOR_PRICING: SectorPricing[] = [
  {
    sectorSlug: 'retail',
    label: 'Small Retail & Shops',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵105',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For sole traders and very small shops.',
        highlight: false,
        features: ['Point of Sale (1 till)', 'Basic inventory management', 'Invoices & Bills', 'Expense claims', 'Sales reports', 'Dedicated database schema'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵205',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For growing shops that need more features.',
        highlight: true,
        features: ['Everything in Starter', 'Multiple POS tills', 'Mobile Money collections', 'Bank reconciliation', 'SMS shortage alerts', 'Customer & supplier management'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵350',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For established shops with advanced needs.',
        highlight: false,
        features: ['Everything in Standard', 'Multi-warehouse / godown', 'Payroll management', 'Budgets & variance tracking', 'Advanced analytics dashboard', 'Priority support'],
      },
    ],
  },
  {
    sectorSlug: 'enterprise',
    label: 'Enterprise & Multi-Branch',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵350',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For businesses opening their second location.',
        highlight: false,
        features: ['Multi-branch POS', 'Consolidated reporting', 'Multi-warehouse inventory', 'Approval workflows', 'Bank reconciliation'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵600',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For established multi-branch businesses.',
        highlight: true,
        features: ['Everything in Starter', 'Unlimited branches & warehouses', 'Payroll management', 'Advanced budgeting', 'SMS alerts at every branch', 'Analytics dashboard'],
      },
      {
        slug: 'pro',
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        seats: 'Unlimited users',
        description: 'For large enterprises with bespoke requirements.',
        highlight: false,
        enterprise: true,
        features: ['Everything in Standard', 'Dedicated account manager', 'SLA-backed support', 'Custom reporting & exports', 'White-glove onboarding'],
      },
    ],
  },
  {
    sectorSlug: 'schools',
    label: 'Schools',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵250',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For small and community schools.',
        highlight: false,
        features: ['Student admissions & register', 'Student ledger & fee collection', 'GES-aligned chart of accounts', 'Income & Expenditure report', 'Weekly I&E email'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵450',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For growing schools with larger teams.',
        highlight: true,
        features: ['Everything in Starter', 'Student health records', 'Fund accounting by term', 'Budgets by department', 'Expense claims & approvals', 'Approval workflows'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵700',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For large schools and school groups.',
        highlight: false,
        features: ['Everything in Standard', 'Multi-campus management', 'Payroll for all staff', 'Full audit trail', 'Advanced analytics', 'Priority support'],
      },
    ],
  },
  {
    sectorSlug: 'churches-ngos',
    label: 'Churches & NGOs',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵120',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For small faith communities and nonprofits.',
        highlight: false,
        features: ['Restricted & unrestricted funds', 'Tag transactions to funds', 'Per-fund I&E reporting', 'Vendor bills & payments', 'Weekly I&E email'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵250',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For organisations with multiple ministries.',
        highlight: true,
        features: ['Everything in Starter', 'Expense claims & approvals', 'Budgets per ministry', 'Approval workflows', 'Mobile Money collections', 'Bank reconciliation'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵400',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For large churches and multi-branch NGOs.',
        highlight: false,
        features: ['Everything in Standard', 'Recurring transactions', 'Payroll management', 'Full audit trail', 'Advanced donor reporting', 'Priority support'],
      },
    ],
  },
  {
    sectorSlug: 'pharmacy',
    label: 'Pharmacy',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵350',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For single-location community pharmacies.',
        highlight: false,
        features: ['Prescription register', 'Drug interaction checks', 'Patient registry', 'NHIS claims management', 'Basic invoicing & accounts'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵600',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For pharmacies with full compliance needs.',
        highlight: true,
        features: ['Everything in Starter', 'GRA e-VAT integration', 'NEPP verification', 'Barcode enforcement at dispense', 'SMS refill reminders', 'ABC-FSN inventory matrix'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵900',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For hospital dispensaries and pharmacy chains.',
        highlight: false,
        features: ['Everything in Standard', 'Multi-location dispensing', 'Payroll management', 'Advanced NHIS reporting', 'Full audit trail', 'Priority support'],
      },
    ],
  },
  {
    sectorSlug: 'manufacturing',
    label: 'Manufacturing',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵300',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For small fabricators and job-order businesses.',
        highlight: false,
        features: ['Job costing', 'WIP tracking', 'Bill of Materials', 'Raw material inventory', 'Basic invoicing & accounts'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵500',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For growing manufacturers with larger teams.',
        highlight: true,
        features: ['Everything in Starter', 'COGS automation', 'Multi-warehouse support', 'Vendor bills & purchase orders', 'Approval workflows', 'Job profitability reports'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵800',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For large manufacturers with complex operations.',
        highlight: false,
        features: ['Everything in Standard', 'Payroll & labour cost allocation', 'Advanced budgeting', 'Multi-stage production workflows', 'Analytics dashboard', 'Priority support'],
      },
    ],
  },
  {
    sectorSlug: 'professional-services',
    label: 'Professional Services',
    tiers: [
      {
        slug: 'starter',
        name: 'Starter',
        price: '₵150',
        period: '/ month',
        seats: 'Up to 3 users',
        description: 'For solo practitioners and very small firms.',
        highlight: false,
        features: ['Client invoicing', 'Client ledger', 'Expense management', 'Vendor bills', 'Basic P&L reporting'],
      },
      {
        slug: 'standard',
        name: 'Standard',
        price: '₵300',
        period: '/ month',
        seats: 'Up to 10 users',
        description: 'For growing firms with staff and multiple clients.',
        highlight: true,
        features: ['Everything in Starter', 'Retainer management', 'Approval workflows', 'Payroll management', 'Bank reconciliation', 'Budgets by department'],
      },
      {
        slug: 'pro',
        name: 'Pro',
        price: '₵500',
        period: '/ month',
        seats: 'Unlimited users',
        description: 'For established firms and multi-partner practices.',
        highlight: false,
        features: ['Everything in Standard', 'Recurring transactions', 'Advanced analytics', 'Full audit trail', 'Role-based access', 'Priority support'],
      },
    ],
  },
];

export const DEFAULT_SECTOR_SLUG = 'retail';
