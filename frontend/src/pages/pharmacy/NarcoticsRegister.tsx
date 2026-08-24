import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ShieldAlert, Plus, Download, Filter, ClipboardCheck } from "lucide-react";

interface NarcoticsEntry {
  id: string;
  itemId: string;
  batchNumber?: string;
  entryDate: string;
  operationType: string;
  quantity: number;
  balanceAfter: number;
  patientName?: string;
  prescriptionRef?: string;
  supplierRef?: string;
  recordedByName: string;
  notes?: string;
  item: { id: string; name: string; sku: string };
}

const OP_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  DISPENSED: "Dispensed",
  DESTROYED: "Destroyed",
  RETURNED: "Returned",
  DAILY_COUNT: "Daily Count",
};

const OP_COLORS: Record<string, string> = {
  RECEIVED: "text-green-600 bg-green-50 dark:bg-green-900/20",
  DISPENSED: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  DESTROYED: "text-red-600 bg-red-50 dark:bg-red-900/20",
  RETURNED: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  DAILY_COUNT: "text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300",
};

export function NarcoticsRegister() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<NarcoticsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [filterItemId, setFilterItemId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showDailyCount, setShowDailyCount] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [dailyCount, setDailyCount] = useState({
    itemId: "",
    countedQty: 0,
    notes: "",
  });

  const [form, setForm] = useState({
    itemId: "",
    batchNumber: "",
    operationType: "DISPENSED",
    quantity: 1,
    patientName: "",
    prescriptionRef: "",
    supplierRef: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterItemId) params.itemId = filterItemId;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      const res = await api.get("/pharmacy/narcotics", { params });
      setEntries(res.data.data.entries);
    } catch {
      showToast("Failed to load narcotics register.", "error");
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
      await api.post("/pharmacy/narcotics", {
        itemId: form.itemId,
        batchNumber: form.batchNumber || null,
        operationType: form.operationType,
        quantity: Number(form.quantity),
        patientName: form.patientName || null,
        prescriptionRef: form.prescriptionRef || null,
        supplierRef: form.supplierRef || null,
        notes: form.notes || null,
      });
      showToast("Entry added.", "success");
      setShowNew(false);
      setForm({ itemId: "", batchNumber: "", operationType: "DISPENSED", quantity: 1, patientName: "", prescriptionRef: "", supplierRef: "", notes: "" });
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to add entry.", "error");
    }
  }

  // Compute the expected balance (last register entry) for the selected daily-count drug
  const expectedBalance = dailyCount.itemId
    ? (() => {
        const lastEntry = entries
          .filter((e) => e.itemId === dailyCount.itemId)
          .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())[0];
        return lastEntry ? lastEntry.balanceAfter : 0;
      })()
    : 0;
  const discrepancy = dailyCount.countedQty - expectedBalance;

  async function handleDailyCount(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/pharmacy/narcotics/daily-count", {
        itemId: dailyCount.itemId,
        countedQty: Number(dailyCount.countedQty),
        notes: dailyCount.notes,
      });
      showToast("Daily count recorded.", "success");
      setShowDailyCount(false);
      setDailyCount({ itemId: "", countedQty: 0, notes: "" });
      load();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to record daily count.", "error");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/pharmacy/narcotics/export.pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `narcotics-register-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("Failed to export PDF.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Narcotics Register</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" /> {exporting ? "Exporting…" : "Export PDF"}
          </Button>
          <Button variant="outline" onClick={() => setShowDailyCount(true)}>
            <ClipboardCheck className="w-4 h-4 mr-1" /> Daily Count
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>
        <select
          value={filterItemId}
          onChange={(e) => setFilterItemId(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">All drugs</option>
          {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          placeholder="From"
        />
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          placeholder="To"
        />
        <Button variant="outline" size="sm" onClick={load}>Apply</Button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No entries found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Drug</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Operation</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Rx / Ref</th>
                <th className="px-4 py-3 text-left">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {entries.map((e) => {
                const isDailyCount = e.operationType === "DAILY_COUNT";
                const isIn = !isDailyCount && (e.operationType === "RECEIVED" || e.operationType === "RETURNED");
                return (
                  <tr key={e.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isDailyCount ? "bg-gray-50/60 dark:bg-gray-700/30" : ""}`}>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(e.entryDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {e.item.name}
                      <span className="block text-xs text-gray-400">{e.item.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {e.batchNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${OP_COLORS[e.operationType] ?? ""}`}>
                        {OP_LABELS[e.operationType] ?? e.operationType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-600">
                      {isDailyCount ? "—" : isIn ? e.quantity : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-500">
                      {isDailyCount ? "—" : !isIn ? e.quantity : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-white">
                      {e.balanceAfter}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.patientName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {e.prescriptionRef ?? e.supplierRef ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.recordedByName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showDailyCount} onClose={() => setShowDailyCount(false)} title="End-of-Day Controlled Substance Count">
        <form onSubmit={handleDailyCount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Drug *</label>
            <select
              required
              value={dailyCount.itemId}
              onChange={(e) => setDailyCount({ ...dailyCount, itemId: e.target.value, countedQty: 0 })}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Select controlled drug…</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>)}
            </select>
          </div>
          {dailyCount.itemId && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
              Expected balance (last register entry): <span className="font-bold">{expectedBalance}</span> units
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Actual counted quantity *</label>
            <Input
              type="number"
              min={0}
              required
              value={dailyCount.countedQty}
              onChange={(e) => setDailyCount({ ...dailyCount, countedQty: Number(e.target.value) })}
            />
          </div>
          {dailyCount.itemId && (
            <div className={`p-3 rounded-lg text-sm font-medium ${discrepancy === 0 ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}`}>
              {discrepancy === 0
                ? "✓ Count matches register"
                : `Discrepancy: ${discrepancy > 0 ? "+" : ""}${discrepancy} (${discrepancy > 0 ? "surplus" : "shortage"})`}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Notes / reason *</label>
            <textarea
              required
              value={dailyCount.notes}
              onChange={(e) => setDailyCount({ ...dailyCount, notes: e.target.value })}
              placeholder="Reason for discrepancy, or 'Count matches register'"
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowDailyCount(false)}>Cancel</Button>
            <Button type="submit">Record Count</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Add Narcotics Entry">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Drug *</label>
              <select
                required
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="">Select drug…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Operation *</label>
              <select
                required
                value={form.operationType}
                onChange={(e) => setForm({ ...form, operationType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="RECEIVED">Received</option>
                <option value="DISPENSED">Dispensed</option>
                <option value="DESTROYED">Destroyed</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity *</label>
              <Input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Batch Number</label>
              <Input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Patient Name</label>
              <Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prescription Ref</label>
              <Input value={form.prescriptionRef} onChange={(e) => setForm({ ...form, prescriptionRef: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier Ref</label>
              <Input value={form.supplierRef} onChange={(e) => setForm({ ...form, supplierRef: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Save Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
