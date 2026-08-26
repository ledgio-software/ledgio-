import { useState, useEffect, useCallback } from "react";
import {
  Tag, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Users,
  AlertCircle, CheckCircle, RefreshCw,
} from "lucide-react";
import { api } from "../../lib/api";

interface PriceListEntry {
  id: string;
  inventoryItemId: string;
  unitPrice: string;
  minQty: number;
  inventoryItem?: { id: string; name: string; sku: string };
}

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  entries: PriceListEntry[];
  customers?: { id: string; name: string }[];
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
}

interface Customer {
  id: string;
  name: string;
}

const EMPTY_FORM = { name: "", description: "", currency: "GHS", isDefault: false };

export function PriceLists() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<{ inventoryItemId: string; unitPrice: string; minQty: string }>({ inventoryItemId: "", unitPrice: "", minQty: "1" });
  const [assignCustomerIds, setAssignCustomerIds] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listsRes, itemsRes, custRes] = await Promise.all([
        api.get("/price-lists"),
        api.get("/inventory/items"),
        api.get("/invoices/customers"),
      ]);
      setLists(listsRes.data.data || []);
      setItems(itemsRes.data.data?.items || []);
      setCustomers(custRes.data.data?.customers || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError(null);
    try {
      if (editingId) {
        await api.put(`/price-lists/${editingId}`, form);
        flash("Price list updated.");
      } else {
        await api.post("/price-lists", { ...form, entries: [] });
        flash("Price list created.");
      }
      setShowCreateForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Save failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this price list? Customers assigned to it will lose their price assignment.")) return;
    try {
      await api.delete(`/price-lists/${id}`);
      flash("Deleted.");
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Delete failed.");
    }
  };

  const handleAddEntry = async (listId: string) => {
    if (!newEntry.inventoryItemId) { setError("Select an item."); return; }
    const unitPrice = parseFloat(newEntry.unitPrice);
    const minQty = parseInt(newEntry.minQty, 10);
    if (isNaN(unitPrice) || unitPrice < 0) { setError("Enter a valid unit price."); return; }
    setError(null);
    try {
      await api.post(`/price-lists/${listId}/entries`, { inventoryItemId: newEntry.inventoryItemId, unitPrice, minQty: isNaN(minQty) ? 1 : minQty });
      setNewEntry({ inventoryItemId: "", unitPrice: "", minQty: "1" });
      flash("Entry added.");
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to add entry.");
    }
  };

  const handleDeleteEntry = async (listId: string, entryId: string) => {
    try {
      await api.delete(`/price-lists/${listId}/entries/${entryId}`);
      flash("Entry removed.");
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to remove entry.");
    }
  };

  const handleAssignCustomers = async (listId: string) => {
    try {
      await api.put(`/price-lists/${listId}/customers`, { customerIds: assignCustomerIds });
      flash("Customers assigned.");
      setShowAssign(null);
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Assignment failed.");
    }
  };

  const startEdit = (list: PriceList) => {
    setEditingId(list.id);
    setForm({ name: list.name, description: list.description || "", currency: list.currency, isDefault: list.isDefault });
    setShowCreateForm(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Tag size={22} /> Price Lists</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Define tiered pricing that auto-fills on invoices and sales orders when a customer is assigned a list.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => { setShowCreateForm(true); setEditingId(null); setForm(EMPTY_FORM); }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus size={14} /> New Price List
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm">
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="border rounded-lg p-5 bg-white dark:bg-gray-800 dark:border-gray-700 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editingId ? "Edit Price List" : "New Price List"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600" placeholder="e.g. Wholesale Prices" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
              <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600" maxLength={3} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600" placeholder="Optional" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
            <span>Set as default price list (applied to new customers without a specific list)</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button>
            <button onClick={() => { setShowCreateForm(false); setEditingId(null); }} className="px-4 py-2 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Price Lists */}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}
      {!loading && lists.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No price lists yet. Create one to get started.</div>
      )}
      {!loading && lists.map((list) => (
        <div key={list.id} className="border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setExpandedId(expandedId === list.id ? null : list.id)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0">
                {expandedId === list.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{list.name}</span>
                  {list.isDefault && <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">Default</span>}
                  <span className="text-xs text-gray-400">{list.currency}</span>
                  <span className="text-xs text-gray-400">{list.entries.length} item{list.entries.length !== 1 ? "s" : ""}</span>
                </div>
                {list.description && <p className="text-xs text-gray-400 mt-0.5">{list.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setShowAssign(showAssign === list.id ? null : list.id); setAssignCustomerIds((list.customers || []).map((c) => c.id)); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Assign customers">
                <Users size={15} />
              </button>
              <button onClick={() => startEdit(list)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit">
                <Edit2 size={15} />
              </button>
              <button onClick={() => handleDelete(list.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Customer Assignment Panel */}
          {showAssign === list.id && (
            <div className="border-t dark:border-gray-700 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/10 space-y-2">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Assign Customers</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {customers.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={assignCustomerIds.includes(c.id)} onChange={(e) => {
                      setAssignCustomerIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                    }} className="rounded" />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleAssignCustomers(list.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">Save Assignment</button>
                <button onClick={() => setShowAssign(null)} className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              </div>
            </div>
          )}

          {/* Entries Table */}
          {expandedId === list.id && (
            <div className="border-t dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">SKU</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Min Qty</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Unit Price ({list.currency})</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {list.entries.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">No entries yet. Add items below.</td></tr>
                    )}
                    {list.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2">{entry.inventoryItem?.name || entry.inventoryItemId}</td>
                        <td className="px-4 py-2 text-gray-400">{entry.inventoryItem?.sku || "—"}</td>
                        <td className="px-4 py-2 text-right font-variant-numeric tabular-nums">{entry.minQty}</td>
                        <td className="px-4 py-2 text-right font-variant-numeric tabular-nums">{Number(entry.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => handleDeleteEntry(list.id, entry.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                    {/* Add entry row */}
                    <tr className="bg-gray-50 dark:bg-gray-700/20">
                      <td className="px-4 py-2">
                        <select value={newEntry.inventoryItemId} onChange={(e) => setNewEntry((n) => ({ ...n, inventoryItemId: e.target.value }))} className="w-full border rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 dark:border-gray-600">
                          <option value="">Select item…</option>
                          {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{items.find((i) => i.id === newEntry.inventoryItemId)?.sku || "—"}</td>
                      <td className="px-4 py-2">
                        <input type="number" min="1" value={newEntry.minQty} onChange={(e) => setNewEntry((n) => ({ ...n, minQty: e.target.value }))} className="w-full border rounded px-2 py-1 text-xs text-right bg-white dark:bg-gray-900 dark:border-gray-600" placeholder="1" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" step="0.01" value={newEntry.unitPrice} onChange={(e) => setNewEntry((n) => ({ ...n, unitPrice: e.target.value }))} className="w-full border rounded px-2 py-1 text-xs text-right bg-white dark:bg-gray-900 dark:border-gray-600" placeholder="0.00" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => handleAddEntry(list.id)} className="text-blue-600 hover:text-blue-800"><Plus size={15} /></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
