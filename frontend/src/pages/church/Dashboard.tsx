import { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Users, CalendarCheck, Heart, TrendingUp, Users2, LayoutDashboard } from "lucide-react";

interface DashboardData {
  members: { total: number; active: number; new_this_month: number };
  lastSunday: { total_count: number; session_date: string; title: string } | null;
  pledges: { total_pledged: number; total_fulfilled: number; active_count: number };
  givingThisMonth: { total: number; count: number };
  attendanceTrend: { session_date: string; total_count: number; title: string }[];
  givingByType: { giving_type: string; total: number }[];
  cellGroupCount: number;
}

function fmt(n: number, currency = "GHS") {
  return `${currency} ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function ChurchDashboard() {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/church/dashboard")
      .then(r => setData(r.data.data))
      .catch(() => showToast("Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!data) return null;

  const pledgePct = data.pledges.total_pledged > 0
    ? Math.round((data.pledges.total_fulfilled / data.pledges.total_pledged) * 100)
    : 0;

  const maxTrend = data.attendanceTrend.reduce((m, r) => Math.max(m, r.total_count ?? 0), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Church Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Active Members</p>
              <p className="text-2xl font-bold">{data.members.active}</p>
              <p className="text-xs text-muted-foreground">+{data.members.new_this_month} this month</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users2 className="h-8 w-8 text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Cell Groups</p>
              <p className="text-2xl font-bold">{data.cellGroupCount}</p>
              <p className="text-xs text-muted-foreground">{data.members.total} total members</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarCheck className="h-8 w-8 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Last Sunday</p>
              <p className="text-2xl font-bold">{data.lastSunday?.total_count ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {data.lastSunday
                  ? new Date(data.lastSunday.session_date).toLocaleDateString()
                  : "No data yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Giving This Month</p>
              <p className="text-lg font-bold">{fmt(data.givingThisMonth.total)}</p>
              <p className="text-xs text-muted-foreground">{data.givingThisMonth.count} transactions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance trend */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> Sunday Attendance Trend
            </h2>
            {data.attendanceTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance data yet.</p>
            ) : (
              <div className="space-y-2">
                {data.attendanceTrend.map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {new Date(row.session_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                      <div
                        className="h-5 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round((row.total_count / maxTrend) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right shrink-0">{row.total_count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pledges + Giving by type */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4" /> Pledge Overview
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-muted-foreground">Total Pledged</p>
                  <p className="font-bold">{fmt(data.pledges.total_pledged)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fulfilled</p>
                  <p className="font-bold text-green-600">{fmt(data.pledges.total_fulfilled)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-green-500 transition-all"
                    style={{ width: `${pledgePct}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{pledgePct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{data.pledges.active_count} active pledges</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Giving by Type (This Month)
              </h2>
              {data.givingByType.length === 0 ? (
                <p className="text-sm text-muted-foreground">No giving recorded this month.</p>
              ) : (
                <div className="space-y-2">
                  {data.givingByType.map((row, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{row.giving_type}</span>
                      <span className="font-medium">{fmt(row.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
