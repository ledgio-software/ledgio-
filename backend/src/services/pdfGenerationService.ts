import PDFDocument from 'pdfkit';

const BRAND_GREEN = '#059669';
const BRAND_BLUE = '#2563eb';
const INK = '#0f172a';
const MUTED = '#475569';

function addSectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  // Always anchor to the page's left margin rather than the carried-over `doc.x`
  // cursor - addBullet() below moves `doc.x` around while drawing wrapped text,
  // and reading a drifted `doc.x` here previously caused the underline (and every
  // bullet drawn after it) to creep progressively further right down the page.
  const leftX = doc.page.margins.left;
  doc.x = leftX;
  doc.moveDown(1);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text(text, leftX);
  doc
    .moveTo(leftX, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(BRAND_GREEN)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);
}

function addBullet(doc: PDFKit.PDFDocument, title: string, body: string): void {
  // Same fix as addSectionHeading: use the page's fixed left margin instead of
  // `doc.x`, which drifts after each wrapped-text call and previously caused
  // both a "staircase" indentation bug and text being clipped past the right
  // page edge (the wrap width was computed from the true margin while the text
  // was actually being drawn starting from the drifted, further-right x).
  const leftX = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  doc.x = leftX;
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`•  ${title}`, leftX, doc.y, { width: doc.page.width - leftX - rightMargin });
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(10.5)
    .text(body, leftX + 16, doc.y, { width: doc.page.width - leftX - rightMargin - 16 });
  doc.moveDown(0.6);
  doc.x = leftX;
}

// ── Sector-specific content ──────────────────────────────────────────────────

interface SectorContent {
  tagline: string;
  firstSteps: Array<{ title: string; body: string }>;
  keyFeatures: Array<{ title: string; body: string }>;
}

