import { useState, useEffect, useCallback } from "react";
import { Moon, Loader2, AlertTriangle, TrendingUp, BedDouble, DollarSign, Percent } from "lucide-react";
import { api } from "../../lib/api";

interface AuditData {
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyPct: number;
  roomRevenue: number;
  revpar: number;
}

interface OccupancyDay { date: string; totalRooms: number; occupiedRooms: number; occupancyPct: number; }

export function NightAudit() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [trend, setTrend] = useState<OccupancyDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [auditRes, trendRes] = await Promise.all([
        api.get("/hospitality/reports/night-audit", { params: { date } }),
        api.get("/hospitality/reports/occupancy", {
          params: { from: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10), to: date },
        }),
      ]);
      setAudit(auditRes.data.data);
      setTrend(trendRes.data.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to load night audit data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const maxOccupancy = Math.max(...trend.map((d) => d.occupancyPct), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Moon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Night Audit</h1>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm" max={new Date().toISOString().slice(0, 10)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : audit && audit.totalRooms === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <BedDouble className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No rooms set up yet</p>
          <p className="text-sm mt-1">Add rooms and room types in the Rooms section first.</p>
        </div>
      ) : audit ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><BedDouble className="h-4 w-4" /> Occupancy</div>
              <p className="text-3xl font-bold">{audit.occupancyPct}%</p>
              <p className="text-xs text-muted-foreground mt-1">{audit.occupiedRooms} / {audit.totalRooms} rooms</p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><DollarSign className="h-4 w-4" /> Room Revenue</div>
              <p className="text-3xl font-bold">GHS {Number(audit.roomRevenue).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">for {date}</p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="h-4 w-4" /> RevPAR</div>
              <p className="text-3xl font-bold">GHS {Number(audit.revpar).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue per available room</p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Percent className="h-4 w-4" /> Available</div>
              <p className="text-3xl font-bold">{audit.totalRooms - audit.occupiedRooms}</p>
              <p className="text-xs text-muted-foreground mt-1">rooms available</p>
            </div>
          </div>

          {/* 14-day Occupancy Trend */}
          <div className="border rounded-xl p-4 bg-card">
            <h2 className="font-semibold mb-4">14-Day Occupancy Trend</h2>
            <div className="flex items-end gap-1 h-32">
              {trend.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/20 rounded-sm relative flex items-end" style={{ height: "100px" }}>
                    <div
                      className="w-full bg-primary rounded-sm transition-all"
                      style={{ height: `${(day.occupancyPct / maxOccupancy) * 100}%` }}
                      title={`${day.date}: ${day.occupancyPct}%`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{day.date.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>Occupancy %</span>
              <span>100%</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
