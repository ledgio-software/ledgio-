import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

type ImportType = "accounts" | "customers" | "inventory-items" | "invoices" | "payments";

const CHUNK_SIZE = 1_000;
const PREVIEW_LIMIT = 10;

const IMPORT_CONFIGS: Record<ImportType, {
  label: string;
  description: string;
  headers: string[];
  sample: string;
  endpoint: string;
  payloadKey: string;
  buildPayload: (rows: any[]) => any[];
  previewColumns: { key: string; label: string }[];
  successNav: { label: string; href: string };
}> = {
  accounts: {
    label: "Chart of Accounts",
    description: "Import accounts with Code, Name, and Type.",
    headers: ["Code", "Name", "Type"],
    sample: `Code,Name,Type\n1010,Petty Cash,Asset\n2010,Accounts Payable,Liability\n4010,Consulting Income,Revenue\n5010,Office Rent,Expense`,
    endpoint: "/import/accounts",
    payloadKey: "accounts",
    buildPayload: (rows) => rows.map((r) => ({ code: r.code, name: r.name, type: r.type || "Asset" })),
    previewColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
    ],
    successNav: { label: "View Chart of Accounts", href: "/accounts" },
  },
  customers: {
    label: "Customers",
    description: "Import customers. Email is optional — a placeholder is used if omitted.",
    headers: ["Name", "Email", "Phone", "Address", "CreditLimit", "TIN", "Type"],
    sample: `Name,Email,Phone,Address,CreditLimit,TIN,Type\nKofi Agyeman,kofi@example.com,0244000001,Accra,,GH123456,RETAIL\nAkosua Trading,akosua@biz.gh,0244000002,Kumasi,5000,,WHOLESALE`,
    endpoint: "/import/customers",
    payloadKey: "customers",
    buildPayload: (rows) => rows.map((r) => ({
      name: r.name,
      email: r.email || "",
      phone: r.phone || "",
      address: r.address || "",
      creditlimit: r.creditlimit || "",
      tin: r.tin || "",
      type: r.type || "RETAIL",
    })),
    previewColumns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "type", label: "Type" },
    ],
    successNav: { label: "View Customers", href: "/invoices" },
  },
  "inventory-items": {
    label: "Inventory Items",
    description: "Import products/items with pricing. SKU auto-generated if blank. warehouseName and initialQty seed opening stock (warehouse must exist first).",
    headers: ["name", "sku", "category", "unitOfMeasure", "costPrice", "sellingPrice", "warehouseName", "initialQty"],
    sample: `name,sku,category,unitOfMeasure,costPrice,sellingPrice,warehouseName,initialQty\nTest Widget,TW-001,Electronics,pcs,50,80,Shop A (Downtown Branch),20\nOffice Chair,CH-001,Furniture,each,200,350,Shop A (Downtown Branch),5`,
    endpoint: "/import/inventory-items",
    payloadKey: "items",
    buildPayload: (rows) => rows.map((r) => ({
      name: r.name,
      sku: r.sku || "",
      category: r.category || "General",
      unitOfMeasure: r.unitofmeasure || r.unit || "pcs",
      costPrice: r.costprice,
      sellingPrice: r.sellingprice,
      warehouseName: r.warehousename || "",
      initialQty: r.initialqty || "",
    })),
    previewColumns: [
      { key: "name", label: "Name" },
      { key: "sku", label: "SKU" },
      { key: "costprice", label: "Cost Price" },
      { key: "sellingprice", label: "Selling Price" },
      { key: "warehousename", label: "Warehouse" },
      { key: "initialqty", label: "Opening Qty" },
    ],
    successNav: { label: "View Inventory", href: "/inventory/items" },
  },
  invoices: {
    label: "Invoices",
    description: "Import bulk invoices. Customers are matched by name and auto-created if not found.",
    headers: ["customername", "customerphone", "invoicedate", "duedate", "currency", "description", "quantity", "unitprice"],
    sample: `customername,customerphone,invoicedate,duedate,currency,description,quantity,unitprice\nKofi Mensah,0244123456,2026-08-01,2026-09-01,GHS,Samsung A15 (Installment Plan),1,1200.00\nAkosua Boateng,0208765432,2026-08-02,2026-09-02,GHS,iPhone 15 (Installment Plan),1,3500.00`,
    endpoint: "/import/invoices",
    payloadKey: "invoices",
    buildPayload: (rows) => rows.map((r) => ({
      customerName: r.customername,
      customerPhone: r.customerphone || null,
      invoiceDate: r.invoicedate || null,
      dueDate: r.duedate || null,
      currency: r.currency || "GHS",
      description: r.description,
      quantity: Number(r.quantity) || 1,
      unitPrice: Number(r.unitprice) || 0,
    })),
    previewColumns: [
      { key: "customername", label: "Customer" },
      { key: "invoicedate", label: "Invoice Date" },
      { key: "duedate", label: "Due Date" },
      { key: "description", label: "Description" },
      { key: "quantity", label: "Qty" },
      { key: "unitprice", label: "Unit Price" },
    ],
    successNav: { label: "View Invoices", href: "/invoices" },
  },
  payments: {
    label: "Payments",
    description: "Post payments against existing open invoices by invoice number. Amount defaults to full remaining balance if omitted.",
    headers: ["invoicenumber", "amount", "paymentdate", "paymentmethod", "reference"],
    sample: `invoicenumber,amount,paymentdate,paymentmethod,reference\nINV-1234567890-1001,500.00,2026-08-26,Mobile Money,MoMo-TX-GH-001\nINV-1234567890-1002,1200.00,2026-08-26,Cash,CASH-REC-002`,
    endpoint: "/import/payments",
    payloadKey: "payments",
    buildPayload: (rows) => rows.map((r) => ({
      invoiceNumber: r.invoicenumber,
      amount: r.amount ? Number(r.amount) : null,
      paymentDate: r.paymentdate || null,
      paymentMethod: r.paymentmethod || null,
      reference: r.reference || null,
    })),
    previewColumns: [
      { key: "invoicenumber", label: "Invoice #" },
      { key: "amount", label: "Amount" },
      { key: "paymentdate", label: "Payment Date" },
      { key: "paymentmethod", label: "Method" },
      { key: "reference", label: "Reference" },
    ],
    successNav: { label: "View Invoices", href: "/invoices" },
  },
};

