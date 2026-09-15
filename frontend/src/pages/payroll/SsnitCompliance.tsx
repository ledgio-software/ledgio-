import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import {
  ShieldCheck, Users, CheckCircle2, AlertCircle, FileText,
  RefreshCw, X, Edit2, Trash2, Send, Eye,
  BadgeCheck, BadgeAlert,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  position: string | null;
  isActive: boolean;
  grossSalary: number;
  ssnitNumber: string | null;
  tier2Scheme: string | null;
  tier2MemberNo: string | null;
}

interface ComplianceSummary {
  total: number;
  active: number;
  registered: number;
  unregistered: number;
  complianceRate: number;
}

interface ScheduleSummary {
  id: string;
  periodMonth: number;
  periodYear: number;
  payrollRunId: string | null;
  status: string;
  submittedAt: string | null;
  totals: { tier1Employee: number; tier1Employer: number; tier2Employer: number; grandTotal: number };
  generatedAt: string;
}

interface ScheduleLine {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  ssnitNumber: string | null;
  grossSalary: number;
  tier1Employee: number;
  tier1Employer: number;
  tier2Employer: number;
  total: number;
}

interface PayrollRun {
  id: string;
  periodMonth: number;
  periodYear: number;
  totalNetPay: number;
  hasSchedule: boolean;
}

type Tab = "compliance" | "schedules" | "detail";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function periodLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

// ── Edit SSNIT Modal ──────────────────────────────────────────────────────────

function EditSsnitModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}) {
  const [ssnitNumber, setSsnitNumber] = useState(employee.ssnitNumber ?? "");
  const [tier2Scheme, setTier2Scheme] = useState(employee.tier2Scheme ?? "");
  const [tier2MemberNo, setTier2MemberNo] = useState(employee.tier2MemberNo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const resp = await api.patch(`/ssnit/employees/${employee.id}`, { ssnitNumber, tier2Scheme, tier2MemberNo });
      onSaved({ ...employee, ssnitNumber: ssnitNumber || null, tier2Scheme: tier2Scheme || null, tier2MemberNo: tier2MemberNo || null });
      onClose();
      void resp;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold">
            SSNIT Details — {employee.firstName} {employee.lastName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SSNIT Number</label>
            <input
              value={ssnitNumber}
              onChange={(e) => setSsnitNumber(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 font-mono"
              placeholder="e.g. C000123456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tier 2 Pension Scheme</label>
            <input
              value={tier2Scheme}
              onChange={(e) => setTier2Scheme(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
              placeholder="e.g. Enterprise Trustees Ltd"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tier 2 Member Number</label>
            <input
              value={tier2MemberNo}
              onChange={(e) => setTier2MemberNo(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 font-mono"
              placeholder="e.g. ETL-00234"
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            <strong>Tier 1</strong>: 5.5% employee + 8% employer → remitted to SSNIT<br />
            <strong>Tier 2</strong>: 5% employer → remitted to occupational pension trustee
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Schedule Modal ───────────────────────────────────────────────────

function GenerateModal({
  runs,
  onClose,
  onGenerated,
}: {
  runs: PayrollRun[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [runId, setRunId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!runId) { setError("Please select a payroll run"); return; }
    setGenerating(true);
    setError("");
    try {
      await api.post("/ssnit/schedules/generate", { payrollRunId: runId });
      onGenerated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const availableRuns = runs.filter((r) => !r.hasSchedule);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Generate SSNIT Schedule
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posted Payroll Run *</label>
            {availableRuns.length === 0 ? (
              <p className="text-sm text-gray-500 italic">All posted payroll runs already have SSNIT schedules.</p>
            ) : (
              <select
                value={runId}
                onChange={(e) => setRunId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
              >
                <option value="">— Select run —</option>
                {availableRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {periodLabel(r.periodMonth, r.periodYear)} (Net GHS {fmt(r.totalNetPay)})
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-gray-500">
            The schedule will compute Tier 1 (13.5% of gross) and Tier 2 (5% of gross) contributions
            per employee from the selected payroll run's payslips.
          </p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || availableRuns.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Detail View ──────────────────────────────────────────────────────

function ScheduleDetail({
  scheduleId,
  onBack,
}: {
  scheduleId: string;
  onBack: () => void;
}) {
  const [schedule, setSchedule] = useState<(ScheduleSummary & { lines?: ScheduleLine[] }) | null>(null);
  const [lines, setLines] = useState<ScheduleLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/ssnit/schedules/${scheduleId}`)
      .then((r) => {
        const d = r.data?.data ?? r.data;
        setSchedule(d.schedule);
        setLines(d.lines ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scheduleId]);

  async function handleSubmit() {
    if (!confirm("Mark this schedule as submitted to SSNIT?")) return;
    setSubmitting(true);
    try {
      await api.patch(`/ssnit/schedules/${scheduleId}/submit`, {});
      setSchedule((s) => s ? { ...s, status: "SUBMITTED", submittedAt: new Date().toISOString() } : s);
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );

  if (!schedule) return <div className="text-red-500 p-4">Schedule not found</div>;

  const unregistered = lines.filter((l) => !l.ssnitNumber).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          ← Back to Schedules
        </button>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold">SSNIT Contribution Schedule</h2>
            <p className="text-sm text-gray-500">{periodLabel(schedule.periodMonth, schedule.periodYear)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              schedule.status === "SUBMITTED"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
            }`}>
              {schedule.status}
            </span>
            {schedule.status === "DRAFT" && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {submitting ? "Marking…" : "Mark Submitted"}
              </button>
            )}
          </div>
        </div>

        {unregistered > 0 && (
          <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg p-3 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {unregistered} employee{unregistered !== 1 ? "s" : ""} without SSNIT numbers — update their registration before submitting.
          </div>
        )}

        {/* Totals */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Tier 1 — Employee (5.5%)", value: schedule.totals.tier1Employee, color: "blue" },
            { label: "Tier 1 — Employer (8%)", value: schedule.totals.tier1Employer, color: "indigo" },
            { label: "Tier 2 — Employer (5%)", value: schedule.totals.tier2Employer, color: "purple" },
            { label: "Grand Total", value: schedule.totals.grandTotal, color: "green", bold: true },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-base font-${s.bold ? "bold" : "semibold"} text-gray-900 dark:text-gray-100`}>
                GHS {fmt(s.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Lines table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">SSNIT No.</th>
              <th className="text-right px-4 py-3">Gross</th>
              <th className="text-right px-4 py-3">T1 Emp (5.5%)</th>
              <th className="text-right px-4 py-3">T1 Er (8%)</th>
              <th className="text-right px-4 py-3">T2 Er (5%)</th>
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {lines.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{l.firstName} {l.lastName}</div>
                  <div className="text-xs text-gray-400">{l.employeeNumber}</div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {l.ssnitNumber ? (
                    <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                      <BadgeCheck className="w-3.5 h-3.5" /> {l.ssnitNumber}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500">
                      <BadgeAlert className="w-3.5 h-3.5" /> Not registered
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(l.grossSalary)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(l.tier1Employee)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(l.tier1Employer)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(l.tier2Employer)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900 font-semibold text-sm">
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-right">Totals</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(schedule.totals.tier1Employee)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(schedule.totals.tier1Employer)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(schedule.totals.tier2Employer)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(schedule.totals.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SsnitCompliance() {
  const [tab, setTab] = useState<Tab>("compliance");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/ssnit/compliance");
      const d = r.data?.data ?? r.data;
      setEmployees(d.employees ?? []);
      setSummary(d.summary ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const r = await api.get("/ssnit/schedules");
      const d = r.data?.data ?? r.data;
      setSchedules(d.schedules ?? []);
    } catch { /* ignore */ }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const r = await api.get("/ssnit/payroll-runs");
      const d = r.data?.data ?? r.data;
      setRuns(d.runs ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCompliance();
    fetchSchedules();
    fetchRuns();
  }, [fetchCompliance, fetchSchedules, fetchRuns]);

  async function handleDeleteSchedule(id: string) {
    if (!confirm("Delete this SSNIT schedule?")) return;
    try {
      await api.delete(`/ssnit/schedules/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      fetchRuns();
    } catch { /* ignore */ }
  }

  function handleEmployeeSaved(updated: Employee) {
    setEmployees((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    if (summary) {
      const active = employees.filter((e) => e.isActive);
      const reg = active.filter((e) => e.id === updated.id ? !!updated.ssnitNumber : !!e.ssnitNumber).length;
      setSummary({ ...summary, registered: reg, unregistered: active.length - reg, complianceRate: Math.round((reg / active.length) * 100) });
    }
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "compliance", label: "Employee Registration", icon: <Users className="w-4 h-4" /> },
    { id: "schedules", label: "Monthly Schedules", icon: <FileText className="w-4 h-4" /> },
  ];

  if (detailId) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold">SSNIT Compliance</h1>
        </div>
        <ScheduleDetail scheduleId={detailId} onBack={() => { setDetailId(null); setTab("schedules"); }} />
      </div>
    );
  }

  const activeEmployees = employees.filter((e) => e.isActive);
  const displayEmployees = showAll ? activeEmployees : activeEmployees.filter((e) => !e.ssnitNumber);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" /> SSNIT Payroll Compliance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track employee registration and generate monthly Tier 1 &amp; Tier 2 contribution schedules
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Employees", value: summary.active, icon: <Users className="w-4 h-4 text-gray-400" /> },
            { label: "Registered", value: summary.registered, icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
            { label: "Unregistered", value: summary.unregistered, icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
            { label: "Compliance Rate", value: `${summary.complianceRate}%`, icon: <ShieldCheck className="w-4 h-4 text-blue-500" /> },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                {s.icon} {s.label}
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Employee Registration Tab */}
      {tab === "compliance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAll(!showAll)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                  !showAll
                    ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                }`}
              >
                {showAll ? "Show Unregistered Only" : `Showing Unregistered (${summary?.unregistered ?? 0})`}
              </button>
              {showAll && <span className="text-sm text-gray-500">Showing all active employees</span>}
            </div>
            <button onClick={fetchCompliance} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : displayEmployees.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400 opacity-60" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {showAll ? "No active employees found" : "All active employees are SSNIT-registered"}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Dept / Position</th>
                    <th className="text-right px-4 py-3">Gross Salary</th>
                    <th className="text-left px-4 py-3">SSNIT No.</th>
                    <th className="text-left px-4 py-3">Tier 2 Scheme</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayEmployees.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{e.firstName} {e.lastName}</div>
                        <div className="text-xs text-gray-400">{e.employeeNumber}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {e.department ?? "—"}<br />{e.position ?? ""}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">GHS {fmt(e.grossSalary)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {e.ssnitNumber ? (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                            <BadgeCheck className="w-3.5 h-3.5" /> {e.ssnitNumber}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <BadgeAlert className="w-3.5 h-3.5" /> Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{e.tier2Scheme ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setEditEmployee(e)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> Generate Schedule
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No schedules generated yet. Run payroll first, then generate a schedule.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Period</th>
                    <th className="text-right px-4 py-3">Tier 1 (Employee)</th>
                    <th className="text-right px-4 py-3">Tier 1 (Employer)</th>
                    <th className="text-right px-4 py-3">Tier 2</th>
                    <th className="text-right px-4 py-3">Grand Total</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2.5 font-medium">{periodLabel(s.periodMonth, s.periodYear)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.totals.tier1Employee)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.totals.tier1Employer)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.totals.tier2Employer)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(s.totals.grandTotal)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === "SUBMITTED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDetailId(s.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {s.status === "DRAFT" && (
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editEmployee && (
        <EditSsnitModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSaved={handleEmployeeSaved}
        />
      )}

      {showGenerate && (
        <GenerateModal
          runs={runs}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => { fetchSchedules(); fetchRuns(); }}
        />
      )}
    </div>
  );
}
