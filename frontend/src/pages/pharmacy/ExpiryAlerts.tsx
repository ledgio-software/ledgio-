import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface ExpiryBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  daysRemaining: number;
  item: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string };
}

const DAYS_OPTIONS = [30, 60, 90, 180];

function urgencyClass(days: number): string {
  if (days <= 7) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  if (days <= 30) return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400";
}

function urgencyLabel(days: number): string {
  if (days <= 0) return "Expired";
  if (days <= 7) return `${days}d — Critical`;
  if (days <= 30) return `${days}d — Warning`;
  return `${days}d`;
}

export function ExpiryAlerts() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<ExpiryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [writingOff, setWritingOff] = useState<string | null>(null);

  async function load(d: number) {
    setLoading(true);
    try {
      const res = await api.get("/pharmacy/expiry-alerts", { params: { days: d } });
      setBatches(res.data.data.batches);
    } catch {
      showToast("Failed to load expiry alerts.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  async function handleWriteOff(batch: ExpiryBatch) {
    setWritingOff(batch.id);
    try {
      await api.post("/inventory/adjustments", {
        itemId: batch.item.id,
        warehouseId: batch.warehouse.id,
        type: "REMOVE",
        quantity: batch.quantityOnHand,
        reason: `Expired — batch ${batch.batchNumber}`,
      });
      showToast(`Written off ${batch.quantityOnHand} units of ${batch.item.name}.`, "success");
      load(days);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Write-off failed.", "error");
    } finally {
      setWritingOff(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expiry Alerts</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Expiring within:</span>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                days === d
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {batches.length > 0 && (
        <div className="mb-4 flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Critical (&le;7 days)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Warning (&le;30 days)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Watch (&le;{days} days)
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading…</p>
      ) : batches.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No batches expiring within {days} days.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Drug</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Batch #</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Expiry Date</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{b.item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.item.sku}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{b.batchNumber}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{b.warehouse.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {new Date(b.expiryDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">{b.quantityOnHand}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${urgencyClass(b.daysRemaining)}`}>
                      {urgencyLabel(b.daysRemaining)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWriteOff(b)}
                      disabled={writingOff === b.id}
                    >
                      {writingOff === b.id ? "Writing off…" : "Write Off"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
