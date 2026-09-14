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
import { Plus, Edit2, Trash2, CalendarDays, Loader2, Star } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
}

const emptyForm = { name: "", academicYear: "", startDate: "", endDate: "", isCurrent: false };

export function AcademicTerms() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicTerm | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/school/terms");
      setTerms(res.data.data.terms);
    } catch {
      showToast("Failed to load academic terms.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(t: AcademicTerm) {
    setEditing(t);
    setForm({ name: t.name, academicYear: t.academicYear, startDate: t.startDate.slice(0, 10), endDate: t.endDate.slice(0, 10), isCurrent: t.isCurrent });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.academicYear.trim() || !form.startDate || !form.endDate) {
      showToast("All fields are required.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/school/terms/${editing.id}`, form);
        showToast("Term updated.", "success");
      } else {
        await api.post("/school/terms", form);
        showToast("Term created.", "success");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to save term.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: AcademicTerm) {
    const ok = await confirm({ title: "Delete Term", description: `Delete "${t.name}"? All fee schedules for this term will also be deleted.`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/school/terms/${t.id}`);
      showToast("Term deleted.", "success");
      load();
    } catch {
      showToast("Failed to delete term.", "error");
    }
  }

  async function setAsCurrent(t: AcademicTerm) {
    try {
      await api.put(`/school/terms/${t.id}`, { isCurrent: true });
      showToast(`"${t.name}" is now the current term.`, "success");
      load();
    } catch {
      showToast("Failed to update term.", "error");
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Academic Terms</h1>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> New Term
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-secondary-400" /></div>
          ) : terms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <CalendarDays className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No academic terms yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Term Name</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {t.isCurrent && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          {t.name}
                        </div>
                      </TableCell>
                      <TableCell>{t.academicYear}</TableCell>
                      <TableCell>{new Date(t.startDate).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{new Date(t.endDate).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>
                        {t.isCurrent ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Current</span>
                        ) : (
                          isAdmin && (
                            <button onClick={() => setAsCurrent(t)} className="text-xs text-primary-600 hover:underline">
                              Set as current
                            </button>
                          )
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Term" : "New Academic Term"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Term Name *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Term 1 2026/27" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Academic Year *</label>
            <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="e.g. 2026/27" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date *</label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date *</label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} className="rounded" />
            <span className="text-sm">Set as current term</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Create Term"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
