import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Search, X, Save, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";

interface PharmacyPatient {
  id: string;
  name: string;
  phone?: string;
  dateOfBirth?: string;
  nhisCardNumber?: string;
  allergies: string[];
  chronicConditions?: string;
}

const COMMON_ALLERGIES = [
  "Penicillin", "Sulfonamides", "Aspirin", "NSAIDs", "Codeine",
  "Morphine", "Latex", "Iodine", "Metronidazole", "Chloroquine",
];

const EMPTY_FORM = {
  name: "",
  phone: "",
  dateOfBirth: "",
  nhisCardNumber: "",
  allergies: [] as string[],
  newAllergyInput: "",
  chronicConditions: "",
};

export function PharmacyPatients() {
  const [patients, setPatients] = useState<PharmacyPatient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchPatients = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/pharmacy/patients", { params: { q } });
      setPatients(res.data.patients ?? []);
    } catch {
      setError("Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchPatients]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(p: PharmacyPatient) {
    setForm({
      name: p.name,
      phone: p.phone ?? "",
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
      nhisCardNumber: p.nhisCardNumber ?? "",
      allergies: [...p.allergies],
      newAllergyInput: "",
      chronicConditions: p.chronicConditions ?? "",
    });
    setEditId(p.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
  }

  function toggleAllergy(a: string) {
    setForm((f) => ({
      ...f,
      allergies: f.allergies.includes(a) ? f.allergies.filter((x) => x !== a) : [...f.allergies, a],
    }));
  }

  function addCustomAllergy() {
    const val = form.newAllergyInput.trim();
    if (!val || form.allergies.includes(val)) return;
    setForm((f) => ({ ...f, allergies: [...f.allergies, val], newAllergyInput: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      nhisCardNumber: form.nhisCardNumber.trim() || undefined,
      allergies: form.allergies,
      chronicConditions: form.chronicConditions.trim() || undefined,
    };
    try {
      if (editId) {
        await api.put(`/pharmacy/patients/${editId}`, payload);
      } else {
        await api.post("/pharmacy/patients", payload);
      }
      closeForm();
      fetchPatients(query);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to save patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Patient Registry</h1>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or NHIS number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Patient list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          {query ? "No patients match your search." : "No patients yet. Add your first patient."}
        </div>
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                    {p.allergies.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {p.allergies.length} {p.allergies.length === 1 ? "allergy" : "allergies"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                    {p.phone && <span>{p.phone}</span>}
                    {p.nhisCardNumber && <span>NHIS: {p.nhisCardNumber}</span>}
                    {p.dateOfBirth && <span>DOB: {new Date(p.dateOfBirth).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {expandedId === p.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50 text-sm space-y-3">
                  {p.allergies.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Allergies</div>
                      <div className="flex flex-wrap gap-1">
                        {p.allergies.map((a) => (
                          <span key={a} className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.chronicConditions && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Chronic Conditions</div>
                      <p className="text-gray-700 dark:text-gray-300">{p.chronicConditions}</p>
                    </div>
                  )}
                  {p.allergies.length === 0 && !p.chronicConditions && (
                    <p className="text-gray-400 text-xs">No allergy or condition flags recorded.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {editId ? "Edit Patient" : "New Patient"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">NHIS Card Number</label>
                <input
                  value={form.nhisCardNumber}
                  onChange={(e) => setForm((f) => ({ ...f, nhisCardNumber: e.target.value }))}
                  placeholder="e.g. GH-NHIS-XXXXXXXX"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Allergies</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_ALLERGIES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAllergy(a)}
                      className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        form.allergies.includes(a)
                          ? "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:border-red-500 dark:text-red-400"
                          : "bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={form.newAllergyInput}
                    onChange={(e) => setForm((f) => ({ ...f, newAllergyInput: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAllergy(); } }}
                    placeholder="Add custom allergy…"
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={addCustomAllergy}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Add
                  </button>
                </div>
                {form.allergies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.allergies.map((a) => (
                      <span key={a} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                        {a}
                        <button type="button" onClick={() => setForm((f) => ({ ...f, allergies: f.allergies.filter((x) => x !== a) }))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Chronic Conditions</label>
                <textarea
                  value={form.chronicConditions}
                  onChange={(e) => setForm((f) => ({ ...f, chronicConditions: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Hypertension, Type 2 Diabetes…"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