const PHARMACY_INVENTORY_CONFIG: typeof IMPORT_CONFIGS["inventory-items"] = {
  label: "Inventory Items",
  description: "Import products with batch and expiry data. batchNumber and expiryDate create opening InventoryBatch records for FEFO dispensing. SKU auto-generated if blank.",
  headers: ["name", "sku", "category", "unitOfMeasure", "costPrice", "sellingPrice", "warehouseName", "initialQty", "batchNumber", "expiryDate"],
  sample: `name,sku,category,unitOfMeasure,costPrice,sellingPrice,warehouseName,initialQty,batchNumber,expiryDate\nAmoxicillin 500mg,AMX-500,Antibiotics,tablet,0.50,1.20,Main Pharmacy,200,LOT-2024-001,2026-12-31\nParacetamol 500mg,PCM-500,Analgesics,tablet,0.10,0.30,Main Pharmacy,500,LOT-2024-002,2027-06-30\nMetronidazole 200mg,MTZ-200,Antibiotics,tablet,0.20,0.60,Main Pharmacy,300,LOT-2024-003,2027-03-15`,
  endpoint: "/import/inventory-items",
  payloadKey: "items",
  buildPayload: (rows) => rows.map((r) => ({
    name: r.name,
    sku: r.sku || "",
    category: r.category || "General",
    unitOfMeasure: r.unitofmeasure || r.unit || "tablet",
    costPrice: r.costprice,
    sellingPrice: r.sellingprice,
    warehouseName: r.warehousename || "",
    initialQty: r.initialqty || "",
    batchNumber: r.batchnumber || "",
    expiryDate: r.expirydate || "",
  })),
  previewColumns: [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "costprice", label: "Cost Price" },
    { key: "sellingprice", label: "Sell Price" },
    { key: "initialqty", label: "Qty" },
    { key: "batchnumber", label: "Batch #" },
    { key: "expirydate", label: "Expiry Date" },
  ],
  successNav: { label: "View Inventory", href: "/inventory/items" },
};

