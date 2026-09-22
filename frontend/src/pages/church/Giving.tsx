import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { TrendingUp, Plus, Trash2, Filter } from "lucide-react";

interface GivingRecord {
  id: string;
  giving_date: string;
  service_type: string;
  giving_type: string;
  amount: number;
  currency: string;
  member_id: string | null;
  member_name: string | null;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface Summary {
  byType: { giving_type: string; total: number; count: number }[];
  byMonth: { month: string; total: number }[];
  grandTotal: { total: number; count: number };
}

interface Branch { id: string; name: string }

function fmt(n: number) {
  return `GHS ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const GIVING_TYPES = ["TITHE", "OFFERING", "SPECIAL_OFFERING", "BUILDING_FUND", "WELFARE", "MISSION", "OTHER"];
const SERVICE_TYPES = ["SUNDAY_SERVICE", "MIDWEEK", "CELL_GROUP", "SPECIAL_SERVICE"];
const PAYMENT_METHODS = ["CASH", "MOBILE_MONEY", "CHEQUE", "BANK_TRANSFER", "OTHER"];

const today = new Date().toISOString().split("T")[0];
const monthStart = today.slice(0, 7) + "-01";

export function ChurchGiving() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [filters, setFilters] = useState({ from: monthStart, to: today, type: "" });

  const [form, setForm] = useState({
    givingDate: today,
    serviceType: "SUNDAY_SERVICE",
    givingType: "TITHE",
    amount: "",
    currency: "GHS",
    memberId: "",
    paymentMethod: "CASH",
    reference: "",
    notes: "",
    branchId: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.type) params.set("type", filters.type);

    try {
      const [recs, summ, br] = await Promise.all([
        api.get(`/church/giving?${params}`),
        api.get(`/church/giving/summary?${params}`),
        api.get("/church/branches"),
      ]);
      setRecords(recs.data.data);
      setSummary(summ.data.data);
      setBranches(br.data.data ?? []);
    } catch {
      showToast("Failed to load giving records", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/church/giving", {
        givingDate: form.givingDate,
        serviceType: form.serviceType,
        givingType: form.givingType,
        amount: Number(form.amount),
        currency: form.currency,
        memberId: form.memberId || undefined,
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        branchId: form.branchId || undefined,
      });
      showToast("Giving recorded", "success");
      setShowAdd(false);
      setForm({ givingDate: today, serviceType: "SUNDAY_SERVICE", givingType: "TITHE", amount: "", currency: "GHS", memberId: "", paymentMethod: "CASH", reference: "", notes: "", branchId: "" });
      load();
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this giving record?")) return;
    setDeleting(id);
    try {
      await api.delete(`/church/giving/${id}`);
      showToast("Deleted", "success");
      load();
    } catch {
      showToast("Failed to delete", "error");
    } finally {
      setDeleting(null);
    }
  }

  const maxMonth = summary?.byMonth.reduce((m, r) => Math.max(m, r.total), 1) ?? 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Offerings & Giving</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Record Giving
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total (Period)</p>
              <p className="text-xl font-bold">{fmt(summary.grandTotal.total)}</p>
              <p className="text-xs text-muted-foreground">{summary.grandTotal.count} transactions</p>
            </CardContent>
          </Card>
          {summary.byType.slice(0, 3).map((t, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t.giving_type.replace(/_/g, " ")}</p>
                <p className="text-xl font-bold">{fmt(t.total)}</p>
                <p className="text-xs text-muted-foreground">{t.count} transactions</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        {summary && summary.byMonth.length > 0 && (
          <Card className="lg:col-span-1">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-4 text-sm">Monthly Trend</h2>
              <div className="space-y-2">
                {summary.byMonth.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14 shrink-0">{row.month}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-emerald-500"
                        style={{ width: `${Math.round((row.total / maxMonth) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-20 text-right shrink-0">{fmt(row.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Records table */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                className="border rounded px-2 py-1 text-sm bg-white dark:bg-secondary-800"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                className="border rounded px-2 py-1 text-sm bg-white dark:bg-secondary-800"
              />
              <select
                value={filters.type}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                className="border rounded px-2 py-1 text-sm bg-white dark:bg-secondary-800"
              >
                <option value="">All Types</option>
                {GIVING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Type</th>
                      <th className="pb-2 pr-3 font-medium">Member</th>
                      <th className="pb-2 pr-3 font-medium">Method</th>
                      <th className="pb-2 pr-3 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">{new Date(r.giving_date).toLocaleDateString()}</td>
                        <td className="py-2 pr-3">{r.giving_type.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.member_name ?? "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.payment_method.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-3 font-medium text-right">{fmt(r.amount)}</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className="text-destructive hover:opacity-70 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Record Giving</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date *</label>
                <input type="date" value={form.givingDate} onChange={e => setForm(f => ({ ...f, givingDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Amount (GHS) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Giving Type *</label>
                <select value={form.givingType} onChange={e => setForm(f => ({ ...f, givingType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  {GIVING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Service Type</label>
                <select value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Payment Method</label>
                <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reference</label>
                <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="Optional" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="Optional" />
              </div>
              {branches.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Branch (optional)</label>
                  <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                    <option value="">Main Church / All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
