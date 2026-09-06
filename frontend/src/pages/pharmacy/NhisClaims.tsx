import { useState } from "react";
import { FileText, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";

interface NhisClaimLine {
  drugName: string;
  quantity: number;
  unitPrice: number;
}

interface NhisClaim {
  id: string;
  rxNumber: string;
  dispensedAt: string;
  patientName: string;
  nhisCardNumber: string;
  patientPhone?: string;
  lines: NhisClaimLine[];
  totalAmount: number;
}

interface ClaimsResponse {
  claims: NhisClaim[];
  totalClaims: number;
  dispensedClaims: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatGHS(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

export function NhisClaims() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ClaimsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchClaims() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/pharmacy/nhis-claims", { params: { from, to } });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to load NHIS claims.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!data || data.claims.length === 0) return;
    const rows = [
      ["Rx Number", "Date", "Patient Name", "NHIS Card No.", "Drug", "Qty", "Unit Price (GHS)", "Line Total (GHS)"],
    ];
    for (const c of data.claims) {
      for (const l of c.lines) {
        rows.push([
          c.rxNumber,
          formatDate(c.dispensedAt),
          c.patientName,
          c.nhisCardNumber,
          l.drugName,
          String(l.quantity),
          l.unitPrice.toFixed(2),
          (l.quantity * l.unitPrice).toFixed(2),
        ]);
      }
    }
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhis-claims-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grandTotal = data?.claims.reduce((s, c) => s + c.totalAmount, 0) ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-green-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">NHIS Claims</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={fetchClaims}
          disabled={loading}
          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Loading…" : "Generate Report"}
        </button>
        {data && data.claims.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total NHIS Rxs</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{data.totalClaims}</div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dispensed</div>
            <div className="text-2xl font-bold text-green-600 mt-1 tabular-nums flex items-center gap-1">
              <CheckCircle2 className="h-5 w-5" />
              {data.dispensedClaims}
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Claim Value</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{formatGHS(grandTotal)}</div>
          </div>
        </div>
      )}

      {/* Claims table */}
      {data && data.claims.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No NHIS prescriptions dispensed in this date range.
        </div>
      )}

      {data && data.claims.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Rx #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">NHIS Card</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Amount (GHS)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.claims.map((c) => (
                <>
                  <tr key={c.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{c.rxNumber}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(c.dispensedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{c.patientName}</div>
                      {c.patientPhone && <div className="text-xs text-gray-400">{c.patientPhone}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.nhisCardNumber}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{c.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expandedId === c.id ? "Hide" : "Lines"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr key={`${c.id}-lines`} className="bg-green-50 dark:bg-green-900/10">
                      <td colSpan={6} className="px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 dark:text-gray-400">
                              <th className="text-left pb-1">Drug</th>
                              <th className="text-right pb-1">Qty</th>
                              <th className="text-right pb-1">Unit Price</th>
                              <th className="text-right pb-1">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-100 dark:divide-green-900/20">
                            {c.lines.map((l, i) => (
                              <tr key={i}>
                                <td className="py-1 text-gray-700 dark:text-gray-300">{l.drugName}</td>
                                <td className="py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">{l.quantity}</td>
                                <td className="py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">{l.unitPrice.toFixed(2)}</td>
                                <td className="py-1 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">{(l.quantity * l.unitPrice).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Grand Total</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{grandTotal.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Select a date range and click "Generate Report" to view NHIS claims.
        </div>
      )}
    </div>
  );
}
