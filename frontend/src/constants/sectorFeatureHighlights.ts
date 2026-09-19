export interface PlanFeatures {
  starter: string[];
  business: string[];
  professional: string[];
}

export interface SectorHighlight {
  tagline: string;
  planFeatures: PlanFeatures;
}

export const SECTOR_FEATURE_HIGHLIGHTS: Record<string, SectorHighlight> = {
  NONPROFIT: {
    tagline: 'Built for Schools, Churches & NGOs',
    planFeatures: {
      starter: [
        'Student Ledger & Fee Collection',
        'Class & Teacher Management',
        'Income & Expenditure Reports',
        'Donor & Grant Tracking',
        'MoMo / Bank Reconciliation',
      ],
      business: [
        'Everything in Starter',
        'Attendance & Assessment Records',
        'Fee Defaulters & Payment Plans',
        'NaSIA Compliance Dashboard',
        'Parent Comms (SMS/Email/WhatsApp)',
        'Report Card Generation',
      ],
      professional: [
        'Everything in Business',
        'Multi-Campus / Branch Management',
        'Budgeting & Fund Accounting',
        'Custom Financial Statements',
        'Advanced Analytics Dashboard',
        'Priority Support',
      ],
    },
  },
  PHARMACY: {
    tagline: 'Built for Licensed Pharmacies',
    planFeatures: {
      starter: [
        'Drug Inventory & Stock Control',
        'Prescription Sales Register',
        'Supplier & Purchase Orders',
        'Basic Sales Reports',
        'Expiry Date Tracking',
      ],
      business: [
        'Everything in Starter',
        'NHIS Claims Management',
        'Patient Records & History',
        'Narcotics & Controlled Drugs Log',
        'Reorder Level Alerts',
        'Cash & Credit Sales',
      ],
      professional: [
        'Everything in Business',
        'Multi-Branch Pharmacy Network',
        'Batch & Lot Number Tracking',
        'Regulatory Compliance Reports',
        'Automated Reorder Requests',
        'Priority Support',
      ],
    },
  },
  RETAIL: {
    tagline: 'Built for Retail Shops & Boutiques',
    planFeatures: {
      starter: [
        'Point-of-Sale (POS) Till',
        'Product & Stock Management',
        'Daily Sales Reporting',
        'Cash Reconciliation',
        'Receipt Printing',
      ],
      business: [
        'Everything in Starter',
        'Multi-Till & Branch Support',
        'Customer Loyalty Accounts',
        'Discount & Promotion Management',
        'Barcode Scanning',
        'Layaway / Credit Sales',
      ],
      professional: [
        'Everything in Business',
        'Multi-Location Inventory',
        'Advanced Sales Analytics',
        'Supplier Price Comparison',
        'Staff Commission Tracking',
        'Priority Support',
      ],
    },
  },
  WHOLESALE: {
    tagline: 'Built for Distributors & Wholesalers',
    planFeatures: {
      starter: [
        'Product Catalogue & Price Lists',
        'Customer Account Management',
        'Invoice & Delivery Notes',
        'Supplier Purchase Orders',
        'Basic Accounts Receivable',
      ],
      business: [
        'Everything in Starter',
        'Customer Credit Limits & Terms',
        'Volume Discount Tiers',
        'Warehouse & Stock Transfers',
        'WHT Deduction Management',
        'Aged Receivables Report',
      ],
      professional: [
        'Everything in Business',
        'Multi-Warehouse Management',
        'Sales Rep Commission Tracking',
        'Route & Delivery Planning',
        'Advanced Debtor Analytics',
        'Priority Support',
      ],
    },
  },
  SERVICE: {
    tagline: 'Built for Service Businesses & Agencies',
    planFeatures: {
      starter: [
        'Client & Project Management',
        'Service Invoicing',
        'Expense Tracking',
        'Basic P&L Reports',
        'Online Payment Links',
      ],
      business: [
        'Everything in Starter',
        'Retainer & Recurring Invoices',
        'Time & Billable Hours Tracking',
        'Staff Payroll',
        'WHT Certificate Generation',
        'Cash Flow Dashboard',
      ],
      professional: [
        'Everything in Business',
        'Multi-Office / Department',
        'Budget vs Actual Reports',
        'Custom Contract Templates',
        'Advanced Tax Compliance',
        'Priority Support',
      ],
    },
  },
  CONSTRUCTION: {
    tagline: 'Built for Contractors & Construction Firms',
    planFeatures: {
      starter: [
        'Job / Project Tracking',
        'Material Purchase Orders',
        'Basic Cost Recording',
        'Supplier Management',
        'Simple Financial Reports',
      ],
      business: [
        'Everything in Starter',
        'Job Costing & Profitability',
        'Site Payroll & Labour Costs',
        'Budget vs Actual per Project',
        'Subcontractor Payments',
        'Retention & Progress Billing',
      ],
      professional: [
        'Everything in Business',
        'Multi-Site Project Management',
        'Equipment & Asset Tracking',
        'Variation Order Management',
        'Custom Project Reports',
        'Priority Support',
      ],
    },
  },
  BUSINESS: {
    tagline: 'Built for Growing Businesses',
    planFeatures: {
      starter: [
        'Sales Invoicing & Receipts',
        'Expense Management',
        'Basic Inventory',
        'Chart of Accounts',
        'Core Financial Reports',
      ],
      business: [
        'Everything in Starter',
        'Full Double-Entry Accounting',
        'Staff Payroll',
        'Multi-Currency Support',
        'Budgeting & Forecasting',
        'WHT Management',
      ],
      professional: [
        'Everything in Business',
        'Multi-Branch Operations',
        'Advanced Analytics Dashboard',
        'Custom Report Builder',
        'API Access',
        'Priority Support',
      ],
    },
  },
};
