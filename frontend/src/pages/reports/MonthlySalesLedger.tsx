import { useState, useEffect, useCallback } from "react";
import {
  CalendarClock, ChevronDown, ChevronRight, Lock, Trophy,
  ShoppingCart, FileText, Download, RefreshCw
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useTenantSettings } from "../../contexts/TenantSettingsContext";
import { useAuth } from "../../contexts/AuthContext";

interface LedgerLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface LedgerTransaction {
  id: string;
  type: "POS" | "INVOICE";
  ref: string;
  date: string;
  customerName: string | null;
  companyName: string | null;
  paymentMethod: string | null;
  status: string;
  total: number;
  lines: LedgerLine[];
}

interface DaySummary {
  date: string;
  transactions: LedgerTransaction[];
  dayTotal: number;
}

interface MonthLedger {
  year: number;
  month: number;
  currency: string;
  totalSales: number;
  totalCashSales: number;
  totalCreditSales: number;
  transactionCount: number;
  days: DaySummary[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

interface MonthCloseRecord {
  id: string;
  year: number;
  month: number;
  closedAt: string;
  closedByName: string | null;
  totalSales: number;
  totalCashSales: number;
  totalCreditSales: number;
  transactionCount: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  summary: { vsLastMonth?: { totalSalesDiff: number; pctChange: number | null } | null };
  rank?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-amber-400 text-amber-900",
    2: "bg-gray-300 text-gray-800",
    3: "bg-orange-400 text-orange-900",
  };
  const cls = colors[rank] ?? "bg-secondary-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {rank <= 3 && <Trophy className="h-3 w-3" />}#{rank}
    </span>
  );
}