const SECTOR_CONTENT: Record<string, SectorContent> = {
  NONPROFIT: {
    tagline: 'School, Church & NGO Management Platform',
    firstSteps: [
      { title: '1. Add Academic Terms', body: 'Go to School > Academic Terms and create your current term (e.g. Term 1 – 2025/2026). Terms gate fee schedules and reports so everything stays organized by period.' },
      { title: '2. Set Up Classes & Teachers', body: 'Add your class groups under School > Classes (e.g. JHS 1A, JHS 1B) and register teaching staff under School > Teachers. Assign class tutors to each class.' },
      { title: '3. Import Students', body: 'Enrol students under School > Students. Bulk import is supported via the CSV upload button. Each student gets a unique STU-XXXX code and a linked guardian record.' },
      { title: '4. Create Fee Schedules', body: 'Under School > Fee Schedules, define what each class owes per term (tuition, exam levy, PTA, boarding, etc.). Schedules auto-populate the demand side of every student\'s ledger.' },
      { title: '5. Collect Your First Fee Payment', body: 'Go to School > Fee Collection, search for a student, select the invoice and record the payment (cash, MoMo, or bank transfer). A receipt is generated immediately.' },
    ],
    keyFeatures: [
      { title: 'Student Ledger', body: 'Full per-student financial history: every fee charged, payment received, discount granted, and outstanding balance — printable as a parent statement.' },
      { title: 'Fee Defaulters & Payment Plans', body: 'Identify students with overdue fees at a glance and set up instalment plans for families who need them.' },
      { title: 'MoMo Reconciliation', body: 'Match mobile money fee payments against your MoMo statement to ensure nothing is missed or double-posted.' },
      { title: 'Attendance & Assessments', body: 'Record daily attendance and continuous-assessment scores; generate term report cards and BECE-style academic transcripts.' },
      { title: 'NaSIA Compliance Dashboard', body: 'Auto-populated NaSIA statistics (enrolment counts, gender ratios, teacher-pupil ratios) ready to copy into inspection returns.' },
      { title: 'I&E Reports (Not P&L)', body: 'Income & Expenditure statements instead of Profit & Loss, matching the financial reporting language required of nonprofits and schools.' },
    ],
  },
  PHARMACY: {
    tagline: 'Licensed Pharmacy & NHIS Management Platform',
    firstSteps: [
      { title: '1. Add Your Drug Stock', body: 'Go to Inventory > Products and add each drug with its pack size, unit, reorder level, and selling price. Enable narcotics tracking for Schedule 2 drugs.' },
      { title: '2. Set Up the Prescription Register', body: 'Under Pharmacy > Rx Register, configure your default prescriber list and dispensing workflow. Each Rx logs drug name, quantity, batch, prescriber, and patient.' },
      { title: '3. Configure NHIS Codes', body: 'Under Pharmacy > NHIS Codes, map your stock items to NHIS tariff codes so claims are auto-populated when you dispense to an NHIS patient.' },
      { title: '4. Add Patients', body: 'Register patients under Pharmacy > Patients with their NHIS member ID, chronic conditions, and allergy flags. Allergy warnings surface automatically at dispensing.' },
      { title: '5. Record Your First Prescription Sale', body: 'Open Pharmacy > Rx Register, search for a patient, attach a prescription, dispense items, and collect payment. The sale posts to the ledger and deducts stock automatically.' },
    ],
    keyFeatures: [
      { title: 'NHIS Claims Management', body: 'Batch NHIS claims by period, submit the claim register, and track approval / rejection status per claim line.' },
      { title: 'Narcotics Register', body: 'Dedicated controlled-substance log satisfying GHS narcotics register requirements — running balance maintained automatically.' },
      { title: 'Expiry Alerts', body: 'Automatic notifications for stock within 90 / 30 days of expiry so you can return or discount before wastage.' },
      { title: 'ABC-FSN Inventory Matrix', body: 'Classify stock by value (A/B/C) and movement (F/S/N) to focus ordering effort on high-impact items.' },
      { title: 'Prescription Register', body: 'Full Rx log with drug name, quantity, batch number, prescriber, and patient — every dispensing event recorded and auditable.' },
      { title: 'Patient Records & History', body: 'Per-patient dispensing history, NHIS member ID, chronic conditions, and allergy flags — surfaces at point of dispensing.' },
    ],
  },
  RETAIL: {
    tagline: 'Retail Shop & Boutique Management Platform',
    firstSteps: [
      { title: '1. Add Products & Stock', body: 'Go to Inventory > Products and add each item with its cost price, selling price, and opening stock quantity. Use categories to group similar items.' },
      { title: '2. Set Up Your Till / POS', body: 'Under POS > Cash Till, create a till for each counter and set its opening float. Each till tracks its own daily cash and sends a closeout SMS if cash is short.' },
      { title: '3. Configure Tax Rates', body: 'Under Settings > Tax Rates, add your applicable VAT rate (e.g. 15% standard). Sales at the POS apply the rate automatically.' },
      { title: '4. Make Your First Sale', body: 'Open POS > Sell, scan or search for products, add them to the basket, take payment (cash, card, or MoMo), and print or SMS the receipt.' },
      { title: '5. Reconcile End-of-Day Cash', body: 'At close, go to POS > Cash Till > Close Till, count your physical cash, and submit. The variance posts to your ledger automatically.' },
    ],
    keyFeatures: [
      { title: 'Point of Sale (POS)', body: 'Fast barcode/search-driven till interface with support for split payments, discounts, and layaway.' },
      { title: 'Multi-Warehouse Inventory', body: 'Track stock across multiple shop branches; transfer stock between locations and see which branch is running low.' },
      { title: 'Price Lists & Promotions', body: 'Set customer-group price lists (wholesale vs retail) and time-limited promotional prices per product.' },
      { title: 'Sales & Stock Reports', body: 'Best-selling products, slow-movers, gross margin by item, and daily sales summary reports.' },
      { title: 'Supplier Payments', body: 'Record supplier bills and payments; track what you owe each supplier and when it is due.' },
      { title: 'Customer Loyalty', body: 'Attach customer records to sales for purchase history, credit terms, and outstanding balance tracking.' },
    ],
  },
  WHOLESALE: {
    tagline: 'Wholesale & Distribution Management Platform',
    firstSteps: [
      { title: '1. Add Products & Suppliers', body: 'Go to Inventory > Products to set up your catalogue with cost prices, and create supplier records under Vendors so purchase orders can reference them.' },
      { title: '2. Create Customer Accounts', body: 'Add your retailer and trader accounts under Customers with their credit limits and payment terms (e.g. Net 30). Ledgio enforces the limit at invoice time.' },
      { title: '3. Set Price Lists', body: 'Under Sales > Price Lists, create tier-based prices (e.g. Gold, Silver, Retail) so the right price applies automatically based on the customer.' },
      { title: '4. Raise Your First Invoice', body: 'Go to Sales > Invoices, select a customer, add line items, and send. The invoice records the receivable and deducts stock.' },
      { title: '5. Record a Supplier Payment', body: 'When you pay a supplier, go to Vendors > Bills, find the bill, and mark it paid. The payment posts to your ledger and clears the payable.' },
    ],
    keyFeatures: [
      { title: 'Credit Control', body: 'Customer credit limits enforced at invoicing; ageing AR report shows 30/60/90/120+ day buckets.' },
      { title: 'Purchase Orders', body: 'Raise POs to suppliers, receive goods against them (partial receipts supported), and auto-generate the supplier bill on receipt.' },
      { title: 'Multi-Warehouse Stock', body: 'Manage inventory across multiple depots; inter-depot transfers and per-location stock valuations.' },
      { title: 'Delivery Notes', body: 'Generate delivery notes from invoices for drivers; delivery status tracked separately from invoice payment.' },
      { title: 'Sales Order Pipeline', body: 'Convert confirmed orders to invoices in one click; backorder tracking when stock is insufficient.' },
      { title: 'Aged Payables & Receivables', body: 'Know exactly who owes you and who you owe, broken down by how long the balance has been outstanding.' },
    ],
  },
  SERVICE: {
    tagline: 'Service Business & Agency Management Platform',
    firstSteps: [
      { title: '1. Set Up Service Items', body: 'Go to Inventory > Products, set the type to "Service", and add your service catalogue (consulting, design, installation, etc.) with your standard rates.' },
      { title: '2. Add Your Clients', body: 'Create client records under Customers with their contact details, payment terms, and any agreed price lists.' },
      { title: '3. Issue Your First Invoice', body: 'Go to Sales > Invoices, select the client, add service line items with hours or fixed amounts, and send. The system records the receivable automatically.' },
      { title: '4. Record Business Expenses', body: 'Log costs under Expenses (staff claims) or Vendor Bills (supplier invoices). Each expense posts to the correct ledger account.' },
      { title: '5. Run Your Profit & Loss', body: 'Go to Reports > Profit & Loss to see revenue, direct costs, and net profit for any period. Use it to price your services correctly.' },
    ],
    keyFeatures: [
      { title: 'Invoicing & Retainers', body: 'Recurring invoices for monthly retainer clients; partial payments and credit notes supported.' },
      { title: 'Expense Claims', body: 'Staff submit out-of-pocket expenses via the app; admins approve and reimburse in bulk.' },
      { title: 'Approval Workflows', body: 'Require sign-off before invoices, expenses, or journal entries post — keeps financial controls tight.' },
      { title: 'Project / Job Costing', body: 'Tag transactions to a project to track revenue and costs per engagement; see profitability by client.' },
      { title: 'Payroll (PAYE & SSNIT)', body: 'Run monthly payroll with automatic PAYE tax and SSNIT contribution calculations; payslips generated per employee.' },
      { title: 'Withholding Tax (WHT)', body: 'Record WHT deductions on invoices and generate the WHT certificate for GRA submission.' },
    ],
  },
  CONSTRUCTION: {
    tagline: 'Construction & Contracting Management Platform',
    firstSteps: [
      { title: '1. Create Your First Job / Project', body: 'Go to Job Costing > Projects and create a project record with its contract value, client, start date, and estimated completion date.' },
      { title: '2. Add Cost Categories', body: 'Under Job Costing > Cost Categories, define your cost buckets (Labour, Materials, Plant & Equipment, Subcontractors, Overheads). These map to your Chart of Accounts.' },
      { title: '3. Set Up Site Payroll', body: 'Register site workers under HR > Employees with their daily rates. Run site payroll weekly or fortnightly and post wages directly to the project.' },
      { title: '4. Record a Material Purchase', body: 'Raise a Purchase Order for site materials, receive the goods, and the supplier bill is auto-generated. Tag the bill to the project so it hits the job cost report.' },
      { title: '5. Run the Job Costing Report', body: 'Go to Reports > Job Costing to see budget vs. actual cost per project, percentage complete, and estimated cost to complete.' },
    ],
    keyFeatures: [
      { title: 'Job Costing', body: 'Track every cost (labour, materials, plant, sub-contractors) against each project contract; instant budget vs. actual.' },
      { title: 'Material Purchase Orders', body: 'Raise POs for site materials, receive goods against them, and auto-generate the supplier bill on delivery — all tagged to the project.' },
      { title: 'Site Payroll', body: 'Daily-rated and casual-labour payroll with PAYE and SSNIT; supports multiple sites with different rates.' },
      { title: 'Fixed Assets & Equipment', body: 'Track each piece of plant and equipment, its depreciation schedule, and book value at any point in time.' },
      { title: 'Delivery Notes', body: 'Generate delivery notes for materials dispatched to site; track delivery status separately from the supplier invoice.' },
      { title: 'Financial Ratios & Analysis', body: 'Liquidity, profitability, and leverage ratios computed from your live accounts — useful for bonding and tender submissions.' },
    ],
  },
  BUSINESS: {
    tagline: 'Multi-Industry ERP & Accounting Platform',
    firstSteps: [
      { title: '1. Configure Your Chart of Accounts', body: 'Use the standard template under Accounting > Chart of Accounts as a starting point, then add or rename accounts to match your business categories.' },
      { title: '2. Add Products & Stock', body: 'Go to Inventory > Products and enter your product catalogue with cost prices, selling prices, and opening stock quantities.' },
      { title: '3. Make Your First Sale', body: 'Use POS > Sell for walk-in customers or Sales > Invoices for credit customers. Each sale posts to the ledger and deducts stock automatically.' },
      { title: '4. Record a Purchase', body: 'Raise a Purchase Order under Purchasing > POs or record a direct Vendor Bill. Mark it paid when you settle the supplier.' },
      { title: '5. Run Your Profit & Loss', body: 'Go to Reports > Profit & Loss to review income and expenses for any period. Check the Trial Balance to confirm your accounts are in balance.' },
    ],
    keyFeatures: [
      { title: 'Double-Entry Bookkeeping', body: 'Full general ledger with journal entries, trial balance, and statutory reports (P&L, Balance Sheet, Cash Flow).' },
      { title: 'Invoicing & Purchase Orders', body: 'Multi-line invoices, bills, and POs with automatic tax calculation and inventory integration.' },
      { title: 'Point of Sale', body: 'Fast POS till with barcode scanning, split payments, daily closeouts, and shortage SMS alerts.' },
      { title: 'Manufacturing', body: 'Bill of Materials, production orders, and finished-goods costing for businesses that assemble or manufacture products.' },
      { title: 'Payroll (PAYE & SSNIT)', body: 'Monthly payroll with automatic statutory deductions, payslips, and GRA PAYE filing reports.' },
      { title: 'Multi-Currency & Bank Reconciliation', body: 'Transact in any currency; reconcile bank statements via Mono Connect integration.' },
    ],
  },
};

