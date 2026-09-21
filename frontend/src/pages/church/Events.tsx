import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { CalendarDays, Plus, Users, MapPin } from "lucide-react";

interface ChurchEvent {
  id: string;
  title: string;
  event_type: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  venue: string | null;
  expected_attendance: number | null;
  actual_attendance: number | null;
  is_active: boolean;
  registration_count: number;
}

interface Registration {
  id: string;
  member_id: string | null;
  name: string;
  phone: string | null;
  attended: boolean;
  registered_at: string;
}

const EVENT_TYPES = ["GENERAL", "CRUSADE", "CONFERENCE", "ANNIVERSARY", "YOUTH_CAMP", "WORKSHOP", "FUNDRAISER", "OTHER"];
const today = new Date().toISOString().split("T")[0];

export function ChurchEvents() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upcoming, setUpcoming] = useState(false);

  const [form, setForm] = useState({ title: "", eventType: "GENERAL", description: "", eventDate: today, endDate: "", venue: "", expectedAttendance: "" });
  const [regForm, setRegForm] = useState({ visitorName: "", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/church/events${upcoming ? "?upcoming=true" : ""}`);
      setEvents(r.data.data);
    } catch { showToast("Failed to load events", "error"); }
    finally { setLoading(false); }
  }, [upcoming, showToast]);

  useEffect(() => { load(); }, [load]);

  async function loadRegistrations(eventId: string) {
    try {
      const r = await api.get(`/church/events/${eventId}/registrations`);
      setRegistrations(r.data.data);
    } catch { showToast("Failed to load registrations", "error"); }
  }

  async function handleSelect(e: ChurchEvent) {
    setSelected(e);
    await loadRegistrations(e.id);
  }

  async function handleAdd() {
    if (!form.title || !form.eventDate) { showToast("Title and date required", "error"); return; }
    setSaving(true);
    try {
      await api.post("/church/events", {
        title: form.title, eventType: form.eventType,
        description: form.description || undefined, eventDate: form.eventDate,
        endDate: form.endDate || undefined, venue: form.venue || undefined,
        expectedAttendance: form.expectedAttendance ? Number(form.expectedAttendance) : undefined,
      });
      showToast("Event created", "success");
      setShowAdd(false);
      setForm({ title: "", eventType: "GENERAL", description: "", eventDate: today, endDate: "", venue: "", expectedAttendance: "" });
      load();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleRegister() {
    if (!selected || !regForm.visitorName) { showToast("Name required", "error"); return; }
    setSaving(true);
    try {
      await api.post(`/church/events/${selected.id}/registrations`, { visitorName: regForm.visitorName, phone: regForm.phone || undefined });
      showToast("Registered", "success");
      setShowRegister(false);
      setRegForm({ visitorName: "", phone: "" });
      await loadRegistrations(selected.id);
    } catch { showToast("Failed to register", "error"); }
    finally { setSaving(false); }
  }

  async function toggleAttended(regId: string, attended: boolean) {
    try {
      await api.patch(`/church/events/${selected!.id}/registrations/${regId}/attended`, { attended: !attended });
      await loadRegistrations(selected!.id);
    } catch { showToast("Failed to update", "error"); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Events & Programs</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={upcoming} onChange={e => setUpcoming(e.target.checked)} className="rounded" />
            Upcoming only
          </label>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event list */}
        <div className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events found.</p>
          ) : events.map(e => (
            <Card key={e.id} className={`cursor-pointer transition-all ${selected?.id === e.id ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={() => handleSelect(e)}>
              <CardContent className="p-4">
                <p className="font-semibold truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.event_type.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString()}</p>
                {e.venue && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{e.venue}</p>}
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Users className="h-3 w-3" />{e.registration_count} registered</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Registrations panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Select an event to view registrations.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold">{selected.title}</h2>
                    <p className="text-xs text-muted-foreground">{new Date(selected.event_date).toLocaleDateString()} {selected.venue ? `· ${selected.venue}` : ""}</p>
                    {selected.expected_attendance && (
                      <p className="text-xs text-muted-foreground">Expected: {selected.expected_attendance} · Registered: {registrations.length} · Attended: {registrations.filter(r => r.attended).length}</p>
                    )}
                  </div>
                  <button onClick={() => setShowRegister(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Plus className="h-4 w-4" /> Register
                  </button>
                </div>
                {registrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No registrations yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Name</th>
                        <th className="pb-2 pr-3 font-medium">Phone</th>
                        <th className="pb-2 pr-3 font-medium">Registered</th>
                        <th className="pb-2 font-medium">Attended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map(r => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{r.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{r.phone ?? "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{new Date(r.registered_at).toLocaleDateString()}</td>
                          <td className="py-2">
                            <input type="checkbox" checked={r.attended} onChange={() => toggleAttended(r.id, r.attended)} className="rounded cursor-pointer" />
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

      {/* Add event modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">New Event</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Event Date *</label>
                <input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Expected Attendance</label>
                <input type="number" min="0" value={form.expectedAttendance} onChange={e => setForm(f => ({ ...f, expectedAttendance: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Venue</label>
                <input type="text" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border rounded px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Register for {selected.title}</h2>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name *</label>
              <input type="text" value={regForm.visitorName} onChange={e => setRegForm(f => ({ ...f, visitorName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input type="text" value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-background" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowRegister(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleRegister} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Register"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
