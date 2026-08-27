import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  PlusCircle,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { api } from "../../lib/api";

type PDCType = "RECEIVABLE" | "PAYABLE";
type PDCStatus = "PENDING" | "DEPOSITED" | "BOUNCED" | "CANCELLED";

interface PDC {
  id: string;
  type: PDCType;
  partyName: string;
  chequeNumber: string;
  bankName: string;
  amount: string;
  currency: string;
  dueDate: string;
  status: PDCStatus;
  invoiceId: string | null;
  billId: string | null;
  receiptJournalId: string | null;
  depositJournalId: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<PDCStatus, string> = {
  PENDING:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  DEPOSITED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  BOUNCED:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400",
};

const emptyForm = {
  type: "RECEIVABLE" as PDCType,
  partyName: "",
  chequeNumber: "",
  bankName: "",
  amount: "",
  currency: "GHS",
  dueDate: "",
  notes: "",
  postJournal: true,
};

export function PostDatedCheques() {
  const [activeTab, setActiveTab] = useState<PDCType>("RECEIVABLE");
  const [pdcs, setPdcs] = useState<PDC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPDCs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/pdc");
      setPdcs(res.data?.data?.pdcs || []);
    } catch (err) {
      console.error("Failed to load PDCs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPDCs();
  }, [fetchPDCs]);

  const filtered = pdcs.filter((p) => p.type === activeTab);

  const pendingAmount = filtered
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const dueSoon = filtered.filter((p) => {
    if (p.status !== "PENDING") return false;
    const due = new Date(p.dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await api.post("/pdc", {
        type: form.type,
        partyName: form.partyName,
        chequeNumber: form.chequeNumber,
        bankName: form.bankName,
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
        notes: form.notes || undefined,
        postJournal: form.postJournal,
      });
      setForm({ ...emptyForm, type: activeTab });
      setShowForm(false);
      setMessage("✅ Cheque added to register.");
      fetchPDCs();
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || "Failed to create cheque."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: "deposit" | "bounce" | "cancel") => {
    setMessage(null);
    try {
      await api.patch(`/pdc/${id}/${action}`);
      const labels = { deposit: "deposited", bounce: "bounced", cancel: "cancelled" };
      setMessage(`✅ Cheque ${labels[action]}.`);
      fetchPDCs();
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.error || `Failed to ${action} cheque.`}`);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString();
  const fmtAmount = (amount: string, currency: string) =>
    `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
            Post-Dated Cheques
          </h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            Track cheques received from customers (Receivable) and issued to suppliers (Payable).
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setForm({ ...emptyForm, type: activeTab }); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Cheque
        </Button>
      </div>

      {message && (
        <div className="p-3 bg-secondary-50 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 rounded-lg text-xs">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-secondary-200 dark:border-secondary-700">
        {(["RECEIVABLE", "PAYABLE"] as PDCType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300"
            }`}
          >
            {tab === "RECEIVABLE" ? (
              <span className="flex items-center gap-1.5"><ArrowDownCircle className="h-4 w-4" /> Receivable</span>
            ) : (
              <span className="flex items-center gap-1.5"><ArrowUpCircle className="h-4 w-4" /> Payable</span>
            )}
          </button>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary-500 mb-1">Pending {activeTab === "RECEIVABLE" ? "to Receive" : "to Pay"}</p>
            <p className="text-2xl font-bold text-secondary-900 dark:text-secondary-50">
              GHS {pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary-500 mb-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Due Within 7 Days
            </p>
            <p className="text-2xl font-bold text-amber-600">{dueSoon}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <CreditCard className="mr-2 h-4 w-4 text-primary-600" />
                Add {form.type === "RECEIVABLE" ? "Receivable" : "Payable"} Cheque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as PDCType })}
                    className="w-full text-xs rounded-md border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="RECEIVABLE">Receivable (from customer)</option>
                    <option value="PAYABLE">Payable (to supplier)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Party Name</label>
                  <Input
                    value={form.partyName}
                    onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                    placeholder="Customer or supplier name"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Cheque Number</label>
                  <Input
                    value={form.chequeNumber}
                    onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                    placeholder="CHQ-001234"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Bank Name</label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="GCB Bank"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Currency</label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    placeholder="GHS"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">Due Date</label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">
                  Notes <span className="font-normal text-secondary-400">(optional)</span>
                </label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-secondary-700 dark:text-secondary-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.postJournal}
                  onChange={(e) => setForm({ ...form, postJournal: e.target.checked })}
                  className="rounded"
                />
                Post journal entry on creation
              </label>
            </CardContent>
            <div className="px-6 pb-6 flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Saving…" : "Add to Register"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* PDC table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-xs text-secondary-500 py-6 text-center">Loading cheques…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-secondary-500 py-6 text-center">
              No {activeTab.toLowerCase()} cheques on register.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-secondary-500 border-b border-secondary-200 dark:border-secondary-800">
                  <th className="py-2 pr-3">Party</th>
                  <th className="py-2 pr-3">Cheque #</th>
                  <th className="py-2 pr-3">Bank</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Due Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pdc) => (
                  <tr key={pdc.id} className="border-b border-secondary-100 dark:border-secondary-800">
                    <td className="py-2 pr-3 font-medium">{pdc.partyName}</td>
                    <td className="py-2 pr-3 font-mono">{pdc.chequeNumber}</td>
                    <td className="py-2 pr-3 text-secondary-500">{pdc.bankName}</td>
                    <td className="py-2 pr-3 font-semibold tabular-nums">{fmtAmount(pdc.amount, pdc.currency)}</td>
                    <td className="py-2 pr-3">{fmtDate(pdc.dueDate)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[pdc.status]}`}>
                        {pdc.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {pdc.status === "PENDING" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction(pdc.id, "deposit")}
                            title="Deposit"
                            className="text-emerald-600 hover:text-emerald-800"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(pdc.id, "bounce")}
                            title="Bounce"
                            className="text-red-500 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(pdc.id, "cancel")}
                            title="Cancel"
                            className="text-secondary-400 hover:text-secondary-600"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
