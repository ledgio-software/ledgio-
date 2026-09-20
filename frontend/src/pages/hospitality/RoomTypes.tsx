import { useState, useEffect, useCallback } from "react";
import { LayoutGrid, Plus, Pencil, Save, X, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";

interface RoomType {
  id: string;
  name: string;
  description?: string;
  rate_per_night: number;
  capacity: number;
  amenities: string[];
  is_active: boolean;
}

const EMPTY_FORM = { name: "", description: "", ratePerNight: "", capacity: "2", amenities: "", isActive: true };

export function RoomTypes() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchRoomTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/hospitality/room-types");
      setRoomTypes(res.data.data ?? []);
    } catch {
      setError("Failed to load room types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoomTypes(); }, [fetchRoomTypes]);

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); };
  const openEdit = (rt: RoomType) => {
    setForm({ name: rt.name, description: rt.description ?? "", ratePerNight: String(rt.rate_per_night), capacity: String(rt.capacity), amenities: rt.amenities.join(", "), isActive: rt.is_active });
    setEditId(rt.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.ratePerNight) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        ratePerNight: Number(form.ratePerNight),
        capacity: Number(form.capacity) || 2,
        amenities: form.amenities.split(",").map((a) => a.trim()).filter(Boolean),
        isActive: form.isActive,
      };
      if (editId) {
        await api.put(`/hospitality/room-types/${editId}`, payload);
      } else {
        await api.post("/hospitality/room-types", payload);
      }
      setShowForm(false);
      fetchRoomTypes();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to save room type.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Room Types</h1>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Room Type
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {showForm && (
        <div className="border rounded-lg p-4 mb-6 bg-card">
          <h2 className="font-semibold mb-4">{editId ? "Edit Room Type" : "New Room Type"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium">Name *</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Deluxe Double" />
            </div>
            <div>
              <label className="text-sm font-medium">Rate per Night (GHS) *</label>
              <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.ratePerNight} onChange={(e) => setForm({ ...form, ratePerNight: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium">Capacity (guests)</label>
              <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} min={1} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea className="w-full border rounded px-3 py-2 mt-1 text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Amenities (comma-separated)</label>
              <input className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="e.g. AC, TV, WiFi, En-suite bathroom" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <label htmlFor="isActive" className="text-sm">Active</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border px-4 py-2 rounded text-sm hover:bg-muted">
              <X className="h-4 w-4" /> Cancel
            </button>
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
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Rate/Night</th>
                <th className="text-left px-4 py-3 font-medium">Capacity</th>
                <th className="text-left px-4 py-3 font-medium">Amenities</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No room types yet. Create your first one.</td></tr>
              )}
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{rt.name}</td>
                  <td className="px-4 py-3">GHS {Number(rt.rate_per_night).toFixed(2)}</td>
                  <td className="px-4 py-3">{rt.capacity} guest{rt.capacity !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rt.amenities.join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${rt.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {rt.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(rt)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
