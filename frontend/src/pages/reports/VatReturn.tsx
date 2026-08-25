import { useState, useEffect } from "react";
import { FileText, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { exportToCsv } from "../../lib/exportCsv";

interface VatLine {
  taxRateName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

interface VatReturn {
  startDate: string | null;
  endDate: string | null;
  outputVat: {
    lines: VatLine[];
    totalTaxableAmount: number;
    totalTaxAmount: number;
  };
  inputVatNote: string;
  netVatPayable: number;
}

export function VatReturn() {
  const { settings } = useTenantSettings();
  const [report, setReport] = useState<VatReturn | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: settings.baseCurrency || "GHS" }).format(n);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/vat-return?startDate=${startDate}&endDate=${endDate}`);
      if (res.data.success) setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load VAT Return.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [startDate, endDate]); // eslint-disable-line

  const handleExport = () => {
    if (!report) return;
    exportToCsv(`vat_return_${startDate}_to_${endDate}`, [
      ...report.outputVat.lines.map((l) => ({
        "Tax Rate": l.taxRateName,
        "Rate %": l.taxRate,
        "Taxable Amount": l.taxableAmount,
        "VAT Amount": l.taxAmount,
      })),
      { "Tax Rate": "TOTAL", "Rate %": "", "Taxable Amount": report.outputVat.totalTaxableAmount, "VAT Amount": report.outputVat.totalTaxAmount },
    ]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">VAT Return</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Output VAT collected on paid invoices</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          <span className="text-gray-500 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          <button onClick={fetchReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={handleExport} disabled={!report} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
            <FileText size={14} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading VAT Return…</div>}

      {!loading && report && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Taxable Sales</p>
              <p className="text-xl font-semibold mt-1">{fmt(report.outputVat.totalTaxableAmount)}</p>
            </div>
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Output VAT Collected</p>
              <p className="text-xl font-semibold mt-1 text-blue-600 dark:text-blue-400">{fmt(report.outputVat.totalTaxAmount)}</p>
            </div>
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Net VAT Payable</p>
              <p className="text-xl font-semibold mt-1 text-orange-600 dark:text-orange-400">{fmt(report.netVatPayable)}</p>
            </div>
          </div>

          {/* Output VAT table */}
          <div className="border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h2 className="font-medium text-sm">Output VAT — Sales</h2>
            </div>
            {report.outputVat.lines.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No taxable invoice payments in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Tax Rate</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Rate %</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Taxable Amount</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">VAT Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {report.outputVat.lines.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2">{l.taxRateName}</td>
                      <td className="px-4 py-2 text-right">{l.taxRate}%</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(l.taxableAmount)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(l.taxAmount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/40 font-semibold">
                    <td className="px-4 py-2" colSpan={2}>Total</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(report.outputVat.totalTaxableAmount)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(report.outputVat.totalTaxAmount)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Input VAT note */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p><strong>Input VAT:</strong> {report.inputVatNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
