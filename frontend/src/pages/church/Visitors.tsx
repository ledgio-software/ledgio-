import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { UserPlus, Plus, CheckCircle, Phone } from "lucide-react";

interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  visit_date: string;
  service_type: string;
  how_they_heard: string | null;
  follow_up_status: string;
  follow_up_notes: string | null;
  converted_to_member_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CONTACTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  VISITED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CONVERTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  NOT_INTERESTED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUSES = ["PENDING", "CONTACTED", "VISITED", "CONVERTED", "NOT_INTERESTED"];
const SERVICE_TYPES = ["SUNDAY_SERVICE", "MIDWEEK", "CELL_GROUP", "SPECIAL_SERVICE"];
const HOW_HEARD = ["Friend", "Social Media", "Flyer", "Radio", "TV", "Walk-in", "Other"];

const today = new Date().toISOString().split("T")[0];

export function ChurchVisitors() {
  const { showToast } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState("CONTACTED");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    visitDate: today, serviceType: "SUNDAY_SERVICE",
    howTheyHeard: "", followUpNotes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : "";
    try {
      const r = await api.get(`/church/visitors${params}`);
      setVisitors(r.data.data);
    } catch {
      showToast("Failed to load visitors", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.firstName || !form.lastName) { showToast("First and last name required", "error"); return; }
    setSaving(true);
    try {
      await api.post("/church/visitors", {
        firstName: form.firstName, lastName: form.lastName,
        phone: form.phone || undefined, email: form.email || undefined,
        visitDate: form.visitDate, serviceType: form.serviceType,
        howTheyHeard: form.howTheyHeard || undefined,
        followUpNotes: form.followUpNotes || undefined,
      });
      showToast("Visitor added", "success");
      setShowAdd(false);
      setForm({ firstName: "", lastName: "", phone: "", email: "", visitDate: today, serviceType: "SUNDAY_SERVICE", howTheyHeard: "", followUpNotes: "" });
      load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleFollowUp() {
    if (!followUpId) return;
    setSaving(true);
    try {
      await api.patch(`/church/visitors/${followUpId}/follow-up`, { status: followUpStatus, notes: followUpNotes || undefined });
      showToast("Follow-up updated", "success");
      setFollowUpId(null);
      load();
    } catch { showToast("Failed to update", "error"); }
    finally { setSaving(false); }
  }

  const pending = visitors.filter(v => v.follow_up_status === "PENDING").length;
  const converted = visitors.filter(v => v.follow_up_status === "CONVERTED").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserPlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">First-timers & Visitors</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Log Visitor
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Visitors</p><p className="text-2xl font-bold">{visitors.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Follow-up</p><p className="text-2xl font-bold text-yellow-600">{pending}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Converted to Members</p><p className="text-2xl font-bold text-green-600">{converted}</p></CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterStatus("")} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === "" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>All</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : visitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visitors recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Visit Date</th>
                    <th className="pb-2 pr-3 font-medium">Contact</th>
                    <th className="pb-2 pr-3 font-medium">How They Heard</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map(v => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{v.first_name} {v.last_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(v.visit_date).toLocaleDateString()}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {v.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</span> : v.email ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{v.how_they_heard ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.follow_up_status] ?? ""}`}>
                          {v.follow_up_status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2">
                        {v.follow_up_status !== "CONVERTED" && (
                          <button onClick={() => { setFollowUpId(v.id); setFollowUpStatus("CONTACTED"); setFollowUpNotes(""); }} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Follow up
                          </button>
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

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Log Visitor</h2>
            <div className="grid grid-cols-2 gap-3">
              {[["First Name *", "firstName"], ["Last Name *", "lastName"], ["Phone", "phone"], ["Email", "email"]].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <input type="text" value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Visit Date *</label>
                <input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Service Type</label>
                <select value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">How They Heard About Us</label>
                <select value={form.howTheyHeard} onChange={e => setForm(f => ({ ...f, howTheyHeard: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  <option value="">Select…</option>
                  {HOW_HEARD.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input type="text" value={form.followUpNotes} onChange={e => setForm(f => ({ ...f, followUpNotes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up modal */}
      {followUpId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Update Follow-up</h2>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={followUpStatus} onChange={e => setFollowUpStatus(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFollowUpId(null)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleFollowUp} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Update"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
