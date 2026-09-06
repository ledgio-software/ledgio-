import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ClipboardList, Plus, Search, CheckCircle2, Clock, AlertTriangle, Bell, ShieldAlert } from "lucide-react";

interface PrescriptionLine {
  id: string;
  itemId: string;
  prescribedQty: number;
  dispensedQty: number;
  notes?: string;
  item: { id: string; name: string; sku: string };
}

interface PharmacyPatient {
  id: string;
  name: string;
  phone?: string;
  nhisCardNumber?: string;
  allergies: string[];
  chronicConditions?: string;
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
  billingType: string;
  patient?: PharmacyPatient;
  lines: PrescriptionLine[];
  createdAt: string;
}

// Common drug interaction pairs relevant to Ghana's pharmacy context
const DRUG_INTERACTIONS: Array<{ drugs: [string, string]; severity: "HIGH" | "MODERATE"; message: string }> = [
  { drugs: ["metronidazole", "alcohol"], severity: "HIGH", message: "Metronidazole + Alcohol: severe nausea/vomiting, disulfiram-like reaction." },
  { drugs: ["warfarin", "aspirin"], severity: "HIGH", message: "Warfarin + Aspirin: major bleeding risk." },
  { drugs: ["warfarin", "co-trimoxazole"], severity: "HIGH", message: "Warfarin + Co-trimoxazole: significantly increased INR, bleeding risk." },
  { drugs: ["warfarin", "metronidazole"], severity: "HIGH", message: "Warfarin + Metronidazole: significantly increased INR." },
  { drugs: ["warfarin", "paracetamol"], severity: "MODERATE", message: "Warfarin + Paracetamol (>2 g/day): may potentiate anticoagulant effect." },
  { drugs: ["warfarin", "amoxicillin"], severity: "MODERATE", message: "Warfarin + Amoxicillin: may potentiate anticoagulant effect." },
  { drugs: ["ciprofloxacin", "antacid"], severity: "MODERATE", message: "Ciprofloxacin + Antacids: reduced absorption — take 2 hours apart." },
  { drugs: ["chloroquine", "amiodarone"], severity: "HIGH", message: "Chloroquine + Amiodarone: risk of fatal cardiac arrhythmia (QT prolongation)." },
  { drugs: ["chloroquine", "artemether"], severity: "HIGH", message: "Chloroquine + Artemether-Lumefantrine: QT prolongation risk." },
  { drugs: ["atenolol", "verapamil"], severity: "HIGH", message: "Beta-blocker + Verapamil: risk of heart block and severe bradycardia." },
  { drugs: ["lisinopril", "spironolactone"], severity: "HIGH", message: "ACE inhibitor + Spironolactone: dangerous hyperkalemia." },
  { drugs: ["carbamazepine", "contraceptive"], severity: "HIGH", message: "Carbamazepine + Oral Contraceptives: reduced contraceptive efficacy." },
  { drugs: ["codeine", "tramadol"], severity: "HIGH", message: "Codeine + Tramadol: increased risk of opioid toxicity and seizures." },
  { drugs: ["amlodipine", "simvastatin"], severity: "MODERATE", message: "Amlodipine + Simvastatin >20 mg: increased myopathy risk." },
  { drugs: ["ibuprofen", "aspirin"], severity: "MODERATE", message: "Ibuprofen + Aspirin: increased GI bleeding risk." },
  { drugs: ["nsaid", "aspirin"], severity: "MODERATE", message: "NSAID + Aspirin: increased GI bleeding risk." },
  { drugs: ["phenytoin", "folic acid"], severity: "MODERATE", message: "Phenytoin + Folic Acid: may reduce seizure control — monitor levels." },
];

function checkInteractions(drugNames: string[]) {
  const lower = drugNames.map((n) => n.toLowerCase());
  return DRUG_INTERACTIONS.filter(({ drugs: [a, b] }) =>
    lower.some((n) => n.includes(a)) && lower.some((n) => n.includes(b))
  );
}

