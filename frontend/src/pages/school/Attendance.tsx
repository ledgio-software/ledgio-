import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { CalendarCheck, Loader2, Save } from "lucide-react";

interface AcademicTerm { id: string; name: string; academicYear: string; isCurrent: boolean; }
interface StudentRow {
  student: { id: string; studentCode: string; firstName: string; lastName: string; className: string; };
  attendance: { id: string; status: string; note: string | null } | null;
}

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type Status = typeof STATUSES[number];

const STATUS_COLORS: Record<Status, string> = {
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-800",
  LATE: "bg-amber-100 text-amber-800",
  EXCUSED: "bg-blue-100 text-blue-800",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function Attendance() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { status: Status; note: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
    api.get("/school/students").then((r) => {
      const students: Array<{ className: string }> = r.data?.data?.students ?? [];
      const unique = [...new Set(students.map((s) => s.className))].sort();
      setClasses(unique);
      if (unique.length > 0) setSelectedClass(unique[0]);
    });
  }, []);

  const load = useCallback(async () => {
    if (!date || !selectedClass) return;
    setLoading(true);
    try {
      const res = await api.get(`/school/attendance?date=${date}&className=${encodeURIComponent(selectedClass)}`);
      const data: StudentRow[] = res.data?.data?.rows ?? [];
      setRows(data);
      const d: Record<string, { status: Status; note: string }> = {};
      for (const r of data) {
        d[r.student.id] = {
          status: (r.attendance?.status as Status) ?? "PRESENT",
          note: r.attendance?.note ?? "",
        };
      }
      setDraft(d);
    } catch {
      showToast("Failed to load attendance", "error");
    } finally {
      setLoading(false);
    }
  }, [date, selectedClass, showToast]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!selectedTermId) { showToast("Select a term first", "error"); return; }
    setSaving(true);
    try {
      const records = Object.entries(draft).map(([studentId, val]) => ({
        studentId,
        status: val.status,
        note: val.note || undefined,
      }));
      await api.post("/school/attendance/bulk", { date, termId: selectedTermId, records });
      showToast("Attendance saved", "success");
      load();
    } catch {
      showToast("Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  }

  const counts = Object.values(draft).reduce(
    (acc, v) => { acc[v.status] = (acc[v.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-semibold">Attendance</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
            <option value="">— Term —</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}</option>)}
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">— Class —</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" className="border rounded px-3 py-1.5 text-sm bg-background" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button size="sm" onClick={save} disabled={saving || rows.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Attendance
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      {rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <span key={s} className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
              {s}: {counts[s] ?? 0}
            </span>
          ))}
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Total: {rows.length}
          </span>
        </div>
      )}

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
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        {selectedClass ? "No students in this class." : "Select a class to start."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const d = draft[r.student.id] ?? { status: "PRESENT" as Status, note: "" };
                      return (
                        <TableRow key={r.student.id}>
                          <TableCell>
                            <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                            <div className="text-xs text-muted-foreground">{r.student.studentCode}</div>
                          </TableCell>
                          <TableCell>{r.student.className}</TableCell>
                          <TableCell>
                            <select
                              className={`border rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                              value={d.status}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [r.student.id]: { ...prev[r.student.id], status: e.target.value as Status } }))}
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </TableCell>
                          <TableCell>
                            <input
                              type="text"
                              className="border rounded px-2 py-1 text-sm bg-background w-32"
                              placeholder="Note..."
                              value={d.note ?? ""}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [r.student.id]: { ...prev[r.student.id], note: e.target.value } }))}
                            />
                          </TableCell>
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
    </div>
  );
}
