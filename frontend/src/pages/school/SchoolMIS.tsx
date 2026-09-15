import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { BarChart2, Loader2, Users, DollarSign, TrendingUp, CalendarDays, UserCheck, AlertTriangle } from "lucide-react";

interface AcademicTerm { id: string; name: string; academicYear: string; isCurrent: boolean; }
interface ByClass { className: string; count: number; }
interface UpcomingEvent { id: string; title: string; eventDate: string; eventType: string; location?: string; }
interface MISData {
  totalStudents: number;
  activeStudents: number;
  byClass: ByClass[];
  totalFeesDemand: number;
  totalFeesCollected: number;
  collectionRate: number;
  totalDefaulters: number;
  attendanceSummary: { avgAttendanceRate: number; totalDaysRecorded: number };
  assessmentSummary: { avgScore: number };
  admissionsSummary: { pending: number; accepted: number; enrolled: number };
  upcomingEvents: UpcomingEvent[];
}

const TYPE_COLORS: Record<string, string> = {
  ACADEMIC: "bg-blue-100 text-blue-800", SPORTS: "bg-green-100 text-green-800",
  CULTURAL: "bg-purple-100 text-purple-800", HOLIDAY: "bg-amber-100 text-amber-800",
  EXAM: "bg-red-100 text-red-800", MEETING: "bg-slate-100 text-slate-800", OTHER: "bg-gray-100 text-gray-800",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ComponentType<any>; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color ?? "bg-blue-50"}`}>
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SchoolMIS() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [data, setData] = useState<MISData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = selectedTermId ? `?termId=${selectedTermId}` : "";
      const res = await api.get(`/school/mis${q}`);
      setData(res.data?.data ?? null);
    } catch { showToast("Failed to load MIS data", "error"); }
    finally { setLoading(false); }
  }, [selectedTermId, showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  const maxStudents = data ? Math.max(...data.byClass.map((c) => c.count), 1) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-slate-600" />
          <h1 className="text-xl font-semibold">MIS Dashboard</h1>
        </div>
        <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
          <option value="">— All Terms —</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}</option>)}
        </select>
      </div>

      {data && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Students" value={data.totalStudents} sub={`${data.activeStudents} active`} color="bg-blue-50" />
            <StatCard icon={DollarSign} label="Fees Collected" value={fmt(data.totalFeesCollected)} sub={`of ${fmt(data.totalFeesDemand)} demand`} color="bg-green-50" />
            <StatCard icon={UserCheck} label="Attendance Rate" value={`${data.attendanceSummary.avgAttendanceRate}%`} sub={`${data.attendanceSummary.totalDaysRecorded} records total`} color="bg-amber-50" />
            <StatCard icon={TrendingUp} label="Avg Assessment" value={`${data.assessmentSummary.avgScore}%`} sub="across all subjects" color="bg-purple-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Students by Class Chart */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold mb-3">Students by Class</h2>
                {data.byClass.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No class data.</p>
                ) : (
                  <div className="space-y-2">
                    {data.byClass.map((c) => (
                      <div key={c.className} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{c.className}</span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div
                            className="h-5 bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max(8, (c.count / maxStudents) * 100)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{c.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fee Collection Progress */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h2 className="text-sm font-semibold">Fee Collection Summary</h2>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Collection Rate</span>
                    <span className="font-medium">{data.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${data.collectionRate >= 80 ? "bg-green-500" : data.collectionRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, data.collectionRate)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Collected: {fmt(data.totalFeesCollected)}</span>
                    <span>Demand: {fmt(data.totalFeesDemand)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="border rounded p-2 text-center">
                    <div className="text-lg font-bold text-red-600">{data.totalDefaulters}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Defaulters</div>
                  </div>
                  <div className="border rounded p-2 text-center">
                    <div className="text-lg font-bold text-amber-600">{data.admissionsSummary.pending}</div>
                    <div className="text-xs text-muted-foreground">Pending Admissions</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{data.admissionsSummary.accepted}</div>
                    <div className="text-xs text-muted-foreground">Accepted</div>
                  </div>
                  <div className="border rounded p-2 text-center">
                    <div className="text-lg font-bold text-blue-600">{data.admissionsSummary.enrolled}</div>
                    <div className="text-xs text-muted-foreground">Enrolled</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Upcoming Events (next 30 days)</h2>
              </div>
              {data.upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events.</p>
              ) : (
                <div className="space-y-2">
                  {data.upcomingEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 p-2 rounded border">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${TYPE_COLORS[e.eventType] ?? "bg-gray-100 text-gray-800"}`}>{e.eventType}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{e.title}</div>
                        {e.location && <div className="text-xs text-muted-foreground">{e.location}</div>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{new Date(e.eventDate).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Select a term to view MIS data.</CardContent></Card>
      )}
    </div>
  );
}
