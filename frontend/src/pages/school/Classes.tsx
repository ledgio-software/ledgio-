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
import { Plus, Edit2, Trash2, Layers, Loader2 } from "lucide-react";

interface SchoolClass {
  id: string;
  name: string;
  level: string;
  capacity: number;
  isActive: boolean;
  studentCount: number;
}

const LEVELS = [
  { value: "CRECHE",  label: "Creche" },
  { value: "NURSERY", label: "Nursery" },
  { value: "KG",      label: "Kindergarten (KG)" },
  { value: "PRIMARY", label: "Primary" },
  { value: "JHS",     label: "Junior High School (JHS)" },
];

const LEVEL_ORDER: Record<string, number> = {
  CRECHE: 0, NURSERY: 1, KG: 2, PRIMARY: 3, JHS: 4,
};

const emptyForm = { name: "", level: "PRIMARY", capacity: "30" };

export function Classes() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const role = (user?.role ?? "").toLowerCase();
  const canWrite = !["viewer", "auditor", "cashier", "teacher", "class teacher"].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/school/classes");
      const sorted = (res.data.data.classes as SchoolClass[]).sort(
        (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.name.localeCompare(b.name)
      );
      setClasses(sorted);
    } catch {
      showToast("Failed to load classes.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    setForm({ name: c.name, level: c.level, capacity: String(c.capacity) });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Class name is required.", "error");
      return;
    }
    const cap = Number(form.capacity);
    if (!cap || cap < 1 || cap > 200) {
      showToast("Capacity must be between 1 and 200.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/school/classes/${editing.id}`, { name: form.name, level: form.level, capacity: cap });
        showToast("Class updated.", "success");
      } else {
        await api.post("/school/classes", { name: form.name, level: form.level, capacity: cap });
        showToast("Class created.", "success");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to save class.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: SchoolClass) {
    const ok = await confirm({
      title: "Delete Class",
      description: `Delete "${c.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/school/classes/${c.id}`);
      showToast("Class deleted.", "success");
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Failed to delete class.", "error");
    }
  }

  const levelLabel = (level: string) => LEVELS.find((l) => l.value === level)?.label ?? level;

  const levelGroups = LEVELS.map((l) => ({
    ...l,
    items: classes.filter((c) => c.level === l.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Classes</h1>
          <span className="text-sm text-secondary-500">({classes.length})</span>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Class
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-secondary-400" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-secondary-500">
            <Layers className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">No classes set up yet</p>
            <p className="text-xs text-secondary-400 text-center max-w-xs">
              Add your classes (e.g. Creche, KG 1, Primary 3A, JHS 2B) to start assigning students.
            </p>
            {canWrite && (
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-1" /> Add First Class
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {levelGroups.map((group) => (
            <div key={group.value}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary-500 mb-2 px-1">
                {group.label}
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Class Name</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead className="text-center">Students</TableHead>
                          <TableHead className="text-center">Capacity</TableHead>
                          <TableHead className="text-center">Fill %</TableHead>
                          <TableHead>Status</TableHead>
                          {canWrite && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((c) => {
                          const fill = c.capacity > 0 ? Math.round((c.studentCount / c.capacity) * 100) : 0;
                          const fillColor = fill >= 100 ? "text-red-600 dark:text-red-400" : fill >= 80 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-secondary-500 text-sm">{levelLabel(c.level)}</TableCell>
                              <TableCell className="text-center font-semibold">{c.studentCount}</TableCell>
                              <TableCell className="text-center text-secondary-500">{c.capacity}</TableCell>
                              <TableCell className={`text-center font-semibold ${fillColor}`}>{fill}%</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-secondary-100 text-secondary-500 dark:bg-secondary-800"}`}>
                                  {c.isActive ? "Active" : "Inactive"}
                                </span>
                              </TableCell>
                              {canWrite && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Class" : "Add Class"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Level *</label>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Class Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Primary 3A, JHS 2B, KG 1"
            />
            <p className="text-xs text-secondary-400 mt-1">
              Use a clear name like "Primary 3A" or "JHS 1". Students will be assigned from a dropdown.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity (max students)</label>
            <Input
              type="number"
              min="1"
              max="200"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              placeholder="30"
            />
            <p className="text-xs text-secondary-400 mt-1">GES recommends a maximum of 30 per class.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Add Class"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
