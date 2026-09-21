import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { CalendarCheck, Users, BarChart2, Save, Plus, Loader2 } from "lucide-react";

interface AttendanceSession {
  id: string;
  title: string;
  session_date: string;
  session_type: string;
  cell_group_name: string | null;
  total_count: number | null;
  notes: string | null;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

interface AttendanceSummary {
  totalMembers: number;
  lastSundayCount: number;
  lastSundayDate: string | null;
  avgSundayAttendance: number;
  trend: { session_date: string; total_count: number; title: string }[];
}

const SESSION_TYPES = [
  { value: "SUNDAY_SERVICE", label: "Sunday Service" },
  { value: "MIDWEEK", label: "Midweek Service" },
  { value: "CELL_GROUP", label: "Cell Group" },
  { value: "SPECIAL_SERVICE", label: "Special Service" },
] as const;

type SessionType = typeof SESSION_TYPES[number]["value"];

const TYPE_BADGE: Record<SessionType, "success" | "default" | "secondary" | "warning"> = {
  SUNDAY_SERVICE: "success",
  MIDWEEK: "default",
  CELL_GROUP: "secondary",
  SPECIAL_SERVICE: "warning",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function Attendance() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"record" | "sessions" | "summary">("record");

  // Record tab state
  const [sessionType, setSessionType] = useState<SessionType>("SUNDAY_SERVICE");
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [sessionTitle, setSessionTitle] = useState("Sunday Service");
  const [bulkCount, setBulkCount] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [recordMode, setRecordMode] = useState<"individual" | "bulk">("bulk");
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sessions tab state
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(todayStr().slice(0, 7));

  // Summary tab state
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const r = await api.get("/church/members");
      const list: Member[] = r.data?.data ?? [];
      setMembers(list);
      const map: Record<string, boolean> = {};
      list.forEach((m) => { map[m.id] = true; });
      setAttendance(map);
    } catch {
      showToast("Failed to load members.", "error");
    } finally {
      setMembersLoading(false);
    }
  }, [showToast]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const r = await api.get("/church/attendance/sessions", {
        params: filterMonth ? { month: filterMonth } : {},
      });
      setSessions(r.data?.data ?? []);
    } catch {
      showToast("Failed to load sessions.", "error");
    } finally {
      setSessionsLoading(false);
    }
  }, [filterMonth, showToast]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/church/attendance/summary");
      setSummary(r.data?.data ?? null);
    } catch {
      showToast("Failed to load summary.", "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "record" && members.length === 0) loadMembers();
    if (activeTab === "sessions") loadSessions();
    if (activeTab === "summary") loadSummary();
  }, [activeTab, loadMembers, loadSessions, loadSummary, members.length]);

  async function handleSaveSession() {
    if (!sessionTitle.trim() || !sessionDate) {
      showToast("Title and date are required.", "error");
      return;
    }
    setSaving(true);
    try {
      // Create the session
      const sessionPayload = {
        title: sessionTitle.trim(),
        sessionDate,
        sessionType,
        totalCount: recordMode === "bulk" && bulkCount ? parseInt(bulkCount, 10) : undefined,
        notes: sessionNotes || undefined,
      };
      const r = await api.post("/church/attendance/sessions", sessionPayload);
      const newSessionId: string = r.data?.data?.id;

      // If individual mode, save per-member records
      if (recordMode === "individual" && newSessionId) {
        const records = Object.entries(attendance).map(([memberId, present]) => ({
          memberId,
          present,
        }));
        if (records.length > 0) {
          await api.post(`/church/attendance/sessions/${newSessionId}/records`, records);
        }
      }

      showToast("Attendance session saved.", "success");
      setSessionTitle("Sunday Service");
      setSessionDate(todayStr());
      setBulkCount("");
      setSessionNotes("");
      // Reset attendance to all present
      const map: Record<string, boolean> = {};
      members.forEach((m) => { map[m.id] = true; });
      setAttendance(map);
    } catch {
      showToast("Failed to save session.", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleMember(id: string) {
    setAttendance((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const presentCount = Object.values(attendance).filter(Boolean).length;

  const maxTrend = summary?.trend.reduce((m, r) => Math.max(m, r.total_count ?? 0), 1) ?? 1;

  const tabs = [
    { id: "record" as const, label: "Record Attendance", icon: CalendarCheck },
    { id: "sessions" as const, label: "Sessions", icon: Users },
    { id: "summary" as const, label: "Summary", icon: BarChart2 },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-6 w-6 text-primary-600" />
        <h1 className="text-xl font-bold text-secondary-900 dark:text-secondary-50">Church Attendance</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-secondary-200 dark:border-secondary-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Record Attendance Tab */}
      {activeTab === "record" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold text-secondary-900 dark:text-secondary-50">Session Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Session Type</label>
                  <select
                    value={sessionType}
                    onChange={(e) => {
                      const t = e.target.value as SessionType;
                      setSessionType(t);
                      const label = SESSION_TYPES.find((s) => s.value === t)?.label ?? "";
                      setSessionTitle(label);
                    }}
                    className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
                  >
                    {SESSION_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 items-center">
                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Mode:</span>
                <button
                  onClick={() => setRecordMode("bulk")}
                  className={`px-3 py-1 rounded text-sm ${recordMode === "bulk" ? "bg-primary-600 text-white" : "bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300"}`}
                >
                  Bulk Count
                </button>
                <button
                  onClick={() => setRecordMode("individual")}
                  className={`px-3 py-1 rounded text-sm ${recordMode === "individual" ? "bg-primary-600 text-white" : "bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300"}`}
                >
                  Per Member
                </button>
              </div>

              {recordMode === "bulk" && (
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Total Attendance Count</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(e.target.value)}
                    placeholder="Enter count..."
                    className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </CardContent>
          </Card>

          {recordMode === "individual" && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-secondary-900 dark:text-secondary-50">Mark Attendance</h2>
                  <span className="text-sm text-secondary-500">{presentCount} / {members.length} present</span>
                </div>

                {membersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                  </div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {members.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-secondary-50 dark:hover:bg-secondary-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={attendance[m.id] ?? true}
                          onChange={() => toggleMember(m.id)}
                          className="h-4 w-4 rounded border-secondary-300 text-primary-600"
                        />
                        <span className="text-sm text-secondary-800 dark:text-secondary-200">
                          {m.first_name} {m.last_name}
                          {m.department && (
                            <span className="ml-2 text-xs text-secondary-400">{m.department}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveSession} disabled={saving} className="flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Session
            </Button>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Month:</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {sessionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cell Group</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-secondary-500">
                          No sessions found for selected month.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.session_date ? s.session_date.slice(0, 10) : "—"}</TableCell>
                          <TableCell className="font-medium">{s.title}</TableCell>
                          <TableCell>
                            <Badge variant={TYPE_BADGE[s.session_type as SessionType]}>
                              {SESSION_TYPES.find((t) => t.value === s.session_type)?.label ?? s.session_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{s.cell_group_name ?? "—"}</TableCell>
                          <TableCell>{s.total_count ?? "—"}</TableCell>
                          <TableCell className="text-secondary-500 text-sm">{s.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {summaryLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : summary ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-secondary-500 uppercase tracking-wide">Total Members</p>
                    <p className="mt-1 text-3xl font-bold text-secondary-900 dark:text-secondary-50">{summary.totalMembers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-secondary-500 uppercase tracking-wide">Last Sunday</p>
                    <p className="mt-1 text-3xl font-bold text-secondary-900 dark:text-secondary-50">{summary.lastSundayCount || "—"}</p>
                    {summary.lastSundayDate && (
                      <p className="text-xs text-secondary-400 mt-1">{summary.lastSundayDate.slice(0, 10)}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-secondary-500 uppercase tracking-wide">Avg Attendance (4wk)</p>
                    <p className="mt-1 text-3xl font-bold text-secondary-900 dark:text-secondary-50">{summary.avgSundayAttendance || "—"}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Trend bar chart */}
              {summary.trend.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h2 className="font-semibold text-secondary-900 dark:text-secondary-50 mb-4 flex items-center gap-2">
                      <BarChart2 className="h-5 w-5 text-primary-600" />
                      Sunday Service Trend (last 8 weeks)
                    </h2>
                    <div className="flex items-end gap-2 h-40">
                      {summary.trend.map((row) => {
                        const pct = maxTrend > 0 ? ((row.total_count ?? 0) / maxTrend) * 100 : 0;
                        return (
                          <div key={row.session_date} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-xs text-secondary-500">{row.total_count ?? 0}</span>
                            <div
                              className="w-full bg-primary-500 dark:bg-primary-600 rounded-t"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                              title={`${row.title}: ${row.total_count}`}
                            />
                            <span className="text-xs text-secondary-400 -rotate-45 origin-top-right whitespace-nowrap overflow-hidden w-8 text-center">
                              {row.session_date?.slice(5, 10)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-secondary-500">
                No summary data available.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default Attendance;