export function MonthlySalesLedger() {
  const { settings } = useTenantSettings();
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [ledger, setLedger] = useState<MonthLedger | null>(null);
  const [closes, setCloses] = useState<MonthCloseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedTxns, setExpandedTxns] = useState<Set<string>>(new Set());

  const currency = settings?.baseCurrency || "GHS";
  const canClose = user?.role === "Admin" || user?.role === "Accountant";

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await api.get(`/reports/monthly-sales-ledger?year=${year}&month=${month}`);
      if (res.data.success) setLedger(res.data.data);
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to load ledger."}`);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  const fetchCloses = useCallback(async () => {
    try {
      const res = await api.get("/reports/month-closes");
      if (res.data.success) setCloses(res.data.data);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    fetchCloses();
  }, [fetchCloses]);

  const handleClose = async () => {
    if (!window.confirm(`Save records for ${MONTH_NAMES[month - 1]} ${year}? This creates a permanent snapshot.`)) return;
    setIsClosing(true);
    setMessage(null);
    try {
      const res = await api.post("/reports/month-close", { year, month });
      if (res.data.success) {
        setMessage(`✅ Records saved for ${MONTH_NAMES[month - 1]} ${year}.`);
        fetchCloses();
      }
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to save records."}`);
    } finally {
      setIsClosing(false);
    }
  };

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const toggleTxn = (id: string) => {
    setExpandedTxns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!ledger) return;
    setExpandedDays(new Set(ledger.days.map((d) => d.date)));
    setExpandedTxns(new Set(ledger.days.flatMap((d) => d.transactions.map((t) => t.id))));
  };

  const collapseAll = () => {
    setExpandedDays(new Set());
    setExpandedTxns(new Set());
  };

  const closedRecord = closes.find((c) => c.year === year && c.month === month);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
            Monthly Sales Ledger
          </h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            Every sale, every line — reconcile your physical book against the system instantly.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="h-9 px-3 rounded-md border border-secondary-300 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
          <select
            className="h-9 px-3 rounded-md border border-secondary-300 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="secondary" onClick={fetchLedger} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-secondary-50 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 rounded-lg text-xs">
          {message}
        </div>
      )}

      {/* Summary cards */}
      {ledger && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-secondary-500">Total Sales</p>
              <p className="text-xl font-bold text-secondary-900 dark:text-secondary-50">{fmt(ledger.totalSales, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-secondary-500">Cash / POS</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(ledger.totalCashSales, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-secondary-500">Credit (AR)</p>
              <p className="text-xl font-bold text-blue-600">{fmt(ledger.totalCreditSales, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-secondary-500">Transactions</p>
              <p className="text-xl font-bold text-secondary-900 dark:text-secondary-50">{ledger.transactionCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {canClose && (
          <Button variant="primary" onClick={handleClose} disabled={isClosing}>
            <Lock className="h-4 w-4 mr-1" />
            {isClosing ? "Saving..." : closedRecord ? "Re-save Records" : "Save Records for This Month"}
          </Button>
        )}
        {closedRecord && (
          <span className="text-xs text-secondary-500 dark:text-secondary-400 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Saved {new Date(closedRecord.closedAt).toLocaleDateString()}
            {closedRecord.closedByName && ` by ${closedRecord.closedByName}`}
          </span>
        )}
        {ledger && ledger.days.length > 0 && (
          <>
            <Button variant="secondary" onClick={expandAll}>Expand All</Button>
            <Button variant="secondary" onClick={collapseAll}>Collapse</Button>
          </>
        )}
      </div>

      {/* Day-by-day ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary-600" />
            {MONTH_NAMES[month - 1]} {year} — Day by Day
          </CardTitle>
          <CardDescription>Each row is a sale. Click a day to expand. Click a transaction to see line items.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-secondary-500 py-8 text-center">Loading...</div>
          ) : !ledger || ledger.days.length === 0 ? (
            <div className="text-xs text-secondary-500 py-8 text-center">No sales recorded for this month.</div>
          ) : (
            <div className="space-y-2">
              {ledger.days.map((day) => {
                const isExpanded = expandedDays.has(day.date);
                const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-GH", {
                  weekday: "short", day: "2-digit", month: "short"
                });
                return (
                  <div key={day.date} className="border border-secondary-200 dark:border-secondary-700 rounded-lg overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => toggleDay(day.date)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-secondary-50 dark:bg-secondary-800 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-secondary-500" /> : <ChevronRight className="h-4 w-4 text-secondary-500" />}
                        <span className="font-semibold text-sm text-secondary-900 dark:text-secondary-50">{dateLabel}</span>
                        <span className="text-xs text-secondary-500">{day.transactions.length} sale{day.transactions.length !== 1 ? "s" : ""}</span>
                      </div>
                      <span className="font-bold text-sm text-secondary-900 dark:text-secondary-50">{fmt(day.dayTotal, currency)}</span>
                    </button>

                    {/* Transaction list */}
                    {isExpanded && (
                      <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
                        {day.transactions.map((txn) => {
                          const isTxnExpanded = expandedTxns.has(txn.id);
                          return (
                            <div key={txn.id}>
                              <button
                                onClick={() => toggleTxn(txn.id)}
                                className="w-full flex items-start justify-between px-6 py-3 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 transition-colors text-left"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  {isTxnExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-secondary-400 mt-0.5 shrink-0" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-secondary-400 mt-0.5 shrink-0" />
                                  }
                                  <div className="flex items-center gap-2 shrink-0">
                                    {txn.type === "POS"
                                      ? <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
                                      : <FileText className="h-3.5 w-3.5 text-blue-500" />
                                    }
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${txn.type === "POS" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                      {txn.type}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-secondary-800 dark:text-secondary-200">{txn.ref}</div>
                                    {(txn.customerName || txn.companyName) && (
                                      <div className="text-xs text-secondary-500 truncate">
                                        {txn.companyName
                                          ? <><span className="font-semibold text-secondary-700 dark:text-secondary-300">{txn.companyName}</span>{txn.customerName && ` · ${txn.customerName}`}</>
                                          : txn.customerName
                                        }
                                      </div>
                                    )}
                                    {txn.paymentMethod && (
                                      <div className="text-xs text-secondary-400">{txn.paymentMethod}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 pl-4">
                                  <div className="text-sm font-semibold text-secondary-900 dark:text-secondary-50">{fmt(txn.total, currency)}</div>
                                  <div className={`text-xs ${txn.status === "COMPLETED" || txn.status === "PAID" ? "text-emerald-500" : txn.status === "PENDING" ? "text-amber-500" : "text-secondary-400"}`}>
                                    {txn.status}
                                  </div>
                                </div>
                              </button>

                              {/* Line items */}
                              {isTxnExpanded && (
                                <div className="px-16 pb-3">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-secondary-400 border-b border-secondary-100 dark:border-secondary-700">
                                        <th className="text-left py-1 font-normal">Item</th>
                                        <th className="text-right py-1 font-normal">Qty</th>
                                        <th className="text-right py-1 font-normal">Unit Price</th>
                                        <th className="text-right py-1 font-normal">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {txn.lines.map((l, li) => (
                                        <tr key={li} className="border-b border-secondary-50 dark:border-secondary-800/50">
                                          <td className="py-1 text-secondary-700 dark:text-secondary-300">{l.description}</td>
                                          <td className="py-1 text-right tabular-nums text-secondary-600 dark:text-secondary-400">{l.quantity}</td>
                                          <td className="py-1 text-right tabular-nums text-secondary-600 dark:text-secondary-400">{fmt(l.unitPrice, currency)}</td>
                                          <td className="py-1 text-right tabular-nums font-medium text-secondary-800 dark:text-secondary-200">{fmt(l.lineTotal, currency)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best-selling products */}
      {ledger && ledger.topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Products — {MONTH_NAMES[month - 1]} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-secondary-500 border-b border-secondary-200 dark:border-secondary-800">
                  <th className="py-2">#</th>
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Qty Sold</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {ledger.topProducts.map((p, i) => (
                  <tr key={p.name} className="border-b border-secondary-100 dark:border-secondary-800">
                    <td className="py-2 tabular-nums text-secondary-400">{i + 1}</td>
                    <td className="py-2 font-medium text-secondary-800 dark:text-secondary-200">{p.name}</td>
                    <td className="py-2 text-right tabular-nums text-secondary-600 dark:text-secondary-400">{p.qty}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-secondary-900 dark:text-secondary-50">{fmt(p.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Month performance ranking */}
      {closes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary-600" />
              Performance Ranking — All Saved Months
            </CardTitle>
            <CardDescription>Months ranked by total revenue. Best months at the top.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-secondary-500 border-b border-secondary-200 dark:border-secondary-800">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Total Sales</th>
                  <th className="py-2 text-right">Cash</th>
                  <th className="py-2 text-right">Credit (AR)</th>
                  <th className="py-2 text-right">Txns</th>
                  <th className="py-2 text-right">vs Prior</th>
                </tr>
              </thead>
              <tbody>
                {[...closes].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((c) => {
                  const diff = c.summary?.vsLastMonth?.totalSalesDiff;
                  const pct = c.summary?.vsLastMonth?.pctChange;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-secondary-100 dark:border-secondary-800 ${c.year === year && c.month === month ? "bg-primary-50 dark:bg-primary-900/10" : ""}`}
                    >
                      <td className="py-2">{c.rank ? <RankBadge rank={c.rank} /> : "—"}</td>
                      <td className="py-2 font-medium text-secondary-800 dark:text-secondary-200">
                        {MONTH_NAMES[c.month - 1]} {c.year}
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold text-secondary-900 dark:text-secondary-50">{fmt(c.totalSales, currency)}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-600">{fmt(c.totalCashSales, currency)}</td>
                      <td className="py-2 text-right tabular-nums text-blue-600">{fmt(c.totalCreditSales, currency)}</td>
                      <td className="py-2 text-right tabular-nums text-secondary-500">{c.transactionCount}</td>
                      <td className="py-2 text-right tabular-nums">
                        {diff != null ? (
                          <span className={diff >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {diff >= 0 ? "+" : ""}{fmt(diff, currency)}
                            {pct != null && ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`}
                          </span>
                        ) : (
                          <span className="text-secondary-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
