import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { CalendarCheck, Plus, Pencil, Trash2, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  eventType: "ACADEMIC" | "SPORTS" | "CULTURAL" | "HOLIDAY" | "EXAM" | "MEETING" | "OTHER";
  location: string | null;
}

const EVENT_TYPES = ["ACADEMIC", "SPORTS", "CULTURAL", "HOLIDAY", "EXAM", "MEETING", "OTHER"] as const;
const TYPE_COLORS: Record<string, string> = {
  ACADEMIC: "bg-blue-100 text-blue-800",
  SPORTS: "bg-green-100 text-green-800",
  CULTURAL: "bg-purple-100 text-purple-800",
  HOLIDAY: "bg-amber-100 text-amber-800",
  EXAM: "bg-red-100 text-red-800",
  MEETING: "bg-slate-100 text-slate-800",
  OTHER: "bg-gray-100 text-gray-800",
};

const emptyForm = {
  title: "",
  description: "",
  eventDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  eventType: "ACADEMIC" as SchoolEvent["eventType"],
  location: "",
};

export function SchoolEvents() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canEdit = ["admin", "accountant"].includes((user?.role ?? "").toLowerCase());

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/school/events?month=${month}&year=${year}`);
      setEvents(res.data?.data?.events ?? []);
    } catch {
      showToast("Failed to load events", "error");
    } finally {
      setLoading(false);
    }
  }, [month, year, showToast]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, eventDate: `${year}-${String(month).padStart(2, "0")}-01` });
    setShowModal(true);
  }

  function openEdit(e: SchoolEvent) {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description ?? "",
      eventDate: e.eventDate.slice(0, 10),
      endDate: e.endDate ? e.endDate.slice(0, 10) : "",
      eventType: e.eventType,
      location: e.location ?? "",
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.title || !form.eventDate) {
      showToast("Title and date are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        description: form.description || null,
        endDate: form.endDate || null,
        location: form.location || null,
      };
      if (editing) {
        await api.put(`/school/events/${editing.id}`, payload);
        showToast("Event updated.", "success");
      } else {
        await api.post("/school/events", payload);
        showToast("Event created.", "success");
      }
      setShowModal(false);
      load();
    } catch {
      showToast("Failed to save event.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this event?")) return;
    setDeleting(id);
    try {
      await api.delete(`/school/events/${id}`);
      showToast("Deleted.", "success");
      load();
    } catch {
      showToast("Failed to delete.", "error");
    } finally {
      setDeleting(null);
    }
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-semibold">School Events & Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-36 text-center">{monthName} {year}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          {canEdit && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add Event
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            No events for {monthName} {year}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events
            .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
            .map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{e.title}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[e.eventType]}`}>
                          {e.eventType}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(e.eventDate).toLocaleDateString()}
                        {e.endDate && e.endDate !== e.eventDate && ` – ${new Date(e.endDate).toLocaleDateString()}`}
                        {e.location && ` · ${e.location}`}
                      </div>
                      {e.description && <p className="text-sm">{e.description}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(e.id)} disabled={deleting === e.id}>
                          {deleting === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{editing ? "Edit Event" : "New Event"}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Title *</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.eventType}
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value as any }))}
                >
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Start Date *</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    value={form.eventDate}
                    onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Location</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. School Hall"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <textarea
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
