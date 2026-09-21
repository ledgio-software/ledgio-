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
  SCHOOL: {
    tagline: 'Built for Schools & Colleges',
    planFeatures: {
      starter: [
        'Student Ledger & Fee Collection',
        'Class & Teacher Management',
        'Income & Expenditure Reports',
        'Expense Claims & Petty Cash',
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
  CHURCH: {
    tagline: 'Built for Churches & Faith Organisations',
    planFeatures: {
      starter: [
        'Tithes & Offerings Tracking',
        'Restricted & Unrestricted Funds',
        'Income & Expenditure Reports',
        'Supplier Bills & Expenses',
        'MoMo / Bank Reconciliation',
      ],
      business: [
        'Everything in Starter',
        'Donor & Member Contribution Records',
        'Per-Fund Balance Sheet',
        'Approval Workflows',
        'Budgeting per Department / Fund',
        'SMS / Email Notifications',
      ],
      professional: [
        'Everything in Business',
        'Multi-Branch / District Management',
        'Grant & Project Fund Tracking',
        'Custom Financial Statements',
        'Advanced Reporting Dashboard',
        'Priority Support',
      ],
    },
  },
  NGO: {
    tagline: 'Built for NGOs & Non-Profits',
    planFeatures: {
      starter: [
        'Donor & Grant Tracking',
        'Restricted Fund Accounting',
        'Income & Expenditure Reports',
        'Supplier Bills & Expenses',
        'MoMo / Bank Reconciliation',
      ],
      business: [
        'Everything in Starter',
        'Project Expenditure Tagging',
        'Per-Fund Balance Sheet',
        'Approval Workflows',
        'Budgeting per Project / Fund',
        'Donor Receipt Generation',
      ],
      professional: [
        'Everything in Business',
        'Multi-Office / Country Management',
        'Grant Compliance Reporting',
        'Custom Financial Statements',
        'Advanced Analytics Dashboard',
        'Priority Support',
      ],
    },
  },
  NONPROFIT: {
    tagline: 'Built for Schools, Churches & NGOs',
    planFeatures: {
      starter: [
        'Fund Accounting',
        'Income & Expenditure Reports',
        'Donor & Grant Tracking',
        'Supplier Bills & Expenses',
        'MoMo / Bank Reconciliation',
      ],
      business: [
        'Everything in Starter',
        'Per-Fund Balance Sheet',
        'Approval Workflows',
        'Budgeting per Department / Fund',
        'SMS / Email Notifications',
        'Donor Receipt Generation',
      ],
      professional: [
        'Everything in Business',
        'Multi-Branch / Office Management',
        'Grant & Project Fund Tracking',
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
        'Prescription History & Audit Trail',
        'GRA e-VAT Clearance Integration',
        'Cash & Credit Sales',
      ],
      professional: [
        'Everything in Business',
        'Multi-Branch Pharmacy Network (Coming Soon)',
        'Batch & Lot Number Tracking',
        'Advanced Compliance Reporting',
        'Automated Reorder Management',
        'Regulatory Compliance Reports',
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
        'Customer Account Management',
        'Sales Channel & Branch Reports',
        'Purchase Order Management',
        'Layaway / Credit Sales',
      ],
      professional: [
        'Everything in Business',
        'Multi-Location Inventory',
        'Advanced Sales Analytics',
        'Delivery Notes & Sales Orders',
        'Staff Payroll',
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
        'Serial Number & Lot Tracking',
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
        'Payment Matching & Reconciliation',
      ],
      business: [
        'Everything in Starter',
        'Retainer & Recurring Invoices',
        'Cash Flow Forecasting',
        'Staff Payroll',
        'WHT Certificate Generation',
        'Cash Flow Dashboard',
      ],
      professional: [
        'Everything in Business',
        'Multi-Office / Department',
        'Budget vs Actual Reports',
        'Approval Workflows',
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
        'Budget vs Actual Reports',
        'Subcontractor Payments',
        'Fixed Assets & Equipment Tracking',
      ],
      professional: [
        'Everything in Business',
        'Multi-Site Project Management',
        'Equipment & Asset Tracking',
        'Material Delivery Notes',
        'Financial Ratios & Analysis',
        'Priority Support',
      ],
    },
  },
  HOSPITALITY: {
    tagline: 'Built for Guest Houses & Hotels',
    planFeatures: {
      starter: [
        'Room & Rate Management',
        'Reservation System',
        'Guest Folio & Billing',
        'Expense Tracking',
        'Basic Revenue Reports',
      ],
      business: [
        'Everything in Starter',
        'Housekeeping Board',
        'Night Audit & RevPAR',
        'Guest History & Profiles',
        'GRA e-VAT Clearance',
        'Bank Reconciliation',
      ],
      professional: [
        'Everything in Business',
        'Multi-Property Management (Coming Soon)',
        'Conference & Banquet Revenue',
        'Staff Payroll',
        'Advanced Analytics',
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
        'Inventory Intelligence & Analytics',
        'API Access',
        'Priority Support',
      ],
    },
  },
};
