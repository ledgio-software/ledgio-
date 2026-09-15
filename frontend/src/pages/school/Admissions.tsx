import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { UserPlus, Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Input } from "../../components/ui/Input";

interface Admission {
  id: string; applicationNumber: string; applicantFirstName: string; applicantLastName: string;
  dateOfBirth?: string; applyingClass: string; parentName: string; parentPhone: string;
  parentEmail?: string; status: string; notes?: string; createdAt: string;
}

const STATUSES = ["PENDING", "REVIEWING", "ACCEPTED", "REJECTED", "ENROLLED"] as const;
type AdmissionStatus = typeof STATUSES[number];

const STATUS_COLORS: Record<AdmissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  ENROLLED: "bg-purple-100 text-purple-800",
};

const EMPTY_FORM = { applicantFirstName: "", applicantLastName: "", dateOfBirth: "", applyingClass: "", parentName: "", parentPhone: "", parentEmail: "", status: "PENDING", notes: "" };

export function Admissions() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const canWrite = isAdmin || (user?.role ?? "").toLowerCase() === "accountant";

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [admissionSearch, setAdmissionSearch] = useState("");
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Admission | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterStatus ? `?status=${filterStatus}` : "";
      const res = await api.get(`/school/admissions${q}`);
      setAdmissions(res.data?.data?.admissions ?? []);
    } catch { showToast("Failed to load admissions", "error"); }
    finally { setLoading(false); }
  }, [filterStatus, showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(a: Admission) {
    setEditing(a);
    setForm({
      applicantFirstName: a.applicantFirstName, applicantLastName: a.applicantLastName,
      dateOfBirth: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : "",
      applyingClass: a.applyingClass, parentName: a.parentName, parentPhone: a.parentPhone,
      parentEmail: a.parentEmail ?? "", status: a.status, notes: a.notes ?? "",
    });
    setShowModal(true);
  }

  async function submit() {
    if (!form.applicantFirstName || !form.applicantLastName || !form.applyingClass || !form.parentName || !form.parentPhone) {
      showToast("Required fields missing", "error"); return;
    }
    setSaving(true);
    try {
      const body = { ...form, dateOfBirth: form.dateOfBirth || undefined, parentEmail: form.parentEmail || undefined, notes: form.notes || undefined };
      if (editing) {
        await api.put(`/school/admissions/${editing.id}`, body);
        showToast("Updated", "success");
      } else {
        await api.post("/school/admissions", body);
        showToast("Application created", "success");
      }
      setShowModal(false); load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this application?")) return;
    try { await api.delete(`/school/admissions/${id}`); showToast("Deleted", "success"); load(); }
    catch { showToast("Failed to delete", "error"); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-teal-600" />
          <h1 className="text-xl font-semibold">Admissions</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />New Application</Button>}
        </div>
      </div>

      {/* Search + Status filter tabs */}
      <div className="flex flex-wrap gap-3 items-center mb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applicant or app #…"
            className="pl-8 w-56"
            value={admissionSearch}
            onChange={(e) => setAdmissionSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-1 flex-wrap border-b">
        {(["", ...STATUSES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${filterStatus === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App #</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    {canWrite && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const q = admissionSearch.toLowerCase().trim();
                    const displayed = q ? admissions.filter((a) =>
                      `${a.applicantFirstName} ${a.applicantLastName}`.toLowerCase().includes(q) ||
                      a.applicationNumber.toLowerCase().includes(q)
                    ) : admissions;
                    if (displayed.length === 0) return (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{admissions.length === 0 ? "No applications found." : "No applications match the search."}</TableCell></TableRow>
                    );
                    return displayed.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.applicationNumber}</TableCell>
                        <TableCell className="font-medium">{a.applicantFirstName} {a.applicantLastName}</TableCell>
                        <TableCell>{a.applyingClass}</TableCell>
                        <TableCell>{a.parentName}</TableCell>
                        <TableCell>{a.parentPhone}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status as AdmissionStatus]}`}>{a.status}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                        {canWrite && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                              {isAdmin && <Button variant="ghost" size="sm" onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold">{editing ? "Edit Application" : "New Application"}</h2>
            <div className="grid grid-cols-2 gap-2">
              {[["First Name", "applicantFirstName"], ["Last Name", "applicantLastName"], ["Applying Class", "applyingClass"], ["Parent Name", "parentName"], ["Parent Phone", "parentPhone"], ["Parent Email", "parentEmail"]].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date of Birth</label>
                <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm bg-background" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
