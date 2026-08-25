import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Settings2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { api } from "../../lib/api";

interface InterestPolicy {
  id: string;
  tenantId: string;
  annualRate: string;
  graceDays: number;
  accountId: string | null;
  isActive: boolean;
}

interface InterestCharge {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  journalId: string | null;
  status: "POSTED" | "VOIDED";
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  POSTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  VOIDED: "bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400",
};

const emptyPolicy = {
  annualRate: "",
  graceDays: "0",
  accountId: "",
  isActive: true,
};

export function InterestCharges() {
  const [policy, setPolicy] = useState<InterestPolicy | null>(null);
  const [charges, setCharges] = useState<InterestCharge[]>([]);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [loadingCharges, setLoadingCharges] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState(emptyPolicy);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoadingPolicy(true);
    try {
      const res = await api.get("/interest-policy");
      const p: InterestPolicy | null = res.data?.data?.policy ?? null;
      setPolicy(p);
      if (p) {
        setForm({
          annualRate: String(Math.round(Number(p.annualRate) * 100)),
          graceDays: String(p.graceDays),
          accountId: p.accountId ?? "",
          isActive: p.isActive,
        });
      }
    } catch {
      // no policy yet
    } finally {
      setLoadingPolicy(false);
    }
  }, []);

  const loadCharges = useCallback(async () => {
    setLoadingCharges(true);
    try {
      const res = await api.get("/interest-policy/charges");
      setCharges(res.data?.data?.charges ?? []);
    } catch {
      setCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  }, []);

  useEffect(() => {
    loadPolicy();
    loadCharges();
  }, [loadPolicy, loadCharges]);

  const handleSavePolicy = async () => {
    setError(null);
    setSuccessMsg(null);
    const ratePercent = parseFloat(form.annualRate);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      setError("Annual rate must be between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/interest-policy", {
        annualRate: ratePercent / 100,
        graceDays: parseInt(form.graceDays, 10) || 0,
        accountId: form.accountId || null,
        isActive: form.isActive,
      });
      setSuccessMsg("Interest policy saved.");
      setShowConfig(false);
      await loadPolicy();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm("Void this interest charge? This cannot be undone.")) return;
    setVoidingId(id);
    try {
      await api.patch(`/interest-policy/charges/${id}/void`);
      await loadCharges();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to void charge.");
    } finally {
      setVoidingId(null);
    }
  };

  const totalPosted = charges
    .filter((c) => c.status === "POSTED")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GH");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">Interest Charges</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadPolicy(); loadCharges(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowConfig((v) => !v)}>
            <Settings2 className="h-4 w-4 mr-1" /> {showConfig ? "Hide Config" : "Configure Policy"}
          </Button>
        </div>
      </div>

      {/* Policy Configuration Panel */}
      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Interest Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm">{error}</div>
            )}
            {successMsg && (
              <div className="p-3 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-sm">{successMsg}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                  Annual Interest Rate (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.annualRate}
                  onChange={(e) => setForm((f) => ({ ...f, annualRate: e.target.value }))}
                  placeholder="e.g. 24 for 24% p.a."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                  Grace Days
                </label>
                <Input
                  type="number"
                  min="0"
                  value={form.graceDays}
                  onChange={(e) => setForm((f) => ({ ...f, graceDays: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm text-secondary-700 dark:text-secondary-300">
                Active (charges will accrue daily on overdue invoices)
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePolicy} disabled={saving}>
                {saving ? "Saving..." : "Save Policy"}
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Policy Status</p>
            {loadingPolicy ? (
              <p className="text-secondary-400 text-sm mt-1">Loading...</p>
            ) : policy ? (
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${policy.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-secondary-400"}`}>
                  {policy.isActive ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {policy.isActive ? "Active" : "Inactive"}
                </span>
                <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-0.5">
                  {Math.round(Number(policy.annualRate) * 100)}% p.a. · {policy.graceDays}d grace
                </p>
              </div>
            ) : (
              <p className="text-secondary-400 text-sm mt-1">Not configured</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Total Accrued (POSTED)</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-secondary-100 mt-1">
              GHS {fmt(totalPosted)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">Total Charges</p>
            <p className="text-xl font-bold text-secondary-900 dark:text-secondary-100 mt-1">
              {charges.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charges Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interest Charge Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCharges ? (
            <p className="text-secondary-400 text-sm py-4 text-center">Loading charges...</p>
          ) : charges.length === 0 ? (
            <p className="text-secondary-400 text-sm py-8 text-center">
              No interest charges recorded yet. Configure the policy and let the daily sweep run.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 dark:border-secondary-700">
                    <th className="py-2 pr-4 text-left font-medium text-secondary-500 dark:text-secondary-400">Date</th>
                    <th className="py-2 pr-4 text-left font-medium text-secondary-500 dark:text-secondary-400">Invoice</th>
                    <th className="py-2 pr-4 text-left font-medium text-secondary-500 dark:text-secondary-400">Period</th>
                    <th className="py-2 pr-4 text-right font-medium text-secondary-500 dark:text-secondary-400">Amount</th>
                    <th className="py-2 pr-4 text-left font-medium text-secondary-500 dark:text-secondary-400">Status</th>
                    <th className="py-2 text-left font-medium text-secondary-500 dark:text-secondary-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge) => (
                    <tr key={charge.id} className="border-b border-secondary-100 dark:border-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-800/50">
                      <td className="py-2 pr-4 text-secondary-700 dark:text-secondary-300">{fmtDate(charge.createdAt)}</td>
                      <td className="py-2 pr-4 text-secondary-700 dark:text-secondary-300 font-mono text-xs">{charge.invoiceId.slice(0, 8)}…</td>
                      <td className="py-2 pr-4 text-secondary-500 dark:text-secondary-400 text-xs">
                        {fmtDate(charge.periodStart)} – {fmtDate(charge.periodEnd)}
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold text-secondary-900 dark:text-secondary-100 tabular-nums">
                        GHS {fmt(Number(charge.amount))}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[charge.status]}`}>
                          {charge.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {charge.status === "POSTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoid(charge.id)}
                            disabled={voidingId === charge.id}
                            className="text-red-600 dark:text-red-400 hover:text-red-700"
                          >
                            {voidingId === charge.id ? "Voiding…" : "Void"}
                          </Button>
                        )}
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
  );
}
