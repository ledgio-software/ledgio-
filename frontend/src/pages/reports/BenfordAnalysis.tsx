import { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "../../lib/api";
import { exportToCsv } from "../../lib/exportCsv";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { UpgradeRequired } from "../../components/UpgradeRequired";

interface BenfordDigitResult {
  digit: number;
  expected: number;
  actual: number;
  count: number;
  zScore: number;
  flagged: boolean;
}

interface BenfordReport {
  totalTransactions: number;
  digits: BenfordDigitResult[];
  chiSquare: number;
  overallFlagged: boolean;
  startDate?: string;
  endDate?: string;
}

const BAR_MAX_WIDTH = 220; // px

export function BenfordAnalysis() {
  const { settings, isLoading: isLoadingTenantSettings } = useTenantSettings();
  const [report, setReport] = useState<BenfordReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const yearStart = today.slice(0, 4) + "-01-01";
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/benford-analysis?startDate=${startDate}&endDate=${endDate}`);
      if (res.data.success) setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load Benford analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingTenantSettings && settings.tier >= 2) fetchReport();
  }, [startDate, endDate, isLoadingTenantSettings, settings.tier]); // eslint-disable-line

  const handleExport = () => {
    if (!report) return;
    exportToCsv(`benford_analysis_${startDate}_to_${endDate}`, report.digits.map((d) => ({
      "Leading Digit": d.digit,
      "Expected %": (d.expected * 100).toFixed(1),
      "Actual %": (d.actual * 100).toFixed(1),
      "Count": d.count,
      "Z-Score": d.zScore,
      "Flagged": d.flagged ? "YES" : "no",
    })));
  };

  const maxActual = report ? Math.max(...report.digits.map((d) => Math.max(d.actual, d.expected))) : 0.32;

  if (isLoadingTenantSettings) return <div className="py-8 text-center text-secondary-500">Loading…</div>;
  if (settings.tier < 2) return <UpgradeRequired featureLabel="Benford's Law Analysis" requiredTier={2} currentTier={settings.tier} />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-amber-500" size={26} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Benford's Law Analysis</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Leading-digit distribution of posted journal amounts — significant deviation may indicate fabricated transactions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <span className="text-gray-500 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <button onClick={fetchReport} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
          {report && (
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
              Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Transactions analysed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.totalTransactions.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Chi-square statistic</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.chiSquare.toFixed(2)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Critical value (df=8, p=0.05): 15.51</p>
            </div>
            <div className={`rounded-lg p-4 border ${report.overallFlagged
              ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
              : "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Overall result</p>
              <div className="flex items-center gap-2">
                {report.overallFlagged
                  ? <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                  : <CheckCircle size={20} className="text-green-600 dark:text-green-400" />}
                <p className={`text-lg font-semibold ${report.overallFlagged ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                  {report.overallFlagged ? "Anomaly detected" : "Conforms to Benford"}
                </p>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Leading-Digit Distribution</h2>
            <div className="space-y-3">
              {report.digits.map((d) => {
                const expectedPx = Math.round((d.expected / maxActual) * BAR_MAX_WIDTH);
                const actualPx = Math.round((d.actual / maxActual) * BAR_MAX_WIDTH);
                return (
                  <div key={d.digit} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-right">{d.digit}</span>
                    <div className="relative flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                      {/* Expected bar (Benford) */}
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-900 rounded"
                        style={{ width: expectedPx }}
                        title={`Expected ${(d.expected * 100).toFixed(1)}%`}
                      />
                      {/* Actual bar */}
                      <div
                        className={`absolute top-1 left-0 h-5 rounded ${d.flagged ? "bg-red-500" : "bg-blue-500"}`}
                        style={{ width: actualPx }}
                        title={`Actual ${(d.actual * 100).toFixed(1)}%`}
                      />
                    </div>
                    <span className="w-12 text-xs text-right text-gray-500 dark:text-gray-400 font-mono">
                      {(d.actual * 100).toFixed(1)}%
                    </span>
                    <span className="w-12 text-xs text-right text-blue-500 dark:text-blue-400 font-mono">
                      {(d.expected * 100).toFixed(1)}%
                    </span>
                    {d.flagged && (
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 w-16">
                        Z={d.zScore}
                      </span>
                    )}
                    {!d.flagged && <span className="w-16" />}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200 dark:bg-blue-900" /> Expected (Benford)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-500" /> Actual (normal)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500" /> Actual (flagged, |Z|&gt;1.96)</span>
            </div>
          </div>

          {/* Detail table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Digit</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Count</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Actual %</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Expected %</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Z-Score</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {report.digits.map((d) => (
                  <tr key={d.digit} className={d.flagged ? "bg-red-50 dark:bg-red-900/10" : ""}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800 dark:text-gray-200">{d.digit}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{d.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{(d.actual * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-600 dark:text-blue-400">{(d.expected * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{d.zScore.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {d.flagged
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertTriangle size={10} /> Flagged</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><CheckCircle size={10} /> OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Benford's Law applies to naturally occurring datasets spanning multiple orders of magnitude. False positives occur with small samples (&lt;300 transactions), sequentially-assigned amounts, or data restricted to a narrow range. A flagged digit warrants investigation, not automatic accusation.
          </p>
        </>
      )}

      {!report && !loading && !error && (
        <div className="text-center py-16 text-gray-400">No data loaded.</div>
      )}
    </div>
  );
}
