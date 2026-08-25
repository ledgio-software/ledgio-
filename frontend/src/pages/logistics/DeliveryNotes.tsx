import { useState, useCallback, useEffect } from "react";
import { Plus, RefreshCw, Truck, Package, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

// ---------- shared types ----------
interface NoteLine { id: string; description: string; quantity: number }
interface Customer { id: string; name: string }
interface Vendor { id: string; name: string }

interface DeliveryNote {
  id: string; dnNumber: string; status: string;
  dispatchDate?: string; notes?: string; invoiceId?: string; salesOrderId?: string;
  customer: Customer; lines: NoteLine[];
  createdAt: string;
}

interface GRN {
  id: string; grnNumber: string; status: string;
  receiptDate?: string; notes?: string; purchaseOrderId?: string; vendorBillId?: string;
  vendor: Vendor; lines: NoteLine[];
  createdAt: string;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "success" | "outline" | "danger" | "warning"> = {
  DRAFT: "secondary",
  DISPATCHED: "success",
  RECEIVED: "success",
};

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// ---------- Delivery Notes tab ----------
function DeliveryNotesTab() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [formCustomerId, setFormCustomerId] = useState("");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formDispatchDate, setFormDispatchDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLines, setFormLines] = useState([{ description: "", quantity: 1 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get("/delivery-notes?pageSize=100");
      setNotes(res.data.notes || []);
    } catch (e: any) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = async () => {
    try {
      const res = await api.get("/customers?pageSize=500");
      setCustomers(res.data.customers || res.data || []);
    } catch { /* ignore */ }
    setFormCustomerId(""); setFormInvoiceId(""); setFormDispatchDate("");
    setFormNotes(""); setFormLines([{ description: "", quantity: 1 }]);
    setFormError(null); setShowForm(true);
  };

  const updateLine = (i: number, field: string, value: string | number) =>
    setFormLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) { setFormError("Select a customer."); return; }
    if (formLines.some((l) => !l.description || l.quantity <= 0)) {
      setFormError("All lines need a description and positive quantity."); return;
    }
    setFormLoading(true); setFormError(null);
    try {
      await api.post("/delivery-notes", {
        customerId: formCustomerId,
        invoiceId: formInvoiceId || undefined,
        dispatchDate: formDispatchDate || undefined,
        notes: formNotes || undefined,
        lines: formLines.map((l) => ({ description: l.description, quantity: Number(l.quantity) })),
      });
      setShowForm(false); load();
    } catch (e: any) { setFormError(e.response?.data?.error || e.message); }
    finally { setFormLoading(false); }
  };

  const dispatch = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/delivery-notes/${id}/dispatch`, {}); load(); }
    catch (e: any) { alert(e.response?.data?.error || e.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Dispatch documents sent to customers.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openForm}>
            <Plus className="h-4 w-4 mr-1" /> New Delivery Note
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Delivery Note</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer *</label>
                  <select className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} required>
                    <option value="">Select customer…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice ID (optional)</label>
                  <input className="w-full border rounded px-3 py-2 text-sm bg-background"
                    placeholder="INV uuid…" value={formInvoiceId} onChange={(e) => setFormInvoiceId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dispatch Date</label>
                  <input type="date" className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formDispatchDate} onChange={(e) => setFormDispatchDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm bg-background" rows={2}
                  value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Items</span>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setFormLines((p) => [...p, { description: "", quantity: 1 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {formLines.map((l, i) => (
                  <div key={i} className="grid grid-cols-10 gap-2 mb-2 items-center">
                    <input className="col-span-7 border rounded px-2 py-1 text-sm bg-background"
                      placeholder="Description" value={l.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)} required />
                    <input type="number" className="col-span-2 border rounded px-2 py-1 text-sm bg-background"
                      placeholder="Qty" min={0.0001} step="any" value={l.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} />
                    <Button type="button" variant="ghost" size="sm" className="col-span-1 text-destructive"
                      onClick={() => setFormLines((p) => p.filter((_, idx) => idx !== i))}
                      disabled={formLines.length === 1}>×</Button>
                  </div>
                ))}
              </div>
              {formError && <p className="text-destructive text-sm">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading}>{formLoading ? "Saving…" : "Create"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DN #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Dispatch Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No delivery notes found.
                  </TableCell>
                </TableRow>
              )}
              {notes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono font-medium">{n.dnNumber}</TableCell>
                  <TableCell>{n.customer.name}</TableCell>
                  <TableCell>{fmt(n.dispatchDate)}</TableCell>
                  <TableCell>{n.lines.length} item{n.lines.length !== 1 ? "s" : ""}</TableCell>
                  <TableCell><Badge variant={STATUS_BADGE[n.status]}>{n.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {n.status === "DRAFT" && (
                      <Button size="sm" variant="outline"
                        onClick={() => dispatch(n.id)} disabled={actionLoading === n.id}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Dispatch
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- GRN tab ----------
function GoodsReceiptNotesTab() {
  const [notes, setNotes] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [formVendorId, setFormVendorId] = useState("");
  const [formPOId, setFormPOId] = useState("");
  const [formReceiptDate, setFormReceiptDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLines, setFormLines] = useState([{ description: "", quantity: 1 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get("/goods-receipt-notes?pageSize=100");
      setNotes(res.data.notes || []);
    } catch (e: any) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = async () => {
    try {
      const res = await api.get("/vendors?pageSize=500");
      setVendors(res.data.vendors || res.data || []);
    } catch { /* ignore */ }
    setFormVendorId(""); setFormPOId(""); setFormReceiptDate("");
    setFormNotes(""); setFormLines([{ description: "", quantity: 1 }]);
    setFormError(null); setShowForm(true);
  };

  const updateLine = (i: number, field: string, value: string | number) =>
    setFormLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVendorId) { setFormError("Select a vendor."); return; }
    if (formLines.some((l) => !l.description || l.quantity <= 0)) {
      setFormError("All lines need a description and positive quantity."); return;
    }
    setFormLoading(true); setFormError(null);
    try {
      await api.post("/goods-receipt-notes", {
        vendorId: formVendorId,
        purchaseOrderId: formPOId || undefined,
        receiptDate: formReceiptDate || undefined,
        notes: formNotes || undefined,
        lines: formLines.map((l) => ({ description: l.description, quantity: Number(l.quantity) })),
      });
      setShowForm(false); load();
    } catch (e: any) { setFormError(e.response?.data?.error || e.message); }
    finally { setFormLoading(false); }
  };

  const receive = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/goods-receipt-notes/${id}/receive`, {}); load(); }
    catch (e: any) { alert(e.response?.data?.error || e.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Receipt documents for goods received from suppliers.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openForm}>
            <Plus className="h-4 w-4 mr-1" /> New GRN
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Goods Receipt Note</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor *</label>
                  <select className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formVendorId} onChange={(e) => setFormVendorId(e.target.value)} required>
                    <option value="">Select vendor…</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Order ID (optional)</label>
                  <input className="w-full border rounded px-3 py-2 text-sm bg-background"
                    placeholder="PO uuid…" value={formPOId} onChange={(e) => setFormPOId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Receipt Date</label>
                  <input type="date" className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formReceiptDate} onChange={(e) => setFormReceiptDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm bg-background" rows={2}
                  value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Items Received</span>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setFormLines((p) => [...p, { description: "", quantity: 1 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {formLines.map((l, i) => (
                  <div key={i} className="grid grid-cols-10 gap-2 mb-2 items-center">
                    <input className="col-span-7 border rounded px-2 py-1 text-sm bg-background"
                      placeholder="Description" value={l.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)} required />
                    <input type="number" className="col-span-2 border rounded px-2 py-1 text-sm bg-background"
                      placeholder="Qty" min={0.0001} step="any" value={l.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} />
                    <Button type="button" variant="ghost" size="sm" className="col-span-1 text-destructive"
                      onClick={() => setFormLines((p) => p.filter((_, idx) => idx !== i))}
                      disabled={formLines.length === 1}>×</Button>
                  </div>
                ))}
              </div>
              {formError && <p className="text-destructive text-sm">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading}>{formLoading ? "Saving…" : "Create GRN"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Receipt Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No goods receipt notes found.
                  </TableCell>
                </TableRow>
              )}
              {notes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono font-medium">{n.grnNumber}</TableCell>
                  <TableCell>{n.vendor.name}</TableCell>
                  <TableCell>{fmt(n.receiptDate)}</TableCell>
                  <TableCell>{n.lines.length} item{n.lines.length !== 1 ? "s" : ""}</TableCell>
                  <TableCell><Badge variant={STATUS_BADGE[n.status]}>{n.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {n.status === "DRAFT" && (
                      <Button size="sm" variant="outline"
                        onClick={() => receive(n.id)} disabled={actionLoading === n.id}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Mark Received
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Combined page ----------
export function DeliveryNotes() {
  const [tab, setTab] = useState<"dn" | "grn">("dn");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery Notes &amp; GRNs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Dispatch documents for customer deliveries and goods receipt notes for supplier deliveries.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button variant={tab === "dn" ? "primary" : "ghost"} size="sm" onClick={() => setTab("dn")}>
          <Truck className="h-4 w-4 mr-1" /> Delivery Notes
        </Button>
        <Button variant={tab === "grn" ? "primary" : "ghost"} size="sm" onClick={() => setTab("grn")}>
          <Package className="h-4 w-4 mr-1" /> Goods Receipt Notes
        </Button>
      </div>

      {tab === "dn" ? <DeliveryNotesTab /> : <GoodsReceiptNotesTab />}
    </div>
  );
}