/**
 * Generates a sector-specific "Quick Start Guide" PDF sent after a tenant's
 * account is fully verified. Content (first steps + key features) is tailored
 * to the tenant's orgType so school staff, pharmacists, and retailers each get
 * a guide that matches their actual workflow.
 */
export function generateQuickStartGuidePdf(
  businessName: string,
  recipientName: string,
  orgType: string = 'BUSINESS',
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    const sector = SECTOR_CONTENT[orgType] ?? SECTOR_CONTENT['BUSINESS'];

    // --- Cover ---
    doc.rect(0, 0, doc.page.width, 150).fill(INK);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('Ledgio', 56, 50);
    doc
      .fillColor('#a7f3d0')
      .font('Helvetica')
      .fontSize(12)
      .text(sector.tagline, 56, 80);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(26)
      .text('Quick Start Guide', 56, 105);

    doc.y = 180;
    doc.x = 56;
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(11)
      .text(`Prepared for ${businessName}`, { continued: false });
    doc.text(`Welcome, ${recipientName} — your account is fully verified and active.`);

    // --- Your First 5 Steps ---
    addSectionHeading(doc, 'Your First 5 Steps');
    for (const step of sector.firstSteps) {
      addBullet(doc, step.title, step.body);
    }

    // --- Key Features for Your Business ---
    addSectionHeading(doc, 'Key Features for Your Business');
    for (const feature of sector.keyFeatures) {
      addBullet(doc, feature.title, feature.body);
    }

    // --- Common Platform Features ---
    addSectionHeading(doc, 'Platform-Wide Features');
    addBullet(doc, 'Invite your team', 'Add teammates under Settings > Team with role-based permissions (Admin, Accountant, Cashier, Viewer) so staff only see what their role requires.');
    addBullet(doc, 'Approval workflows', 'Require sign-off before transactions post by requesting an approval under Approvals in the sidebar.');
    addBullet(doc, 'Fiscal periods & budgets', 'Open, close, and lock accounting periods under Settings > Fiscal Periods, and track budget vs. actual under Reports > Budgets.');
    addBullet(doc, 'Automated reports', 'Enable a schedule under Settings > Reports to receive weekly summaries by email automatically.');
    addBullet(doc, 'Multi-currency support', 'Transactions in any currency convert at live rates once configured under Settings > Currencies.');

    // --- Next steps / links ---
    addSectionHeading(doc, 'Need Help?');
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(10.5)
      .text('Sign in any time to continue setup:');
    doc.fillColor(BRAND_BLUE).font('Helvetica-Bold').text(`${appUrl}/login`, { link: `${appUrl}/login`, underline: true });
    doc.moveDown(0.6);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(10.5)
      .text('Tip: install Ledgio to your phone or desktop home screen for one-tap access — look for the Install App section on our homepage.');

    doc.moveDown(2);
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(8.5)
      .text('Generated automatically by Ledgio ERP for your account activation.', { align: 'left' });

    doc.end();
  });
}

