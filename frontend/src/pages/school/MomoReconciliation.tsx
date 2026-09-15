import { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Smartphone, CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface MomoTxn {
  phone: string;
  amount: number;
  momoRef?: string;
  date?: string;
}

interface MatchedRow {
  txn: MomoTxn;
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    className: string;
    guardianPhone: string;
    guardianName: string;
  };
  outstandingBalance: number;
}

type Step = "input" | "preview" | "done";

function parseTransactions(raw: string): MomoTxn[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result: MomoTxn[] = [];
  for (const line of lines) {
    // Skip header-like lines
    if (/phone|number|amount|ref/i.test(line) && !/\d{9,}/.test(line)) continue;
    // Split by tab, comma, or 2+ spaces
    const parts = line.split(/\t|,|  +/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const phone = parts[0].replace(/[^\d+]/g, "");
    const amountStr = parts[1].replace(/[^\d.]/g, "");
    const amount = parseFloat(amountStr);
    if (!phone || isNaN(amount) || amount <= 0) continue;
    const momoRef = parts[2] || undefined;
    const date = parts[3] || undefined;
    result.push({ phone, amount, momoRef, date });
  }
  return result;
}

export function MomoReconciliation() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [termId, setTermId] = useState("");
  const [raw, setRaw] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [unmatched, setUnmatched] = useState<MomoTxn[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [result, setResult] = useState<{ processed: number; failed: number; errors?: string[] } | null>(null);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const cur = list.find((t) => t.isCurrent);
      if (cur) setTermId(cur.id);
    }).catch(() => {});
  }, []);

  async function handlePreview() {
    if (!termId) { showToast("Select a term first.", "error"); return; }
    const txns = parseTransactions(raw);
    if (txns.length === 0) { showToast("No valid transactions found. Each line needs: phone  amount  [ref]", "error"); return; }
    setLoading(true);
    try {
      const res = await api.post("/school/fee-collection/momo-reconcile/preview", { termId, transactions: txns });
      const data = res.data.data;
      setMatched(data.matched);
      setUnmatched(data.unmatched);
      setSelected(new Set(data.matched.map((_: MatchedRow, i: number) => i)));
      setStep("preview");
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Preview failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    const entries = [...selected].map((i) => ({
      studentId: matched[i].student.id,
      amount: matched[i].txn.amount,
      momoRef: matched[i].txn.momoRef,
    }));
    if (entries.length === 0) { showToast("Nothing selected to post.", "error"); return; }
    setCommitting(true);
    try {
      const res = await api.post("/school/fee-collection/momo-reconcile/commit", { termId, entries });
      setResult(res.data.data);
      setStep("done");
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to post payments.", "error");
    } finally {
      setCommitting(false);
    }
  }

  function toggleAll() {
    if (selected.size === matched.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matched.map((_, i) => i)));
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const selectLabel = (i: number) =>
    matched[i].txn.amount <= matched[i].outstandingBalance
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">MoMo Reconciliation</h1>
      </div>
      <p className="text-sm text-secondary-500">
        Paste your MoMo transaction list to automatically match payments to students and post them in bulk.
      </p>

      {step === "input" && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <label className="block text-sm font-medium mb-1">Term *</label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
              >
                <option value="">— Select term —</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} {t.isCurrent ? "(current)" : ""}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Paste MoMo Transactions</label>
              <textarea
                rows={10}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={`One transaction per line. Format:\n  phone  amount  [reference]\n\nExamples:\n  0244123456  150.00  TXN001\n  0201987654  250\n  +233244555666  80.50  GHA-REF-789\n\nYou can also paste directly from Excel or a MoMo statement.`}
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white font-mono resize-y"
              />
              <p className="text-xs text-secondary-400 mt-1">
                Columns: phone · amount · reference (optional). Separate with tab, comma, or spaces. Phone can be 0244… or +233244… or 233244…
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handlePreview} disabled={loading || !raw.trim() || !termId}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                Preview Matches
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Transactions", value: matched.length + unmatched.length, color: "text-secondary-900 dark:text-white" },
              { label: "Matched", value: matched.length, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Unmatched", value: unmatched.length, color: "text-red-600 dark:text-red-400" },
              { label: "Selected to post", value: selected.size, color: "text-primary-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-secondary-500">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Matched transactions */}
          {matched.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-secondary-100 dark:border-secondary-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">Matched Transactions</span>
                  <label className="flex items-center gap-2 text-xs cursor-pointer text-secondary-500">
                    <input type="checkbox" checked={selected.size === matched.length} onChange={toggleAll} className="rounded" />
                    Select all
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-secondary-100 dark:border-secondary-800">
                        <th className="px-4 py-2 text-left font-medium text-secondary-500 w-8"></th>
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Student</th>
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Class</th>
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Guardian Phone</th>
                        <th className="px-4 py-2 text-right font-medium text-secondary-500">Outstanding</th>
                        <th className="px-4 py-2 text-right font-medium text-secondary-500">MoMo Amount</th>
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.map((row, i) => (
                        <tr key={i} className={`border-b border-secondary-50 dark:border-secondary-800/50 ${selected.has(i) ? "bg-primary-50/30 dark:bg-primary-900/10" : ""}`}>
                          <td className="px-4 py-2">
                            <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="rounded" />
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {row.student.firstName} {row.student.lastName}
                            <span className="text-xs text-secondary-400 ml-1 font-mono">{row.student.studentCode}</span>
                          </td>
                          <td className="px-4 py-2 text-secondary-500">{row.student.className}</td>
                          <td className="px-4 py-2 text-secondary-500 font-mono text-xs">{row.txn.phone}</td>
                          <td className="px-4 py-2 text-right font-semibold text-secondary-700 dark:text-secondary-300">
                            {row.outstandingBalance > 0 ? `GHS ${row.outstandingBalance.toFixed(2)}` : <span className="text-emerald-600 text-xs">Fully paid</span>}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${selectLabel(i)}`}>
                            GHS {row.txn.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-xs text-secondary-400 font-mono">{row.txn.momoRef ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unmatched transactions */}
          {unmatched.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-secondary-100 dark:border-secondary-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">Unmatched ({unmatched.length})</span>
                  <span className="text-xs text-secondary-400">— phone numbers not found in active students</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-secondary-100 dark:border-secondary-800">
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Phone</th>
                        <th className="px-4 py-2 text-right font-medium text-secondary-500">Amount</th>
                        <th className="px-4 py-2 text-left font-medium text-secondary-500">Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatched.map((txn, i) => (
                        <tr key={i} className="border-b border-secondary-50 dark:border-secondary-800/50">
                          <td className="px-4 py-2 font-mono text-xs text-secondary-500">{txn.phone}</td>
                          <td className="px-4 py-2 text-right text-secondary-500">GHS {txn.amount.toFixed(2)}</td>
                          <td className="px-4 py-2 text-xs text-secondary-400 font-mono">{txn.momoRef ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("input")}>Back</Button>
            <Button onClick={handleCommit} disabled={committing || selected.size === 0}>
              {committing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Post {selected.size} Payment{selected.size !== 1 ? "s" : ""} as Mobile Money
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            {result.failed === 0 ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            ) : (
              <XCircle className="w-12 h-12 text-amber-500" />
            )}
            <div>
              <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                {result.processed} payment{result.processed !== 1 ? "s" : ""} posted
              </p>
              {result.failed > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{result.failed} failed</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-500 space-y-0.5 text-left list-disc list-inside">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <Button onClick={() => { setStep("input"); setRaw(""); setResult(null); }}>
              Reconcile Another Batch
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
