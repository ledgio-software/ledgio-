import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import {
  ArrowLeft, Users, TrendingUp, CalendarCheck, Calendar, UserPlus,
  MapPin, Phone, Mail, Building2, Download, RefreshCw
} from "lucide-react";

type TabKey = "overview" | "members" | "giving" | "attendance" | "events" | "visitors" | "report";

interface BranchSummary {
  id: string;
  name: string;
  address: string | null;
  pastor_name: string | null;
  phone: string | null;
  email: string | null;
  established_date: string | null;
  is_active: boolean;
  member_count: number;
  total_giving_this_month: number;
  total_giving_all_time: number;
  last_attendance_count: number;
  avg_attendance: number;
  upcoming_events: number;
  visitors_this_month: number;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  membership_status: string;
  membership_date: string | null;
  cell_group_name: string | null;
}

interface Giving {
  id: string;
  giving_date: string;
  giving_type: string;
  amount: number;
  currency: string;
  member_name: string | null;
  payment_method: string;
}

interface AttendanceSession {
  id: string;
  title: string;
  session_date: string;
  session_type: string;
  total_count: number | null;
}

interface ChurchEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  venue: string | null;
  is_active: boolean;
}

interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  visit_date: string;
  service_type: string;
  follow_up_status: string;
}

const TABS: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "members", label: "Members", icon: Users },
  { key: "giving", label: "Giving", icon: TrendingUp },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "events", label: "Events", icon: Calendar },
  { key: "visitors", label: "Visitors", icon: UserPlus },
  { key: "report", label: "Report", icon: Download },
];