interface TableColumn {
  header: string;
  width: number;
}

/**
 * Truncates `text` (in the doc's currently-set font/size) to fit within
 * `maxWidth`, appending an ellipsis if it doesn't already fit. pdfkit's own
 * `ellipsis: true` text() option only truncates when line-wrapping is active,
 * which fights with fixed-height table rows - measuring/truncating manually
 * up front and drawing with `lineBreak: false` guarantees a single line that
 * never overflows into the next column or wraps the row taller than expected.
 */
function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (doc.widthOfString(text) <= maxWidth) return text;
  const ellipsis = '…';
  if (doc.widthOfString(ellipsis) > maxWidth) return '';

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (doc.widthOfString(candidate) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return text.slice(0, low) + ellipsis;
}

/**
 * Draws a ruled table with a header row, handling page breaks by redrawing
 * the header on each new page. Cells are single-line (truncated with an
 * ellipsis if too long for their column) - callers must size columns for
 * their expected content.
 */
function drawSimpleTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: string[][],
  opts: { rowHeight?: number } = {}
): void {
  const rowHeight = opts.rowHeight || 26;
  const leftX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right;
  const bottomY = doc.page.height - doc.page.margins.bottom;

  function drawHeaderRow(): void {
    const headerY = doc.y;
    doc.rect(leftX, headerY, rightX - leftX, rowHeight).fill(INK);
    let x = leftX;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
    for (const col of columns) {
      const cellWidth = col.width - 12;
      doc.text(truncateToWidth(doc, col.header, cellWidth), x + 6, headerY + rowHeight / 2 - 5, { width: cellWidth, lineBreak: false });
      x += col.width;
    }
    doc.y = headerY + rowHeight;
    doc.x = leftX;
  }

  drawHeaderRow();

  for (const row of rows) {
    if (doc.y + rowHeight > bottomY) {
      doc.addPage();
      doc.x = leftX;
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }

    const rowY = doc.y;
    let x = leftX;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (let i = 0; i < columns.length; i++) {
      const cellWidth = columns[i].width - 12;
      doc.text(truncateToWidth(doc, row[i] ?? '', cellWidth), x + 6, rowY + rowHeight / 2 - 5, { width: cellWidth, lineBreak: false });
      x += columns[i].width;
    }
    doc
      .moveTo(leftX, rowY + rowHeight)
      .lineTo(rightX, rowY + rowHeight)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
    doc.y = rowY + rowHeight;
    doc.x = leftX;
  }
}

