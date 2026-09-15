import { useState, useCallback, useEffect, useMemo } from "react";
import { Plus, RefreshCw, FileText, CheckCircle, XCircle, ArrowRight, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { confirm as alertConfirm } from "../../components/ui/AlertDialog";

interface SalesOrderLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  orderDate: string;
  expectedDate?: string;
  currency: string;
  status: string;
  notes?: string;
  invoiceId?: string;
  customer: { id: string; name: string };
  lines: SalesOrderLine[];
}

interface Customer {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "danger" | "success" | "warning"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  INVOICED: "outline",
  CANCELLED: "danger",
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalesOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [soSearch, setSoSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCurrency, setFormCurrency] = useState("GHS");
  const [formExpectedDate, setFormExpectedDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLines, setFormLines] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/sales-orders?${params}`);
      setOrders(res.data.orders || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.get("/invoices/customers");
      setCustomers(res.data.data?.customers || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    loadCustomers();
    setFormCustomerId("");
    setFormCurrency("GHS");
    setFormExpectedDate("");
    setFormNotes("");
    setFormLines([{ description: "", quantity: 1, unitPrice: 0 }]);
    setFormError(null);
    setShowForm(true);
  };

  const addLine = () => setFormLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setFormLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: string | number) =>
    setFormLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) { setFormError("Please select a customer."); return; }
    if (formLines.some((l) => !l.description || l.quantity <= 0)) {
      setFormError("All lines need a description and positive quantity.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await api.post("/sales-orders", {
        customerId: formCustomerId,
        currency: formCurrency,
        expectedDate: formExpectedDate || undefined,
        notes: formNotes || undefined,
        lines: formLines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      });
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.response?.data?.error || e.message);
    } finally {
      setFormLoading(false);
    }
  };

  const confirm = async (id: string) => {
    setActionLoading(id + "-confirm");
    try {
      await api.put(`/sales-orders/${id}/confirm`, {});
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const cancel = async (id: string) => {
    if (!await alertConfirm({ title: "Cancel this sales order?", confirmLabel: "Cancel Order" })) return;
    setActionLoading(id + "-cancel");
    try {
      await api.put(`/sales-orders/${id}/cancel`, {});
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const convertToInvoice = async (id: string) => {
    if (!await alertConfirm({ title: "Convert to invoice?", description: "This sales order will be converted to a customer invoice.", confirmLabel: "Convert", variant: "warning" })) return;
    setActionLoading(id + "-convert");
    try {
      await api.post(`/sales-orders/${id}/convert-to-invoice`, {});
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalByOrder = (o: SalesOrder) =>
    o.lines.reduce((s, l) => s + Number(l.amount), 0);

  const displayedOrders = useMemo(() => {
    const q = soSearch.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter((o) => o.soNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
  }, [orders, soSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage customer orders before converting them to invoices.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Sales Order
          </Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-secondary-400" />
          <Input
            placeholder="Search SO # or customer…"
            className="pl-8"
            value={soSearch}
            onChange={(e) => setSoSearch(e.target.value)}
          />
        </div>
        {(["", "DRAFT", "CONFIRMED", "INVOICED", "CANCELLED"] as const).map((s) => (
          <Button
            key={s || "ALL"}
            variant={statusFilter === s ? "primary" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
        {soSearch && <span className="text-xs text-secondary-500">{displayedOrders.length} of {orders.length}</span>}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Sales Order</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer *</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    value={formExpectedDate}
                    onChange={(e) => setFormExpectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Line Items</span>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-3 w-3 mr-1" /> Add Line
                  </Button>
                </div>
                <div className="space-y-2">
                  {formLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        className="col-span-5 border rounded px-2 py-1 text-sm bg-background"
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(i, "description", e.target.value)}
                        required
                      />
                      <input
                        type="number"
                        className="col-span-2 border rounded px-2 py-1 text-sm bg-background"
                        placeholder="Qty"
                        min={0.0001}
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        className="col-span-3 border rounded px-2 py-1 text-sm bg-background"
                        placeholder="Unit Price"
                        min={0}
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                      <div className="col-span-1 text-sm text-right font-mono">
                        {fmt(line.quantity * line.unitPrice)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="col-span-1 text-destructive"
                        onClick={() => removeLine(i)}
                        disabled={formLines.length === 1}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-semibold mt-2">
                  Total: {formCurrency} {fmt(formLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))}
                </div>
              </div>

              {formError && <p className="text-destructive text-sm">{formError}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Saving…" : "Create Sales Order"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedOrders.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {orders.length === 0 ? "No sales orders found." : "No orders match the search."}
                  </TableCell>
                </TableRow>
              )}
              {displayedOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.soNumber}</TableCell>
                  <TableCell>{o.customer.name}</TableCell>
                  <TableCell>{new Date(o.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{o.expectedDate ? new Date(o.expectedDate).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{o.currency}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalByOrder(o))}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[o.status]}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {o.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirm(o.id)}
                          disabled={actionLoading === o.id + "-confirm"}
                          title="Confirm"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status === "CONFIRMED" && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => convertToInvoice(o.id)}
                          disabled={actionLoading === o.id + "-convert"}
                          title="Convert to Invoice"
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                      {(o.status === "DRAFT" || o.status === "CONFIRMED") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => cancel(o.id)}
                          disabled={actionLoading === o.id + "-cancel"}
                          title="Cancel"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status === "INVOICED" && o.invoiceId && (
                        <a href="/invoices" className="text-xs text-primary underline">
                          View Invoices
                        </a>
                      )}
                    </div>
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
