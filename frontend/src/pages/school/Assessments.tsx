import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { ClipboardCheck, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface AcademicTerm { id: string; name: string; academicYear: string; isCurrent: boolean; }
interface Student { id: string; firstName: string; lastName: string; className: string; studentCode: string; }
interface Assessment {
  id: string; studentId: string; termId: string; subjectName: string; examType: string;
  score: number; maxScore: number;
  student: Student | null;
}

const EXAM_TYPES = ["MIDTERM", "ENDTERM", "QUIZ", "PROJECT", "OTHER"];

function pct(score: number, max: number) { return max > 0 ? Math.round((score / max) * 100) : 0; }
function grade(p: number) {
  if (p >= 80) return "A"; if (p >= 70) return "B"; if (p >= 60) return "C"; if (p >= 50) return "D"; return "F";
}
function gradeColor(g: string) {
  if (g === "A") return "text-green-700"; if (g === "B") return "text-blue-700";
  if (g === "C") return "text-amber-700"; if (g === "D") return "text-orange-700"; return "text-red-700";
}

export function Assessments() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const canWrite = isAdmin || (user?.role ?? "").toLowerCase() === "accountant";

  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [form, setForm] = useState({ studentId: "", termId: "", subjectName: "", examType: "MIDTERM", score: "", maxScore: "100" });
  const [saving, setSaving] = useState(false);

  const classes = [...new Set(students.map((s) => s.className))].sort();

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
    api.get("/school/students").then((r) => setStudents(r.data?.data?.students ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTermId) params.set("termId", selectedTermId);
      if (selectedClass) params.set("className", selectedClass);
      const res = await api.get(`/school/assessments?${params}`);
      setAssessments(res.data?.data?.assessments ?? []);
    } catch { showToast("Failed to load assessments", "error"); }
    finally { setLoading(false); }
  }, [selectedTermId, selectedClass, showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ studentId: "", termId: selectedTermId, subjectName: "", examType: "MIDTERM", score: "", maxScore: "100" });
    setShowModal(true);
  }

  function openEdit(a: Assessment) {
    setEditing(a);
    setForm({ studentId: a.studentId, termId: a.termId, subjectName: a.subjectName, examType: a.examType, score: String(a.score), maxScore: String(a.maxScore) });
    setShowModal(true);
  }

  async function submit() {
    if (!form.studentId || !form.termId || !form.subjectName || !form.score || !form.maxScore) {
      showToast("All fields required", "error"); return;
    }
    setSaving(true);
    try {
      const body = { ...form, score: parseFloat(form.score), maxScore: parseFloat(form.maxScore) };
      if (editing) {
        await api.put(`/school/assessments/${editing.id}`, body);
        showToast("Updated", "success");
      } else {
        await api.post("/school/assessments", body);
        showToast("Created", "success");
      }
      setShowModal(false);
      load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this assessment?")) return;
    try {
      await api.delete(`/school/assessments/${id}`);
      showToast("Deleted", "success");
      load();
    } catch { showToast("Failed to delete", "error"); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-purple-600" />
          <h1 className="text-xl font-semibold">Assessments</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
            <option value="">— All Terms —</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}</option>)}
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">— All Classes —</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {canWrite && (
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add</Button>
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
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Grade</TableHead>
                    {canWrite && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No assessments found.</TableCell></TableRow>
                  ) : (
                    assessments.map((a) => {
                      const p = pct(a.score, a.maxScore);
                      const g = grade(p);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium">{a.student?.firstName} {a.student?.lastName}</div>
                            <div className="text-xs text-muted-foreground">{a.student?.studentCode}</div>
                          </TableCell>
                          <TableCell>{a.student?.className}</TableCell>
                          <TableCell>{a.subjectName}</TableCell>
                          <TableCell><span className="text-xs font-medium">{a.examType}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{a.score}/{a.maxScore}</TableCell>
                          <TableCell className="text-right tabular-nums">{p}%</TableCell>
                          <TableCell><span className={`font-bold ${gradeColor(g)}`}>{g}</span></TableCell>
                          {canWrite && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                                {isAdmin && <Button variant="ghost" size="sm" onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-3">
            <h2 className="text-base font-semibold">{editing ? "Edit Assessment" : "Add Assessment"}</h2>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Student</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
                  <option value="">— Select Student —</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.className})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Term</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.termId} onChange={(e) => setForm((f) => ({ ...f, termId: e.target.value }))}>
                  <option value="">— Select Term —</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Subject</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} placeholder="e.g. Mathematics" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Exam Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.examType} onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value }))}>
                    {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Score</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Max Score</label>
                  <input type="number" min="1" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.maxScore} onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))} />
                </div>
              </div>
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
