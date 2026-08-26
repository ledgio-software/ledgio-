import { useState, useCallback } from "react";
import { FileSpreadsheet, RefreshCw, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { exportToCsv } from "../../lib/exportCsv";

interface SalesRow {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customerName: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
}

interface PurchaseRow {
  billId: string;
  billNumber: string;
  date: string;
  dueDate: string;
  vendorName: string;
  currency: string;
  amount: number;
  status: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SalesResult {
  rows: SalesRow[];
  totals: { subtotal: number; tax: number; total: number };
  pagination: Pagination;
}

interface PurchaseResult {
  rows: PurchaseRow[];
  totals: { amount: number };
  pagination: Pagination;
}

const STATUS_VARIANT: Record<string, string> = {
  PAID: "default",
  PARTIAL: "secondary",
  UNPAID: "destructive",
  OVERDUE: "destructive",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function fmt(n: number, currency = "") {
  return (currency ? `${currency} ` : "") + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" });
}

export function Registers() {
  const [tab, setTab] = useState<"sales" | "purchase">("sales");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesResult, setSalesResult] = useState<SalesResult | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);

  const loadSales = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate, page: String(page), pageSize: "100" });
      const res = await api.get(`/reports/sales-register?${params}`);
      setSalesResult(res.data.data);
      setSalesPage(page);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load sales register.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadPurchase = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate, page: String(page), pageSize: "100" });
      const res = await api.get(`/reports/purchase-register?${params}`);
      setPurchaseResult(res.data.data);
      setPurchasePage(page);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load purchase register.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  function handleRun() {
    if (tab === "sales") loadSales(1);
    else loadPurchase(1);
  }

  function handleExportCsv() {
    if (tab === "sales" && salesResult) {
      const rows = salesResult.rows.map((r) => ({
        Date: fmtDate(r.date),
        "Invoice No": r.invoiceNumber,
        Customer: r.customerName,
        Currency: r.currency,
        Subtotal: String(r.subtotal),
        Tax: String(r.tax),
        Total: String(r.total),
        Status: r.status,
      }));
      exportToCsv(`sales-register-${startDate}_${endDate}.csv`, rows);
    } else if (tab === "purchase" && purchaseResult) {
      const rows = purchaseResult.rows.map((r) => ({
        Date: fmtDate(r.date),
        "Bill No": r.billNumber,
        Vendor: r.vendorName,
        Currency: r.currency,
        Amount: String(r.amount),
        Status: r.status,
      }));
      exportToCsv(`purchase-register-${startDate}_${endDate}.csv`, rows);
    }
  }

  const hasResult = tab === "sales" ? salesResult !== null : purchaseResult !== null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-secondary-900 dark:text-secondary-50">Purchase & Sales Registers</h1>
            <p className="text-sm text-muted-foreground">Statutory register of all purchases and sales for a period</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!hasResult}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 border-b border-border pb-0">
        {(["sales", "purchase"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "sales" ? "Sales Register" : "Purchase Register"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button onClick={handleRun} disabled={loading} size="sm">
              {loading ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {loading ? "Loading…" : "Run"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Sales Register */}
      {tab === "sales" && salesResult && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subtotal</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(salesResult.totals.subtotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax Collected</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(salesResult.totals.tax)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Sales</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(salesResult.totals.total)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales Register</CardTitle>
              <CardDescription>{salesResult.pagination.total} invoice{salesResult.pagination.total !== 1 ? "s" : ""} in period</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {salesResult.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No invoices found for the selected period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesResult.rows.map((r) => (
                      <TableRow key={r.invoiceId}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                        <TableCell className="text-sm">{r.customerName}</TableCell>
                        <TableCell className="text-sm">{r.currency}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmt(r.subtotal)}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmt(r.tax)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-sm">{fmt(r.total)}</TableCell>
                        <TableCell>
                          <Badge variant={(STATUS_VARIANT[r.status] as any) || "secondary"}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {salesResult.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {salesPage} of {salesResult.pagination.totalPages} ({salesResult.pagination.total} total)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={salesPage <= 1 || loading} onClick={() => loadSales(salesPage - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={salesPage >= salesResult.pagination.totalPages || loading} onClick={() => loadSales(salesPage + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Purchase Register */}
      {tab === "purchase" && purchaseResult && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Purchases</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(purchaseResult.totals.amount)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purchase Register</CardTitle>
              <CardDescription>{purchaseResult.pagination.total} bill{purchaseResult.pagination.total !== 1 ? "s" : ""} in period</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {purchaseResult.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No vendor bills found for the selected period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill No</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseResult.rows.map((r) => (
                      <TableRow key={r.billId}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.billNumber}</TableCell>
                        <TableCell className="text-sm">{r.vendorName}</TableCell>
                        <TableCell className="text-sm">{r.currency}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-sm">{fmt(r.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={(STATUS_VARIANT[r.status] as any) || "secondary"}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {purchaseResult.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {purchasePage} of {purchaseResult.pagination.totalPages} ({purchaseResult.pagination.total} total)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={purchasePage <= 1 || loading} onClick={() => loadPurchase(purchasePage - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={purchasePage >= purchaseResult.pagination.totalPages || loading} onClick={() => loadPurchase(purchasePage + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {!hasResult && !loading && (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Select a date range and click Run to view the register.</p>
        </div>
      )}
    </div>
  );
}
