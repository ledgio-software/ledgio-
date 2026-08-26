import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { CheckCircle, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";

type ImportType = "accounts" | "customers" | "inventory-items";

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
};

export function BulkImportWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportType>("accounts");
  const config = IMPORT_CONFIGS[importType];

  const [rawCsv, setRawCsv] = useState(config.sample);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    importedCount: number;
    errorCount: number;
    errors: any[];
  } | null>(null);

  const handleTypeChange = (type: ImportType) => {
    setImportType(type);
    setRawCsv(IMPORT_CONFIGS[type].sample);
    setParsedRows([]);
    setResultSummary(null);
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
    try {
      const payload = { [config.payloadKey]: config.buildPayload(parsedRows) };
      const response = await api.post(config.endpoint, payload);
      if (response.data.success) {
        setResultSummary(response.data.data);
        setStep(3);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Import execution failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
          Bulk Data Import Wizard
        </h2>
        <p className="text-secondary-500 dark:text-secondary-400 mt-1">
          Import accounts, customers, or inventory items from CSV or Excel exports.
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
            <CardDescription>Review mapped rows before inserting into your database.</CardDescription>
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
                  {parsedRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      {config.previewColumns.map((col) => (
                        <TableCell key={col.key} className="font-mono text-sm">{r[col.key]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Edit
              </Button>
              <Button variant="primary" onClick={handleExecuteImport} disabled={isSubmitting}>
                {isSubmitting ? "Importing..." : `Execute Import (${parsedRows.length} items)`}
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
