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
import { Plus, Edit2, Trash2, GraduationCap, Phone, Search, Loader2 } from "lucide-react";

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  firstName: "", lastName: "", className: "",
  guardianName: "", guardianPhone: "", guardianEmail: "",
};

const WRITE_ROLES = new Set(["viewer", "auditor", "hr", "cashier", "warehouse manager"]);

export function Students() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const isReadOnly = WRITE_ROLES.has((user?.role ?? "").toLowerCase());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/school/students");
      setStudents(res.data.data.students);
    } catch {
      showToast("Failed to load students.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(s: Student) {
    setEditing(s);
    setForm({ firstName: s.firstName, lastName: s.lastName, className: s.className, guardianName: s.guardianName, guardianPhone: s.guardianPhone, guardianEmail: s.guardianEmail ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.className.trim() || !form.guardianName.trim() || !form.guardianPhone.trim()) {
      showToast("First name, last name, class, guardian name, and phone are required.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/school/students/${editing.id}`, form);
        showToast("Student updated.", "success");
      } else {
        await api.post("/school/students", form);
        showToast("Student added.", "success");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to save student.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Student) {
    const ok = await confirm({ title: "Delete Student", description: `Remove ${s.firstName} ${s.lastName}? This cannot be undone.`, confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/school/students/${s.id}`);
      showToast("Student deleted.", "success");
      load();
    } catch {
      showToast("Failed to delete student.", "error");
    }
  }

  const classes = [...new Set(students.map((s) => s.className))].sort();
  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${s.firstName} ${s.lastName} ${s.studentCode}`.toLowerCase().includes(q) || s.guardianPhone.includes(q);
    const matchClass = !classFilter || s.className === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Students</h1>
          <span className="text-sm text-secondary-500">({students.length})</span>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Student
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <Input placeholder="Search name, code, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-secondary-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <GraduationCap className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{students.length === 0 ? "No students yet. Add your first student." : "No students match your search."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-secondary-500">{s.studentCode}</TableCell>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>{s.className}</TableCell>
                      <TableCell>{s.guardianName}</TableCell>
                      <TableCell>
                        <a href={`tel:${s.guardianPhone}`} className="flex items-center gap-1 text-primary-600 hover:underline text-sm">
                          <Phone className="w-3 h-3" />{s.guardianPhone}
                        </a>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-secondary-100 text-secondary-500 dark:bg-secondary-800"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Student" : "Add Student"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Ama" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Mensah" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Class *</label>
            <Input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="e.g. Form 1A, JHS 2B, Primary 3" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guardian / Parent Name *</label>
            <Input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} placeholder="e.g. Kofi Mensah" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Guardian Phone *</label>
              <Input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="0244000000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guardian Email</label>
              <Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Add Student"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
