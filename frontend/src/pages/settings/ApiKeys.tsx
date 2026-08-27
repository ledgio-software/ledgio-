import { useState, useEffect, useCallback } from "react";
import { Key, PlusCircle, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeys() {
  const { showToast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api-keys");
      if (res.data.success) setKeys(res.data.data.apiKeys);
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.post("/api-keys", { name: newKeyName.trim() });
      if (res.data.success) {
        setNewRawKey(res.data.data.apiKey.rawKey);
        setNewKeyName("");
        setShowCreateForm(false);
        fetchKeys();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to create API key.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revoke API key "${name}"? Any system using this key will immediately lose access.`)) return;
    setRevokingId(id);
    try {
      await api.delete(`/api-keys/${id}`);
      showToast("API key revoked.", "success");
      fetchKeys();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to revoke key.", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async () => {
    if (!newRawKey) return;
    await navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">API Keys</h2>
        <p className="text-secondary-500 dark:text-secondary-400 mt-1">
          Generate API keys so external systems can push invoices and payments to Ledgio automatically.
          Each key is tied to your account and carries the same access as your Accountant role.
        </p>
      </div>

      {/* New raw key reveal card */}
      {newRawKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            Copy your new API key now — it will never be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-white dark:bg-secondary-900 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 break-all select-all">
              {newRawKey}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <button
            onClick={() => setNewRawKey(null)}
            className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
          >
            I've copied it — dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary-600" />
              API Keys
            </span>
            <Button variant="primary" size="sm" onClick={() => setShowCreateForm(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Generate New Key
            </Button>
          </CardTitle>
          <CardDescription>
            Use the X-API-Key header to authenticate calls to <code className="text-xs bg-secondary-100 dark:bg-secondary-800 px-1 rounded">/api/external/v1/invoices</code> and{" "}
            <code className="text-xs bg-secondary-100 dark:bg-secondary-800 px-1 rounded">/api/external/v1/payments</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateForm && (
            <form onSubmit={handleCreate} className="flex items-center gap-3 p-3 bg-secondary-50 dark:bg-secondary-950 border border-secondary-200 dark:border-secondary-800 rounded-lg">
              <Input
                autoFocus
                required
                placeholder="Key name, e.g. Phone Shop Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="primary" size="sm" disabled={isCreating}>
                {isCreating ? "Generating…" : "Create"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </form>
          )}

          {isLoading ? (
            <div className="text-xs text-secondary-500 py-6 text-center">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-xs text-secondary-500 py-6 text-center">No API keys yet. Generate one to get started.</div>
          ) : (
            <div className="divide-y divide-secondary-200 dark:divide-secondary-800">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="font-medium text-secondary-900 dark:text-secondary-50 flex items-center gap-2">
                      {k.name}
                      {!k.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary-500 font-mono">
                      {k.keyPrefix}… &nbsp;·&nbsp; Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && <> &nbsp;·&nbsp; Last used {new Date(k.lastUsedAt).toLocaleString()}</>}
                    </div>
                  </div>
                  {k.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 text-xs"
                      onClick={() => handleRevoke(k.id, k.name)}
                      disabled={revokingId === k.id}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      {revokingId === k.id ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use your API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-secondary-700 dark:text-secondary-300">
          <p>Pass your API key in the <code className="text-xs bg-secondary-100 dark:bg-secondary-800 px-1 rounded">X-API-Key</code> header. No JWT or login session needed.</p>

          <div>
            <p className="font-semibold mb-1">Create an invoice:</p>
            <pre className="text-xs bg-secondary-950 text-secondary-100 rounded p-3 overflow-x-auto">{`POST /api/external/v1/invoices
X-API-Key: ledgio_your_key_here
Content-Type: application/json

{
  "customerName": "Kofi Mensah",
  "customerPhone": "0244123456",
  "currency": "GHS",
  "items": [
    { "description": "Samsung A15", "quantity": 1, "unitPrice": 1200.00 }
  ],
  "externalRef": "SHOP-TXN-001"
}`}</pre>
          </div>

          <div>
            <p className="font-semibold mb-1">Post a payment:</p>
            <pre className="text-xs bg-secondary-950 text-secondary-100 rounded p-3 overflow-x-auto">{`POST /api/external/v1/payments
X-API-Key: ledgio_your_key_here
Content-Type: application/json

{
  "invoiceNumber": "INV-1234567890-1001",
  "amount": 500.00,
  "paymentMethod": "Mobile Money",
  "reference": "MoMo-TX-GH-001"
}`}</pre>
          </div>

          <p className="text-xs text-secondary-500">
            Both endpoints accept a single object or an array (up to 100 items). The <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">externalRef</code> field on invoices prevents duplicates — sending the same ref twice returns the existing invoice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
