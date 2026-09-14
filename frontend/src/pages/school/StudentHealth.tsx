import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Heart, Pencil, Loader2, X, Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface HealthRecord {
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  hasRecord: boolean;
  bloodGroup: string | null;
  allergies: string[];
  medicalConditions: string[];
  emergencyContact: string | null;
  emergencyPhone: string | null;
  vaccinationNotes: string | null;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export function StudentHealth() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canEdit = ["admin", "accountant"].includes((user?.role ?? "").toLowerCase());

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [form, setForm] = useState({
    bloodGroup: "",
    allergiesText: "",
    medicalConditionsText: "",
    emergencyContact: "",
    emergencyPhone: "",
    vaccinationNotes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterClass ? `?className=${encodeURIComponent(filterClass)}` : "";
      const res = await api.get(`/school/health${params}`);
      const list: HealthRecord[] = res.data?.data?.records ?? [];
      setRecords(list);
      const cls = [...new Set(list.map((r) => r.className))].sort();
      if (cls.length && !classes.length) setClasses(cls);
    } catch {
      showToast("Failed to load health records", "error");
    } finally {
      setLoading(false);
    }
  }, [filterClass, showToast]);

  useEffect(() => { load(); }, [load]);

  function openEdit(r: HealthRecord) {
    setEditing(r);
    setForm({
      bloodGroup: r.bloodGroup ?? "",
      allergiesText: r.allergies.join(", "),
      medicalConditionsText: r.medicalConditions.join(", "),
      emergencyContact: r.emergencyContact ?? "",
      emergencyPhone: r.emergencyPhone ?? "",
      vaccinationNotes: r.vaccinationNotes ?? "",
    });
    setShowModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/school/health/${editing.studentId}`, {
        bloodGroup: form.bloodGroup || null,
        allergies: form.allergiesText.split(",").map((s) => s.trim()).filter(Boolean),
        medicalConditions: form.medicalConditionsText.split(",").map((s) => s.trim()).filter(Boolean),
        emergencyContact: form.emergencyContact || null,
        emergencyPhone: form.emergencyPhone || null,
        vaccinationNotes: form.vaccinationNotes || null,
      });
      showToast("Health record saved.", "success");
      setShowModal(false);
      load();
    } catch {
      showToast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          <h1 className="text-xl font-semibold">Student Health Records</h1>
        </div>
        <select
          className="border rounded px-3 py-1.5 text-sm bg-background"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Allergies</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Emergency Contact</TableHead>
                    <TableHead>Record</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-10 text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : records.map((r) => (
                    <TableRow key={r.studentId}>
                      <TableCell>
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.studentCode}</div>
                      </TableCell>
                      <TableCell>{r.className}</TableCell>
                      <TableCell>{r.bloodGroup ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">
                        {r.allergies.length > 0
                          ? r.allergies.join(", ")
                          : <span className="text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.medicalConditions.length > 0
                          ? r.medicalConditions.join(", ")
                          : <span className="text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.emergencyContact
                          ? <span>{r.emergencyContact}{r.emergencyPhone ? ` · ${r.emergencyPhone}` : ""}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          r.hasRecord ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                        }`}>
                          {r.hasRecord ? "On file" : "Not set"}
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            {r.hasRecord ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </Button>
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

      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Health Record — {editing.studentName}
              </h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Blood Group</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.bloodGroup}
                  onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                >
                  <option value="">Not recorded</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Emergency Contact Name</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.emergencyContact}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))}
                  placeholder="Name"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Emergency Phone</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                value={form.emergencyPhone}
                onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                placeholder="+233..."
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Allergies (comma-separated)</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                value={form.allergiesText}
                onChange={(e) => setForm((f) => ({ ...f, allergiesText: e.target.value }))}
                placeholder="e.g. Peanuts, Penicillin"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Medical Conditions (comma-separated)</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                value={form.medicalConditionsText}
                onChange={(e) => setForm((f) => ({ ...f, medicalConditionsText: e.target.value }))}
                placeholder="e.g. Asthma, Sickle Cell"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Vaccination Notes</label>
              <textarea
                className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                rows={3}
                value={form.vaccinationNotes}
                onChange={(e) => setForm((f) => ({ ...f, vaccinationNotes: e.target.value }))}
                placeholder="e.g. COVID-19 vaccinated 2024, Yellow Fever 2023"
              />
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
