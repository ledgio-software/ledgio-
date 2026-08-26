import { useState, useEffect } from "react";
import { RefreshCw, FileText, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { exportToCsv } from "../../lib/exportCsv";

interface AgingItem {
  itemId: string;
  itemName: string;
  itemSku: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  unitCost: number;
  daysOnHand: number;
  bucket: string;
  value: number;
}

interface BucketStat { qty: number; value: number; }

interface StockAgingReport {
  asOfDate: string;
  bucketSummary: { "0-30": BucketStat; "31-60": BucketStat; "61-90": BucketStat; "90+": BucketStat };
  totalQty: number;
  totalValue: number;
  items: AgingItem[];
}

const BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

function bucketColor(bucket: string) {
  if (bucket === "0-30") return "text-green-600 dark:text-green-400";
  if (bucket === "31-60") return "text-yellow-600 dark:text-yellow-400";
  if (bucket === "61-90") return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function StockAging() {
  const { settings } = useTenantSettings();
  const [report, setReport] = useState<StockAgingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterBucket, setFilterBucket] = useState<string>("ALL");

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: settings.baseCurrency || "GHS" }).format(n);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/stock-aging?asOfDate=${asOfDate}`);
      if (res.data.success) setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load Stock Aging report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [asOfDate]); // eslint-disable-line

  const visibleItems = report?.items.filter((i) => filterBucket === "ALL" || i.bucket === filterBucket) ?? [];

  const handleExport = () => {
    if (!report) return;
    exportToCsv(`stock_aging_${asOfDate}`, visibleItems.map((i) => ({
      Item: i.itemName,
      SKU: i.itemSku,
      Warehouse: i.warehouseName,
      Qty: i.qty,
      "Unit Cost": i.unitCost,
      "Total Value": i.value,
      "Days On Hand": i.daysOnHand,
      Bucket: i.bucket,
    })));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-secondary-50">Stock Aging</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Inventory age analysis by days on hand</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-gray-300">As of</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          <button onClick={fetchReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
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

      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading Stock Aging…</div>}

      {!loading && report && (
        <>
          {/* Bucket summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BUCKETS.map((b) => {
              const s = report.bucketSummary[b];
              return (
                <button
                  key={b}
                  onClick={() => setFilterBucket(filterBucket === b ? "ALL" : b)}
                  className={`border rounded-lg p-4 text-left transition-all ${filterBucket === b ? "ring-2 ring-blue-500 border-blue-400" : "bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300"}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide ${bucketColor(b)}`}>{b} days</p>
                  <p className="text-lg font-semibold mt-1">{fmt(s.value)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.qty.toLocaleString()} units</p>
                </button>
              );
            })}
          </div>

          {/* Totals bar */}
          <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 text-sm">
            <span className="text-gray-500">Total Stock Value:</span>
            <span className="font-semibold">{fmt(report.totalValue)}</span>
            <span className="text-gray-500 ml-4">Total Units:</span>
            <span className="font-semibold">{report.totalQty.toLocaleString()}</span>
            {filterBucket !== "ALL" && (
              <button onClick={() => setFilterBucket("ALL")} className="ml-auto text-blue-600 hover:underline text-xs">Clear filter</button>
            )}
          </div>

          {/* Items table */}
          <div className="border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 overflow-auto">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No stock items in this age bucket.</p>
            ) : (
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Item</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">SKU</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Warehouse</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Qty</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Unit Cost</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Value</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Days</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {visibleItems.map((item, i) => (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${item.bucket === "90+" ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}>
                      <td className="px-4 py-2 font-medium">{item.itemName}</td>
                      <td className="px-4 py-2 text-gray-500">{item.itemSku || "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{item.warehouseName}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.qty.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(item.unitCost)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(item.value)}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.daysOnHand}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${bucketColor(item.bucket)}`}>{item.bucket}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
