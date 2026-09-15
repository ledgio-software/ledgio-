import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import {
  MessageSquare, Send, Users, AlertCircle, BookOpen, DollarSign,
  Calendar, Phone, Mail, Smartphone, Filter, Trash2, CheckCircle2,
  RefreshCw, ChevronDown, X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ParentMessage {
  id: string;
  studentId: string;
  type: string;
  channel: string;
  recipient: string;
  message: string;
  status: string;
  sentAt: string;
  sentBy?: string;
  referenceId?: string;
  student?: { id: string; firstName: string; lastName: string; className: string } | null;
}

interface Stats {
  total: number;
  last7Days: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
}

interface Template {
  type: string;
  label: string;
  fields: string[];
  preview: string;
}

type Tab = "compose" | "bulk" | "history";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, ReactNode> = {
  FEE_REMINDER: <DollarSign className="w-4 h-4 text-amber-500" />,
  ATTENDANCE: <Calendar className="w-4 h-4 text-red-500" />,
  RESULTS: <BookOpen className="w-4 h-4 text-blue-500" />,
  GENERAL: <MessageSquare className="w-4 h-4 text-gray-500" />,
};

const TYPE_LABEL: Record<string, string> = {
  FEE_REMINDER: "Fee Reminder",
  ATTENDANCE: "Attendance Alert",
  RESULTS: "Results Notification",
  GENERAL: "General",
};

const CHANNEL_ICON: Record<string, ReactNode> = {
  SMS: <Phone className="w-3.5 h-3.5" />,
  EMAIL: <Mail className="w-3.5 h-3.5" />,
  WHATSAPP: <Smartphone className="w-3.5 h-3.5" />,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  students,
  templates,
  onClose,
  onSent,
}: {
  students: Student[];
  templates: Template[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("FEE_REMINDER");
  const [channel, setChannel] = useState("SMS");
  const [customMessage, setCustomMessage] = useState("");
  const [templateData, setTemplateData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tpl = templates.find((t) => t.type === type);
  const student = students.find((s) => s.id === studentId);

  const recipientPreview =
    channel === "EMAIL"
      ? student?.guardianEmail || "(no email on record)"
      : student?.guardianPhone || "(no phone on record)";

  async function handleSend() {
    if (!studentId) { setError("Please select a student."); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/school/parent-comms/send", {
        studentId,
        type,
        channel,
        customMessage: type === "GENERAL" ? customMessage : undefined,
        templateData: {
          ...templateData,
          guardianName: student?.guardianName ?? "",
          studentName: student ? `${student.firstName} ${student.lastName}` : "",
        },
      });
      onSent();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" /> Compose Message
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {/* Student */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student *</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">— Select student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} · {s.className}
                </option>
              ))}
            </select>
            {student && (
              <p className="mt-1 text-xs text-gray-500">Guardian: {student.guardianName} · {student.guardianPhone}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    type === t.type
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  }`}
                >
                  {TYPE_ICON[t.type]} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel *</label>
            <div className="flex gap-2">
              {["SMS", "EMAIL", "WHATSAPP"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${
                    channel === ch
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                  }`}
                >
                  {CHANNEL_ICON[ch]} {ch}
                </button>
              ))}
            </div>
            {student && (
              <p className="mt-1 text-xs text-gray-500">
                Recipient: <span className="font-medium">{recipientPreview}</span>
              </p>
            )}
          </div>

          {/* Template-specific fields */}
          {type === "FEE_REMINDER" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Amount Due (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  value={templateData.amount ?? ""}
                  onChange={(e) => setTemplateData((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                  placeholder="450.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Due Date</label>
                <input
                  type="date"
                  value={templateData.dueDate ?? ""}
                  onChange={(e) => setTemplateData((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
          )}

          {type === "ATTENDANCE" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={templateData.status ?? "absent"}
                  onChange={(e) => setTemplateData((p) => ({ ...p, status: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                >
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="left early">Left Early</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={templateData.date ?? new Date().toISOString().split("T")[0]}
                  onChange={(e) => setTemplateData((p) => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
          )}

          {type === "RESULTS" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Term</label>
                <input
                  value={templateData.term ?? ""}
                  onChange={(e) => setTemplateData((p) => ({ ...p, term: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                  placeholder="Term 1 2026"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Average (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={templateData.average ?? ""}
                  onChange={(e) => setTemplateData((p) => ({ ...p, average: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                  placeholder="78.5"
                />
              </div>
            </div>
          )}

          {type === "GENERAL" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message *</label>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 resize-none"
                placeholder="Type your message here…"
              />
            </div>
          )}

          {/* Preview */}
          {tpl && type !== "GENERAL" && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1 text-gray-700 dark:text-gray-300">Message preview</p>
              <p className="italic">{tpl.preview}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> {saving ? "Sending…" : "Send Message"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Send Panel ───────────────────────────────────────────────────────────

function BulkPanel({ onSent }: { onSent: () => void }) {
  const [trigger, setTrigger] = useState<"FEE_DEFAULTERS" | "ABSENT_TODAY" | "RESULTS_READY">("FEE_DEFAULTERS");
  const [channel, setChannel] = useState("SMS");
  const [termId, setTermId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; message?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/school/terms").then((r) => setTerms(r.data?.data?.terms ?? r.data?.terms ?? [])).catch(() => {});
  }, []);

  async function handleBulkSend() {
    setSending(true);
    setResult(null);
    setError("");
    try {
      const body: Record<string, string> = { trigger, channel };
      if (trigger === "RESULTS_READY") body.termId = termId;
      if (trigger === "ABSENT_TODAY") body.date = date;
      const resp = await api.post("/school/parent-comms/bulk", body);
      const r = (resp.data?.data ?? resp.data) as { sent: number; message?: string };
      setResult(r);
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk send failed");
    } finally {
      setSending(false);
    }
  }

  const triggers = [
    {
      id: "FEE_DEFAULTERS" as const,
      label: "Fee Defaulters",
      desc: "Send reminders to all guardians with outstanding fee balances",
      icon: <DollarSign className="w-5 h-5 text-amber-500" />,
    },
    {
      id: "ABSENT_TODAY" as const,
      label: "Absent Students",
      desc: "Notify guardians of students marked absent for a specific date",
      icon: <Calendar className="w-5 h-5 text-red-500" />,
    },
    {
      id: "RESULTS_READY" as const,
      label: "Results Ready",
      desc: "Inform all guardians that end-of-term results are available",
      icon: <BookOpen className="w-5 h-5 text-blue-500" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {triggers.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTrigger(t.id); setResult(null); }}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              trigger === t.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">{t.icon}<span className="font-medium text-sm">{t.label}</span></div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <ChevronDown className="w-4 h-4" /> Send Options
        </h3>

        {/* Channel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channel</label>
          <div className="flex gap-2">
            {["SMS", "EMAIL", "WHATSAPP"].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${
                  channel === ch
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                }`}
              >
                {CHANNEL_ICON[ch]} {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Trigger-specific options */}
        {trigger === "RESULTS_READY" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Term *</label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full max-w-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">— Select term —</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {trigger === "ABSENT_TODAY" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full max-w-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-3 text-sm flex gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            {result.sent > 0
              ? `${result.sent} message${result.sent !== 1 ? "s" : ""} sent successfully.`
              : result.message ?? "No eligible recipients found."}
          </div>
        )}

        <button
          onClick={handleBulkSend}
          disabled={sending || (trigger === "RESULTS_READY" && !termId)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          <Users className="w-4 h-4" />
          {sending ? "Sending…" : "Send Bulk Messages"}
        </button>
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({
  messages,
  loading,
  onDelete,
}: {
  messages: ParentMessage[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No messages sent yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div key={m.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
            onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
          >
            <div className="shrink-0">{TYPE_ICON[m.type]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {m.student ? `${m.student.firstName} ${m.student.lastName}` : m.studentId}
                </span>
                {m.student && (
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {m.student.className}
                  </span>
                )}
                <span className="text-xs text-gray-400">→</span>
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[160px]">{m.recipient}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-500">{fmtDate(m.sentAt)}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  {CHANNEL_ICON[m.channel]} {m.channel}
                </span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{TYPE_LABEL[m.type] ?? m.type}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                m.status === "SENT"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : m.status === "FAILED"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
              }`}>
                {m.status}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {expandedId === m.id && (
            <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">{m.message}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ParentComms() {
  const [tab, setTab] = useState<Tab>("compose");
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterChannel, setFilterChannel] = useState("");

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterType) params.set("type", filterType);
      if (filterChannel) params.set("channel", filterChannel);
      const resp = await api.get(`/school/parent-comms?${params}`);
      const d = (resp.data?.data ?? resp.data) as { messages: ParentMessage[] };
      setMessages(d.messages ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filterType, filterChannel]);

  useEffect(() => {
    fetchMessages();
    api.get("/school/parent-comms/stats").then((r) => setStats((r.data?.data ?? r.data) as Stats)).catch(() => {});
    api.get("/school/students?limit=500").then((r) => setStudents((r.data?.data ?? r.data)?.students ?? [])).catch(() => {});
    api.get("/school/parent-comms/templates").then((r) => setTemplates((r.data?.data ?? r.data)?.templates ?? [])).catch(() => {});
  }, [fetchMessages]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this message record?")) return;
    try {
      await api.delete(`/school/parent-comms/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch { /* ignore */ }
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "compose", label: "Compose", icon: <Send className="w-4 h-4" /> },
    { id: "bulk", label: "Bulk Send", icon: <Users className="w-4 h-4" /> },
    { id: "history", label: "History", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-600" /> Parent Communication Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">Send fee reminders, attendance alerts, and results notifications to parents</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Send className="w-4 h-4" /> Compose
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Sent", value: stats.total, color: "blue" },
            { label: "Last 7 Days", value: stats.last7Days, color: "green" },
            { label: "Fee Reminders", value: stats.byType?.FEE_REMINDER ?? 0, color: "amber" },
            { label: "SMS / WhatsApp", value: (stats.byChannel?.SMS ?? 0) + (stats.byChannel?.WHATSAPP ?? 0), color: "purple" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
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

      {/* Tab content */}
      {tab === "compose" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-8">
            <Send className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Send a Message</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Choose a template and send a personalised message to a parent or guardian.
            </p>
            <button
              onClick={() => setShowCompose(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 mx-auto"
            >
              <Send className="w-4 h-4" /> Open Compose
            </button>

            {/* Template previews */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
              {templates.map((t) => (
                <div key={t.type} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {TYPE_ICON[t.type]}
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 italic">{t.preview}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "bulk" && <BulkPanel onSent={() => { fetchMessages(); api.get("/school/parent-comms/stats").then((r) => setStats((r.data?.data ?? r.data) as Stats)).catch(() => {}); }} />}

      {tab === "history" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Filter className="w-4 h-4" /> Filter:
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
            >
              <option value="">All Types</option>
              <option value="FEE_REMINDER">Fee Reminder</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="RESULTS">Results</option>
              <option value="GENERAL">General</option>
            </select>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
            >
              <option value="">All Channels</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
            <button onClick={fetchMessages} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <HistoryTab messages={messages} loading={loading} onDelete={handleDelete} />
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          students={students}
          templates={templates}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            fetchMessages();
            api.get("/school/parent-comms/stats").then((r) => setStats((r.data?.data ?? r.data) as Stats)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
