import { useState, useEffect, useCallback } from "react";
import { Target, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

interface CostCentre {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

function CostCentreForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<CostCentre>;
  onSave: (data: { name: string; code: string; description?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [code, setCode] = useState(initial?.code || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !code.trim()) { setError("Name and Code are required."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() || undefined });
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Code *</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm bg-background font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. SALES, MKT, OPS"
            disabled={!!initial?.code}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Name *</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Department"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Description</label>
        <input
          className="w-full border rounded px-3 py-2 text-sm bg-background"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving}>
          <Check className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export function CostCentres() {
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/cost-centres");
      setCostCentres(res.data.costCentres || []);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load cost centres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { name: string; code: string; description?: string }) => {
    await api.post("/cost-centres", data);
    setShowCreate(false);
    load();
  };

  const handleUpdate = async (id: string, data: { name: string; code: string; description?: string }) => {
    await api.put(`/cost-centres/${id}`, data);
    setEditingId(null);
    load();
  };

  const handleToggleActive = async (cc: CostCentre) => {
    try {
      await api.put(`/cost-centres/${cc.id}`, { isActive: !cc.isActive });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Update failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cost centre? This cannot be undone.")) return;
    try {
      await api.delete(`/cost-centres/${id}`);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Delete failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Centres</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tag invoices, bills, and expense claims to a department, branch, or project to segment your P&amp;L.
          </p>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)}>
          <Plus className="h-4 w-4 mr-1" /> New Cost Centre
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showCreate && (
        <CostCentreForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Cost Centres
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Loading…</p>
          ) : costCentres.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No cost centres yet. Create one to start segmenting your P&amp;L.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCentres.map((cc) =>
                  editingId === cc.id ? (
                    <TableRow key={cc.id}>
                      <TableCell colSpan={5}>
                        <CostCentreForm
                          initial={cc}
                          onSave={(data) => handleUpdate(cc.id, data)}
                          onCancel={() => setEditingId(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={cc.id}>
                      <TableCell className="font-mono font-semibold">{cc.code}</TableCell>
                      <TableCell>{cc.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cc.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={cc.isActive ? "success" : "secondary"}>
                          {cc.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(cc.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(cc)}
                            title={cc.isActive ? "Deactivate" : "Activate"}
                          >
                            {cc.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(cc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
