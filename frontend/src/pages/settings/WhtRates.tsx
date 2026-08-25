import { useState, useEffect, useCallback, useMemo } from "react";
import { Percent, Trash2, PlusCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useAccounts } from "../../hooks/useAccounts";

interface WhtRate {
  id: string;
  name: string;
  code: string;
  rate: string;
  accountId: string | null;
  isActive: boolean;
  description: string | null;
}

export function WhtRates() {
  const { accounts } = useAccounts();
  const [whtRates, setWhtRates] = useState<WhtRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    ratePercent: "",
    accountId: "",
    description: "",
  });

  const liabilityAccounts = useMemo(
    () =>
      [...accounts]
        .filter((a) => a.type === "Liability")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, `${a.code} - ${a.name}`));
    return map;
  }, [accounts]);

  const fetchWhtRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/wht-rates");
      setWhtRates(res.data?.data?.whtRates || []);
    } catch (err) {
      console.error("Failed to load WHT rates:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWhtRates();
  }, [fetchWhtRates]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post("/wht-rates", {
        name: form.name,
        code: form.code,
        rate: Number(form.ratePercent) / 100,
        ...(form.accountId ? { accountId: form.accountId } : {}),
        ...(form.description ? { description: form.description } : {}),
      });
      setForm({ name: "", code: "", ratePercent: "", accountId: "", description: "" });
      setMessage("✅ WHT rate created.");
      fetchWhtRates();
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to create WHT rate."}`);
    }
  };

  const handleToggleActive = async (rate: WhtRate) => {
    setMessage(null);
    try {
      await api.put(`/wht-rates/${rate.id}`, { isActive: !rate.isActive });
      fetchWhtRates();
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to update WHT rate."}`);
    }
  };

  const handleDelete = async (id: string) => {
    setMessage(null);
    try {
      await api.delete(`/wht-rates/${id}`);
      fetchWhtRates();
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to delete WHT rate."}`);
    }
  };

  const applyGhanaPreset = () => {
    setForm({ name: "WHT on Services", code: "WHT5", ratePercent: "5", accountId: "", description: "GRA 5% withholding tax on payments to service providers and contractors." });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">Withholding Tax (WHT)</h2>
        <p className="text-secondary-500 dark:text-secondary-400 mt-1">
          Configure GRA withholding tax rates deducted from vendor bill payments. When a bill has a WHT rate, paying it
          credits WHT Payable instead of paying the full amount in cash.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-secondary-50 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 rounded-lg text-xs">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Percent className="mr-2 h-5 w-5 text-primary-600" />
            Configured WHT Rates
          </CardTitle>
          <CardDescription>
            Rates applied to vendor bill payments. The withheld amount is credited to the designated WHT Payable account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-secondary-500 py-4 text-center">Loading WHT rates...</div>
          ) : whtRates.length === 0 ? (
            <div className="text-xs text-secondary-500 py-4 text-center">
              No WHT rates configured yet. Add one below or use the Ghana preset.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-secondary-500 border-b border-secondary-200 dark:border-secondary-800">
                  <th className="py-2">Name</th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2">WHT Payable Account</th>
                  <th className="py-2">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {whtRates.map((r) => (
                  <tr key={r.id} className="border-b border-secondary-100 dark:border-secondary-800">
                    <td className="py-2">
                      <div>{r.name}</div>
                      {r.description && <div className="text-secondary-400 mt-0.5">{r.description}</div>}
                    </td>
                    <td className="py-2 font-mono">{r.code}</td>
                    <td className="py-2">{(Number(r.rate) * 100).toFixed(2)}%</td>
                    <td className="py-2 text-secondary-500">
                      {r.accountId ? accountLabelById.get(r.accountId) || "Unknown account" : <span className="italic">Default WHT Payable</span>}
                    </td>
                    <td className="py-2">
                      <button onClick={() => handleToggleActive(r)} className="flex items-center gap-1 text-xs" title="Toggle active">
                        {r.isActive ? (
                          <><ToggleRight className="h-4 w-4 text-emerald-600" /><span className="text-emerald-600">Active</span></>
                        ) : (
                          <><ToggleLeft className="h-4 w-4 text-secondary-400" /><span className="text-secondary-400">Inactive</span></>
                        )}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleCreate}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <PlusCircle className="mr-2 h-5 w-5 text-primary-600" />
                Add WHT Rate
              </span>
              <Button type="button" variant="outline" size="sm" onClick={applyGhanaPreset} className="text-xs">
                Use Ghana WHT5 Preset (5%)
              </Button>
            </CardTitle>
            <CardDescription>
              Enter the rate as a percentage (e.g. 5 for 5%). The WHT Payable account receives the withheld amounts at payment time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="WHT on Services"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Code</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="WHT5"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={form.ratePercent}
                  onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                  placeholder="5"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">
                  WHT Payable Account <span className="font-normal text-secondary-400">(optional)</span>
                </label>
                <select
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  className="w-full text-xs rounded-md border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Use default WHT Payable account —</option>
                  {liabilityAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">
                Description <span className="font-normal text-secondary-400">(optional)</span>
              </label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="GRA 5% withholding on payments to contractors"
              />
            </div>
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" className="w-full">
              Create WHT Rate
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