export function ChurchBranchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [summary, setSummary] = useState<BranchSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [giving, setGiving] = useState<Giving[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadSummary = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/church/branches/${id}/summary`);
      setSummary(res.data.data);
    } catch {
      showToast("Failed to load branch", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadTabData = useCallback(async (tab: TabKey) => {
    if (!id) return;
    setTabLoading(true);
    try {
      switch (tab) {
        case "members": {
          const r = await api.get(`/church/branches/${id}/members`);
          setMembers(r.data.data);
          break;
        }
        case "giving": {
          const params = new URLSearchParams();
          if (dateFrom) params.set("from", dateFrom);
          if (dateTo) params.set("to", dateTo);
          const r = await api.get(`/church/branches/${id}/giving?${params}`);
          setGiving(r.data.data);
          break;
        }
        case "attendance": {
          const r = await api.get(`/church/branches/${id}/attendance`);
          setAttendance(r.data.data);
          break;
        }
        case "events": {
          const r = await api.get(`/church/branches/${id}/events`);
          setEvents(r.data.data);
          break;
        }
        case "visitors": {
          const r = await api.get(`/church/branches/${id}/visitors`);
          setVisitors(r.data.data);
          break;
        }
        case "report": {
          const r = await api.get(`/church/branches/${id}/report`);
          setReportData(r.data.data);
          break;
        }
      }
    } catch {
      showToast("Failed to load tab data", "error");
    } finally {
      setTabLoading(false);
    }
  }, [id, showToast, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab !== "overview") {
      loadTabData(activeTab);
    }
  }, [activeTab, loadTabData]);

  function handlePrintReport() {
    window.print();
  }

  if (loading) return <div className="p-6"><p className="text-sm text-muted-foreground">Loading branch…</p></div>;
  if (!summary) return <div className="p-6"><p className="text-sm text-muted-foreground">Branch not found.</p></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/church/branches")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{summary.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${summary.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              {summary.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            {summary.pastor_name && <span>Pastor: {summary.pastor_name}</span>}
            {summary.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{summary.address}</span>}
            {summary.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{summary.phone}</span>}
            {summary.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{summary.email}</span>}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Members</p>
          <p className="text-2xl font-bold">{summary.member_count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Giving This Month</p>
          <p className="text-2xl font-bold">{Number(summary.total_giving_this_month ?? 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Avg Attendance</p>
          <p className="text-2xl font-bold">{Number(summary.avg_attendance ?? 0).toFixed(0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Visitors This Month</p>
          <p className="text-2xl font-bold">{summary.visitors_this_month ?? 0}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tabLoading && activeTab !== "overview" ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm">Branch Information</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{summary.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Pastor</span><span>{summary.pastor_name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{summary.phone ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{summary.email ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span>{summary.address ?? "—"}</span></div>
                    {summary.established_date && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Established</span><span>{new Date(summary.established_date).toLocaleDateString()}</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm">Activity Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Members</span><span className="font-medium">{summary.member_count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Giving (This Month)</span><span className="font-medium text-green-600">{Number(summary.total_giving_this_month ?? 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">All-time Giving</span><span className="font-medium">{Number(summary.total_giving_all_time ?? 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Last Session Count</span><span className="font-medium">{summary.last_attendance_count ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg Attendance</span><span className="font-medium">{Number(summary.avg_attendance ?? 0).toFixed(0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Upcoming Events</span><span className="font-medium">{summary.upcoming_events ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Visitors This Month</span><span className="font-medium">{summary.visitors_this_month ?? 0}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Members tab */}
          {activeTab === "members" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members assigned to this branch yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Phone</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Cell Group</th>
                      <th className="text-left py-2">Joined</th>
                    </tr></thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-medium">{m.first_name} {m.last_name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.phone ?? "—"}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.membership_status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-muted text-muted-foreground"}`}>
                              {m.membership_status}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.cell_group_name ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">{m.membership_date ? new Date(m.membership_date).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Giving tab */}
          {activeTab === "giving" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border rounded px-2 py-1 text-xs bg-white dark:bg-secondary-800" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="border rounded px-2 py-1 text-xs bg-white dark:bg-secondary-800" />
                </div>
                <button onClick={() => loadTabData("giving")} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <RefreshCw className="h-3 w-3" /> Apply
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Total: <strong>{giving.reduce((s, g) => s + Number(g.amount), 0).toLocaleString()}</strong> across {giving.length} records
              </p>
              {giving.length === 0 ? (
                <p className="text-sm text-muted-foreground">No giving records for this branch.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-right py-2 pr-4">Amount</th>
                      <th className="text-left py-2 pr-4">Member</th>
                      <th className="text-left py-2">Method</th>
                    </tr></thead>
                    <tbody>
                      {giving.map(g => (
                        <tr key={g.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">{new Date(g.giving_date).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{g.giving_type.replace(/_/g, " ")}</td>
                          <td className="py-2 pr-4 text-right font-medium text-green-600">{g.currency} {Number(g.amount).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{g.member_name ?? "Anonymous"}</td>
                          <td className="py-2 text-muted-foreground">{g.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Attendance tab */}
          {activeTab === "attendance" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{attendance.length} session{attendance.length !== 1 ? "s" : ""}</p>
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance sessions for this branch.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pr-4">Title</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-right py-2">Count</th>
                    </tr></thead>
                    <tbody>
                      {attendance.map(a => (
                        <tr key={a.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">{new Date(a.session_date).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{a.title}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{a.session_type.replace(/_/g, " ")}</td>
                          <td className="py-2 text-right font-medium">{a.total_count ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Events tab */}
          {activeTab === "events" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Shows this branch's events + org-wide events visible to all branches.</p>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events for this branch.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map(ev => (
                    <Card key={ev.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{ev.event_type.replace(/_/g, " ")}</p>
                            {ev.venue && <p className="text-xs text-muted-foreground">{ev.venue}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium">{new Date(ev.event_date).toLocaleDateString()}</p>
                            {!ev.is_active && <span className="text-xs text-muted-foreground">Inactive</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Visitors tab */}
          {activeTab === "visitors" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{visitors.length} visitor record{visitors.length !== 1 ? "s" : ""}</p>
              {visitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visitors recorded for this branch.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Visit Date</th>
                      <th className="text-left py-2 pr-4">Service</th>
                      <th className="text-left py-2">Follow-up</th>
                    </tr></thead>
                    <tbody>
                      {visitors.map(v => (
                        <tr key={v.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{v.first_name} {v.last_name}</td>
                          <td className="py-2 pr-4">{new Date(v.visit_date).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{v.service_type.replace(/_/g, " ")}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${v.follow_up_status === "CONVERTED" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : v.follow_up_status === "PENDING" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30" : "bg-muted text-muted-foreground"}`}>
                              {v.follow_up_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Report tab */}
          {activeTab === "report" && reportData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Branch Activity Report — {summary.name}</p>
                <button onClick={handlePrintReport} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
                  <Download className="h-4 w-4" /> Print / Save PDF
                </button>
              </div>

              <div className="print:block">
                {/* Report content */}
                <div className="border rounded-lg p-6 space-y-6 bg-white dark:bg-secondary-900">
                  <div className="text-center border-b pb-4">
                    <h2 className="text-xl font-bold">{summary.name}</h2>
                    <p className="text-sm text-muted-foreground">Branch Activity Report</p>
                    <p className="text-xs text-muted-foreground">Generated: {new Date().toLocaleDateString()}</p>
                  </div>

                  {/* Giving summary */}
                  {!!reportData.giving && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2 border-b pb-1">Giving Summary</h3>
                      {(() => {
                        const g = reportData.giving as { total: number; count: number; by_type: { giving_type: string; total: number }[] };
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Giving</span><span className="font-medium">{Number(g.total ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Records</span><span>{g.count ?? 0}</span></div>
                            {(g.by_type ?? []).map((t: { giving_type: string; total: number }) => (
                              <div key={t.giving_type} className="flex justify-between pl-4">
                                <span className="text-muted-foreground">{t.giving_type.replace(/_/g, " ")}</span>
                                <span>{Number(t.total).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Attendance summary */}
                  {!!reportData.attendance && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2 border-b pb-1">Attendance Summary</h3>
                      {(() => {
                        const a = reportData.attendance as { sessions: number; avg_count: number; last_count: number };
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Sessions</span><span>{a.sessions ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Average Count</span><span>{Number(a.avg_count ?? 0).toFixed(0)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Last Session Count</span><span>{a.last_count ?? "—"}</span></div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Members summary */}
                  {!!reportData.members && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2 border-b pb-1">Members Summary</h3>
                      {(() => {
                        const m = reportData.members as { total: number; active: number; new_this_month: number };
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Members</span><span>{m.total ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span>{m.active ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">New This Month</span><span>{m.new_this_month ?? 0}</span></div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Visitors summary */}
                  {!!reportData.visitors && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2 border-b pb-1">Visitors Summary</h3>
                      {(() => {
                        const v = reportData.visitors as { total: number; converted: number; pending_follow_up: number };
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Visitors</span><span>{v.total ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Converted to Members</span><span className="text-green-600">{v.converted ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pending Follow-up</span><span className="text-yellow-600">{v.pending_follow_up ?? 0}</span></div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
