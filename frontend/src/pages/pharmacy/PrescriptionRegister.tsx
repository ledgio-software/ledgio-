import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ClipboardList, Plus, Search, CheckCircle2, Clock } from "lucide-react";

interface PrescriptionLine {
  id: string;
  itemId: string;
  prescribedQty: number;
  dispensedQty: number;
  notes?: string;
  item: { id: string; name: string; sku: string };
}

interface Prescription {
  id: string;
  rxNumber: string;
  patientName: string;
  patientAge?: number;
  patientPhone?: string;
  prescribingDoctor: string;
  prescriptionDate: string;
  dispensedAt?: string;
  dispensedByName?: string;
  cashSaleId?: string;
  notes?: string;
  lines: PrescriptionLine[];
  createdAt: string;
}

export function PrescriptionRegister() {
  const { showToast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [items, setItems] = useState<{ id: string; name: string; sku: string }[]>([]);

  const [form, setForm] = useState({
    patientName: "",
    patientAge: "",
    patientPhone: "",
    prescribingDoctor: "",
    prescriptionDate: new Date().toISOString().slice(0, 10),
    notes: "",
    lines: [{ itemId: "", prescribedQty: 1 }],
  });

  async function load(q?: string) {
    setLoading(true);
    try {
      const res = await api.get("/pharmacy/prescriptions", { params: q ? { q } : {} });
      setPrescriptions(res.data.data.prescriptions);
    } catch {
      showToast("Failed to load prescriptions.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    try {
      const res = await api.get("/inventory/items");
      setItems(res.data.data.items.map((i: any) => ({ id: i.id, name: i.name, sku: i.sku })));
    } catch {}
  }

  useEffect(() => { load(); loadItems(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/pharmacy/prescriptions", {
        patientName: form.patientName,
        patientAge: form.patientAge ? Number(form.patientAge) : null,
        patientPhone: form.patientPhone || null,
        prescribingDoctor: form.prescribingDoctor,
        prescriptionDate: new Date(form.prescriptionDate).toISOString(),
        notes: form.notes || null,
        lines: form.lines.map((l) => ({ itemId: l.itemId, prescribedQty: Number(l.prescribedQty) })),
      });
      showToast("Prescription created.", "success");
      setShowNew(false);
      setForm({ patientName: "", patientAge: "", patientPhone: "", prescribingDoctor: "", prescriptionDate: new Date().toISOString().slice(0, 10), notes: "", lines: [{ itemId: "", prescribedQty: 1 }] });
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to create prescription.", "error");
    }
  }

  async function handleDispense(id: string) {
    try {
      await api.patch(`/pharmacy/prescriptions/${id}/dispense`, { dispensedByName: undefined });
      showToast("Prescription marked as dispensed.", "success");
      load();
      setSelected(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to dispense.", "error");
    }
  }

  const filtered = prescriptions.filter((p) =>
    !search || p.patientName.toLowerCase().includes(search.toLowerCase()) || p.rxNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prescription Register</h1>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Prescription
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          placeholder="Search by patient name or Rx number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No prescriptions found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Rx #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Doctor</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setSelected(p)}>
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{p.rxNumber}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{p.patientName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.prescribingDoctor}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Date(p.prescriptionDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {p.dispensedAt ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Dispensed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><Clock className="w-3 h-3" /> Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {!p.dispensedAt && (
                      <Button variant="outline" size="sm" onClick={() => handleDispense(p.id)}>Dispense</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Prescription Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New Prescription">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Patient Name *</label>
              <Input required value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Patient Age</label>
              <Input type="number" value={form.patientAge} onChange={(e) => setForm({ ...form, patientAge: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prescribing Doctor *</label>
              <Input required value={form.prescribingDoctor} onChange={(e) => setForm({ ...form, prescribingDoctor: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prescription Date *</label>
              <Input type="date" required value={form.prescriptionDate} onChange={(e) => setForm({ ...form, prescriptionDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prescribed Items</label>
            {form.lines.map((line, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  required
                  value={line.itemId}
                  onChange={(e) => {
                    const lines = [...form.lines];
                    lines[i] = { ...lines[i], itemId: e.target.value };
                    setForm({ ...form, lines });
                  }}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  required
                  className="w-20 border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  value={line.prescribedQty}
                  onChange={(e) => {
                    const lines = [...form.lines];
                    lines[i] = { ...lines[i], prescribedQty: Number(e.target.value) };
                    setForm({ ...form, lines });
                  }}
                />
                {form.lines.length > 1 && (
                  <button type="button" className="text-red-500 text-sm" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="text-blue-600 text-sm" onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: "", prescribedQty: 1 }] })}>
              + Add item
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Save Prescription</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Prescription — ${selected.rxNumber}`}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{selected.patientName}</span></div>
              <div><span className="text-gray-500">Age:</span> {selected.patientAge ?? "—"}</div>
              <div><span className="text-gray-500">Phone:</span> {selected.patientPhone ?? "—"}</div>
              <div><span className="text-gray-500">Doctor:</span> {selected.prescribingDoctor}</div>
              <div><span className="text-gray-500">Date:</span> {new Date(selected.prescriptionDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Status:</span> {selected.dispensedAt ? <span className="text-green-600 font-medium">Dispensed {new Date(selected.dispensedAt).toLocaleDateString()}</span> : <span className="text-amber-600 font-medium">Pending</span>}</div>
            </div>
            {selected.notes && <p className="text-gray-600 italic">"{selected.notes}"</p>}
            <table className="w-full mt-2 border-t dark:border-gray-700 pt-2">
              <thead><tr className="text-gray-500 text-xs"><th className="text-left py-1">Item</th><th className="text-right py-1">Prescribed</th><th className="text-right py-1">Dispensed</th></tr></thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id} className="border-t dark:border-gray-700">
                    <td className="py-1">{l.item.name} <span className="text-gray-400 text-xs">({l.item.sku})</span></td>
                    <td className="text-right py-1">{l.prescribedQty}</td>
                    <td className="text-right py-1">{l.dispensedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!selected.dispensedAt && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => handleDispense(selected.id)}>Mark as Dispensed</Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