interface ReportAccountRow {
  code: string;
  name: string;
  balance: number;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function drawReportCover(doc: PDFKit.PDFDocument, tenantName: string, title: string, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 110).fill(INK);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(tenantName, 56, 40);
  doc.fillColor('#a7f3d0').font('Helvetica').fontSize(11).text(title, 56, 66);
  doc.y = 130;
  doc.x = 56;
  doc.fillColor(MUTED).font('Helvetica').fontSize(10.5).text(subtitle, 56);
  doc.moveDown(0.8);
}

function drawTotalRow(doc: PDFKit.PDFDocument, label: string, value: string, opts: { color?: string } = {}): void {
  const leftX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.4);
  doc.x = leftX;
  doc
    .moveTo(leftX, doc.y)
    .lineTo(rightX, doc.y)
    .strokeColor('#0f172a')
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.3);
  doc.x = leftX;
  doc
    .fillColor(opts.color || INK)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(label, leftX, doc.y, { continued: true, width: (rightX - leftX) * 0.6 });
  doc.text(value, { align: 'right' });
}

/**
 * Generates a real Balance Sheet PDF (Assets/Liabilities/Equity + the
 * balance-check row), mirroring exactly what BalanceSheet.tsx renders
 * on-screen, using reportingService.getBalanceSheet()'s real result -
 * replaces the previous window.print()-based fake "Export PDF" button.
 */
export function generateBalanceSheetPdf(
  tenantName: string,
  currency: string,
  asOfDateLabel: string,
  data: {
    assets: ReportAccountRow[];
    totalAssets: number;
    liabilities: ReportAccountRow[];
    totalLiabilities: number;
    equity: ReportAccountRow[];
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReportCover(doc, tenantName, 'Balance Sheet', `As of ${asOfDateLabel} — all figures in ${currency}`);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns: TableColumn[] = [
      { header: 'Code', width: tableWidth * 0.15 },
      { header: 'Account', width: tableWidth * 0.55 },
      { header: 'Balance', width: tableWidth * 0.3 },
    ];

    addSectionHeading(doc, 'Assets');
    drawSimpleTable(doc, columns, data.assets.map(a => [a.code, a.name, formatMoney(a.balance, currency)]));
    drawTotalRow(doc, 'Total Assets', formatMoney(data.totalAssets, currency));

    addSectionHeading(doc, 'Liabilities');
    drawSimpleTable(doc, columns, data.liabilities.map(l => [l.code, l.name, formatMoney(l.balance, currency)]));
    drawTotalRow(doc, 'Total Liabilities', formatMoney(data.totalLiabilities, currency));

    addSectionHeading(doc, 'Equity');
    const equityRows = data.equity.map(e => [e.code, e.name, formatMoney(e.balance, currency)]);
    equityRows.push(['', 'Retained Earnings', formatMoney(data.retainedEarnings, currency)]);
    drawSimpleTable(doc, columns, equityRows);
    drawTotalRow(doc, 'Total Equity', formatMoney(data.totalEquity, currency));

    drawTotalRow(
      doc,
      'Total Liabilities & Equity',
      formatMoney(data.totalLiabilitiesAndEquity, currency),
      { color: data.isBalanced ? BRAND_GREEN : '#dc2626' }
    );
    doc.moveDown(0.3);
    doc.x = doc.page.margins.left;
    doc
      .fillColor(data.isBalanced ? BRAND_GREEN : '#dc2626')
      .font('Helvetica')
      .fontSize(9.5)
      .text(data.isBalanced ? 'Assets = Liabilities + Equity (balanced)' : 'Assets do not equal Liabilities + Equity - check ledger entries', doc.page.margins.left);

    doc.end();
  });
}

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Generates a customer-facing Invoice PDF - the itemized document attached
 * to the "email this invoice" send (see EmailService.sendInvoiceEmail /
 * invoiceEmailService.ts), not an internal report like the other generators
 * in this file.
 */
