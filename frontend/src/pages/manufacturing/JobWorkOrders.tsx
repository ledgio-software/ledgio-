import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { confirm } from "../../components/ui/AlertDialog";

interface WorkOrder {
  id: string;
  jobId: string | null;
  type: "IN" | "OUT";
  vendorId: string | null;
  itemId: string | null;
  quantity: number;
  dueDate: string | null;
  status: "PENDING" | "SENT" | "RECEIVED" | "CANCELLED";
  billId: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function JobWorkOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ jobId: "", type: "OUT", vendorId: "", itemId: "", quantity: "1", dueDate: "" });
  const [submitting, setSubmitting] = useState(false);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [receiveBillId, setReceiveBillId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/job-work-orders");
      setOrders(res.data.data ?? []);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/job-work-orders", {
        jobId: form.jobId || null,
        type: form.type,
        vendorId: form.vendorId || null,
        itemId: form.itemId || null,
        quantity: parseFloat(form.quantity),
        dueDate: form.dueDate || null,
      });
      setShowForm(false);
      setForm({ jobId: "", type: "OUT", vendorId: "", itemId: "", quantity: "1", dueDate: "" });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend(id: string) {
    try {
      await api.patch(`/job-work-orders/${id}/send`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    }
  }

  async function handleReceive(id: string) {
    try {
      await api.patch(`/job-work-orders/${id}/receive`, { billId: receiveBillId || null });
      setReceiving(null);
      setReceiveBillId("");
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    }
  }

  async function handleCancel(id: string) {
    if (!await confirm({ title: "Cancel this work order?", confirmLabel: "Cancel Order" })) return;
    try {
      await api.patch(`/job-work-orders/${id}/cancel`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50">Job Work Orders</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">Track sub-contracting orders sent to and received from vendors</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + New Work Order
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-secondary-900 dark:text-secondary-50 mb-4">New Work Order</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              >
                <option value="OUT">OUT — Send goods to vendor</option>
                <option value="IN">IN — Receive goods from vendor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Quantity</label>
              <input
                type="number"
                min="0.0001"
                step="any"
                required
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Job ID (optional)</label>
              <input
                type="text"
                value={form.jobId}
                onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}
                placeholder="UUID of linked job"
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Vendor ID (optional)</label>
              <input
                type="text"
                value={form.vendorId}
                onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                placeholder="UUID of vendor"
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Item ID (optional)</label>
              <input
                type="text"
                value={form.itemId}
                onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
                placeholder="UUID of inventory item"
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">Due Date (optional)</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-secondary-300 dark:border-secondary-600 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-secondary-500">Loading…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-secondary-400 dark:text-secondary-500">
          <p className="text-lg font-medium">No work orders yet</p>
          <p className="text-sm mt-1">Create a work order to track goods sent to or received from sub-contractors.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/50">
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary-600 dark:text-secondary-400">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${order.type === "OUT" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"}`}>
                        {order.type === "OUT" ? "↑ OUT" : "↓ IN"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-secondary-900 dark:text-secondary-100">
                      {Number(order.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">
                      {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {order.status === "PENDING" && (
                          <button onClick={() => handleSend(order.id)} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Send</button>
                        )}
                        {(order.status === "PENDING" || order.status === "SENT") && (
                          <>
                            {receiving === order.id ? (
                              <div className="flex gap-1 items-center">
                                <input
                                  type="text"
                                  placeholder="Bill ID (optional)"
                                  value={receiveBillId}
                                  onChange={e => setReceiveBillId(e.target.value)}
                                  className="border border-secondary-300 dark:border-secondary-600 rounded px-2 py-0.5 text-xs w-32 bg-white dark:bg-secondary-700"
                                />
                                <button onClick={() => handleReceive(order.id)} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Confirm</button>
                                <button onClick={() => { setReceiving(null); setReceiveBillId(""); }} className="text-xs px-2 py-1 rounded border border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-700">×</button>
                              </div>
                            ) : (
                              <button onClick={() => setReceiving(order.id)} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Receive</button>
                            )}
                            <button onClick={() => handleCancel(order.id)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Cancel</button>
                          </>
                        )}
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