export function BulkImportWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isPharmacy = user?.orgType === "PHARMACY";

  const configs: typeof IMPORT_CONFIGS = isPharmacy
    ? { ...IMPORT_CONFIGS, "inventory-items": PHARMACY_INVENTORY_CONFIG }
    : IMPORT_CONFIGS;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportType>("accounts");
  const config = configs[importType];

  const [rawCsv, setRawCsv] = useState(config.sample);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    importedCount: number;
    errorCount: number;
    errors: any[];
  } | null>(null);

  const handleTypeChange = (type: ImportType) => {
    setImportType(type);
    setRawCsv(configs[type].sample);
    setParsedRows([]);
    setResultSummary(null);
    setProgress(null);
    setStep(1);
  };

  const handleParseCsv = () => {
    const lines = rawCsv.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      showToast("Please enter a header row and at least 1 data row.", "error");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const dataRows = lines.slice(1).map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const rowObj: any = {};
      headers.forEach((h, idx) => { rowObj[h] = parts[idx] || ""; });
      return rowObj;
    });

    setParsedRows(dataRows);
    setStep(2);
  };

  const handleExecuteImport = async () => {
    setIsSubmitting(true);
    setResultSummary(null);

    const allBuilt = config.buildPayload(parsedRows);
    const chunks: any[][] = [];
    for (let i = 0; i < allBuilt.length; i += CHUNK_SIZE) {
      chunks.push(allBuilt.slice(i, i + CHUNK_SIZE));
    }

    let totalImported = 0;
    let totalErrors = 0;
    const allErrors: any[] = [];

    try {
      for (let c = 0; c < chunks.length; c++) {
        setProgress({ done: c * CHUNK_SIZE, total: allBuilt.length });
        const payload = { [config.payloadKey]: chunks[c] };
        const response = await api.post(config.endpoint, payload);
        if (response.data.success) {
          totalImported += response.data.data.importedCount;
          totalErrors += response.data.data.errorCount;
          // Offset row numbers to reflect position in full dataset
          const offset = c * CHUNK_SIZE;
          response.data.data.errors.forEach((e: any) => {
            allErrors.push({ ...e, row: e.row + offset });
          });
        }
      }

      setProgress({ done: allBuilt.length, total: allBuilt.length });
      setResultSummary({ importedCount: totalImported, errorCount: totalErrors, errors: allErrors });
      setStep(3);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Import execution failed.", "error");
    } finally {
      setIsSubmitting(false);
      setProgress(null);
    }
  };

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
          Bulk Data Import Wizard
        </h2>
        <p className="text-secondary-500 dark:text-secondary-400 mt-1">
          Import accounts, customers, inventory items, invoices, or payments from CSV.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-secondary-900 rounded-lg border border-secondary-200 dark:border-secondary-800">
        {["Select & Paste", "Preview & Map", "Complete"].map((label, idx) => (
          <>
            <div key={label} className={`flex items-center space-x-2 ${step >= idx + 1 ? "text-primary-600 dark:text-primary-400 font-semibold" : "text-secondary-400"}`}>
              <span className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-sm">{idx + 1}</span>
              <span>{label}</span>
            </div>
            {idx < 2 && <ArrowRight key={`arrow-${idx}`} className="h-4 w-4 text-secondary-400" />}
          </>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Select Type & Paste CSV</CardTitle>
            <CardDescription>Choose what you are importing, then paste your comma-separated data below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Data Category</label>
              <select
                value={importType}
                onChange={(e) => handleTypeChange(e.target.value as ImportType)}
                className="w-full h-10 px-3 rounded-md border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-secondary-900 dark:text-secondary-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="accounts">Chart of Accounts (Code, Name, Type)</option>
                <option value="customers">Customers (Name, Email, Phone, Address, CreditLimit, TIN, Type)</option>
                <option value="inventory-items">Inventory Items (Name, SKU, Category, Unit, CostPrice, SellingPrice, ...)</option>
                <option value="invoices">Invoices (CustomerName, InvoiceDate, DueDate, Description, Qty, UnitPrice)</option>
                <option value="payments">Payments (InvoiceNumber, Amount, PaymentDate, Method, Reference)</option>
              </select>
            </div>

            <div className="p-3 bg-secondary-50 dark:bg-secondary-950 rounded-md border border-secondary-200 dark:border-secondary-800 text-xs text-secondary-600 dark:text-secondary-400">
              <span className="font-semibold">Required columns:</span> {config.headers.join(", ")}
              <br />
              {config.description}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                CSV Data (first line must be column headers)
              </label>
              <textarea
                rows={10}
                value={rawCsv}
                onChange={(e) => setRawCsv(e.target.value)}
                className="w-full p-3 font-mono text-xs rounded-md border border-secondary-300 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-950 text-secondary-900 dark:text-secondary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleParseCsv} className="flex items-center">
                Parse & Preview Data
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Preview & Confirm Import ({parsedRows.length} Rows)</CardTitle>
            <CardDescription>
              Showing first {Math.min(PREVIEW_LIMIT, parsedRows.length)} of {parsedRows.length.toLocaleString()} rows.
              Importing in batches of {CHUNK_SIZE} — up to 16,000 rows supported.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row #</TableHead>
                    {config.previewColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, PREVIEW_LIMIT).map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      {config.previewColumns.map((col) => (
                        <TableCell key={col.key} className="font-mono text-sm">{r[col.key]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > PREVIEW_LIMIT && (
                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2 text-center">
                  … and {parsedRows.length - PREVIEW_LIMIT} more rows (not shown in preview)
                </p>
              )}
            </div>

            {/* Progress bar */}
            {isSubmitting && progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-secondary-600 dark:text-secondary-400">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing… {progress.done} / {progress.total} records
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting} className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Edit
              </Button>
              <Button variant="primary" onClick={handleExecuteImport} disabled={isSubmitting}>
                {isSubmitting ? "Importing…" : `Execute Import (${parsedRows.length.toLocaleString()} items)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && resultSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="mr-2 h-6 w-6" />
              Import Completed
            </CardTitle>
            <CardDescription>Results summary for your {config.label} import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Successfully Imported</p>
                <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">{resultSummary.importedCount}</p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                <p className="text-sm text-amber-700 dark:text-amber-300">Errors</p>
                <p className="text-3xl font-bold text-amber-800 dark:text-amber-200 mt-1">{resultSummary.errorCount}</p>
              </div>
            </div>

            {resultSummary.errors.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-1 flex items-center">
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Error Details:
                </p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                  {resultSummary.errors.map((err: any, i: number) => (
                    <li key={i}>Row {err.row} ({err.name || err.code}): {err.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => { setStep(1); setResultSummary(null); }}>
                Import Another File
              </Button>
              <Button variant="primary" onClick={() => navigate(config.successNav.href)}>
                {config.successNav.label}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
