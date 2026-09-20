import { useState, useEffect, useCallback } from "react";
import { BedDouble, Plus, Loader2, AlertTriangle, WrenchIcon, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../lib/api";

interface Room {
  id: string;
  room_number: string;
  floor?: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "HOUSEKEEPING" | "OUT_OF_ORDER";
  housekeeping_status: "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";
  room_type_id: string;
  room_type_name: string;
  rate_per_night: number;
  capacity: number;
  is_active: boolean;
}

interface RoomType { id: string; name: string; rate_per_night: number; }

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700 border-green-200",
  OCCUPIED: "bg-blue-100 text-blue-700 border-blue-200",
  MAINTENANCE: "bg-orange-100 text-orange-700 border-orange-200",
  HOUSEKEEPING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  OUT_OF_ORDER: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available", OCCUPIED: "Occupied", MAINTENANCE: "Maintenance",
  HOUSEKEEPING: "Housekeeping", OUT_OF_ORDER: "Out of Order",
};

const EMPTY_FORM = { roomTypeId: "", roomNumber: "", floor: "" };

export function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, typesRes] = await Promise.all([
        api.get("/hospitality/rooms"),
        api.get("/hospitality/room-types"),
      ]);
      setRooms(roomsRes.data.data ?? []);
      setRoomTypes(typesRes.data.data ?? []);
    } catch {
      setError("Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.roomTypeId || !form.roomNumber.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/hospitality/rooms", { roomTypeId: form.roomTypeId, roomNumber: form.roomNumber.trim(), floor: form.floor.trim() || null });
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create room.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (roomId: string, status: string) => {
    try {
      await api.patch(`/hospitality/rooms/${roomId}/status`, { status });
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to update status.");
    }
  };

  const filtered = statusFilter === "ALL" ? rooms : rooms.filter((r) => r.status === statusFilter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BedDouble className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Room Management</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Room
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["ALL", "AVAILABLE", "OCCUPIED", "HOUSEKEEPING", "MAINTENANCE", "OUT_OF_ORDER"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {s === "ALL" ? `All (${rooms.length})` : `${STATUS_LABELS[s]} (${rooms.filter((r) => r.status === s).length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 mb-6 bg-card">
          <h2 className="font-semibold mb-4">Add New Room</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Room Type *</label>
              <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}>
                <option value="">Select type…</option>
                {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} — GHS {Number(rt.rate_per_night).toFixed(2)}/night</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Room Number *</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. 101" />
            </div>
            <div>
              <label className="text-sm font-medium">Floor</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. Ground" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null} Add Room
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="border px-4 py-2 rounded text-sm hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">No rooms found.</div>
          )}
          {filtered.map((room) => (
            <div key={room.id} className={`border-2 rounded-xl p-4 ${STATUS_COLORS[room.status]}`}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xl font-bold">{room.room_number}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">{STATUS_LABELS[room.status]}</span>
              </div>
              <p className="text-sm font-medium">{room.room_type_name}</p>
              {room.floor && <p className="text-xs opacity-75">Floor: {room.floor}</p>}
              <p className="text-xs mt-1 opacity-75">GHS {Number(room.rate_per_night).toFixed(2)}/night</p>
              <p className="text-xs mt-1 opacity-75">HK: {room.housekeeping_status}</p>
              {room.status === "AVAILABLE" && (
                <div className="mt-3 flex gap-1">
                  <button onClick={() => handleStatusChange(room.id, "MAINTENANCE")} title="Mark Maintenance" className="text-orange-600 hover:opacity-75">
                    <WrenchIcon className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleStatusChange(room.id, "OUT_OF_ORDER")} title="Out of Order" className="text-red-600 hover:opacity-75">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {room.status === "HOUSEKEEPING" && (
                <div className="mt-3 flex gap-1">
                  <button onClick={() => handleStatusChange(room.id, "AVAILABLE")} title="Mark Available" className="text-green-700 hover:opacity-75">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {room.status === "MAINTENANCE" && (
                <div className="mt-3">
                  <button onClick={() => handleStatusChange(room.id, "AVAILABLE")} title="Mark Available" className="text-green-700 hover:opacity-75">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
