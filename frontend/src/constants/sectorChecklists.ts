export interface ChecklistStep {
  id: string;
  label: string;
  route: string;
}

export interface SectorChecklist {
  title: string;
  steps: ChecklistStep[];
}

export const SECTOR_CHECKLISTS: Record<string, SectorChecklist> = {
  NONPROFIT: {
    title: 'School & NGO Setup',
    steps: [
      { id: 'academic-terms', label: 'Add Academic Terms', route: '/school/terms' },
      { id: 'classes-teachers', label: 'Set Up Classes & Teachers', route: '/school/classes' },
      { id: 'import-students', label: 'Import Students', route: '/school/students' },
      { id: 'fee-schedules', label: 'Create Fee Schedules', route: '/school/fee-schedules' },
      { id: 'first-payment', label: 'Collect First Fee Payment', route: '/school/fee-collection' },
    ],
  },
  PHARMACY: {
    title: 'Pharmacy Setup',
    steps: [
      { id: 'drug-stock', label: 'Add Drug Stock', route: '/inventory/products' },
      { id: 'rx-register', label: 'Set Up Rx Register', route: '/pharmacy/rx-register' },
      { id: 'nhis-codes', label: 'Configure NHIS Codes', route: '/pharmacy/nhis' },
      { id: 'patients', label: 'Add Patients', route: '/pharmacy/patients' },
      { id: 'first-sale', label: 'Record First Prescription Sale', route: '/pos/cash-sales' },
    ],
  },
  RETAIL: {
    title: 'Retail Shop Setup',
    steps: [
      { id: 'products', label: 'Add Products & Stock', route: '/inventory/products' },
      { id: 'till', label: 'Set Up Till / POS', route: '/pos/tills' },
      { id: 'tax-rates', label: 'Configure Tax Rates', route: '/settings/tax-rates' },
      { id: 'first-sale', label: 'Make First Sale', route: '/pos/cash-sales' },
      { id: 'reconcile', label: 'Reconcile End-of-Day Cash', route: '/pos/reconciliation' },
    ],
  },
  WHOLESALE: {
    title: 'Wholesale Setup',
    steps: [
      { id: 'products-suppliers', label: 'Add Products & Suppliers', route: '/inventory/products' },
      { id: 'customers', label: 'Create Customer Accounts', route: '/customers' },
      { id: 'price-lists', label: 'Set Price Lists', route: '/inventory/price-lists' },
      { id: 'first-invoice', label: 'Raise First Invoice', route: '/invoices/new' },
      { id: 'supplier-payment', label: 'Record Supplier Payment', route: '/bills' },
    ],
  },
  SERVICE: {
    title: 'Service Business Setup',
    steps: [
      { id: 'service-items', label: 'Set Up Service Items', route: '/inventory/products' },
      { id: 'clients', label: 'Add Clients', route: '/customers' },
      { id: 'first-invoice', label: 'Issue First Invoice', route: '/invoices/new' },
      { id: 'expense', label: 'Record Expense', route: '/expenses' },
      { id: 'pnl', label: 'Run P&L Report', route: '/reports/profit-loss' },
    ],
  },
  CONSTRUCTION: {
    title: 'Construction Setup',
    steps: [
      { id: 'project', label: 'Create Job / Project', route: '/projects' },
      { id: 'cost-categories', label: 'Add Cost Categories', route: '/projects/cost-categories' },
      { id: 'payroll', label: 'Set Up Site Payroll', route: '/payroll' },
      { id: 'material-purchase', label: 'Record Material Purchase', route: '/bills' },
      { id: 'job-costing', label: 'Run Job Costing Report', route: '/reports/job-costing' },
    ],
  },
  BUSINESS: {
    title: 'Business Setup',
    steps: [
      { id: 'products', label: 'Add Products', route: '/inventory/products' },
      { id: 'chart-of-accounts', label: 'Configure Chart of Accounts', route: '/accounting/chart-of-accounts' },
      { id: 'first-sale', label: 'Make First Sale', route: '/invoices/new' },
      { id: 'purchase', label: 'Record Purchase', route: '/bills' },
      { id: 'pnl', label: 'Run P&L Report', route: '/reports/profit-loss' },
    ],
  },
};
