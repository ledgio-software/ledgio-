import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { FileText, Download, BarChart2, TrendingUp, Users, CalendarCheck, RefreshCw } from "lucide-react";

type ReportType = "giving" | "attendance" | "members" | "visitors" | "comparison";

interface Branch { id: string; name: string }
interface GivingSummary {
  by_type: { giving_type: string; total: number; count: number }[];
  by_month: { month: string; total: number }[];
  grand_total: { total: number; count: number };
}
interface AttendanceSummary {
  totalMembers: number;
  lastSundayCount: number;
  lastSundayDate: string | null;
  avgSundayAttendance: number;
  trend: { session_date: string; total_count: number; title: string }[];
}
interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  overall_score: number;
  total_giving: number;
  avg_attendance: number;
  member_count: number;
}

export function ChurchReports() {
  const { showToast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportType>("giving");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [branchFilter, setBranchFilter] = useState("");

  // Report data
  const [givingData, setGivingData] = useState<GivingSummary | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const loadBranches = useCallback(async () => {
    try {
      const r = await api.get("/church/branches");
      setBranches(r.data.data ?? []);
    } catch { /* branches are optional filter */ }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      switch (activeReport) {
        case "giving": {
          const r = await api.get(`/church/giving/summary?${params}`);
          setGivingData(r.data.data);
          break;
        }
        case "attendance": {
          const r = await api.get("/church/attendance/summary");
          setAttendanceData(r.data.data);
          break;
        }
        case "comparison": {
          const r = await api.get("/church/branches/leaderboard");
          setLeaderboard(r.data.data ?? []);
          break;
        }
      }
    } catch {
      showToast("Failed to load report", "error");
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateFrom, dateTo, showToast]);

  useEffect(() => { runReport(); }, [runReport]);

  function handlePrint() {
    window.print();
  }

  const REPORT_TABS: { key: ReportType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "giving", label: "Giving Report", icon: TrendingUp },
    { key: "attendance", label: "Attendance Report", icon: CalendarCheck },
    { key: "members", label: "Members Report", icon: Users },
    { key: "comparison", label: "Branch Comparison", icon: BarChart2 },
  ];

  return (
    <div className="p-6 space-y-6 print:p-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Church Reports</h1>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90">
          <Download className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800" />
            </div>
            {branches.length > 0 && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Branch</label>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                  className="border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800">
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={runReport} className="flex items-center gap-2 px-4 py-2 border rounded text-sm hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Report type tabs */}
      <div className="flex gap-1 border-b print:hidden overflow-x-auto">
        {REPORT_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveReport(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeReport === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading report…</p>
      ) : (
        <div className="space-y-6">
          {/* GIVING REPORT */}
          {activeReport === "giving" && givingData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Giving</p>
                    <p className="text-2xl font-bold text-green-600">{Number(givingData.grand_total?.total ?? 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Records</p>
                    <p className="text-2xl font-bold">{givingData.grand_total?.count ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Giving Types</p>
                    <p className="text-2xl font-bold">{givingData.by_type?.length ?? 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm mb-3">By Giving Type</p>
                    <div className="space-y-2">
                      {(givingData.by_type ?? []).map(t => {
                        const pct = givingData.grand_total?.total > 0 ? (t.total / givingData.grand_total.total) * 100 : 0;
                        return (
                          <div key={t.giving_type}>
                            <div className="flex justify-between text-xs mb-1">
                              <span>{t.giving_type.replace(/_/g, " ")}</span>
                              <span className="font-medium">{Number(t.total).toLocaleString()} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm mb-3">Monthly Trend</p>
                    <div className="space-y-2">
                      {(givingData.by_month ?? []).slice(-6).map(m => (
                        <div key={m.month} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{m.month}</span>
                          <span className="font-medium">{Number(m.total).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ATTENDANCE REPORT */}
          {activeReport === "attendance" && attendanceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{attendanceData.totalMembers}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Last Sunday</p>
                  <p className="text-2xl font-bold">{attendanceData.lastSundayCount}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Avg Attendance</p>
                  <p className="text-2xl font-bold">{Number(attendanceData.avgSundayAttendance ?? 0).toFixed(0)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold">
                    {attendanceData.totalMembers > 0 ? ((attendanceData.avgSundayAttendance / attendanceData.totalMembers) * 100).toFixed(0) : 0}%
                  </p>
                </CardContent></Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-3">Attendance Trend (Last 8 Sessions)</p>
                  {attendanceData.trend?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sessions yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left py-2 pr-4">Date</th>
                          <th className="text-left py-2 pr-4">Session</th>
                          <th className="text-right py-2">Count</th>
                        </tr></thead>
                        <tbody>
                          {(attendanceData.trend ?? []).map((s, i) => (
                            <tr key={i} className="border-b hover:bg-muted/30">
                              <td className="py-2 pr-4">{new Date(s.session_date).toLocaleDateString()}</td>
                              <td className="py-2 pr-4 text-muted-foreground">{s.title}</td>
                              <td className="py-2 text-right font-medium">{s.total_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* MEMBERS REPORT */}
          {activeReport === "members" && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  For a full members report, go to the <strong>Members</strong> page and use the export feature.
                  This section will be expanded with member growth trends, cell group breakdown, and retention metrics.
                </p>
              </CardContent>
            </Card>
          )}

          {/* BRANCH COMPARISON */}
          {activeReport === "comparison" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Side-by-side comparison of all branches by key metrics.</p>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No branch data available yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-2 pr-4">Rank</th>
                        <th className="text-left py-2 pr-4">Branch</th>
                        <th className="text-right py-2 pr-4">Members</th>
                        <th className="text-right py-2 pr-4">Total Giving</th>
                        <th className="text-right py-2 pr-4">Avg Attendance</th>
                        <th className="text-right py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((b, idx) => (
                        <tr key={b.id} className={`border-b hover:bg-muted/30 ${idx === 0 ? "font-medium" : ""}`}>
                          <td className="py-2 pr-4">
                            <span className={`text-xs font-bold ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                              #{b.rank}
                            </span>
                          </td>
                          <td className="py-2 pr-4">{b.name}</td>
                          <td className="py-2 pr-4 text-right">{b.member_count}</td>
                          <td className="py-2 pr-4 text-right text-green-600">{Number(b.total_giving ?? 0).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right">{Number(b.avg_attendance ?? 0).toFixed(0)}</td>
                          <td className="py-2 text-right font-medium text-primary">{Number(b.overall_score ?? 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bar chart visualization */}
              {leaderboard.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm mb-3">Overall Score Comparison</p>
                    <div className="space-y-2">
                      {leaderboard.map((b, idx) => {
                        const maxScore = leaderboard[0].overall_score ?? 1;
                        const pct = maxScore > 0 ? ((b.overall_score ?? 0) / maxScore) * 100 : 0;
                        return (
                          <div key={b.id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className={idx === 0 ? "font-medium" : ""}>{b.name}</span>
                              <span>{Number(b.overall_score ?? 0).toFixed(1)}</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${idx === 0 ? "bg-yellow-400" : "bg-primary"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
