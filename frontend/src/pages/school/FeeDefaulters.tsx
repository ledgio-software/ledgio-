import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { AlertTriangle, Loader2, Printer, Settings, MessageSquare } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface LateFineConfig {
  enabled: boolean;
  ratePerDay: number;
  graceDays: number;
}

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface Defaulter {
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    className: string;
    guardianName: string;
    guardianPhone: string;
  };
  totalOwed: number;
  totalPaid: number;
  balance: number;
  daysOverdue: number;
  lateFineAmount: number;
  totalDue: number;
  paymentStatus: "partial" | "unpaid";
}

export function FeeDefaulters() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(false);
  const [lateFineConfig, setLateFineConfig] = useState<LateFineConfig>({ enabled: false, ratePerDay: 0, graceDays: 0 });
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [configDraft, setConfigDraft] = useState<LateFineConfig>({ enabled: false, ratePerDay: 0, graceDays: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showSmsConfirm, setShowSmsConfirm] = useState(false);
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const canSendSms = isAdmin || (user?.role ?? "").toLowerCase() === "accountant";

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
    api.get("/school/fee-collection/late-fine-config").then((r) => {
      const cfg = r.data?.data?.config ?? { enabled: false, ratePerDay: 0, graceDays: 0 };
      setLateFineConfig(cfg);
      setConfigDraft(cfg);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true);
    try {
      const res = await api.get(`/school/reports/fee-defaulters?termId=${selectedTermId}`);
      setDefaulters(res.data?.data?.defaulters ?? []);
      if (res.data?.data?.lateFineConfig) setLateFineConfig(res.data.data.lateFineConfig);
    } catch {
      showToast("Failed to load defaulters report", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      await api.put("/school/fee-collection/late-fine-config", configDraft);
      setLateFineConfig(configDraft);
      setShowConfigPanel(false);
      showToast("Late fine settings saved.", "success");
      load();
    } catch {
      showToast("Failed to save settings.", "error");
    } finally {
      setSavingConfig(false);
    }
  }

  async function sendReminders() {
    if (!selectedTermId) return;
    setSendingReminders(true);
    setShowSmsConfirm(false);
    try {
      const res = await api.post("/school/fee-collection/send-reminders", { termId: selectedTermId });
      const { sent, failed, skipped } = res.data?.data ?? { sent: 0, failed: 0, skipped: 0 };
      showToast(
        `SMS reminders: ${sent} sent${failed > 0 ? `, ${failed} failed` : ""}${skipped > 0 ? `, ${skipped} skipped (no phone)` : ""}.`,
        failed > 0 ? "error" : "success"
      );
    } catch {
      showToast("Failed to send SMS reminders.", "error");
    } finally {
      setSendingReminders(false);
    }
  }

  const totalBalance = defaulters.reduce((s, d) => s + d.balance, 0);
  const totalLateFine = defaulters.reduce((s, d) => s + d.lateFineAmount, 0);
  const totalDue = defaulters.reduce((s, d) => s + d.totalDue, 0);
  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-semibold">Fee Defaulters</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border rounded px-3 py-1.5 text-sm bg-background"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            <option value="">— Select Term —</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}
              </option>
            ))}
          </select>
          {canSendSms && defaulters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSmsConfirm(true)}
              disabled={sendingReminders}
            >
              {sendingReminders
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <MessageSquare className="h-4 w-4 mr-1" />}
              SMS Reminders
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => { setConfigDraft(lateFineConfig); setShowConfigPanel((v) => !v); }}>
              <Settings className="h-4 w-4 mr-1" /> Late Fine
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {showConfigPanel && isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium text-sm">Late Fine Configuration</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="lf-enabled"
                checked={configDraft.enabled}
                onChange={(e) => setConfigDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              <label htmlFor="lf-enabled" className="text-sm">Enable late fines</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Rate per day (GHS per GHS owed)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={configDraft.ratePerDay}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, ratePerDay: parseFloat(e.target.value) || 0 }))}
                  disabled={!configDraft.enabled}
                />
                <p className="text-xs text-muted-foreground mt-0.5">e.g. 0.01 = 1% of balance per overdue day</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Grace period (days)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={configDraft.graceDays}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, graceDays: parseInt(e.target.value) || 0 }))}
                  disabled={!configDraft.enabled}
                />
                <p className="text-xs text-muted-foreground mt-0.5">Fine starts after this many overdue days</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfigPanel(false)}>Cancel</Button>
              <Button size="sm" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showSmsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold">Send SMS Reminders</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Send an SMS fee reminder to the guardian of each defaulter listed below
              ({defaulters.length} student{defaulters.length !== 1 ? "s" : ""}).
              Guardians without a phone number will be skipped.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSmsConfirm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={sendReminders}>
                <MessageSquare className="h-4 w-4 mr-1" /> Send Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                    <TableHead>Status</TableHead>
                    {lateFineConfig.enabled && (
                      <>
                        <TableHead className="text-right">Late Fine</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={lateFineConfig.enabled ? 11 : 9} className="text-center py-10 text-muted-foreground">
                        {selectedTermId
                          ? "No defaulters for this term."
                          : "Select a term to view defaulters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    defaulters.map((d) => (
                      <TableRow key={d.student.id}>
                        <TableCell>
                          <div className="font-medium">
                            {d.student.firstName} {d.student.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{d.student.studentCode}</div>
                        </TableCell>
                        <TableCell>{d.student.className}</TableCell>
                        <TableCell>{d.student.guardianName}</TableCell>
                        <TableCell>{d.student.guardianPhone}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.totalOwed)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.totalPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-red-600">
                          {fmt(d.balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.daysOverdue > 0 ? (
                            <span className={d.daysOverdue > 30 ? "text-red-600 font-medium" : "text-amber-600"}>
                              {d.daysOverdue}d
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              d.paymentStatus === "partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {d.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                          </span>
                        </TableCell>
                        {lateFineConfig.enabled && (
                          <>
                            <TableCell className="text-right tabular-nums text-amber-600">
                              {d.lateFineAmount > 0 ? fmt(d.lateFineAmount) : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-red-700">
                              {fmt(d.totalDue)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {defaulters.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {defaulters.length} defaulter{defaulters.length !== 1 ? "s" : ""} ·{" "}
                  {selectedTerm ? `${selectedTerm.name} (${selectedTerm.academicYear})` : ""}
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-red-600">
                    Outstanding: {fmt(totalBalance)}
                  </span>
                  {lateFineConfig.enabled && totalLateFine > 0 && (
                    <>
                      <span className="text-amber-600">Late Fines: {fmt(totalLateFine)}</span>
                      <span className="font-bold text-red-700">Total Due: {fmt(totalDue)}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
