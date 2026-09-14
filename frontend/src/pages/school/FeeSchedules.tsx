import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { confirm } from "../../components/ui/AlertDialog";
import { Plus, Edit2, Trash2, Receipt, Loader2, Zap } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface FeeSchedule {
  id: string;
  termId: string;
  feeName: string;
  className: string | null;
  amount: string;
  dueDate: string | null;
  createdAt: string;
  term: AcademicTerm;
}

const emptyForm = { termId: "", feeName: "", className: "", amount: "", dueDate: "" };

export function FeeSchedules() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeeSchedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";

  const loadTerms = useCallback(async () => {
    try {
      const res = await api.get("/school/terms");
      const t: AcademicTerm[] = res.data.data.terms;
      setTerms(t);
      if (!selectedTermId) {
        const current = t.find((x) => x.isCurrent) ?? t[0];
        if (current) setSelectedTermId(current.id);
      }
    } catch {
      showToast("Failed to load terms.", "error");
    }
  }, [showToast, selectedTermId]);

  const loadSchedules = useCallback(async () => {
    if (!selectedTermId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/school/fee-schedules?termId=${selectedTermId}`);
      setSchedules(res.data.data.schedules);
    } catch {
      showToast("Failed to load fee schedules.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => { loadTerms(); }, []);
  useEffect(() => { if (selectedTermId) loadSchedules(); }, [selectedTermId]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, termId: selectedTermId });
    setModalOpen(true);
  }

  function openEdit(s: FeeSchedule) {
    setEditing(s);
    setForm({
      termId: s.termId,
      feeName: s.feeName,
      className: s.className ?? "",
      amount: String(s.amount),
      dueDate: s.dueDate ? s.dueDate.slice(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.feeName.trim() || !form.amount || !form.termId) {
      showToast("Term, fee name, and amount are required.", "error");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Amount must be a positive number.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        termId: form.termId,
        feeName: form.feeName.trim(),
        className: form.className.trim() || null,
        amount,
        dueDate: form.dueDate || null,
      };
      if (editing) {
        await api.put(`/school/fee-schedules/${editing.id}`, payload);
        showToast("Fee schedule updated.", "success");
      } else {
        await api.post("/school/fee-schedules", payload);
        showToast("Fee schedule created.", "success");
      }
      setModalOpen(false);
      loadSchedules();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to save fee schedule.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: FeeSchedule) {
    const ok = await confirm({ title: "Delete Fee Schedule", description: `Delete "${s.feeName}"? Invoices already generated will not be deleted.`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/school/fee-schedules/${s.id}`);
      showToast("Fee schedule deleted.", "success");
      loadSchedules();
    } catch {
      showToast("Failed to delete fee schedule.", "error");
    }
  }

  async function generateInvoices(s: FeeSchedule) {
    const ok = await confirm({
      title: "Generate Invoices",
      description: `Generate fee invoices for "${s.feeName}"${s.className ? ` (${s.className})` : " (all classes)"}? Students who already have an invoice for this schedule will be skipped.`,
      confirmLabel: "Generate",
    });
    if (!ok) return;
    setGenerating(s.id);
    try {
      const res = await api.post(`/school/fee-schedules/${s.id}/generate-invoices`);
      const { created, skipped, message } = res.data;
      showToast(message ?? `Created ${created}, skipped ${skipped}.`, "success");
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to generate invoices.", "error");
    } finally {
      setGenerating(null);
    }
  }

  const fmt = (n: string | number) =>
    Number(n).toLocaleString("en-GH", { style: "currency", currency: "GHS" });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Fee Schedules</h1>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} disabled={!selectedTermId}>
            <Plus className="w-4 h-4 mr-1" /> New Schedule
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300 whitespace-nowrap">Term:</label>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
        >
          {terms.length === 0 && <option value="">No terms</option>}
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-secondary-400" /></div>
          ) : !selectedTermId ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <Receipt className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No academic terms. Create a term first.</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <Receipt className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No fee schedules for this term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.feeName}</TableCell>
                      <TableCell>{s.className ?? <span className="text-secondary-400 text-xs">All classes</span>}</TableCell>
                      <TableCell className="font-mono">{fmt(s.amount)}</TableCell>
                      <TableCell>{s.dueDate ? new Date(s.dueDate).toLocaleDateString("en-GB") : <span className="text-secondary-400 text-xs">—</span>}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generateInvoices(s)}
                              disabled={generating === s.id}
                              title="Generate invoices"
                            >
                              {generating === s.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Zap className="w-4 h-4 text-amber-500" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Fee Schedule" : "New Fee Schedule"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Term *</label>
            <select
              className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
              value={form.termId}
              onChange={(e) => setForm({ ...form, termId: e.target.value })}
            >
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fee Name *</label>
            <Input value={form.feeName} onChange={(e) => setForm({ ...form, feeName: e.target.value })} placeholder="e.g. Tuition Fee, PTA Levy, ICT Fee" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Class <span className="text-secondary-400">(leave blank to apply to all classes)</span></label>
            <Input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="e.g. Form 1A, JHS 2, Primary 3" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Amount (GHS) *</label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
