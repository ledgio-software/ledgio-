import { useState, useEffect, useCallback } from "react";
import { Hash, Plus, RefreshCw, AlertCircle, Search } from "lucide-react";
import { api } from "../../lib/api";

interface SerialRecord {
  id: string;
  serialNumber: string;
  inventoryItemId: string;
  warehouseId: string;
  status: string;
  invoiceId: string | null;
  billId: string | null;
  createdAt: string;
  inventoryItem?: { id: string; name: string; sku: string };
}

interface InventoryItem { id: string; name: string; sku: string; }
interface Warehouse { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SOLD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  RETURNED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  DAMAGED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function SerialNumbers() {
  const [records, setRecords] = useState<SerialRecord[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [filterItem, setFilterItem] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ inventoryItemId: "", warehouseId: "", serialsText: "", billId: "" });
  const [receiveSaving, setReceiveSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterItem) params.set("inventoryItemId", filterItem);
      if (filterWarehouse) params.set("warehouseId", filterWarehouse);
      if (filterStatus) params.set("status", filterStatus);
      const [srRes, itemsRes, whRes] = await Promise.all([
        api.get(`/serial-numbers?${params.toString()}`),
        api.get("/inventory"),
        api.get("/inventory/warehouses"),
      ]);
      let data: SerialRecord[] = srRes.data.data || [];
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => r.serialNumber.toLowerCase().includes(q) || r.inventoryItem?.name.toLowerCase().includes(q));
      }
      setRecords(data);
      setTotal(srRes.data.pagination?.total || data.length);
      setItems(itemsRes.data.items || itemsRes.data || []);
      setWarehouses(whRes.data.data?.warehouses || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load serial numbers.");
    } finally {
      setLoading(false);
    }
  }, [filterItem, filterWarehouse, filterStatus, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleReceive = async () => {
    const sns = receiveForm.serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!receiveForm.inventoryItemId || !receiveForm.warehouseId) { setError("Select item and warehouse."); return; }
    if (sns.length === 0) { setError("Enter at least one serial number."); return; }
    setReceiveSaving(true);
    setError(null);
    try {
      await api.post("/serial-numbers/receive", {
        inventoryItemId: receiveForm.inventoryItemId,
        warehouseId: receiveForm.warehouseId,
        serialNumbers: sns,
        ...(receiveForm.billId ? { billId: receiveForm.billId } : {}),
      });
      setShowReceive(false);
      setReceiveForm({ inventoryItemId: "", warehouseId: "", serialsText: "", billId: "" });
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Receive failed.");
    } finally {
      setReceiveSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Hash size={22} /> Serial Numbers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track individual units by serial number — receive on bills, assign on invoices.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setShowReceive(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus size={14} /> Receive Serials
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Receive Panel */}
      {showReceive && (
        <div className="border rounded-lg p-5 bg-white dark:bg-gray-800 dark:border-gray-700 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Receive Serial Numbers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Item *</label>
              <select value={receiveForm.inventoryItemId} onChange={(e) => setReceiveForm((f) => ({ ...f, inventoryItemId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600">
                <option value="">Select item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Warehouse *</label>
              <select value={receiveForm.warehouseId} onChange={(e) => setReceiveForm((f) => ({ ...f, warehouseId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600">
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serial Numbers (one per line, or comma-separated) *</label>
              <textarea value={receiveForm.serialsText} onChange={(e) => setReceiveForm((f) => ({ ...f, serialsText: e.target.value }))} rows={4} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600 font-mono" placeholder="SN-001&#10;SN-002&#10;SN-003" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bill ID (optional)</label>
              <input value={receiveForm.billId} onChange={(e) => setReceiveForm((f) => ({ ...f, billId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-600" placeholder="Link to vendor bill UUID" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReceive} disabled={receiveSaving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60">
              {receiveSaving ? "Saving…" : "Receive"}
            </button>
            <button onClick={() => setShowReceive(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial / item…" className="pl-8 pr-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 w-52" />
        </div>
        <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
          <option value="">All Items</option>
          {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
        <select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
          <option value="">All Statuses</option>
          {["AVAILABLE", "SOLD", "RETURNED", "DAMAGED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}
      {!loading && records.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No serial numbers found. Receive serials when processing a vendor bill or GRN.</div>
      )}
      {!loading && records.length > 0 && (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left border-b dark:border-gray-700">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Serial #</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">SKU</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Invoice</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-xs">{r.serialNumber}</td>
                  <td className="px-4 py-2">{r.inventoryItem?.name || r.inventoryItemId.slice(0, 8) + "…"}</td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{r.inventoryItem?.sku || "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{r.invoiceId ? r.invoiceId.slice(0, 8) + "…" : "—"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t dark:border-gray-700">{total} total record{total !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}