export function generateInvoicePdf(
  tenantName: string,
  data: {
    invoiceNumber: string;
    issueDateLabel: string;
    dueDateLabel: string;
    currency: string;
    customerName: string;
    customerEmail: string;
    customerAddress?: string | null;
    items: InvoicePdfItem[];
    subtotal: number;
    tax: number;
    taxBreakdown: { name: string; rate: number; amount: number }[] | null;
    total: number;
    graClearanceStatus?: string | null;
    graQrCodeDataUrl?: string | null;
    graVerificationEngineId?: string | null;
    graClearedAt?: string | null;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReportCover(doc, tenantName, `Invoice ${data.invoiceNumber}`, `Issued ${data.issueDateLabel} — due ${data.dueDateLabel}`);

    doc.x = doc.page.margins.left;
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(10).text('Bill To', doc.x);
    doc.fillColor(INK).font('Helvetica').fontSize(10.5).text(data.customerName);
    doc.fillColor(MUTED).fontSize(9.5).text(data.customerEmail);
    if (data.customerAddress) {
      doc.text(data.customerAddress);
    }
    doc.moveDown(0.5);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns: TableColumn[] = [
      { header: 'Description', width: tableWidth * 0.46 },
      { header: 'Qty', width: tableWidth * 0.14 },
      { header: 'Unit Price', width: tableWidth * 0.2 },
      { header: 'Amount', width: tableWidth * 0.2 },
    ];

    addSectionHeading(doc, 'Items');
    drawSimpleTable(
      doc,
      columns,
      data.items.map((i) => [i.description, String(i.quantity), formatMoney(i.unitPrice, data.currency), formatMoney(i.amount, data.currency)])
    );

    drawTotalRow(doc, 'Subtotal', formatMoney(data.subtotal, data.currency));
    if (data.taxBreakdown && data.taxBreakdown.length > 0) {
      for (const line of data.taxBreakdown) {
        doc.moveDown(0.2);
        doc.x = doc.page.margins.left;
        doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(`${line.name} (${line.rate}%)`, doc.x, doc.y, { continued: true, width: tableWidth * 0.6 });
        doc.text(formatMoney(line.amount, data.currency), { align: 'right' });
      }
    } else if (data.tax > 0) {
      doc.moveDown(0.2);
      doc.x = doc.page.margins.left;
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text('Tax', doc.x, doc.y, { continued: true, width: tableWidth * 0.6 });
      doc.text(formatMoney(data.tax, data.currency), { align: 'right' });
    }
    drawTotalRow(doc, 'Total Due', formatMoney(data.total, data.currency), { color: BRAND_GREEN });

    // GRA E-VAT clearance section
    if (data.graClearanceStatus === 'CLEARED') {
      doc.moveDown(1.2);
      const leftX = doc.page.margins.left;
      const rightX = doc.page.width - doc.page.margins.right;
      const sectionWidth = rightX - leftX;

      // Green clearance banner
      doc.rect(leftX, doc.y, sectionWidth, 28).fillColor('#dcfce7').fill();
      doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(10)
         .text('✓  GRA E-VAT CLEARED', leftX + 8, doc.y - 22, { width: sectionWidth - 16 });
      if (data.graVerificationEngineId) {
        doc.fillColor('#166534').font('Helvetica').fontSize(8)
           .text(`Verification Engine ID: ${data.graVerificationEngineId}`, leftX + 8, doc.y - 8, { width: sectionWidth - 16 });
      }
      if (data.graClearedAt) {
        const clearedLabel = new Date(data.graClearedAt).toLocaleString('en-GH', { timeZone: 'Africa/Accra' });
        doc.fillColor('#166534').font('Helvetica').fontSize(8)
           .text(`Cleared: ${clearedLabel}`, leftX + 8, doc.y, { width: sectionWidth - 120 });
      }

      // QR code (right-aligned in the clearance block)
      if (data.graQrCodeDataUrl) {
        try {
          const base64 = data.graQrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
          const imgBuf = Buffer.from(base64, 'base64');
          doc.image(imgBuf, rightX - 80, doc.y - 48, { width: 72, height: 72 });
          doc.moveDown(2.4);
        } catch {
          doc.moveDown(0.5);
        }
      } else {
        doc.moveDown(0.5);
      }
    }

    doc.end();
  });
}

/**
 * Generates a real Profit & Loss PDF (Income/Expenses + Net Profit/Loss),
 * mirroring ProfitAndLoss.tsx's on-screen layout.
 */
export function generateProfitAndLossPdf(
  tenantName: string,
  currency: string,
  asOfDateLabel: string,
  data: {
    revenues: ReportAccountRow[];
    totalRevenue: number;
    expenses: ReportAccountRow[];
    totalExpenses: number;
    netProfit: number;
    isProfit: boolean;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReportCover(doc, tenantName, 'Profit and Loss Statement', `As of ${asOfDateLabel} — all figures in ${currency}`);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns: TableColumn[] = [
      { header: 'Code', width: tableWidth * 0.15 },
      { header: 'Account', width: tableWidth * 0.55 },
      { header: 'Balance', width: tableWidth * 0.3 },
    ];

    addSectionHeading(doc, 'Income');
    drawSimpleTable(doc, columns, data.revenues.map(r => [r.code, r.name, formatMoney(r.balance, currency)]));
    drawTotalRow(doc, 'Total Income', formatMoney(data.totalRevenue, currency));

    addSectionHeading(doc, 'Expenses');
    drawSimpleTable(doc, columns, data.expenses.map(e => [e.code, e.name, formatMoney(e.balance, currency)]));
    drawTotalRow(doc, 'Total Expenses', formatMoney(data.totalExpenses, currency));

    drawTotalRow(
      doc,
      data.isProfit ? 'Net Profit' : 'Net Loss',
      formatMoney(data.netProfit, currency),
      { color: data.isProfit ? BRAND_GREEN : '#dc2626' }
    );

    doc.end();
  });
}

