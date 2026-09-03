import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, Download } from "lucide-react";
import { api } from "../../lib/api";
import { exportToCsv } from "../../lib/exportCsv";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { UpgradeRequired } from "../../components/UpgradeRequired";

type Tab = "duplicate-payments" | "round-amounts";

interface DuplicatePaymentGroup {
  vendorName: string;
  amount: string;
  paymentDate: string;
  count: number;
  paymentIds: string[];
}

interface RoundAmountTransaction {
  journalEntryId: string;
  lineId: string;
  amount: string;
  description: string | null;
  entryDate: string;
  accountName: string | null;
}

export function FraudAlerts() {
  const { settings, isLoading: isLoadingTenantSettings } = useTenantSettings();
  const today = new Date().toISOString().split("T")[0];
  const yearStart = today.slice(0, 4) + "-01-01";

  const [tab, setTab] = useState<Tab>("duplicate-payments");
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [minAmount, setMinAmount] = useState("500");
  const [roundingThreshold, setRoundingThreshold] = useState("100");

  const [dupPayments, setDupPayments] = useState<DuplicatePaymentGroup[]>([]);
  const [roundAmounts, setRoundAmounts] = useState<RoundAmountTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/reports/fraud/duplicate-payments?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.data.success) setDupPayments(res.data.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load duplicate payment analysis.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundAmounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/reports/fraud/round-amounts?minAmount=${minAmount}&roundingThreshold=${roundingThreshold}&startDate=${startDate}&endDate=${endDate}`
      );
      if (res.data.success) setRoundAmounts(res.data.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load round-amount analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoadingTenantSettings || settings.tier < 2) return;
    if (tab === "duplicate-payments") fetchDuplicates();
    else fetchRoundAmounts();
  }, [tab, startDate, endDate, minAmount, roundingThreshold, isLoadingTenantSettings, settings.tier]); // eslint-disable-line

  const handleExport = () => {
    if (tab === "duplicate-payments") {
      exportToCsv(
        "duplicate_payments",
        dupPayments.map((r) => ({
          Customer: r.vendorName,
          Amount: r.amount,
          "Payment Date": r.paymentDate,
          "Duplicate Count": r.count,
        }))
      );
    } else {
      exportToCsv(
        "round_amount_transactions",
        roundAmounts.map((r) => ({
          "Journal Entry": r.journalEntryId,
          Account: r.accountName ?? "",
          Description: r.description ?? "",
          Amount: r.amount,
          Date: r.entryDate,
        }))
      );
    }
  };

  const noData =
    tab === "duplicate-payments" ? dupPayments.length === 0 : roundAmounts.length === 0;

  if (isLoadingTenantSettings) return <div className="py-8 text-center text-secondary-500">Loading…</div>;
  if (settings.tier < 2) return <UpgradeRequired featureLabel="Fraud Alerts" requiredTier={2} currentTier={settings.tier} />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Fraud Alerts</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(
          [
            { id: "duplicate-payments", label: "Duplicate Payments" },
            { id: "round-amounts", label: "Round-Amount Transactions" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        {tab === "round-amounts" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Round Multiple</label>
              <input
                type="number"
                value={roundingThreshold}
                onChange={(e) => setRoundingThreshold(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() =>
              tab === "duplicate-payments" ? fetchDuplicates() : fetchRoundAmounts()
            }
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={noData}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {tab === "duplicate-payments" ? (
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Customer / Vendor</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Payment Date</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : dupPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No duplicate payments detected for this period.
                  </td>
                </tr>
              ) : (
                dupPayments.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{row.vendorName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.paymentDate}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        ×{row.count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : roundAmounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No round-amount transactions found for these filters.
                  </td>
                </tr>
              ) : (
                roundAmounts.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.entryDate}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{row.accountName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.description ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                      {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!noData && (
        <p className="mt-3 text-xs text-gray-400">
          {tab === "duplicate-payments"
            ? `${dupPayments.length} duplicate group(s) found.`
            : `${roundAmounts.length} transaction(s) found (capped at 500).`}
        </p>
      )}
    </div>
  );
}
