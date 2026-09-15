export interface ChartOfAccountsTemplateEntry {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COST_OF_SALES' | 'EXPENSE';
}

/**
 * A starting chart of accounts for a typical Ghanaian small/medium
 * business - covers cash/bank/mobile money, VAT/NHIL/GETFund payable
 * (matching TaxRate's Ghana VAT preset), and common trading-business expense
 * lines. Entirely editable/deletable afterward through the normal Chart of
 * Accounts page - this is a starting point, not a lock-in.
 */
export const GHANA_SME_CHART_OF_ACCOUNTS_TEMPLATE: ChartOfAccountsTemplateEntry[] = [
  // Assets
  { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
  { code: '1010', name: 'Cash Till', type: 'ASSET' },
  { code: '1020', name: 'Bank Account', type: 'ASSET' },
  { code: '1030', name: 'Mobile Money Account', type: 'ASSET' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1200', name: 'Inventory', type: 'ASSET' },
  { code: '1500', name: 'Furniture & Equipment', type: 'ASSET' },

  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2100', name: 'VAT Payable', type: 'LIABILITY' },
  { code: '2110', name: 'NHIL Payable', type: 'LIABILITY' },
  { code: '2120', name: 'GETFund Levy Payable', type: 'LIABILITY' },
  { code: '2200', name: 'Staff Salaries Payable', type: 'LIABILITY' },
  { code: '2210', name: 'PAYE Tax Payable', type: 'LIABILITY' },
  { code: '2220', name: 'SSNIT Contributions Payable', type: 'LIABILITY' },
  { code: '2230', name: 'Net Pay Payable', type: 'LIABILITY' },
  { code: '2300', name: 'Short-Term Loans', type: 'LIABILITY' },

  // Equity
  { code: '3000', name: "Owner's Capital", type: 'EQUITY' },
  { code: '3010', name: "Owner's Drawings", type: 'EQUITY' },
  { code: '3900', name: 'Opening Balance Equity', type: 'EQUITY' },

  // Revenue
  { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '4100', name: 'Service Revenue', type: 'REVENUE' },
  { code: '4900', name: 'Other Income', type: 'REVENUE' },

  // Cost of Sales
  { code: '5000', name: 'Cost of Goods Sold', type: 'COST_OF_SALES' },

  // Expenses
  { code: '6000', name: 'Rent Expense', type: 'EXPENSE' },
  { code: '6010', name: 'Utilities Expense', type: 'EXPENSE' },
  { code: '6020', name: 'Salaries & Wages Expense', type: 'EXPENSE' },
  { code: '6022', name: 'Employer SSNIT Contribution', type: 'EXPENSE' },
  { code: '6030', name: 'Transport & Fuel Expense', type: 'EXPENSE' },
  { code: '6040', name: 'Communication Expense', type: 'EXPENSE' },
  { code: '6050', name: 'Office Supplies Expense', type: 'EXPENSE' },
  { code: '6060', name: 'Bank Charges', type: 'EXPENSE' },
  { code: '6070', name: 'Repairs & Maintenance Expense', type: 'EXPENSE' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'EXPENSE' },
];

/**
 * Chart of accounts for a Ghanaian school / educational institution (orgType NONPROFIT).
 * Uses education-appropriate account names: Fee Income instead of Sales Revenue,
 * Direct Educational Costs instead of COGS, and school-specific expense lines.
 * School Fund replaces Owner's Capital; no VAT/NHIL/GETFund payable lines.
 */
export const GHANA_SCHOOL_CHART_OF_ACCOUNTS_TEMPLATE: ChartOfAccountsTemplateEntry[] = [
  // Assets
  { code: '1000', name: 'Cash on Hand', type: 'ASSET' },
  { code: '1010', name: 'Cash Till', type: 'ASSET' },
  { code: '1020', name: 'Bank Account', type: 'ASSET' },
  { code: '1030', name: 'Mobile Money Account', type: 'ASSET' },
  { code: '1100', name: 'School Fees Receivable', type: 'ASSET' },
  { code: '1200', name: 'Stationery & Supplies Inventory', type: 'ASSET' },
  { code: '1500', name: 'Furniture & Equipment', type: 'ASSET' },

  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2100', name: 'Fees Received in Advance', type: 'LIABILITY' },
  { code: '2200', name: 'Staff Salaries Payable', type: 'LIABILITY' },
  { code: '2210', name: 'PAYE Tax Payable', type: 'LIABILITY' },
  { code: '2220', name: 'SSNIT Contributions Payable', type: 'LIABILITY' },
  { code: '2230', name: 'Net Pay Payable', type: 'LIABILITY' },
  { code: '2300', name: 'Short-Term Loans', type: 'LIABILITY' },

  // Equity
  { code: '3000', name: 'School Fund / Proprietor Capital', type: 'EQUITY' },
  { code: '3900', name: 'Opening Balance Equity', type: 'EQUITY' },

  // Fee Income (Revenue)
  { code: '4000', name: 'Tuition Fees Income', type: 'REVENUE' },
  { code: '4010', name: 'Examination Fees Income', type: 'REVENUE' },
  { code: '4020', name: 'PTA Levy Income', type: 'REVENUE' },
  { code: '4030', name: 'Boarding Fees Income', type: 'REVENUE' },
  { code: '4040', name: 'Canteen Revenue', type: 'REVENUE' },
  { code: '4050', name: 'Uniform & Books Sales', type: 'REVENUE' },
  { code: '4900', name: 'Other Income', type: 'REVENUE' },

  // Direct Educational Costs (Cost of Sales)
  { code: '5000', name: 'Learning Materials & Textbooks', type: 'COST_OF_SALES' },
  { code: '5010', name: 'Examination Costs', type: 'COST_OF_SALES' },

  // Expenses
  { code: '6000', name: 'Rent Expense', type: 'EXPENSE' },
  { code: '6010', name: 'Utilities Expense', type: 'EXPENSE' },
  { code: '6020', name: "Teachers' Salaries", type: 'EXPENSE' },
  { code: '6021', name: 'Non-Teaching Staff Salaries', type: 'EXPENSE' },
  { code: '6022', name: 'Employer SSNIT Contribution', type: 'EXPENSE' },
  { code: '6030', name: 'Transport & Fuel Expense', type: 'EXPENSE' },
  { code: '6040', name: 'Communication Expense', type: 'EXPENSE' },
  { code: '6050', name: 'Office & School Supplies', type: 'EXPENSE' },
  { code: '6060', name: 'Bank Charges', type: 'EXPENSE' },
  { code: '6070', name: 'Repairs & Maintenance Expense', type: 'EXPENSE' },
  { code: '6080', name: 'Sports & Activities Expense', type: 'EXPENSE' },
  { code: '6090', name: 'Library Expenses', type: 'EXPENSE' },
  { code: '6100', name: 'Student Welfare Expense', type: 'EXPENSE' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'EXPENSE' },
];

export function getTemplateForOrgType(orgType?: string | null): ChartOfAccountsTemplateEntry[] {
  if (orgType === 'NONPROFIT') return GHANA_SCHOOL_CHART_OF_ACCOUNTS_TEMPLATE;
  return GHANA_SME_CHART_OF_ACCOUNTS_TEMPLATE;
}
