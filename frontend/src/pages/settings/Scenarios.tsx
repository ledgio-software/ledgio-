import { useState, useEffect } from "react";
import { api } from "../../lib/api";

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [form, setForm] = useState({ name: "", description: "", isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [postingAll, setPostingAll] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/scenarios");
      setScenarios(res.data.data ?? []);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", isActive: true });
    setShowModal(true);
  }

  function openEdit(s: Scenario) {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "", isActive: s.isActive });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/scenarios/${editing.id}`, { name: form.name, description: form.description || null, isActive: form.isActive });
      } else {
        await api.post("/scenarios", { name: form.name, description: form.description || null });
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostAll(s: Scenario) {
    if (!confirm(`Post all provisional entries in scenario "${s.name}" to the general ledger?`)) return;
    setPostingAll(s.id);
    try {
      const res = await api.post(`/scenarios/${s.id}/post-all`);
      const { posted, errors } = res.data.data;
      alert(`Posted ${posted} entries.${errors.length ? "\n\nErrors:\n" + errors.join("\n") : ""}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    } finally {
      setPostingAll(null);
    }
  }

  async function handleDelete(s: Scenario) {
    if (!confirm(`Delete scenario "${s.name}"?`)) return;
    try {
      await api.delete(`/scenarios/${s.id}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50">Scenarios</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">Group provisional (non-posting) journal entries into named scenarios for what-if analysis</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">+ New Scenario</button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50 mb-4">
              {editing ? "Edit Scenario" : "New Scenario"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
                  placeholder="e.g. Budget 2027, Merger Impact"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 resize-none"
                />
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  Active
                </label>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-secondary-300 dark:border-secondary-600 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                  {submitting ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-secondary-500">Loading…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-16 text-secondary-400 dark:text-secondary-500">
          <p className="text-lg font-medium">No scenarios yet</p>
          <p className="text-sm mt-1">Create a scenario to capture provisional journal entries that don't affect the live ledger.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/50">
                <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
              {scenarios.map(s => (
                <tr key={s.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                  <td className="px-4 py-3 font-medium text-secondary-900 dark:text-secondary-100">{s.name}</td>
                  <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">{s.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handlePostAll(s)} disabled={postingAll === s.id} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                        {postingAll === s.id ? "Posting…" : "Post All"}
                      </button>
                      <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded border border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-700">Edit</button>
                      <button onClick={() => handleDelete(s)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                    </div>
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
