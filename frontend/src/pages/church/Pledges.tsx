import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { TrendingUp, DollarSign, CheckCircle, Plus, Loader2, Edit2 } from "lucide-react";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

interface ChurchPledge {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  pledge_type: string;
  amount: number;
  currency: string;
  pledge_date: string;
  due_date: string | null;
  fulfilled_amount: number;
  status: string;
  notes: string | null;
}

type PledgeStatus = "ACTIVE" | "FULFILLED" | "CANCELLED";

const STATUS_BADGE: Record<PledgeStatus, "default" | "success" | "secondary"> = {
  ACTIVE: "default",
  FULFILLED: "success",
  CANCELLED: "secondary",
};

const PLEDGE_TYPES = ["Building Fund", "Special Project", "Welfare", "Tithe", "Offering", "Other"];

interface PledgeForm {
  memberId: string;
  pledgeType: string;
  amount: string;
  currency: string;
  pledgeDate: string;
  dueDate: string;
  notes: string;
}

const emptyForm: PledgeForm = {
  memberId: "", pledgeType: "Building Fund", amount: "", currency: "GHS",
  pledgeDate: new Date().toISOString().slice(0, 10), dueDate: "", notes: "",
};

function fmt(n: number, currency = "GHS") {
  return `${currency} ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function Pledges() {
  const { showToast } = useToast();
  const [pledges, setPledges] = useState<ChurchPledge[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMemberId, setFilterMemberId] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<ChurchPledge | null>(null);
  const [form, setForm] = useState<PledgeForm>(emptyForm);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPledges = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterMemberId) params.memberId = filterMemberId;
      const r = await api.get("/church/pledges", { params });
      setPledges(r.data?.data ?? []);
    } catch {
      showToast("Failed to load pledges.", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterMemberId, showToast]);

  useEffect(() => {
    loadPledges();
    api.get("/church/members").then((r) => setMembers(r.data?.data ?? []));
  }, [loadPledges]);

  async function handleAddPledge() {
    if (!form.memberId || !form.pledgeType || !form.amount || !form.pledgeDate) {
      showToast("Member, type, amount and date are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/church/pledges", {
        memberId: form.memberId,
        pledgeType: form.pledgeType,
        amount: parseFloat(form.amount),
        currency: form.currency,
        pledgeDate: form.pledgeDate,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      });
      showToast("Pledge recorded.", "success");
      setShowAddModal(false);
      setForm(emptyForm);
      loadPledges();
    } catch {
      showToast("Failed to save pledge.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment() {
    if (!selectedPledge || !paymentAmount) {
      showToast("Payment amount is required.", "error");
      return;
    }
    const payment = parseFloat(paymentAmount);
    if (isNaN(payment) || payment <= 0) {
      showToast("Enter a valid payment amount.", "error");
      return;
    }
    setSaving(true);
    try {
      const newFulfilled = Number(selectedPledge.fulfilled_amount) + payment;
      await api.put(`/church/pledges/${selectedPledge.id}`, {
        fulfilledAmount: newFulfilled,
      });
      showToast("Payment recorded.", "success");
      setShowPaymentModal(false);
      setPaymentAmount("");
      setSelectedPledge(null);
      loadPledges();
    } catch {
      showToast("Failed to record payment.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(pledge: ChurchPledge) {
    setSelectedPledge(pledge);
    setPaymentAmount("");
    setShowPaymentModal(true);
  }

  function f(key: keyof PledgeForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const totalPledged = pledges.reduce((s, p) => s + Number(p.amount), 0);
  const totalFulfilled = pledges.reduce((s, p) => s + Number(p.fulfilled_amount), 0);
  const totalBalance = totalPledged - totalFulfilled;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary-600" />
          <h1 className="text-xl font-bold text-secondary-900 dark:text-secondary-50">Pledges</h1>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Pledge
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary-600 shrink-0" />
            <div>
              <p className="text-xs text-secondary-500">Total Pledged</p>
              <p className="font-bold text-secondary-900 dark:text-secondary-50">{fmt(totalPledged)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs text-secondary-500">Total Fulfilled</p>
              <p className="font-bold text-secondary-900 dark:text-secondary-50">{fmt(totalFulfilled)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-secondary-500">Outstanding Balance</p>
              <p className="font-bold text-secondary-900 dark:text-secondary-50">{fmt(totalBalance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
          >
            <option value="">All Members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Pledges table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fulfilled</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-secondary-500">
                      No pledges found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pledges.map((p) => {
                    const balance = Number(p.amount) - Number(p.fulfilled_amount);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                        <TableCell>{p.pledge_type}</TableCell>
                        <TableCell>{fmt(p.amount, p.currency)}</TableCell>
                        <TableCell>{fmt(p.fulfilled_amount, p.currency)}</TableCell>
                        <TableCell className={balance > 0 ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
                          {fmt(balance, p.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[p.status as PledgeStatus]}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.due_date ? p.due_date.slice(0, 10) : "—"}</TableCell>
                        <TableCell>
                          {p.status === "ACTIVE" && (
                            <button
                              onClick={() => openPayment(p)}
                              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                              title="Record payment"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Pay
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Pledge Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Pledge"
        className="max-w-lg"
      >
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Member *</label>
            <select
              value={form.memberId}
              onChange={(e) => f("memberId", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Pledge Type *</label>
            <select
              value={form.pledgeType}
              onChange={(e) => f("pledgeType", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              {PLEDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => f("amount", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => f("currency", e.target.value)}
                maxLength={10}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Pledge Date *</label>
              <input
                type="date"
                value={form.pledgeDate}
                onChange={(e) => f("pledgeDate", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => f("dueDate", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => f("notes", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button onClick={handleAddPledge} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record Pledge
          </Button>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        className="max-w-sm"
      >
        {selectedPledge && (
          <div className="space-y-4 mt-2">
            <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-4 space-y-1">
              <p className="text-sm font-medium text-secondary-800 dark:text-secondary-200">
                {selectedPledge.first_name} {selectedPledge.last_name}
              </p>
              <p className="text-sm text-secondary-600 dark:text-secondary-400">{selectedPledge.pledge_type}</p>
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                Pledged: {fmt(selectedPledge.amount, selectedPledge.currency)} |{" "}
                Fulfilled: {fmt(selectedPledge.fulfilled_amount, selectedPledge.currency)}
              </p>
              <p className="text-sm font-medium text-amber-600">
                Balance: {fmt(Number(selectedPledge.amount) - Number(selectedPledge.fulfilled_amount), selectedPledge.currency)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">
                Payment Amount ({selectedPledge.currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <CheckCircle className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default Pledges;
