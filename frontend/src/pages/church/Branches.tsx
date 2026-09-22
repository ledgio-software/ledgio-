import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { GitBranch, Plus, Trash2, Pencil, Trophy, Star, ChevronRight, Eye } from "lucide-react";

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

interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  overall_score: number;
  total_giving: number;
  avg_attendance: number;
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
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [allMembers, setAllMembers] = useState<ChurchMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<"branches" | "leaderboard">("branches");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [br, mem, lb] = await Promise.all([
        api.get("/church/branches"),
        api.get("/church/members"),
        api.get("/church/branches/leaderboard").catch(() => ({ data: { data: [] } })),
      ]);
      setBranches(br.data.data);
      setAllMembers(mem.data.data);
      setLeaderboard(lb.data.data ?? []);
    } catch { showToast("Failed to load branches", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(e: React.MouseEvent, b: Branch) {
    e.stopPropagation();
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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this branch? Members assigned to it will be unlinked.")) return;
    try {
      await api.delete(`/church/branches/${id}`);
      showToast("Deleted", "success");
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];
  const rankBg = ["bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700", "bg-gray-50 border-gray-200 dark:bg-gray-800/40", "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700"];

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

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Branches</p>
          <p className="text-2xl font-bold">{branches.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Active Branches</p>
          <p className="text-2xl font-bold text-green-600">{branches.filter(b => b.is_active).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Branch Members</p>
          <p className="text-2xl font-bold">{branches.reduce((s, b) => s + b.member_count, 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Avg Members / Branch</p>
          <p className="text-2xl font-bold">{branches.length > 0 ? Math.round(branches.reduce((s, b) => s + b.member_count, 0) / branches.length) : 0}</p>
        </CardContent></Card>
      </div>

      {/* Top performing banner */}
      {leaderboard.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
          <CardContent className="p-4 flex items-center gap-4">
            <Trophy className="h-8 w-8 text-yellow-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">Top Performing Branch</p>
              <p className="text-lg font-bold">{leaderboard[0].name}</p>
              <p className="text-xs text-muted-foreground">
                {leaderboard[0].member_count} members · Avg attendance {leaderboard[0].avg_attendance?.toFixed(0) ?? 0} · Total giving {Number(leaderboard[0].total_giving).toLocaleString()}
              </p>
            </div>
            <button onClick={() => navigate(`/church/branches/${leaderboard[0].id}`)} className="text-primary hover:underline text-sm flex items-center gap-1">
              View <ChevronRight className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["branches", "leaderboard"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab === "leaderboard" ? "Leaderboard" : "All Branches"}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <>
          {/* Branches grid */}
          {activeTab === "branches" && (
            branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches added yet. The main church is your headquarters — add satellite branches here.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map(b => (
                  <Card key={b.id} className={`cursor-pointer hover:shadow-md transition-shadow ${!b.is_active ? "opacity-60" : ""}`}
                    onClick={() => navigate(`/church/branches/${b.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{b.name}</p>
                          {!b.is_active && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button onClick={() => navigate(`/church/branches/${b.id}`)} className="text-muted-foreground hover:text-foreground" title="View details">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={(e) => openEdit(e, b)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => handleDelete(e, b.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {b.pastor_name && <p className="text-xs text-muted-foreground">Pastor: {b.pastor_name}</p>}
                      {b.address && <p className="text-xs text-muted-foreground truncate">{b.address}</p>}
                      {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
                      {b.established_date && <p className="text-xs text-muted-foreground">Est. {new Date(b.established_date).toLocaleDateString()}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs font-medium">{b.member_count} members</p>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* Leaderboard tab */}
          {activeTab === "leaderboard" && (
            leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leaderboard data yet. Data is calculated from giving, attendance, and member records.</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, idx) => (
                  <Card key={entry.id} className={`cursor-pointer hover:shadow-md transition-shadow border ${idx < 3 ? rankBg[idx] : ""}`}
                    onClick={() => navigate(`/church/branches/${entry.id}`)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 border shrink-0">
                        {idx < 3 ? <Trophy className={`h-5 w-5 ${rankColors[idx]}`} /> : <Star className="h-5 w-5 text-muted-foreground" />}
                        <span className="sr-only">#{entry.rank}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{entry.name}</p>
                          <span className="text-xs text-muted-foreground">#{entry.rank}</span>
                        </div>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">{entry.member_count} members</span>
                          <span className="text-xs text-muted-foreground">Avg attendance: {Number(entry.avg_attendance ?? 0).toFixed(0)}</span>
                          <span className="text-xs text-muted-foreground">Giving: {Number(entry.total_giving ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{Number(entry.overall_score ?? 0).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">score</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}

                {/* Score explanation */}
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium mb-1">How scores are calculated</p>
                    <p className="text-xs text-muted-foreground">Overall score = 40% giving + 40% attendance + 20% member count, normalized across all branches. Higher is better.</p>
                  </CardContent>
                </Card>
              </div>
            )
          )}
        </>
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
