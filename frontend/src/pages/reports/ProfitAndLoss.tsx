import { useState, useEffect, useCallback } from "react";
import { Download, Printer, FileText, FileType, Columns2 } from "lucide-react";
import { useProfitAndLoss } from "../../hooks/useProfitAndLoss";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { exportToCsv } from "../../lib/exportCsv";
import { api } from "../../lib/api";
import { downloadBlobResponse } from "../../lib/downloadBlob";
import { useToast } from "../../contexts/ToastContext";

interface FundOption {
  id: string;
  name: string;
  code: string;
}

interface PnLData {
  revenues: Array<{ id: string; code: string; name: string; amount: number }>;
  costOfSales: Array<{ id: string; code: string; name: string; amount: number }>;
  expenses: Array<{ id: string; code: string; name: string; amount: number }>;
  totalRevenue: number;
  totalCostOfSales: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
}

function fmtVariance(v: number, currency: string) {
  const sign = v > 0 ? "+" : "";
  return sign + new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
}

function variancePct(current: number, prior: number) {
  if (prior === 0) return current === 0 ? "—" : "N/A";
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

interface CompareRowProps {
  label: string;
  p1: number;
  p2: number;
  currency: string;
  isBold?: boolean;
  isTotal?: boolean;
  isProfit?: boolean;
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function CompareRow({ label, p1, p2, currency, isBold, isTotal, isProfit }: CompareRowProps) {
  const variance = p1 - p2;
  const rowClass = [
    "grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 py-1.5 items-center",
    isTotal ? "border-t border-secondary-200 dark:border-secondary-700 mt-1 pt-2" : "",
    isProfit ? "border-t-2 border-secondary-900 dark:border-secondary-50 mt-2 pt-3" : "",
  ].join(" ");

  const numClass = [
    "text-right tabular-nums w-28",
    isBold || isTotal || isProfit ? "font-bold" : "",
    isProfit ? (p1 >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400") : "",
  ].join(" ");

  const vClass = [
    "text-right tabular-nums w-28",
    variance > 0 ? "text-emerald-600 dark:text-emerald-400" : variance < 0 ? "text-red-600 dark:text-red-400" : "text-secondary-500",
  ].join(" ");

  return (
    <div className={rowClass}>
      <span className={`text-sm ${isBold || isTotal || isProfit ? "font-bold uppercase tracking-wide text-xs" : "text-secondary-700 dark:text-secondary-300"}`}>
        {label}
      </span>
      <span className={numClass + " text-sm"}>{fmt(p1, currency)}</span>
      <span className={numClass + " text-sm"}>{fmt(p2, currency)}</span>
      <span className={vClass + " text-sm"}>{fmtVariance(variance, currency)}</span>
      <span className="text-right tabular-nums w-20 text-sm text-secondary-500">{variancePct(p1, p2)}</span>
    </div>
  );
}

export function ProfitAndLoss() {
  const { settings } = useTenantSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSchool = user?.orgType === 'NONPROFIT' || user?.orgType === 'SCHOOL';

  // School-specific label overrides
  const labels = isSchool ? {
    reportTitle: 'Income & Expenditure Statement',
    incomeSection: 'Fee Income',
    totalIncome: 'Total Fee Income',
    costOfSalesSection: 'Direct Educational Costs',
    totalCostOfSales: 'Total Direct Costs',
    grossProfit: 'Gross Surplus',
    expensesSection: 'Expenses',
    totalExpenses: 'Total Expenses',
    netSurplus: (n: number) => n >= 0 ? 'Net Surplus' : 'Net Deficit',
  } : {
    reportTitle: 'Profit and Loss Statement',
    incomeSection: 'Income',
    totalIncome: 'Total Income',
    costOfSalesSection: 'Cost of Sales',
    totalCostOfSales: 'Total Cost of Sales',
    grossProfit: 'Gross Profit',
    expensesSection: 'Expenses',
    totalExpenses: 'Total Expenses',
    netSurplus: (n: number) => n >= 0 ? 'Net Profit' : 'Net Loss',
  };
  const [isExporting, setIsExporting] = useState<"pdf" | "docx" | null>(null);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string>("");

  // Compare-periods state
  const [compareMode, setCompareMode] = useState(false);
  const [p1Start, setP1Start] = useState("");
  const [p1End, setP1End] = useState("");
  const [p2Start, setP2Start] = useState("");
  const [p2End, setP2End] = useState("");
  const [p1Label, setP1Label] = useState("Period 1");
  const [p2Label, setP2Label] = useState("Period 2");
  const [compareData, setCompareData] = useState<{ p1: PnLData; p2: PnLData } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const fetchCompare = useCallback(async () => {
    if (!p1Start || !p1End || !p2Start || !p2End) {
      setCompareError("Please set all four dates before comparing.");
      return;
    }
    setCompareLoading(true); setCompareError(null); setCompareData(null);
    try {
      const [r1, r2] = await Promise.all([
        api.get("/reports/profit-loss", { params: { startDate: p1Start, endDate: p1End, ...(selectedFundId ? { fundId: selectedFundId } : {}) } }),
        api.get("/reports/profit-loss", { params: { startDate: p2Start, endDate: p2End, ...(selectedFundId ? { fundId: selectedFundId } : {}) } }),
      ]);
      setCompareData({ p1: r1.data.data, p2: r2.data.data });
    } catch (e: any) {
      setCompareError(e.response?.data?.error || "Failed to fetch comparison data.");
    } finally {
      setCompareLoading(false);
    }
  }, [p1Start, p1End, p2Start, p2End, selectedFundId]);

  useEffect(() => {
    api.get("/funds").then((res) => {
      if (res.data.success) setFunds(res.data.data.funds || []);
    }).catch(() => {
      // Funds are an optional nonprofit feature - silently show none rather
      // than blocking the report if this fails for an unconfigured tenant.
    });
  }, []);

  const {
    revenueAccounts,
    costOfSalesAccounts,
    expenseAccounts,
    totalRevenue,
    totalCostOfSales,
    grossProfit,
    totalExpense,
    netIncome
  } = useProfitAndLoss(selectedFundId || undefined);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings.baseCurrency,
    }).format(amount);
  };

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleExport = () => {
    const exportData = [
      ...revenueAccounts.map(r => ({ Category: labels.incomeSection, Account: r.account.name, Balance: r.balance })),
      ...costOfSalesAccounts.map(c => ({ Category: labels.costOfSalesSection, Account: c.account.name, Balance: c.balance })),
      { Category: 'Total', Account: labels.grossProfit, Balance: grossProfit },
      ...expenseAccounts.map(e => ({ Category: labels.expensesSection, Account: e.account.name, Balance: e.balance })),
      { Category: 'Total', Account: labels.netSurplus(netIncome), Balance: netIncome }
    ];
    exportToCsv(`profit_and_loss_${new Date().toISOString().split('T')[0]}`, exportData);
  };

  const handleExportFile = async (format: "pdf" | "docx") => {
    setIsExporting(format);
    try {
      const fundParam = selectedFundId ? `&fundId=${selectedFundId}` : "";
      const response = await api.get(`/reports/profit-loss/export?format=${format}${fundParam}`, { responseType: "blob" });
      downloadBlobResponse(response, `Profit_And_Loss_${new Date().toISOString().split('T')[0]}.${format}`);
    } catch (err) {
      console.error(`Failed to export Profit & Loss as ${format}:`, err);
      showToast(`Failed to export Profit & Loss as ${format.toUpperCase()}.`, "error");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
            Profit and Loss
          </h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            Review your income and expenses to determine net profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={compareMode ? "primary" : "outline"}
            onClick={() => { setCompareMode((m) => !m); setCompareData(null); setCompareError(null); }}
          >
            <Columns2 className="mr-2 h-4 w-4" />
            {compareMode ? "Single Period" : "Compare Periods"}
          </Button>
          {!compareMode && (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" disabled={isExporting === "pdf"} onClick={() => handleExportFile("pdf")}>
                <FileText className="mr-2 h-4 w-4 text-primary-600" />
                {isExporting === "pdf" ? "Exporting..." : "Export PDF"}
              </Button>
              <Button variant="outline" disabled={isExporting === "docx"} onClick={() => handleExportFile("docx")}>
                <FileType className="mr-2 h-4 w-4 text-blue-600" />
                {isExporting === "docx" ? "Exporting..." : "Export Word"}
              </Button>
              <Button variant="primary" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {funds.length > 0 && (
        <div className="print:hidden">
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            Filter by Fund
          </label>
          <select
            value={selectedFundId}
            onChange={(e) => setSelectedFundId(e.target.value)}
            className="flex h-10 w-full sm:w-80 rounded-md border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-secondary-700 dark:bg-secondary-950 dark:text-secondary-50"
          >
            <option value="">All Funds</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name} ({fund.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Compare Periods UI ─────────────────────────────────── */}
      {compareMode && (
        <div className="print:hidden space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Period 1 */}
            <div className="border rounded-lg p-4 space-y-3 bg-secondary-50 dark:bg-secondary-900">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide">Period 1 Label</label>
                <input
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  value={p1Label}
                  onChange={(e) => setP1Label(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">From</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={p1Start} onChange={(e) => setP1Start(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">To</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={p1End} onChange={(e) => setP1End(e.target.value)} />
                </div>
              </div>
            </div>
            {/* Period 2 */}
            <div className="border rounded-lg p-4 space-y-3 bg-secondary-50 dark:bg-secondary-900">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide">Period 2 Label</label>
                <input
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  value={p2Label}
                  onChange={(e) => setP2Label(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">From</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={p2Start} onChange={(e) => setP2Start(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">To</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={p2End} onChange={(e) => setP2End(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {compareError && (
            <p className="text-sm text-destructive">{compareError}</p>
          )}

          <Button onClick={fetchCompare} disabled={compareLoading}>
            {compareLoading ? "Loading…" : "Run Comparison"}
          </Button>

          {compareData && (
            <div className="bg-white dark:bg-secondary-950 shadow-sm border border-secondary-200 dark:border-secondary-800 rounded-xl p-6 overflow-x-auto">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 pb-3 mb-3 border-b border-secondary-200 dark:border-secondary-700">
                <span className="text-xs font-bold uppercase tracking-wide text-secondary-500">Account</span>
                <span className="text-xs font-bold uppercase tracking-wide text-right w-28 text-secondary-700">{p1Label}</span>
                <span className="text-xs font-bold uppercase tracking-wide text-right w-28 text-secondary-700">{p2Label}</span>
                <span className="text-xs font-bold uppercase tracking-wide text-right w-28 text-secondary-500">Variance</span>
                <span className="text-xs font-bold uppercase tracking-wide text-right w-20 text-secondary-500">%</span>
              </div>

              <div className="space-y-1">
                {/* Income */}
                <p className="text-xs font-bold uppercase tracking-wider text-secondary-500 mt-3 mb-1">{labels.incomeSection}</p>
                {compareData.p1.revenues.map((r) => {
                  const p2row = compareData.p2.revenues.find((x) => x.id === r.id);
                  return <CompareRow key={r.id} label={r.name} p1={r.amount} p2={p2row?.amount ?? 0} currency={settings.baseCurrency} />;
                })}
                {compareData.p2.revenues.filter((r) => !compareData.p1.revenues.find((x) => x.id === r.id)).map((r) => (
                  <CompareRow key={r.id} label={r.name} p1={0} p2={r.amount} currency={settings.baseCurrency} />
                ))}
                <CompareRow label={labels.totalIncome} p1={compareData.p1.totalRevenue} p2={compareData.p2.totalRevenue} currency={settings.baseCurrency} isTotal isBold />

                {/* Cost of Sales */}
                {(compareData.p1.costOfSales.length > 0 || compareData.p2.costOfSales.length > 0) && (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary-500 mt-4 mb-1">{labels.costOfSalesSection}</p>
                    {compareData.p1.costOfSales.map((r) => {
                      const p2row = compareData.p2.costOfSales.find((x) => x.id === r.id);
                      return <CompareRow key={r.id} label={r.name} p1={r.amount} p2={p2row?.amount ?? 0} currency={settings.baseCurrency} />;
                    })}
                    {compareData.p2.costOfSales.filter((r) => !compareData.p1.costOfSales.find((x) => x.id === r.id)).map((r) => (
                      <CompareRow key={r.id} label={r.name} p1={0} p2={r.amount} currency={settings.baseCurrency} />
                    ))}
                    <CompareRow label={labels.grossProfit} p1={compareData.p1.grossProfit} p2={compareData.p2.grossProfit} currency={settings.baseCurrency} isTotal isBold />
                  </>
                )}

                {/* Expenses */}
                <p className="text-xs font-bold uppercase tracking-wider text-secondary-500 mt-4 mb-1">{labels.expensesSection}</p>
                {compareData.p1.expenses.map((r) => {
                  const p2row = compareData.p2.expenses.find((x) => x.id === r.id);
                  return <CompareRow key={r.id} label={r.name} p1={r.amount} p2={p2row?.amount ?? 0} currency={settings.baseCurrency} />;
                })}
                {compareData.p2.expenses.filter((r) => !compareData.p1.expenses.find((x) => x.id === r.id)).map((r) => (
                  <CompareRow key={r.id} label={r.name} p1={0} p2={r.amount} currency={settings.baseCurrency} />
                ))}
                <CompareRow label={labels.totalExpenses} p1={compareData.p1.totalExpenses} p2={compareData.p2.totalExpenses} currency={settings.baseCurrency} isTotal isBold />

                {/* Net Profit */}
                <CompareRow label={labels.netSurplus(compareData.p1.netProfit)} p1={compareData.p1.netProfit} p2={compareData.p2.netProfit} currency={settings.baseCurrency} isProfit />
              </div>
            </div>
          )}
        </div>
      )}

      {!compareMode && <div className="bg-white dark:bg-secondary-950 shadow-sm border border-secondary-200 dark:border-secondary-800 rounded-xl p-8 sm:p-12 print:shadow-none print:border-none print:p-0">

        {/* Report Header */}
        <div className="text-center mb-10 border-b border-secondary-200 dark:border-secondary-800 pb-6">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50 tracking-tight uppercase">
            {settings.companyName}
          </h1>
          <h2 className="text-xl text-secondary-600 dark:text-secondary-400 mt-1">
            {labels.reportTitle}
          </h2>
          <p className="text-sm text-secondary-500 dark:text-secondary-500 mt-2">
            As of {today}
          </p>
          <p className="text-xs text-secondary-400 mt-1">
            All figures are reported in {settings.baseCurrency}
          </p>
        </div>

        {/* Report Body */}
        <div className="space-y-8 text-sm">
          
          {/* Income Section */}
          <section>
            <h3 className="font-bold text-lg text-secondary-900 dark:text-secondary-50 border-b border-secondary-200 dark:border-secondary-800 pb-2 mb-4">
              {labels.incomeSection}
            </h3>
            <div className="space-y-3 pl-4">
              {revenueAccounts.length === 0 ? (
                <div className="text-secondary-500 italic">No revenue activity to report.</div>
              ) : (
                revenueAccounts.map((row) => (
                  <div key={row.account.id} className="flex justify-between items-center text-secondary-700 dark:text-secondary-300">
                    <span className="flex-1">{row.account.name}</span>
                    <span className="w-32 text-right tabular-nums">{formatCurrency(row.balance)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-800 font-bold text-secondary-900 dark:text-secondary-50 pl-4">
              <span className="flex-1 uppercase tracking-wider text-xs">{labels.totalIncome}</span>
              <span className="w-32 text-right tabular-nums">{formatCurrency(totalRevenue)}</span>
            </div>
          </section>

          {/* Cost of Sales Section */}
          {costOfSalesAccounts.length > 0 && (
            <section>
              <h3 className="font-bold text-lg text-secondary-900 dark:text-secondary-50 border-b border-secondary-200 dark:border-secondary-800 pb-2 mb-4">
                {labels.costOfSalesSection}
              </h3>
              <div className="space-y-3 pl-4">
                {costOfSalesAccounts.map((row) => (
                  <div key={row.account.id} className="flex justify-between items-center text-secondary-700 dark:text-secondary-300">
                    <span className="flex-1">{row.account.name}</span>
                    <span className="w-32 text-right tabular-nums">{formatCurrency(row.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-800 font-bold text-secondary-900 dark:text-secondary-50 pl-4">
                <span className="flex-1 uppercase tracking-wider text-xs">{labels.totalCostOfSales}</span>
                <span className="w-32 text-right tabular-nums">{formatCurrency(totalCostOfSales)}</span>
              </div>
            </section>
          )}

          {/* Gross Profit Subtotal - only shown once Cost of Sales is in use,
              otherwise it would just duplicate Total Income and add noise. */}
          {costOfSalesAccounts.length > 0 && (
            <section className="pt-2">
              <div className="flex justify-between items-center text-base font-bold text-secondary-900 dark:text-secondary-50 border-t-2 border-secondary-300 dark:border-secondary-700 pt-3">
                <span className="flex-1 uppercase tracking-wider text-xs">{labels.grossProfit}</span>
                <span className="w-32 text-right tabular-nums">{formatCurrency(grossProfit)}</span>
              </div>
            </section>
          )}

          {/* Expenses Section */}
          <section>
            <h3 className="font-bold text-lg text-secondary-900 dark:text-secondary-50 border-b border-secondary-200 dark:border-secondary-800 pb-2 mb-4">
              {labels.expensesSection}
            </h3>
            <div className="space-y-3 pl-4">
              {expenseAccounts.length === 0 ? (
                <div className="text-secondary-500 italic">No expense activity to report.</div>
              ) : (
                expenseAccounts.map((row) => (
                  <div key={row.account.id} className="flex justify-between items-center text-secondary-700 dark:text-secondary-300">
                    <span className="flex-1">{row.account.name}</span>
                    <span className="w-32 text-right tabular-nums">{formatCurrency(row.balance)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-800 font-bold text-secondary-900 dark:text-secondary-50 pl-4">
              <span className="flex-1 uppercase tracking-wider text-xs">{labels.totalExpenses}</span>
              <span className="w-32 text-right tabular-nums">{formatCurrency(totalExpense)}</span>
            </div>
          </section>

          {/* Net Income Section */}
          <section className="pt-8 mt-8 border-t-2 border-secondary-900 dark:border-secondary-50">
            <div className={`flex justify-between items-center text-xl font-black ${netIncome >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              <span className="flex-1 uppercase tracking-widest">{labels.netSurplus(netIncome)}</span>
              <span className="w-48 text-right tabular-nums double-underline decoration-double border-b-4 border-double pb-1">
                {formatCurrency(netIncome)}
              </span>
            </div>
          </section>

        </div>
      </div>}
    </div>
  );
}
