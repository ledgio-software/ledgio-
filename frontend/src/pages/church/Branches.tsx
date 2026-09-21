import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { GitBranch, Plus, Trash2, Pencil } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  pastor_id: string | null;
  pastor_name: string | null;
  phone: string | null;
  email: string | null;
  established_date: string | null;
  is_active: boolean;
  member_count: number;
}

interface ChurchMember {
  id: string;
  first_name: string;
  last_name: string;
}

const emptyForm = { name: "", address: "", pastorId: "", phone: "", email: "", establishedDate: "", isActive: true };

export function ChurchBranches() {
  const { showToast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allMembers, setAllMembers] = useState<ChurchMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [br, mem] = await Promise.all([
        api.get("/church/branches"),
        api.get("/church/members"),
      ]);
      setBranches(br.data.data);
      setAllMembers(mem.data.data);
    } catch { showToast("Failed to load branches", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name, address: b.address ?? "", pastorId: b.pastor_id ?? "",
      phone: b.phone ?? "", email: b.email ?? "",
      establishedDate: b.established_date ?? "", isActive: b.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) { showToast("Branch name required", "error"); return; }
    setSaving(true);
    const payload = {
      name: form.name, address: form.address || undefined,
      pastorId: form.pastorId || undefined, phone: form.phone || undefined,
      email: form.email || undefined, establishedDate: form.establishedDate || undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api.put(`/church/branches/${editing.id}`, payload);
        showToast("Branch updated", "success");
      } else {
        await api.post("/church/branches", payload);
        showToast("Branch created", "success");
      }
      setShowModal(false);
      load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this branch? Members assigned to it will be unlinked.")) return;
    try {
      await api.delete(`/church/branches/${id}`);
      showToast("Deleted", "success");
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Church Branches</h1>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Branch
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Branches</p>
            <p className="text-2xl font-bold">{branches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Branches</p>
            <p className="text-2xl font-bold text-green-600">{branches.filter(b => b.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Branch Members</p>
            <p className="text-2xl font-bold">{branches.reduce((s, b) => s + b.member_count, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Members / Branch</p>
            <p className="text-2xl font-bold">{branches.length > 0 ? Math.round(branches.reduce((s, b) => s + b.member_count, 0) / branches.length) : 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Branches grid */}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branches added yet. The main church is your headquarters — add satellite branches here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <Card key={b.id} className={!b.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{b.name}</p>
                    {!b.is_active && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button onClick={() => openEdit(b)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(b.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {b.pastor_name && <p className="text-xs text-muted-foreground">Pastor: {b.pastor_name}</p>}
                {b.address && <p className="text-xs text-muted-foreground truncate">{b.address}</p>}
                {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
                {b.established_date && <p className="text-xs text-muted-foreground">Est. {new Date(b.established_date).toLocaleDateString()}</p>}
                <p className="text-xs font-medium mt-2">{b.member_count} members</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editing ? "Edit Branch" : "Add Branch"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Branch Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="e.g. Accra Central Branch" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Pastor / Leader</label>
                <select value={form.pastorId} onChange={e => setForm(f => ({ ...f, pastorId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  <option value="">Select…</option>
                  {allMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input type="text" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Established Date</label>
                <input type="date" value={form.establishedDate} onChange={e => setForm(f => ({ ...f, establishedDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Address</label>
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              {editing && (
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  <label htmlFor="isActive" className="text-sm">Active</label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
