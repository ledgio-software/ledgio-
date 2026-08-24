import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/utils";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

interface NhisClaim {
  id: string;
  receiptNo: string;
  amount: number;
  createdAt: string;
  nhisClaimRef: string | null;
  nhisSettledAt: string | null;
  customerName: string | null;
}

type Filter = "outstanding" | "settled" | "all";

export function NhisClaims() {
  const { showToast } = useToast();
  const [claims, setClaims] = useState<NhisClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("outstanding");
  const [settling, setSettling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === "settled") params.settled = "true";
      else if (filter === "all") params.all = "true";
      const res = await api.get("/tills/nhis-claims", { params });
      setClaims(res.data.data.claims || []);
    } catch {
      showToast("Failed to load NHIS claims.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function handleSettle(claimId: string) {
    setSettling(claimId);
    try {
      await api.put(`/tills/sales/${claimId}/settle-nhis`);
      showToast("Claim marked as settled.", "success");
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to settle claim.", "error");
    } finally {
      setSettling(null);
    }
  }

  const totalOutstanding = claims
    .filter((c) => !c.nhisSettledAt)
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const daysOutstanding = (createdAt: string) =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NHIS Claims</h1>
        </div>
      </div>

      {filter === "outstanding" && totalOutstanding > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
          <div className="text-sm text-blue-700 dark:text-blue-300">Total outstanding NHIS claims</div>
          <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatMoney(totalOutstanding)}</div>
        </div>
      )}

      <div className="flex rounded-md border border-secondary-200 dark:border-secondary-800 p-1 text-sm mb-4 w-fit">
        {(["outstanding", "settled", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded text-xs font-medium capitalize ${filter === f ? "bg-primary-600 text-white" : "text-secondary-500"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No {filter !== "all" ? filter : ""} NHIS claims found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Receipt No</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Claim Ref</th>
                <th className="px-4 py-3 text-right">Amount (GHS)</th>
                <th className="px-4 py-3 text-right">Days Outstanding</th>
                <th className="px-4 py-3 text-left">Status</th>
                {filter !== "settled" && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {claims.map((c) => {
                const days = daysOutstanding(c.createdAt);
                const settled = !!c.nhisSettledAt;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{c.receiptNo}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{c.customerName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.nhisClaimRef ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatMoney(Number(c.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${days > 30 ? "text-red-600" : days > 14 ? "text-amber-600" : "text-gray-600 dark:text-gray-400"}`}>
                        {settled ? "—" : days}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {settled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Settled
                        </span>
                      ) : (
                        <span className="inline-flex text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                          Outstanding
                        </span>
                      )}
                    </td>
                    {filter !== "settled" && (
                      <td className="px-4 py-3 text-right">
                        {!settled && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={settling === c.id}
                            onClick={() => handleSettle(c.id)}
                          >
                            {settling === c.id ? "Settling…" : "Settle"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
