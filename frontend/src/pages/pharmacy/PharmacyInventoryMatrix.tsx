import { useState } from "react";
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";

interface MatrixItem {
  id: string;
  name: string;
  sku: string;
  totalStock: number;
  unitPrice: number;
  stockValue: number;
  daysSinceMove: number;
  fsn: "F" | "S" | "N";
  abc: "A" | "B" | "C";
  classification: string;
}

const ABC_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  C: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const FSN_COLORS: Record<string, string> = {
  F: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  S: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  N: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const FSN_LABEL: Record<string, string> = {
  F: "Fast (≤30d)",
  S: "Slow (31–90d)",
  N: "Non-moving (90d+)",
};

const ABC_LABEL: Record<string, string> = {
  A: "A — High value (top 70%)",
  B: "B — Medium value (70–90%)",
  C: "C — Low value (bottom 10%)",
};

function formatGHS(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PharmacyInventoryMatrix() {
  const [items, setItems] = useState<MatrixItem[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [abcFilter, setAbcFilter] = useState<string>("ALL");
  const [fsnFilter, setFsnFilter] = useState<string>("ALL");

  async function fetchMatrix() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/pharmacy/inventory-matrix");
      setItems(res.data.data.items);
      setTotalValue(res.data.data.totalValue);
      setLoaded(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to load inventory matrix.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((i) => {
    if (abcFilter !== "ALL" && i.abc !== abcFilter) return false;
    if (fsnFilter !== "ALL" && i.fsn !== fsnFilter) return false;
    return true;
  });

  const counts = { A: 0, B: 0, C: 0, F: 0, S: 0, N: 0 };
  items.forEach((i) => { counts[i.abc]++; counts[i.fsn]++; });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">ABC-FSN Inventory Matrix</h1>
        </div>
        <button
          onClick={fetchMatrix}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analysing…" : loaded ? "Refresh" : "Run Analysis"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 space-y-1">
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">ABC Classification (by stock value)</div>
          {(["A", "B", "C"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${ABC_COLORS[k]}`}>{k}</span>
              <span>{ABC_LABEL[k]}</span>
              <span className="font-semibold">{counts[k]} items</span>
            </div>
          ))}
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 space-y-1">
          <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">FSN Classification (by movement)</div>
          {(["F", "S", "N"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${FSN_COLORS[k]}`}>{k}</span>
              <span>{FSN_LABEL[k]}</span>
              <span className="font-semibold">{counts[k]} items</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loaded && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter:</span>
            <div className="flex gap-1">
              {["ALL", "A", "B", "C"].map((v) => (
                <button
                  key={v}
                  onClick={() => setAbcFilter(v)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${abcFilter === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  {v === "ALL" ? "All ABC" : `${v} class`}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {["ALL", "F", "S", "N"].map((v) => (
                <button
                  key={v}
                  onClick={() => setFsnFilter(v)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${fsnFilter === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  {v === "ALL" ? "All FSN" : `${v} moving`}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-gray-500">
              {filtered.length} items · Total value: <span className="font-semibold">{formatGHS(totalValue)}</span>
            </span>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Item</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">SKU</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Stock</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Unit Price</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Stock Value</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">ABC</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">FSN</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Class</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Days Since Move</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No items match the selected filters.</td></tr>
                  )}
                  {filtered.map((item) => (
                    <tr key={item.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{item.sku}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{item.totalStock}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatGHS(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatGHS(item.stockValue)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${ABC_COLORS[item.abc]}`}>{item.abc}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${FSN_COLORS[item.fsn]}`}>{item.fsn}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                          {item.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{item.daysSinceMove}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
            <p><strong>ABC:</strong> A = top 70% of cumulative stock value, B = 70–90%, C = bottom 10%.</p>
            <p><strong>FSN:</strong> F = Fast (≤30 days since last movement), S = Slow (31–90 days), N = Non-moving (90+ days).</p>
            <p>Reorder priority: <span className="font-semibold text-red-600">AN</span> (high-value, non-moving) — review for expiry. <span className="font-semibold text-amber-600">BN/CN</span> — consider liquidation or return to supplier.</p>
          </div>
        </>
      )}

      {!loaded && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Click "Run Analysis" to classify your inventory by value and movement.
        </div>
      )}
    </div>
  );
}
