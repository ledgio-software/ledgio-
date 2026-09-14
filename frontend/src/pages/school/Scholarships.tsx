import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Award, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface ScholarshipRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  termId: string | null;
  termName: string | null;
  scholarshipName: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  discountValue: number;
  reason: string | null;
  awardedDate: string;
}

const empty: Omit<ScholarshipRecord, "id" | "studentName" | "studentCode" | "className" | "termName"> = {
  studentId: "",
  termId: null,
  scholarshipName: "",
  discountType: "PERCENT",
  discountValue: 0,
  reason: "",
  awardedDate: new Date().toISOString().slice(0, 10),
};

export function Scholarships() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canEdit = ["admin", "accountant"].includes((user?.role ?? "").toLowerCase());

  const [records, setRecords] = useState<ScholarshipRecord[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [students, setStudents] = useState<{ id: string; firstName: string; lastName: string; studentCode: string; className: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTermId, setFilterTermId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScholarshipRecord | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
    });
    api.get("/school/students?limit=500").then((r) => {
      setStudents(r.data?.data?.students ?? []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterTermId ? `?termId=${filterTermId}` : "";
      const res = await api.get(`/school/scholarships${params}`);
      setRecords(res.data?.data?.scholarships ?? []);
    } catch {
      showToast("Failed to load scholarships", "error");
    } finally {
      setLoading(false);
    }
  }, [filterTermId, showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...empty });
    setShowModal(true);
  }

  function openEdit(r: ScholarshipRecord) {
    setEditing(r);
    setForm({
      studentId: r.studentId,
      termId: r.termId,
      scholarshipName: r.scholarshipName,
      discountType: r.discountType,
      discountValue: r.discountValue,
      reason: r.reason ?? "",
      awardedDate: r.awardedDate.slice(0, 10),
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.studentId || !form.scholarshipName || form.discountValue <= 0) {
      showToast("Student, name, and discount value are required.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/school/scholarships/${editing.id}`, form);
        showToast("Scholarship updated.", "success");
      } else {
        await api.post("/school/scholarships", form);
        showToast("Scholarship awarded.", "success");
      }
      setShowModal(false);
      load();
    } catch {
      showToast("Failed to save scholarship.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this scholarship record?")) return;
    setDeleting(id);
    try {
      await api.delete(`/school/scholarships/${id}`);
      showToast("Deleted.", "success");
      load();
    } catch {
      showToast("Failed to delete.", "error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-500" />
          <h1 className="text-xl font-semibold">Scholarships & Discounts</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-3 py-1.5 text-sm bg-background"
            value={filterTermId}
            onChange={(e) => setFilterTermId(e.target.value)}
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.academicYear})</option>
            ))}
          </select>
          {canEdit && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Award Scholarship
            </Button>
          )}
        </div>
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
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Scholarship</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Awarded</TableHead>
                    <TableHead>Reason</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-10 text-muted-foreground">
                        No scholarships found.
                      </TableCell>
                    </TableRow>
                  ) : records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.studentCode}</div>
                      </TableCell>
                      <TableCell>{r.className}</TableCell>
                      <TableCell>{r.scholarshipName}</TableCell>
                      <TableCell>{r.termName ?? "—"}</TableCell>
                      <TableCell>
                        {r.discountType === "PERCENT"
                          ? `${r.discountValue}%`
                          : fmt(r.discountValue)}
                      </TableCell>
                      <TableCell>{new Date(r.awardedDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.reason ?? "—"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => remove(r.id)} disabled={deleting === r.id}>
                              {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{editing ? "Edit Scholarship" : "Award Scholarship"}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Student *</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentCode}) — {s.className}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Term (optional)</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.termId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, termId: e.target.value || null }))}
                >
                  <option value="">No specific term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.academicYear})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Scholarship Name *</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.scholarshipName}
                  onChange={(e) => setForm((f) => ({ ...f, scholarshipName: e.target.value }))}
                  placeholder="e.g. Academic Excellence Award"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Discount Type *</label>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (GHS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Awarded Date *</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.awardedDate}
                  onChange={(e) => setForm((f) => ({ ...f, awardedDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                <textarea
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  rows={2}
                  value={form.reason ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
