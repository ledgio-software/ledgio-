import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Plus, Loader2, AlertTriangle, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";

interface Reservation {
  id: string;
  reservation_number: string;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  room_number: string;
  room_type_name: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  rate_per_night: number;
  adults: number;
  children: number;
}

interface Room {
  id: string;
  room_number: string;
  room_type_name: string;
  rate_per_night: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-green-100 text-green-700",
  CHECKED_OUT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
};

const EMPTY_FORM = {
  guestName: "", guestEmail: "", guestPhone: "",
  roomId: "", checkInDate: "", checkOutDate: "",
  adults: "1", children: "0", specialRequests: "", depositAmount: "0",
};

export function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("CONFIRMED");
  const [form, setForm] = useState(EMPTY_FORM);
  const navigate = useNavigate();

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await api.get("/hospitality/reservations", { params });
      setReservations(res.data.data ?? []);
    } catch {
      setError("Failed to load reservations.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get("/hospitality/rooms");
      setRooms((res.data.data ?? []).filter((r: Room) => r.status === "AVAILABLE"));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleCreate = async () => {
    if (!form.guestName.trim() || !form.roomId || !form.checkInDate || !form.checkOutDate) {
      setError("Guest name, room, check-in, and check-out dates are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/hospitality/reservations", {
        guestName: form.guestName.trim(),
        guestEmail: form.guestEmail.trim() || null,
        guestPhone: form.guestPhone.trim() || null,
        roomId: form.roomId,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        specialRequests: form.specialRequests.trim() || null,
        depositAmount: Number(form.depositAmount) || 0,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchReservations();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create reservation.");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Reservations</h1>
        </div>
        <button onClick={() => { fetchRooms(); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Reservation
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["ALL", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {s === "ALL" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 mb-6 bg-card">
          <h2 className="font-semibold mb-4">New Reservation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium">Guest Name *</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Room *</label>
              <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">Select available room…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number} — {r.room_type_name} (GHS {Number(r.rate_per_night).toFixed(2)}/night)</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Deposit (GHS)</label>
              <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} min={0} />
            </div>
            <div>
              <label className="text-sm font-medium">Check-in Date *</label>
              <input type="date" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.checkInDate} min={today} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Check-out Date *</label>
              <input type="date" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.checkOutDate} min={form.checkInDate || today} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Adults</label>
              <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.adults} min={1} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Children</label>
              <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.children} min={0} onChange={(e) => setForm({ ...form, children: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Special Requests</label>
              <textarea className="w-full border rounded px-3 py-2 mt-1 text-sm" rows={2} value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} placeholder="Any special requests or notes" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null} Create Reservation
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }} className="border px-4 py-2 rounded text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Res #</th>
                <th className="text-left px-4 py-3 font-medium">Guest</th>
                <th className="text-left px-4 py-3 font-medium">Room</th>
                <th className="text-left px-4 py-3 font-medium">Check-in</th>
                <th className="text-left px-4 py-3 font-medium">Check-out</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Rate/Night</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No reservations found.</td></tr>
              )}
              {reservations.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/hospitality/reservations/${r.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs">{r.reservation_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.guest_name}</p>
                    {r.guest_phone && <p className="text-xs text-muted-foreground">{r.guest_phone}</p>}
                  </td>
                  <td className="px-4 py-3">Room {r.room_number} <span className="text-xs text-muted-foreground">({r.room_type_name})</span></td>
                  <td className="px-4 py-3">{r.check_in_date}</td>
                  <td className="px-4 py-3">{r.check_out_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[r.status] ?? ""}`}>{r.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3">GHS {Number(r.rate_per_night).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
