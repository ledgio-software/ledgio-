import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Layers, Plus, Trash2, UserPlus, X } from "lucide-react";

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  leader_name: string | null;
  meeting_schedule: string | null;
  is_active: boolean;
  member_count: number;
}

interface MinistryMember {
  id: string;
  member_id: string;
  member_name: string;
  role: string;
  joined_at: string;
}

interface ChurchMember {
  id: string;
  first_name: string;
  last_name: string;
}

export function ChurchMinistries() {
  const { showToast } = useToast();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ministry | null>(null);
  const [members, setMembers] = useState<MinistryMember[]>([]);
  const [allMembers, setAllMembers] = useState<ChurchMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", meetingSchedule: "" });
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignRole, setAssignRole] = useState("Member");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/church/ministries");
      setMinistries(r.data.data);
    } catch { showToast("Failed to load ministries", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function loadMembers(ministryId: string) {
    try {
      const [mr, all] = await Promise.all([
        api.get(`/church/ministries/${ministryId}/members`),
        api.get("/church/members"),
      ]);
      setMembers(mr.data.data);
      setAllMembers(all.data.data);
    } catch { showToast("Failed to load members", "error"); }
  }

  async function handleSelect(m: Ministry) {
    setSelected(m);
    await loadMembers(m.id);
  }

  async function handleAdd() {
    if (!form.name) { showToast("Ministry name required", "error"); return; }
    setSaving(true);
    try {
      await api.post("/church/ministries", { name: form.name, description: form.description || undefined, meetingSchedule: form.meetingSchedule || undefined });
      showToast("Ministry created", "success");
      setShowAdd(false);
      setForm({ name: "", description: "", meetingSchedule: "" });
      load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleAssign() {
    if (!assignMemberId || !selected) return;
    setSaving(true);
    try {
      await api.post(`/church/ministries/${selected.id}/members`, { memberId: assignMemberId, role: assignRole });
      showToast("Member assigned", "success");
      setShowAssign(false);
      setAssignMemberId("");
      setAssignRole("Member");
      await loadMembers(selected.id);
    } catch { showToast("Failed to assign", "error"); }
    finally { setSaving(false); }
  }

  async function handleRemoveMember(ministryId: string, memberId: string) {
    try {
      await api.delete(`/church/ministries/${ministryId}/members/${memberId}`);
      showToast("Removed", "success");
      await loadMembers(ministryId);
    } catch { showToast("Failed to remove", "error"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ministry?")) return;
    try {
      await api.delete(`/church/ministries/${id}`);
      showToast("Deleted", "success");
      if (selected?.id === id) setSelected(null);
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Departments & Ministries</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Ministry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ministry list */}
        <div className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : ministries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ministries yet.</p>
          ) : ministries.map(m => (
            <Card key={m.id} className={`cursor-pointer transition-all ${selected?.id === m.id ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={() => handleSelect(m)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{m.name}</p>
                    {m.leader_name && <p className="text-xs text-muted-foreground">Leader: {m.leader_name}</p>}
                    {m.meeting_schedule && <p className="text-xs text-muted-foreground">{m.meeting_schedule}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{m.member_count} members</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(m.id); }} className="text-destructive hover:opacity-70 ml-2 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Members panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Select a ministry to view its members.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{selected.name} — Members</h2>
                  <button onClick={() => setShowAssign(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <UserPlus className="h-4 w-4" /> Assign Member
                  </button>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Name</th>
                        <th className="pb-2 pr-3 font-medium">Role</th>
                        <th className="pb-2 pr-3 font-medium">Joined</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(mm => (
                        <tr key={mm.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{mm.member_name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{mm.role}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{new Date(mm.joined_at).toLocaleDateString()}</td>
                          <td className="py-2">
                            <button onClick={() => handleRemoveMember(selected.id, mm.member_id)} className="text-destructive hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add ministry modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">New Ministry / Department</h2>
            {[["Name *", "name"], ["Description", "description"], ["Meeting Schedule", "meetingSchedule"]].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input type="text" value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder={key === "meetingSchedule" ? "e.g. Every Saturday 3pm" : ""} />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign member modal */}
      {showAssign && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Assign Member to {selected.name}</h2>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Member</label>
              <select value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                <option value="">Select member…</option>
                {allMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <input type="text" value={assignRole} onChange={e => setAssignRole(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="e.g. Leader, Secretary, Member" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleAssign} disabled={saving || !assignMemberId} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Assign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
