import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";

interface Room {
  id: string;
  room_number: string;
  floor?: string;
  room_type_name: string;
  status: string;
  housekeeping_status: "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";
}

const HK_COLUMNS = [
  { key: "DIRTY", label: "Needs Cleaning", color: "border-orange-300 bg-orange-50", chipColor: "bg-orange-100 text-orange-700" },
  { key: "CLEAN", label: "Clean", color: "border-blue-300 bg-blue-50", chipColor: "bg-blue-100 text-blue-700" },
  { key: "INSPECTED", label: "Inspected", color: "border-green-300 bg-green-50", chipColor: "bg-green-100 text-green-700" },
  { key: "OUT_OF_ORDER", label: "Out of Order", color: "border-red-300 bg-red-50", chipColor: "bg-red-100 text-red-700" },
];

const TRANSITIONS: Record<string, string[]> = {
  DIRTY: ["CLEAN", "OUT_OF_ORDER"],
  CLEAN: ["INSPECTED", "DIRTY"],
  INSPECTED: ["DIRTY"],
  OUT_OF_ORDER: ["CLEAN"],
};

export function HousekeepingBoard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/hospitality/rooms");
      setRooms(res.data.data ?? []);
    } catch {
      setError("Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const updateHkStatus = async (roomId: string, housekeepingStatus: string) => {
    setUpdating(roomId);
    setError(null);
    try {
      await api.patch(`/hospitality/rooms/${roomId}/status`, { housekeepingStatus });
      fetchRooms();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to update status.");
    } finally {
      setUpdating(null);
    }
  };

  const grouped = HK_COLUMNS.reduce<Record<string, Room[]>>((acc, col) => {
    acc[col.key] = rooms.filter((r) => r.housekeeping_status === col.key);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Housekeeping Board</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {HK_COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3 min-h-64`}>
              <h2 className="font-semibold text-sm mb-3">
                {col.label} <span className="ml-1 text-xs opacity-60">({grouped[col.key]?.length ?? 0})</span>
              </h2>
              <div className="space-y-2">
                {(grouped[col.key] ?? []).map((room) => (
                  <div key={room.id} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">Room {room.room_number}</p>
                        <p className="text-xs text-muted-foreground">{room.room_type_name}</p>
                        {room.floor && <p className="text-xs text-muted-foreground">Floor: {room.floor}</p>}
                        <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${room.status === "OCCUPIED" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {room.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(TRANSITIONS[col.key] ?? []).map((next) => (
                        <button key={next} onClick={() => updateHkStatus(room.id, next)} disabled={updating === room.id}
                          className="text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-50 transition-colors">
                          → {next}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(grouped[col.key] ?? []).length === 0 && (
                  <p className="text-xs text-center py-4 opacity-50">No rooms</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
