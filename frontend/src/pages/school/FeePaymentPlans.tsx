import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, X, CreditCard, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student { id: string; studentCode: string; firstName: string; lastName: string; className: string; }
interface AcademicTerm { id: string; name: string; academicYear: string; isCurrent: boolean; }
interface FeeSchedule { id: string; feeName: string; className: string | null; amount: number; }
interface Installment {
  id: string; dueDate: string; amount: number; amountPaid: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'; paidAt: string | null; paymentMode: string | null; notes: string | null;
}
interface Plan {
  id: string; studentId: string; termId: string; scheduleId: string;
  totalAmount: number; totalPaid: number; balance: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes: string | null; createdAt: string;
  installments: Installment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PENDING: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELLED: 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}>
      {status}
    </span>
  );
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fmt(n: number) { return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ─── Create Plan Modal ────────────────────────────────────────────────────────

interface CreatePlanModalProps {
  students: Student[];
  terms: AcademicTerm[];
  schedules: FeeSchedule[];
  onClose: () => void;
  onCreated: (plan: Plan) => void;
}

function CreatePlanModal({ students, terms, schedules, onClose, onCreated }: CreatePlanModalProps) {
  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [numInstallments, setNumInstallments] = useState(3);
  const [installments, setInstallments] = useState<{ dueDate: string; amount: string }[]>([
    { dueDate: '', amount: '' }, { dueDate: '', amount: '' }, { dueDate: '', amount: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSchedule = schedules.find((s) => s.id === scheduleId);

  useEffect(() => {
    if (selectedSchedule) setTotalAmount(String(selectedSchedule.amount));
  }, [selectedSchedule]);

  useEffect(() => {
    const rows = Array.from({ length: numInstallments }, (_, i) => installments[i] ?? { dueDate: '', amount: '' });
    setInstallments(rows);
  }, [numInstallments]);

  // Auto-split evenly when totalAmount changes
  useEffect(() => {
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0 || numInstallments < 1) return;
    const base = Math.floor((total / numInstallments) * 100) / 100;
    const remainder = Math.round((total - base * numInstallments) * 100) / 100;
    setInstallments((prev) => prev.map((row, i) => ({
      ...row,
      amount: i === numInstallments - 1 ? String(+(base + remainder).toFixed(2)) : String(base),
    })));
  }, [totalAmount, numInstallments]);

  function setInstallment(idx: number, field: 'dueDate' | 'amount', value: string) {
    setInstallments((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  async function handleSubmit() {
    setError('');
    if (!studentId || !termId || !scheduleId || !totalAmount) {
      setError('Student, term, schedule and total amount are required.'); return;
    }
    const total = parseFloat(totalAmount);
    const insts = installments.map((i) => ({ dueDate: i.dueDate, amount: parseFloat(i.amount) }));
    if (insts.some((i) => !i.dueDate || isNaN(i.amount) || i.amount <= 0)) {
      setError('Every installment needs a due date and a positive amount.'); return;
    }
    const instSum = insts.reduce((s, i) => s + i.amount, 0);
    if (Math.abs(instSum - total) > 0.02) {
      setError(`Installment amounts (${instSum.toFixed(2)}) must equal total (${total.toFixed(2)}).`); return;
    }
    setSaving(true);
    try {
      const res = await api.post('/school/fee-payment-plans', { studentId, termId, scheduleId, totalAmount: total, installments: insts, notes: notes || undefined });
      onCreated(res.data.data.plan);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to create plan.');
    } finally {
      setSaving(false);
    }
  }

  const filteredSchedules = schedules.filter((s) => {
    if (!termId) return true;
    const student = students.find((st) => st.id === studentId);
    return !s.className || !student || s.className === student.className;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-base font-semibold text-secondary-900 dark:text-white">New Payment Plan</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded p-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Student</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentCode}) — {s.className}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Term</label>
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
                <option value="">Select term…</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.academicYear}){t.isCurrent ? ' ✓' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Fee Schedule</label>
              <select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
                <option value="">Select fee…</option>
                {filteredSchedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.feeName}{s.className ? ` (${s.className})` : ''} — {fmt(s.amount)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Total Amount (GHS)</label>
              <input type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Number of installments</label>
              <input type="number" min="1" max="12" value={numInstallments} onChange={(e) => setNumInstallments(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-2">Installment Schedule</p>
            <div className="space-y-2">
              {installments.map((inst, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-xs text-secondary-500 mb-0.5">Due Date #{idx + 1}</label>
                    <input type="date" value={inst.dueDate} onChange={(e) => setInstallment(idx, 'dueDate', e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-1.5 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary-500 mb-0.5">Amount (GHS)</label>
                    <input type="number" min="0" step="0.01" value={inst.amount} onChange={(e) => setInstallment(idx, 'amount', e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-1.5 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" placeholder="0.00" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Create Plan'}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay Installment Modal ────────────────────────────────────────────────────

interface PayModalProps { planId: string; installment: Installment; onClose: () => void; onPaid: (plan: Plan) => void; }

function PayInstallmentModal({ planId, installment, onClose, onPaid }: PayModalProps) {
  const [amount, setAmount] = useState(String(+(installment.amount - installment.amountPaid).toFixed(2)));
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    setError('');
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Enter a valid positive amount.'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/school/fee-payment-plans/${planId}/installments/${installment.id}/pay`, { amount: num, paymentMode, notes: notes || undefined });
      onPaid(res.data.data.plan);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Payment failed.');
    } finally {
      setSaving(false);
    }
  }

  const remaining = installment.amount - installment.amountPaid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-base font-semibold text-secondary-900 dark:text-white">Record Payment</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-secondary-50 dark:bg-secondary-800 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-secondary-500">Due</span><span className="font-medium">{fmtDate(installment.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">Installment</span><span className="font-medium">{fmt(installment.amount)}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">Already Paid</span><span className="text-emerald-600">{fmt(installment.amountPaid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Remaining</span><span className="text-red-600">{fmt(remaining)}</span></div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Amount (GHS)</label>
            <input type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
              {['CASH', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER', 'WAIVER'].map((m) => <option key={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Row ─────────────────────────────────────────────────────────────────

function PlanRow({ plan, students, schedules, onPayInstallment }: {
  plan: Plan; students: Student[]; schedules: FeeSchedule[];
  onPayInstallment: (plan: Plan, inst: Installment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const student = students.find((s) => s.id === plan.studentId);
  const schedule = schedules.find((s) => s.id === plan.scheduleId);
  const overdueCount = plan.installments.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 dark:hover:bg-secondary-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-secondary-900 dark:text-white">
              {student ? `${student.firstName} ${student.lastName}` : plan.studentId}
            </span>
            {student && <span className="text-xs text-secondary-500">{student.studentCode} · {student.className}</span>}
            <StatusBadge status={plan.status} />
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle size={12} />{overdueCount} overdue
              </span>
            )}
          </div>
          <div className="text-xs text-secondary-500 mt-0.5">{schedule?.feeName ?? 'Fee'} · {plan.installments.length} installments</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-secondary-900 dark:text-white">{fmt(plan.totalPaid)} <span className="text-secondary-400 font-normal">/ {fmt(plan.totalAmount)}</span></div>
          <div className="mt-1 w-32"><ProgressBar paid={plan.totalPaid} total={plan.totalAmount} /></div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-secondary-400 shrink-0" /> : <ChevronDown size={16} className="text-secondary-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-secondary-200 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-800/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-secondary-500 border-b border-secondary-200 dark:border-secondary-700">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-4 py-2 text-left font-medium">Due Date</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Paid</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Mode</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {plan.installments.map((inst, idx) => (
                <tr key={inst.id} className="border-b border-secondary-100 dark:border-secondary-700/50 last:border-0">
                  <td className="px-4 py-2 text-secondary-500">{idx + 1}</td>
                  <td className="px-4 py-2 text-secondary-700 dark:text-secondary-300">{fmtDate(inst.dueDate)}</td>
                  <td className="px-4 py-2 text-right font-medium text-secondary-900 dark:text-white">{fmt(inst.amount)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{fmt(inst.amountPaid)}</td>
                  <td className="px-4 py-2"><StatusBadge status={inst.status} /></td>
                  <td className="px-4 py-2 text-secondary-500">{inst.paymentMode?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {inst.status !== 'PAID' && plan.status === 'ACTIVE' && (
                      <button
                        onClick={() => onPayInstallment(plan, inst)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <CreditCard size={12} /> Pay
                      </button>
                    )}
                    {inst.status === 'PAID' && <CheckCircle2 size={14} className="text-emerald-500 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FeePaymentPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTermId, setFilterTermId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget, setPayTarget] = useState<{ plan: Plan; inst: Installment } | null>(null);

  const load = useCallback(async (termId?: string) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (termId) params.termId = termId;
      const [plansRes, studentsRes, termsRes, schedulesRes] = await Promise.all([
        api.get('/school/fee-payment-plans', { params }),
        api.get('/school/students', { params: { limit: 500 } }),
        api.get('/school/terms'),
        api.get('/school/fee-schedules'),
      ]);
      setPlans(plansRes.data.data.plans ?? []);
      setStudents(studentsRes.data.data.students ?? []);
      setTerms(termsRes.data.data.terms ?? []);
      setSchedules(schedulesRes.data.data.schedules ?? []);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filterTermId || undefined); }, [load, filterTermId]);

  function handleCreated(plan: Plan) {
    setPlans((prev) => [plan, ...prev]);
    setShowCreate(false);
  }

  function handlePlanUpdated(updated: Plan) {
    setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setPayTarget(null);
  }

  const filtered = plans.filter((p) => !filterStatus || p.status === filterStatus);

  // Summary stats
  const active = plans.filter((p) => p.status === 'ACTIVE').length;
  const completed = plans.filter((p) => p.status === 'COMPLETED').length;
  const overdue = plans.filter((p) => p.installments.some((i) => i.status === 'OVERDUE')).length;
  const totalBalance = plans.filter((p) => p.status === 'ACTIVE').reduce((s, p) => s + p.balance, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900 dark:text-white">Fee Payment Plans</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage instalment schedules for school fees</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-1" /> New Plan
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Plans', value: active, icon: Clock, color: 'text-blue-600' },
          { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Plans w/ Overdue', value: overdue, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Outstanding Balance', value: fmt(totalBalance), icon: CreditCard, color: 'text-secondary-700 dark:text-secondary-200' },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <tile.icon size={18} className={tile.color} />
                <span className="text-xs text-secondary-500">{tile.label}</span>
              </div>
              <p className="text-xl font-bold text-secondary-900 dark:text-white mt-1">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-secondary-500 mb-1">Term</label>
              <select value={filterTermId} onChange={(e) => setFilterTermId(e.target.value)} className="text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-1.5 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
                <option value="">All Terms</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-secondary-500 mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-1.5 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white">
                <option value="">All Statuses</option>
                <option>ACTIVE</option>
                <option>COMPLETED</option>
                <option>CANCELLED</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {filtered.length} {filtered.length === 1 ? 'Plan' : 'Plans'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-secondary-400 text-center py-6">Loading…</p>}
          {error && <p className="text-sm text-red-600 text-center py-4">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-secondary-400 text-center py-8">No payment plans found. Create one to get started.</p>
          )}
          {!loading && filtered.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              students={students}
              schedules={schedules}
              onPayInstallment={(p, i) => setPayTarget({ plan: p, inst: i })}
            />
          ))}
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreate && (
        <CreatePlanModal
          students={students}
          terms={terms}
          schedules={schedules}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {payTarget && (
        <PayInstallmentModal
          planId={payTarget.plan.id}
          installment={payTarget.inst}
          onClose={() => setPayTarget(null)}
          onPaid={handlePlanUpdated}
        />
      )}
    </div>
  );
}
