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
  SCHOOL: {
    title: 'School Setup',
    steps: [
      { id: 'academic-terms', label: 'Add Academic Terms', route: '/school/terms' },
      { id: 'classes-teachers', label: 'Set Up Classes & Teachers', route: '/school/classes' },
      { id: 'import-students', label: 'Import Students', route: '/school/students' },
      { id: 'fee-schedules', label: 'Create Fee Schedules', route: '/school/fee-schedules' },
      { id: 'first-payment', label: 'Collect First Fee Payment', route: '/school/fee-collection' },
    ],
  },
  CHURCH: {
    title: 'Church Setup',
    steps: [
      { id: 'fund-accounts', label: 'Set Up Fund Accounts (Tithes, Offerings)', route: '/accounts' },
      { id: 'add-members', label: 'Add Members / Donors', route: '/customers' },
      { id: 'first-offering', label: 'Record First Tithe or Offering', route: '/invoices' },
      { id: 'expense-categories', label: 'Configure Expense Categories', route: '/accounts' },
      { id: 'ie-report', label: 'Run Income & Expenditure Report', route: '/reports/pnl' },
    ],
  },
  NGO: {
    title: 'NGO Setup',
    steps: [
      { id: 'fund-accounts', label: 'Create Restricted Fund Accounts', route: '/accounts' },
      { id: 'donors-grants', label: 'Add Donors & Grants', route: '/customers' },
      { id: 'first-donation', label: 'Record First Donation', route: '/invoices' },
      { id: 'project-tagging', label: 'Tag Project Expenditures', route: '/expenses' },
      { id: 'fund-report', label: 'Run Per-Fund Balance Report', route: '/reports/pnl' },
    ],
  },
  HOSPITALITY: {
    title: 'Hotel / Guest House Setup',
    steps: [
      { id: 'room-types', label: 'Set Up Room Types & Rates', route: '/hospitality/rooms' },
      { id: 'first-reservation', label: 'Create First Reservation', route: '/hospitality/reservations' },
      { id: 'guest-folio', label: 'Post Charges to Guest Folio', route: '/hospitality/folios' },
      { id: 'expenses', label: 'Record Operating Expenses', route: '/expenses' },
      { id: 'revenue-report', label: 'Run Revenue Report', route: '/reports/pnl' },
    ],
  },
  PHARMACY: {
    title: 'Pharmacy Setup',
    steps: [
      { id: 'drug-stock', label: 'Add Drug Stock', route: '/inventory' },
      { id: 'rx-register', label: 'Set Up Rx Register', route: '/pharmacy/prescriptions' },
      { id: 'nhis-codes', label: 'Configure NHIS Codes', route: '/pharmacy/nhis-claims' },
      { id: 'patients', label: 'Add Patients', route: '/pharmacy/patients' },
      { id: 'first-sale', label: 'Record First Prescription Sale', route: '/pos' },
    ],
  },
  RETAIL: {
    title: 'Retail Shop Setup',
    steps: [
      { id: 'products', label: 'Add Products & Stock', route: '/inventory' },
      { id: 'till', label: 'Set Up Till / POS', route: '/pos' },
      { id: 'tax-rates', label: 'Configure Tax Rates', route: '/settings/tax-rates' },
      { id: 'first-sale', label: 'Make First Sale', route: '/pos' },
      { id: 'reconcile', label: 'Reconcile End-of-Day Cash', route: '/banking' },
    ],
  },
  WHOLESALE: {
    title: 'Wholesale Setup',
    steps: [
      { id: 'products-suppliers', label: 'Add Products & Suppliers', route: '/inventory' },
      { id: 'customers', label: 'Create Customer Accounts', route: '/customers' },
      { id: 'price-lists', label: 'Set Price Lists', route: '/settings/price-lists' },
      { id: 'first-invoice', label: 'Raise First Invoice', route: '/invoices' },
      { id: 'supplier-payment', label: 'Record Supplier Payment', route: '/bills' },
    ],
  },
  SERVICE: {
    title: 'Service Business Setup',
    steps: [
      { id: 'service-items', label: 'Set Up Service Items', route: '/inventory' },
      { id: 'clients', label: 'Add Clients', route: '/customers' },
      { id: 'first-invoice', label: 'Issue First Invoice', route: '/invoices' },
      { id: 'expense', label: 'Record Expense', route: '/expenses' },
      { id: 'pnl', label: 'Run P&L Report', route: '/reports/pnl' },
    ],
  },
  CONSTRUCTION: {
    title: 'Construction Setup',
    steps: [
      { id: 'project', label: 'Create Job / Project', route: '/manufacturing/jobs' },
      { id: 'cost-categories', label: 'Add Cost Categories', route: '/cost-categories' },
      { id: 'payroll', label: 'Set Up Site Payroll', route: '/payroll/runs' },
      { id: 'material-purchase', label: 'Record Material Purchase', route: '/bills' },
      { id: 'job-costing', label: 'Run Job Costing Report', route: '/manufacturing/jobs' },
    ],
  },
  BUSINESS: {
    title: 'Business Setup',
    steps: [
      { id: 'products', label: 'Add Products', route: '/inventory' },
      { id: 'chart-of-accounts', label: 'Configure Chart of Accounts', route: '/accounts' },
      { id: 'first-sale', label: 'Make First Sale', route: '/invoices' },
      { id: 'purchase', label: 'Record Purchase', route: '/bills' },
      { id: 'pnl', label: 'Run P&L Report', route: '/reports/pnl' },
    ],
  },
};
