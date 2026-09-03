import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../../lib/api";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { UpgradeRequired } from "../../components/UpgradeRequired";

interface RatioValue {
  value: number | null;
  label: string;
  lowerIsBetter: boolean;
  isPercent?: boolean;
}

interface FinancialRatiosReport {
  asOfDate: string;
  startDate: string | null;
  endDate: string | null;
  balanceTotals: { totalAssets: number; totalLiabilities: number; totalEquity: number };
  incomeTotals: { revenue: number; netProfit: number };
  ratios: {
    solvency: Record<string, RatioValue>;
    profitability: Record<string, RatioValue>;
    efficiency: Record<string, RatioValue>;
  };
  note: string;
}

function RatioCard({ ratio }: { ratio: RatioValue }) {
  const { value, label, lowerIsBetter, isPercent } = ratio;
  const formatted = value === null ? "N/A" : isPercent ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);

  let colorClass = "text-gray-500";
  let Icon = Minus;
  if (value !== null) {
    const isGood = lowerIsBetter ? value < 1 : value > 0;
    colorClass = isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    Icon = isGood ? TrendingUp : TrendingDown;
  }

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700 flex flex-col gap-1">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-2xl font-semibold ${value === null ? "text-gray-400" : colorClass}`}>{formatted}</span>
        {value !== null && <Icon size={16} className={colorClass} />}
      </div>
      {value !== null && (
        <p className="text-xs text-gray-400">{lowerIsBetter ? "Lower is better" : "Higher is better"}</p>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mt-2">{title}</h2>;
}

export function FinancialRatios() {
  const { settings, isLoading: isLoadingTenantSettings } = useTenantSettings();
  const [report, setReport] = useState<FinancialRatiosReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const firstOfYear = today.slice(0, 4) + "-01-01";
  const [startDate, setStartDate] = useState(firstOfYear);
  const [endDate, setEndDate] = useState(today);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/financial-ratios?startDate=${startDate}&endDate=${endDate}&asOfDate=${endDate}`);
      if (res.data.success) setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load Financial Ratios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingTenantSettings && settings.tier >= 2) fetchReport();
  }, [startDate, endDate, isLoadingTenantSettings, settings.tier]); // eslint-disable-line

  if (isLoadingTenantSettings) return <div className="py-8 text-center text-secondary-500">Loading…</div>;
  if (settings.tier < 2) return <UpgradeRequired featureLabel="Financial Ratio Analysis" requiredTier={2} currentTier={settings.tier} />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-secondary-50">Financial Ratio Analysis</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Solvency, profitability, and efficiency ratios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          <span className="text-gray-500 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          <button onClick={fetchReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading Financial Ratios…</div>}

      {!loading && report && (
        <>
          <SectionHeader title="Solvency" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.values(report.ratios.solvency).map((r, i) => <RatioCard key={i} ratio={r} />)}
          </div>

          <SectionHeader title="Profitability" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.values(report.ratios.profitability).map((r, i) => <RatioCard key={i} ratio={r} />)}
          </div>

          <SectionHeader title="Efficiency" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.values(report.ratios.efficiency).map((r, i) => <RatioCard key={i} ratio={r} />)}
          </div>

          {/* Note */}
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-800 dark:text-blue-300">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{report.note}</p>
          </div>
        </>
      )}
    </div>
  );
}
