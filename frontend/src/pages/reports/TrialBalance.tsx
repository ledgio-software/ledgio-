import { useState } from "react";
import { RefreshCw, FileText, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { exportToCsv } from "../../lib/exportCsv";

interface TrialBalanceAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalanceReport {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export function TrialBalance() {
  const { settings } = useTenantSettings();
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: settings.baseCurrency || "GHS" }).format(n);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await api.get(`/reports/trial-balance?${params.toString()}`);
      if (res.data.success) setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load Trial Balance.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!report) return;
    exportToCsv(`trial_balance_${endDate || "all"}`, report.accounts.map((a) => ({
      Code: a.code,
      Account: a.name,
      Type: a.type,
      Debit: a.debit,
      Credit: a.credit,
    })));
  };

  const typeLabel: Record<string, string> = {
    ASSET: "Asset", LIABILITY: "Liability", EQUITY: "Equity",
    REVENUE: "Revenue", EXPENSE: "Expense", COST_OF_SALES: "Cost of Sales",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Trial Balance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All account debit and credit balances — total debits must equal total credits
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-gray-300">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          />
          <label className="text-sm text-gray-600 dark:text-gray-300">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          />
          <button
            onClick={fetchReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Run
          </button>
          <button
            onClick={handleExport}
            disabled={!report}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <FileText size={14} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Select a date range and click <strong>Run</strong> to generate the Trial Balance.
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading Trial Balance…</div>
      )}

      {!loading && report && (
        <>
          {/* Balance status banner */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium ${
            report.isBalanced
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          }`}>
            {report.isBalanced
              ? <><CheckCircle2 size={15} /> Trial Balance is balanced — Total Debits = Total Credits</>
              : <><AlertTriangle size={15} /> Trial Balance is OUT OF BALANCE — check for posting errors</>
            }
          </div>

          {/* Table */}
          <div className="border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 overflow-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 w-24">Code</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">Account Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 w-32">Type</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 w-36">Debit</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 w-36">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {report.accounts.filter((a) => a.debit !== 0 || a.credit !== 0).map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{typeLabel[a.type] ?? a.type}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {a.debit > 0 ? fmt(a.debit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {a.credit > 0 ? fmt(a.credit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-700/50 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(report.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(report.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {report.accounts.filter((a) => a.debit === 0 && a.credit === 0).length > 0 && (
            <p className="text-xs text-gray-400 text-right">
              {report.accounts.filter((a) => a.debit === 0 && a.credit === 0).length} accounts with zero balance are hidden.
            </p>
          )}
        </>
      )}
    </div>
  );
}