export interface CashFlowLineItem {
  code: string;
  name: string;
  change: number;
}

/**
 * Generates a real Cash Flow Statement PDF (indirect method), mirroring
 * CashFlowStatement.tsx's on-screen layout.
 */
export function generateCashFlowPdf(
  tenantName: string,
  currency: string,
  periodLabel: string,
  data: {
    netIncome: number;
    operatingAdjustments: CashFlowLineItem[];
    netCashFromOperating: number;
    investingAdjustments: CashFlowLineItem[];
    netCashFromInvesting: number;
    financingAdjustments: CashFlowLineItem[];
    netCashFromFinancing: number;
    netChangeInCash: number;
    beginningCash: number;
    endingCash: number;
    cashTies: boolean;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReportCover(doc, tenantName, 'Cash Flow Statement', `${periodLabel} — all figures in ${currency}`);

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns: TableColumn[] = [
      { header: 'Code', width: tableWidth * 0.15 },
      { header: 'Account', width: tableWidth * 0.55 },
      { header: 'Change in Cash', width: tableWidth * 0.3 },
    ];

    addSectionHeading(doc, 'Operating Activities');
    doc.fillColor(INK).font('Helvetica').fontSize(10.5).text(`Net Income: ${formatMoney(data.netIncome, currency)}`, doc.page.margins.left);
    doc.moveDown(0.5);
    drawSimpleTable(doc, columns, data.operatingAdjustments.map(a => [a.code, a.name, formatMoney(a.change, currency)]));
    drawTotalRow(doc, 'Net Cash from Operating Activities', formatMoney(data.netCashFromOperating, currency));

    addSectionHeading(doc, 'Investing Activities');
    drawSimpleTable(doc, columns, data.investingAdjustments.map(a => [a.code, a.name, formatMoney(a.change, currency)]));
    drawTotalRow(doc, 'Net Cash from Investing Activities', formatMoney(data.netCashFromInvesting, currency));

    addSectionHeading(doc, 'Financing Activities');
    drawSimpleTable(doc, columns, data.financingAdjustments.map(a => [a.code, a.name, formatMoney(a.change, currency)]));
    drawTotalRow(doc, 'Net Cash from Financing Activities', formatMoney(data.netCashFromFinancing, currency));

    drawTotalRow(doc, 'Net Change in Cash', formatMoney(data.netChangeInCash, currency));
    drawTotalRow(doc, 'Cash at Beginning of Period', formatMoney(data.beginningCash, currency));
    drawTotalRow(doc, 'Cash at End of Period', formatMoney(data.endingCash, currency), { color: BRAND_GREEN });

    doc.moveDown(0.3);
    doc.x = doc.page.margins.left;
    doc
      .fillColor(data.cashTies ? BRAND_GREEN : '#dc2626')
      .font('Helvetica')
      .fontSize(9.5)
      .text(
        data.cashTies
          ? 'Reconciles with actual cash account balances.'
          : 'Does not reconcile with actual cash account balances - check ledger entries.',
        doc.page.margins.left
      );

    doc.end();
  });
}

export interface ExecutiveReportCloseoutRow {
  closedAt: string;
  warehouseName: string;
  closedBy: string;
  openingCash: number;
  cashSales: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
}

/**
 * Generates a real PDF for the Executive Performance & Till Closeout report -
 * the daily/monthly/yearly revenue summary plus the shop leaderboard, or (for
 * reportType 'closeouts') the full end-of-day till closeout ledger.
 */
export function generateExecutiveReportPdf(
  tenantName: string,
  currency: string,
  reportType: 'daily' | 'monthly' | 'yearly' | 'closeouts',
  data: {
    periodTotal?: number;
    shopLeaderboard?: { name: string; code: string; location: string | null; totalRevenue: number }[];
    closeouts?: ExecutiveReportCloseoutRow[];
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const titleMap = { daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly', closeouts: 'Till Closeout' } as const;
    drawReportCover(
      doc,
      tenantName,
      'Executive Performance Report',
      `${titleMap[reportType]} report — all figures in ${currency}`
    );

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (reportType === 'closeouts') {
      addSectionHeading(doc, 'End-of-Day Till Closeouts');
      const columns: TableColumn[] = [
        { header: 'Date/Time', width: tableWidth * 0.2 },
        { header: 'Shop', width: tableWidth * 0.2 },
        { header: 'Closed By', width: tableWidth * 0.16 },
        { header: 'Expected', width: tableWidth * 0.15 },
        { header: 'Actual', width: tableWidth * 0.15 },
        { header: 'Discrepancy', width: tableWidth * 0.14 },
      ];
      const rows = (data.closeouts || []).map(c => [
        new Date(c.closedAt).toLocaleString(),
        c.warehouseName,
        c.closedBy,
        formatMoney(c.expectedCash, currency),
        formatMoney(c.actualCash, currency),
        formatMoney(c.discrepancy, currency),
      ]);
      drawSimpleTable(doc, columns, rows);
    } else {
      addSectionHeading(doc, `Total ${titleMap[reportType]} Sales Revenue`);
      doc.x = doc.page.margins.left;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text(formatMoney(data.periodTotal || 0, currency));

      addSectionHeading(doc, 'Top-Selling Shops Leaderboard');
      const columns: TableColumn[] = [
        { header: 'Shop', width: tableWidth * 0.3 },
        { header: 'Code', width: tableWidth * 0.15 },
        { header: 'Location', width: tableWidth * 0.3 },
        { header: 'Total Revenue', width: tableWidth * 0.25 },
      ];
      const rows = (data.shopLeaderboard || []).map(s => [s.name, s.code, s.location || '-', formatMoney(s.totalRevenue, currency)]);
      drawSimpleTable(doc, columns, rows);
    }

    doc.end();
  });
}