function checkAllergies(drugNames: string[], allergies: string[]) {
  const lower = drugNames.map((n) => n.toLowerCase());
  return allergies.filter((allergy) => lower.some((n) => n.includes(allergy.toLowerCase())));
}

export function PrescriptionRegister() {
  const { showToast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [items, setItems] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [patients, setPatients] = useState<PharmacyPatient[]>([]);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const emptyForm = {
    patientName: "",
    patientAge: "",
    patientPhone: "",
    patientId: "",
    prescribingDoctor: "",
    prescriptionDate: new Date().toISOString().slice(0, 10),
    billingType: "CASH" as "CASH" | "NHIS" | "INSURANCE",
    notes: "",
    lines: [{ itemId: "", prescribedQty: 1 }],
  };

  const [form, setForm] = useState(emptyForm);

  const selectedPatient = patients.find((p) => p.id === form.patientId) || null;
  const selectedDrugNames = form.lines
    .map((l) => items.find((it) => it.id === l.itemId)?.name || "")
    .filter(Boolean);

  const allergyWarnings = selectedPatient ? checkAllergies(selectedDrugNames, selectedPatient.allergies) : [];
  const interactionWarnings = checkInteractions(selectedDrugNames);

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

  async function loadPatients() {
    try {
      const res = await api.get("/pharmacy/patients");
      setPatients(res.data.data.patients);
    } catch {}
  }

  useEffect(() => { load(); loadItems(); loadPatients(); }, []);

  // When a patient is selected, pre-fill name and phone
  function handlePatientSelect(patientId: string) {
    const patient = patients.find((p) => p.id === patientId);
    setForm((f) => ({
      ...f,
      patientId,
      patientName: patient?.name || f.patientName,
      patientPhone: patient?.phone || f.patientPhone,
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/pharmacy/prescriptions", {
        patientName: form.patientName,
        patientAge: form.patientAge ? Number(form.patientAge) : null,
        patientPhone: form.patientPhone || null,
        patientId: form.patientId || null,
        prescribingDoctor: form.prescribingDoctor,
        prescriptionDate: new Date(form.prescriptionDate).toISOString(),
        billingType: form.billingType,
        notes: form.notes || null,
        lines: form.lines.map((l) => ({ itemId: l.itemId, prescribedQty: Number(l.prescribedQty) })),
      });
      showToast("Prescription created.", "success");
      setShowNew(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to create prescription.", "error");
    }
  }

  async function handleDispense(id: string) {
    try {
      await api.patch(`/pharmacy/prescriptions/${id}/dispense`, {});
      showToast("Prescription marked as dispensed.", "success");
      load();
      setSelected(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to dispense.", "error");
    }
  }

  async function handleSendRefillReminder(id: string) {
    setSendingReminder(id);
    try {
      await api.post(`/pharmacy/prescriptions/${id}/send-refill-reminder`);
      showToast("Refill reminder sent via SMS.", "success");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to send reminder.", "error");
    } finally {
      setSendingReminder(null);
    }
  }

  const filtered = prescriptions.filter(
    (p) => !search || p.patientName.toLowerCase().includes(search.toLowerCase()) || p.rxNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
                <th className="px-4 py-3 text-left">Billing</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setSelected(p)}>
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{p.rxNumber}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {p.patientName}
                    {p.patient?.allergies?.length ? (
                      <span className="ml-1 text-red-500 text-xs" title={`Allergies: ${p.patient.allergies.join(", ")}`}>⚠</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.prescribingDoctor}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Date(p.prescriptionDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${p.billingType === "NHIS" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : p.billingType === "INSURANCE" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {p.billingType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.dispensedAt ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Dispensed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><Clock className="w-3 h-3" /> Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!p.dispensedAt && (
                      <Button variant="outline" size="sm" onClick={() => handleDispense(p.id)}>Dispense</Button>
                    )}
                    {p.dispensedAt && p.patientPhone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendRefillReminder(p.id)}
                        disabled={sendingReminder === p.id}
                        title="Send SMS refill reminder"
                      >
                        <Bell className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Prescription Modal */}
      <Modal isOpen={showNew} onClose={() => { setShowNew(false); setForm(emptyForm); }} title="New Prescription">
        <form onSubmit={handleCreate} className="space-y-4">

          {/* Patient selector */}
          {patients.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Registered Patient (optional)</label>
              <select
                value={form.patientId}
                onChange={(e) => handlePatientSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="">— walk-in / unregistered —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.phone ? ` (${p.phone})` : ""}{p.nhisCardNumber ? ` · NHIS: ${p.nhisCardNumber}` : ""}
                  </option>
                ))}
              </select>
              {selectedPatient?.allergies?.length ? (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Known allergies: {selectedPatient.allergies.join(", ")}
                </p>
              ) : null}
              {selectedPatient?.chronicConditions && (
                <p className="mt-0.5 text-xs text-amber-600">Chronic conditions: {selectedPatient.chronicConditions}</p>
              )}
            </div>
          )}

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
              <label className="block text-sm font-medium mb-1">Billing Type</label>
              <select
                value={form.billingType}
                onChange={(e) => setForm({ ...form, billingType: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="CASH">Cash</option>
                <option value="NHIS">NHIS (National Health Insurance)</option>
                <option value="INSURANCE">Private Insurance</option>
              </select>
            </div>
            <div className="col-span-2">
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

          {/* Allergy warnings */}
          {allergyWarnings.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">Allergy Alert</span>
              </div>
              {allergyWarnings.map((a, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-300">Patient has a documented allergy to <strong>{a}</strong>.</p>
              ))}
            </div>
          )}

          {/* Drug interaction warnings */}
          {interactionWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Drug Interaction Warnings</span>
              </div>
              {interactionWarnings.map((w, i) => (
                <p key={i} className={`text-xs mt-0.5 ${w.severity === "HIGH" ? "text-red-700 dark:text-red-300 font-medium" : "text-amber-700 dark:text-amber-300"}`}>
                  {w.severity === "HIGH" ? "⚠ HIGH: " : "• "}{w.message}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowNew(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit">Save Prescription</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Prescription — ${selected.rxNumber}`}>
          <div className="space-y-3 text-sm">
            {selected.patient?.allergies?.length ? (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 px-3 py-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs text-red-700 dark:text-red-300">Allergies on file: <strong>{selected.patient.allergies.join(", ")}</strong></span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{selected.patientName}</span></div>
              <div><span className="text-gray-500">Age:</span> {selected.patientAge ?? "—"}</div>
              <div><span className="text-gray-500">Phone:</span> {selected.patientPhone ?? "—"}</div>
              <div><span className="text-gray-500">Doctor:</span> {selected.prescribingDoctor}</div>
              <div><span className="text-gray-500">Date:</span> {new Date(selected.prescriptionDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Billing:</span> <span className={`font-medium ${selected.billingType === "NHIS" ? "text-green-600" : ""}`}>{selected.billingType}</span></div>
              {selected.patient?.nhisCardNumber && (
                <div className="col-span-2"><span className="text-gray-500">NHIS Card:</span> <span className="font-mono font-medium">{selected.patient.nhisCardNumber}</span></div>
              )}
              <div className="col-span-2"><span className="text-gray-500">Status:</span> {selected.dispensedAt ? <span className="text-green-600 font-medium">Dispensed {new Date(selected.dispensedAt).toLocaleDateString()}</span> : <span className="text-amber-600 font-medium">Pending</span>}</div>
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
            <div className="flex justify-end gap-2 pt-2">
              {selected.patientPhone && selected.dispensedAt && (
                <Button variant="outline" onClick={() => handleSendRefillReminder(selected.id)} disabled={sendingReminder === selected.id}>
                  <Bell className="w-3 h-3 mr-1" /> Send Refill Reminder
                </Button>
              )}
              {!selected.dispensedAt && (
                <Button onClick={() => handleDispense(selected.id)}>Mark as Dispensed</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
