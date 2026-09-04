import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { confirm } from "../../components/ui/AlertDialog";

interface VoucherClass {
  id: string;
  name: string;
  voucherType: string;
  defaultDebitAccountId: string | null;
  defaultCreditAccountId: string | null;
  narrationTemplate: string | null;
  isActive: boolean;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

const VOUCHER_TYPES = ["PAYMENT", "RECEIPT", "CONTRA", "JOURNAL"];

export function VoucherClasses() {
  const [classes, setClasses] = useState<VoucherClass[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VoucherClass | null>(null);
  const [form, setForm] = useState({ name: "", voucherType: "JOURNAL", defaultDebitAccountId: "", defaultCreditAccountId: "", narrationTemplate: "", isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [vcRes, accRes] = await Promise.all([
        api.get("/voucher-classes" + (typeFilter ? `?voucherType=${typeFilter}` : "")),
        api.get("/accounts"),
      ]);
      setClasses(vcRes.data.data ?? []);
      setAccounts(accRes.data.data?.accounts ?? accRes.data.accounts ?? []);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [typeFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", voucherType: "JOURNAL", defaultDebitAccountId: "", defaultCreditAccountId: "", narrationTemplate: "", isActive: true });
    setShowModal(true);
  }

  function openEdit(vc: VoucherClass) {
    setEditing(vc);
    setForm({
      name: vc.name,
      voucherType: vc.voucherType,
      defaultDebitAccountId: vc.defaultDebitAccountId ?? "",
      defaultCreditAccountId: vc.defaultCreditAccountId ?? "",
      narrationTemplate: vc.narrationTemplate ?? "",
      isActive: vc.isActive,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        voucherType: form.voucherType,
        defaultDebitAccountId: form.defaultDebitAccountId || null,
        defaultCreditAccountId: form.defaultCreditAccountId || null,
        narrationTemplate: form.narrationTemplate || null,
        ...(editing && { isActive: form.isActive }),
      };
      if (editing) {
        await api.put(`/voucher-classes/${editing.id}`, payload);
      } else {
        await api.post("/voucher-classes", payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(vc: VoucherClass) {
    if (!await confirm({ title: `Delete voucher class "${vc.name}"?`, confirmLabel: "Delete" })) return;
    try {
      await api.delete(`/voucher-classes/${vc.id}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    }
  }

  const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50">Voucher Classes</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">Define named presets (Voucher Classes) with default accounts and narration templates for common journal types</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">+ New Class</button>
      </div>

      <div className="flex gap-2">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
        >
          <option value="">All Types</option>
          {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50 mb-4">
              {editing ? "Edit Voucher Class" : "New Voucher Class"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Voucher Type</label>
                  <select
                    value={form.voucherType}
                    onChange={e => setForm(f => ({ ...f, voucherType: e.target.value }))}
                    className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
                  >
                    {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Default Debit Account (optional)</label>
                <select
                  value={form.defaultDebitAccountId}
                  onChange={e => setForm(f => ({ ...f, defaultDebitAccountId: e.target.value }))}
                  className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
                >
                  <option value="">— None —</option>
                  {accountOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Default Credit Account (optional)</label>
                <select
                  value={form.defaultCreditAccountId}
                  onChange={e => setForm(f => ({ ...f, defaultCreditAccountId: e.target.value }))}
                  className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
                >
                  <option value="">— None —</option>
                  {accountOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Narration Template (optional)</label>
                <input
                  type="text"
                  value={form.narrationTemplate}
                  onChange={e => setForm(f => ({ ...f, narrationTemplate: e.target.value }))}
                  placeholder="e.g. Payment to {party}"
                  className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
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
      ) : classes.length === 0 ? (
        <div className="text-center py-16 text-secondary-400 dark:text-secondary-500">
          <p className="text-lg font-medium">No voucher classes yet</p>
          <p className="text-sm mt-1">Create classes to predefine accounts and narration templates for common payment, receipt, or journal types.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/50">
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Narration Template</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {classes.map(vc => (
                  <tr key={vc.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                    <td className="px-4 py-3 font-medium text-secondary-900 dark:text-secondary-100">{vc.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                        {vc.voucherType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">{vc.narrationTemplate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${vc.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                        {vc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(vc)} className="text-xs px-2 py-1 rounded border border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-700">Edit</button>
                        <button onClick={() => handleDelete(vc)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
