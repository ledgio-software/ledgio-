import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Calendar, Loader2, Plus, Pencil, Trash2, Printer } from "lucide-react";

interface TimetableSlot {
  id: string; className: string; dayOfWeek: string; startTime: string; endTime: string;
  subjectName: string; teacherName?: string;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_LABELS: Record<string, string> = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday" };
const EMPTY_FORM = { className: "", dayOfWeek: "MON", startTime: "08:00", endTime: "09:00", subjectName: "", teacherName: "" };

const SUBJECT_COLORS = ["bg-blue-50 border-blue-200", "bg-purple-50 border-purple-200", "bg-green-50 border-green-200", "bg-amber-50 border-amber-200", "bg-rose-50 border-rose-200", "bg-cyan-50 border-cyan-200", "bg-indigo-50 border-indigo-200", "bg-pink-50 border-pink-200"];

export function Timetable() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canWrite = ["admin", "accountant"].includes((user?.role ?? "").toLowerCase());

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/school/students").then((r) => {
      const students: Array<{ className: string }> = r.data?.data?.students ?? [];
      const unique = [...new Set(students.map((s) => s.className))].sort();
      setClasses(unique);
      if (unique.length > 0) setSelectedClass(unique[0]);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const res = await api.get(`/school/timetable?className=${encodeURIComponent(selectedClass)}`);
      setSlots(res.data?.data?.slots ?? []);
    } catch { showToast("Failed to load timetable", "error"); }
    finally { setLoading(false); }
  }, [selectedClass, showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, className: selectedClass });
    setShowModal(true);
  }

  function openEdit(s: TimetableSlot) {
    setEditing(s);
    setForm({ className: s.className, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, subjectName: s.subjectName, teacherName: s.teacherName ?? "" });
    setShowModal(true);
  }

  async function submit() {
    if (!form.className || !form.subjectName) { showToast("Class and subject required", "error"); return; }
    setSaving(true);
    try {
      const body = { ...form, teacherName: form.teacherName || undefined };
      if (editing) { await api.put(`/school/timetable/${editing.id}`, body); showToast("Updated", "success"); }
      else { await api.post("/school/timetable", body); showToast("Added", "success"); }
      setShowModal(false); load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this slot?")) return;
    try { await api.delete(`/school/timetable/${id}`); showToast("Deleted", "success"); load(); }
    catch { showToast("Failed to delete", "error"); }
  }

  // Build subject→color map
  const subjectColorMap: Record<string, string> = {};
  let colorIdx = 0;
  for (const s of slots) {
    if (!subjectColorMap[s.subjectName]) {
      subjectColorMap[s.subjectName] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
      colorIdx++;
    }
  }

  function printTimetable() {
    const html = `<!DOCTYPE html><html><head><title>Timetable - ${selectedClass}</title>
<style>body{font-family:Arial,sans-serif;margin:30px}h1{text-align:center;font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f3f4f6;font-weight:600}@media print{body{margin:15px}}</style>
</head><body><h1>Timetable — ${selectedClass}</h1><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>
${DAYS.flatMap((d) => slots.filter((s) => s.dayOfWeek === d).map((s) => `<tr><td>${DAY_LABELS[d]}</td><td>${s.startTime}–${s.endTime}</td><td>${s.subjectName}</td><td>${s.teacherName ?? ''}</td></tr>`)).join("")}
</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-sky-600" />
          <h1 className="text-xl font-semibold">Timetable</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">— Select Class —</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={printTimetable}><Printer className="h-4 w-4 mr-1" />Print</Button>
          {canWrite && <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Slot</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <Card key={day}>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase">{DAY_LABELS[day]}</h3>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No slots</p>
                  ) : (
                    <div className="space-y-1.5">
                      {daySlots.map((s) => (
                        <div key={s.id} className={`border rounded p-2 text-xs ${subjectColorMap[s.subjectName]}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{s.subjectName}</span>
                            {canWrite && (
                              <div className="flex gap-0.5">
                                <button onClick={() => openEdit(s)} className="hover:text-blue-600"><Pencil className="h-3 w-3" /></button>
                                <button onClick={() => del(s.id)} className="hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            )}
                          </div>
                          <div className="text-muted-foreground">{s.startTime}–{s.endTime}</div>
                          {s.teacherName && <div className="text-muted-foreground">{s.teacherName}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-3">
            <h2 className="text-base font-semibold">{editing ? "Edit Slot" : "Add Slot"}</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Class</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.className} onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}>
                  <option value="">— Select —</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Day</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}>
                  {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Subject</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} placeholder="e.g. Mathematics" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Time</label>
                <input type="time" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Time</label>
                <input type="time" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Teacher (optional)</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.teacherName} onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))} placeholder="Teacher name" />
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
