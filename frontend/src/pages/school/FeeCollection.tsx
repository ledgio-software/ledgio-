import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { BookOpen, Loader2, Phone, CreditCard, CheckCircle2, Gift, Zap } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface InvoiceSummary {
  id: string;
  status: string;
  total: number;
  amountPaid: number;
  dueDate: string | null;
}

interface StudentRow {
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
  paymentStatus: "paid" | "partial" | "unpaid" | "not_generated";
  invoices: InvoiceSummary[];
}

interface Summary {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  notGenerated: number;
}

interface Receipt {
  studentName: string;
  studentCode: string;
  className: string;
  guardianName: string;
  totalPaid: number;
  change: number;
  paymentMode: string;
  termName: string;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  not_generated: "No Invoice",
};

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  unpaid: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  not_generated: "bg-secondary-100 text-secondary-500 dark:bg-secondary-800",
};

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

const CAN_COLLECT_ROLES = new Set(["admin", "accountant"]);
const CAN_WAIVE_ROLES = new Set(["admin"]);

export function FeeCollection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Collect modal state
  const [collectTarget, setCollectTarget] = useState<StudentRow | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [collecting, setCollecting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Generate invoices state
  const [generating, setGenerating] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  // Waiver modal state
  const [waiveTarget, setWaiveTarget] = useState<{ invoice: InvoiceSummary; student: StudentRow["student"] } | null>(null);
  const [waiveAmount, setWaiveAmount] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [waiving, setWaiving] = useState(false);

  const canCollect = CAN_COLLECT_ROLES.has((user?.role ?? "").toLowerCase());
  const canWaive = CAN_WAIVE_ROLES.has((user?.role ?? "").toLowerCase());
  const canGenerate = CAN_COLLECT_ROLES.has((user?.role ?? "").toLowerCase());

  useEffect(() => {
    api.get("/school/terms").then((res) => {
      const t: AcademicTerm[] = res.data.data.terms;
      setTerms(t);
      const current = t.find((x) => x.isCurrent) ?? t[0];
      if (current) setSelectedTermId(current.id);
      else setLoading(false);
    }).catch(() => {
      showToast("Failed to load terms.", "error");
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedTermId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/school/fee-collection?termId=${selectedTermId}`);
      setRows(res.data.data.students);
      setSummary(res.data.data.summary);
    } catch {
      showToast("Failed to load fee collection data.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => { if (selectedTermId) load(); }, [selectedTermId]);

  function openCollect(row: StudentRow) {
    setCollectTarget(row);
    setCollectAmount(String(row.balance.toFixed(2)));
    setPaymentMode("CASH");
    setReceipt(null);
  }

  async function handleCollect() {
    if (!collectTarget || !selectedTermId) return;
    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Enter a valid amount.", "error");
      return;
    }
    setCollecting(true);
    try {
      const res = await api.post("/school/fee-collection/collect", {
        studentId: collectTarget.student.id,
        termId: selectedTermId,
        amount: amt,
        paymentMode,
      });
      const term = terms.find((t) => t.id === selectedTermId);
      setReceipt({
        studentName: `${collectTarget.student.firstName} ${collectTarget.student.lastName}`,
        studentCode: collectTarget.student.studentCode,
        className: collectTarget.student.className,
        guardianName: collectTarget.student.guardianName,
        totalPaid: res.data.totalPaid,
        change: res.data.change,
        paymentMode,
        termName: term ? `${term.name} (${term.academicYear})` : "",
      });
      showToast(res.data.message, "success");
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to record payment.", "error");
    } finally {
      setCollecting(false);
    }
  }

  async function handleGenerate() {
    if (!selectedTermId) return;
    setGenerating(true);
    setShowGenerateConfirm(false);
    try {
      const res = await api.post("/school/fee-collection/generate-invoices", { termId: selectedTermId });
      showToast(res.data.message, "success");
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to generate invoices.", "error");
    } finally {
      setGenerating(false);
    }
  }

  function openWaive(row: StudentRow, inv: InvoiceSummary) {
    setWaiveTarget({ invoice: inv, student: row.student });
    setWaiveAmount(String((inv.total - inv.amountPaid).toFixed(2)));
    setWaiveReason("");
  }

  async function handleWaive() {
    if (!waiveTarget) return;
    const amt = parseFloat(waiveAmount);
    if (isNaN(amt) || amt <= 0) { showToast("Enter a valid waiver amount.", "error"); return; }
    setWaiving(true);
    try {
      await api.post("/school/fee-collection/waive", {
        invoiceId: waiveTarget.invoice.id,
        amount: amt,
        reason: waiveReason.trim() || undefined,
      });
      showToast(`Waiver of GHS ${amt.toFixed(2)} applied.`, "success");
      setWaiveTarget(null);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to apply waiver.", "error");
    } finally {
      setWaiving(false);
    }
  }

  const classes = [...new Set(rows.map((r) => r.student.className))].sort();
  const filtered = rows.filter((r) => {
    const matchClass = !classFilter || r.student.className === classFilter;
    const matchStatus = !statusFilter || r.paymentStatus === statusFilter;
    return matchClass && matchStatus;
  });

  const fmt = (n: number) =>
    n.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Fee Collection</h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300 whitespace-nowrap">Term:</label>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Students", value: summary.total, cls: "text-secondary-900 dark:text-white" },
            { label: "Paid", value: summary.paid, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Partial", value: summary.partial, cls: "text-amber-600 dark:text-amber-400" },
            { label: "Unpaid", value: summary.unpaid, cls: "text-red-600 dark:text-red-400" },
            { label: "No Invoice", value: summary.notGenerated, cls: "text-secondary-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-xs text-secondary-500 mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canGenerate && summary && summary.notGenerated > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <Zap className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
            {summary.notGenerated} student{summary.notGenerated !== 1 ? "s" : ""} have no invoice for this term.
          </p>
          <Button size="sm" onClick={() => setShowGenerateConfirm(true)} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Generate Invoices
          </Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="not_generated">No Invoice</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-secondary-400" /></div>
          ) : !selectedTermId ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <BookOpen className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No academic terms found.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <BookOpen className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{rows.length === 0 ? "No active students found." : "No students match your filters."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    {canCollect && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.student.id}>
                      <TableCell>
                        <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                        <div className="text-xs text-secondary-400 font-mono">{r.student.studentCode}</div>
                      </TableCell>
                      <TableCell>{r.student.className}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.student.guardianName}</div>
                        <a href={`tel:${r.student.guardianPhone}`} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                          <Phone className="w-3 h-3" />{r.student.guardianPhone}
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(r.totalOwed)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">{fmt(r.totalPaid)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">{r.balance > 0 ? fmt(r.balance) : "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[r.paymentStatus]}`}>
                          {STATUS_LABEL[r.paymentStatus]}
                        </span>
                      </TableCell>
                      {canCollect && (
                        <TableCell className="text-right">
                          {(r.paymentStatus === "unpaid" || r.paymentStatus === "partial") && (
                            <Button size="sm" variant="ghost" onClick={() => openCollect(r)} title="Collect fee">
                              <CreditCard className="w-4 h-4 text-primary-600" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoices Confirmation */}
      <Modal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        title="Generate Fee Invoices"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-600 dark:text-secondary-400">
            This will create invoices for all students who don't have one yet for the selected term.
            Students who already have invoices will be skipped. This action is safe to run multiple times.
          </p>
          {summary && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm">
              <span className="font-semibold text-amber-800 dark:text-amber-300">{summary.notGenerated}</span>
              <span className="text-amber-700 dark:text-amber-400"> student{summary.notGenerated !== 1 ? "s" : ""} will receive invoices.</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
              Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Waiver Modal */}
      <Modal
        isOpen={!!waiveTarget}
        onClose={() => setWaiveTarget(null)}
        title={`Apply Waiver — ${waiveTarget?.student.firstName} ${waiveTarget?.student.lastName}`}
      >
        {waiveTarget && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
              <div className="font-medium mb-1">Invoice balance</div>
              <div className="font-mono text-lg">{fmt(waiveTarget.invoice.total - waiveTarget.invoice.amountPaid)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Waiver Amount (GHS) *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={waiveAmount}
                onChange={(e) => setWaiveAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <Input
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g. Staff child, scholarship, hardship"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setWaiveTarget(null)}>Cancel</Button>
              <Button onClick={handleWaive} disabled={waiving} className="bg-amber-600 hover:bg-amber-700 text-white">
                {waiving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Gift className="w-4 h-4 mr-1" />}
                Apply Waiver
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Collect Fee Modal */}
      <Modal
        isOpen={!!collectTarget}
        onClose={() => { setCollectTarget(null); setReceipt(null); }}
        title={receipt ? "Payment Receipt" : `Collect Fee — ${collectTarget?.student.firstName} ${collectTarget?.student.lastName}`}
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-semibold text-lg">Payment Recorded</span>
            </div>
            <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-500">Student</span>
                <span className="font-medium">{receipt.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Code</span>
                <span className="font-mono text-xs">{receipt.studentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Class</span>
                <span>{receipt.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Guardian</span>
                <span>{receipt.guardianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Term</span>
                <span>{receipt.termName}</span>
              </div>
              <div className="border-t border-secondary-200 dark:border-secondary-700 my-1" />
              <div className="flex justify-between">
                <span className="text-secondary-500">Payment Mode</span>
                <span>{PAYMENT_MODES.find((m) => m.value === receipt.paymentMode)?.label ?? receipt.paymentMode}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Amount Paid</span>
                <span className="text-emerald-600 dark:text-emerald-400">{fmt(receipt.totalPaid)}</span>
              </div>
              {receipt.change > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Change</span>
                  <span>{fmt(receipt.change)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setCollectTarget(null); setReceipt(null); }}>Close</Button>
              <Button onClick={() => window.print()}>Print Receipt</Button>
            </div>
          </div>
        ) : collectTarget && (
          <div className="space-y-4">
            {/* Invoice breakdown */}
            {collectTarget.invoices.filter((inv) => inv.status !== "PAID" && inv.status !== "VOIDED").length > 0 && (
              <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-2">Outstanding Invoices</div>
                {collectTarget.invoices
                  .filter((inv) => inv.status !== "PAID" && inv.status !== "VOIDED")
                  .map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2">
                      <span className="text-secondary-600 dark:text-secondary-400">
                        Invoice <span className="font-mono text-xs">{inv.id.slice(-6).toUpperCase()}</span>
                        {inv.dueDate && <span className="ml-2 text-xs text-secondary-400">due {new Date(inv.dueDate).toLocaleDateString("en-GB")}</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-red-600 dark:text-red-400">{fmt(inv.total - inv.amountPaid)}</span>
                        {canWaive && collectTarget && (
                          <button
                            className="text-xs text-amber-600 hover:underline whitespace-nowrap"
                            onClick={() => { setCollectTarget(null); openWaive(collectTarget, inv); }}
                          >
                            Waive
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                <div className="border-t border-secondary-200 dark:border-secondary-700 pt-1 flex justify-between font-semibold">
                  <span>Total Balance</span>
                  <span className="font-mono">{fmt(collectTarget.balance)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Amount Received (GHS) *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Payment Mode</label>
              <select
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCollectTarget(null)}>Cancel</Button>
              <Button onClick={handleCollect} disabled={collecting}>
                {collecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                Collect Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