/**
 * Generates a real PDF for the Inventory Decision Intelligence Tower -
 * Fast-Selling items, Slow-Moving (dead) stock, and smart re-allocation
 * suggestions.
 */
export function generateStockIntelligencePdf(
  tenantName: string,
  data: {
    fastSellers: { sku: string; name: string; totalStock: number; unitOfMeasure: string }[];
    slowMoving: { sku: string; name: string; totalStock: number; unitOfMeasure: string }[];
    suggestions: { itemName: string; fromWarehouseName: string; toWarehouseName: string; suggestedQty: number }[];
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    drawReportCover(doc, tenantName, 'Inventory Decision Intelligence', 'Fast-moving items, dead stock, and smart re-allocation suggestions');

    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const itemColumns: TableColumn[] = [
      { header: 'SKU', width: tableWidth * 0.2 },
      { header: 'Item Name', width: tableWidth * 0.45 },
      { header: 'Unit', width: tableWidth * 0.15 },
      { header: 'Total Stock', width: tableWidth * 0.2 },
    ];

    addSectionHeading(doc, `Fast-Selling Items (${data.fastSellers.length})`);
    drawSimpleTable(doc, itemColumns, data.fastSellers.map(i => [i.sku, i.name, i.unitOfMeasure, String(i.totalStock)]));

    addSectionHeading(doc, `Slow-Moving / Dead Stock (${data.slowMoving.length})`);
    drawSimpleTable(doc, itemColumns, data.slowMoving.map(i => [i.sku, i.name, i.unitOfMeasure, String(i.totalStock)]));

    addSectionHeading(doc, `Smart Re-Allocation Suggestions (${data.suggestions.length})`);
    const suggestionColumns: TableColumn[] = [
      { header: 'Item', width: tableWidth * 0.34 },
      { header: 'From', width: tableWidth * 0.24 },
      { header: 'To', width: tableWidth * 0.24 },
      { header: 'Suggested Qty', width: tableWidth * 0.18 },
    ];
    drawSimpleTable(doc, suggestionColumns, data.suggestions.map(s => [s.itemName, s.fromWarehouseName, s.toWarehouseName, String(s.suggestedQty)]));

    doc.end();
  });
}

export interface StockSheetItem {
  sku: string;
  name: string;
  unitOfMeasure: string;
}

/**
 * Generates a blind physical stock-count sheet for a single warehouse - lists
 * every item's SKU/name/unit with a blank "Counted Qty" column to write into
 * by hand. Deliberately never includes the system's current quantity on hand,
 * so a paper count isn't unconsciously biased toward matching what the app
 * already expects.
 */
export function generateStockTakeSheetPdf(
  tenantName: string,
  warehouseName: string,
  items: StockSheetItem[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const leftX = doc.page.margins.left;
    const rightMargin = doc.page.margins.right;

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text('Blind Stock Count Sheet', leftX, doc.y);
    doc.moveDown(0.3);
    doc.x = leftX;
    doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(tenantName, leftX);
    doc.x = leftX;
    doc.text(`Warehouse: ${warehouseName}`, leftX);
    doc.x = leftX;
    doc.text(
      `Date: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      leftX
    );
    doc.moveDown(0.5);
    doc.x = leftX;
    doc
      .fillColor(MUTED)
      .font('Helvetica-Oblique')
      .fontSize(9.5)
      .text(
        'Count every item physically on the shelf and write the counted quantity in the "Counted Qty" column below. Do not refer to any system records while counting.',
        leftX,
        doc.y,
        { width: doc.page.width - leftX - rightMargin }
      );
    doc.moveDown(1);
    doc.x = leftX;

    const tableWidth = doc.page.width - leftX - rightMargin;
    const columns: TableColumn[] = [
      { header: 'SKU', width: tableWidth * 0.38 },
      { header: 'Item Name', width: tableWidth * 0.30 },
      { header: 'Unit', width: tableWidth * 0.12 },
      { header: 'Counted Qty', width: tableWidth * 0.20 },
    ];
    const rows = items.map((item) => [item.sku, item.name, item.unitOfMeasure, '']);

    drawSimpleTable(doc, columns, rows, { rowHeight: 28 });

    doc.moveDown(1);
    doc.x = leftX;
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(8.5)
      .text(`${items.length} item(s) listed. Generated by Ledgio ERP.`, leftX);

    doc.end();
  });
}
