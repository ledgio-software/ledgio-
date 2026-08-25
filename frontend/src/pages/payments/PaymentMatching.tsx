import { useState, useCallback, useEffect } from "react";
import { CreditCard, RefreshCw, Search, CheckSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  dueDate: string;
  status: string;
}

interface OutstandingBill {
  id: string;
  billNumber: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  balance: number;
  currency: string;
  dueDate: string;
  status: string;
}

interface Customer { id: string; name: string }
interface Vendor { id: string; name: string }

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString();
}

const STATUS_BADGE: Record<string, "secondary" | "warning" | "danger"> = {
  SENT: "secondary",
  PARTIALLY_PAID: "warning",
  UNPAID: "danger",
};

// ---------- Customer payment tab ----------
function CustomerPaymentTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get("/customers?pageSize=500")
      .then((r) => setCustomers(r.data.customers || r.data || []))
      .catch(() => {});
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoadingInvoices(true);
    setInvoices([]);
    setAllocations({});
    try {
      const res = await api.get(`/payment-batches/outstanding-invoices?customerId=${selectedCustomerId}`);
      setInvoices(res.data || []);
    } catch (e: any) {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const totalAllocated = invoices.reduce((s, inv) => {
    const v = parseFloat(allocations[inv.id] || "0") || 0;
    return s + v;
  }, 0);

  const setAllToBalance = () => {
    const next: Record<string, string> = {};
    invoices.forEach((inv) => { next[inv.id] = String(inv.balance); });
    setAllocations(next);
  };

  const submit = async () => {
    const allocs = invoices
      .map((inv) => ({ invoiceId: inv.id, amount: parseFloat(allocations[inv.id] || "0") || 0 }))
      .filter((a) => a.amount > 0);

    if (allocs.length === 0) { setResult({ success: false, message: "Enter at least one payment amount." }); return; }

    setSubmitting(true); setResult(null);
    try {
      const res = await api.post("/payment-batches", {
        batchType: "CUSTOMER",
        entityId: selectedCustomerId,
        notes: notes || undefined,
        allocations: allocs,
      });
      const { errors } = res.data;
      if (errors?.length > 0) {
        setResult({ success: false, message: `Partial success. Errors: ${errors.join("; ")}` });
      } else {
        setResult({ success: true, message: `Payment batch ${res.data.batch.batchNumber} created.` });
      }
      loadInvoices();
    } catch (e: any) {
      setResult({ success: false, message: e.response?.data?.error || e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Customer</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm bg-background"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Button variant="outline" onClick={loadInvoices} disabled={!selectedCustomerId || loadingInvoices}>
          <Search className="h-4 w-4 mr-1" />
          {loadingInvoices ? "Loading…" : "Load Outstanding"}
        </Button>
      </div>

      {invoices.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {invoices.length} outstanding invoice{invoices.length !== 1 ? "s" : ""}
            </span>
            <Button variant="outline" size="sm" onClick={setAllToBalance}>
              <CheckSquare className="h-4 w-4 mr-1" /> Pay All Balances
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Pay Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                      <TableCell>{fmtDate(inv.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[inv.status] || "secondary"}>{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {inv.currency} {fmt(inv.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <input
                          type="number"
                          className="w-28 border rounded px-2 py-1 text-sm text-right bg-background font-mono"
                          min={0}
                          max={inv.balance}
                          step="0.01"
                          value={allocations[inv.id] || ""}
                          placeholder="0.00"
                          onChange={(e) =>
                            setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Cheque #1234"
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm">
                Total allocated: <span className="font-semibold font-mono">{fmt(totalAllocated)}</span>
              </div>
              <Button onClick={submit} disabled={submitting || totalAllocated === 0}>
                {submitting ? "Processing…" : "Record Payments"}
              </Button>
            </div>
            {result && (
              <p className={`text-sm ${result.success ? "text-green-600" : "text-destructive"}`}>
                {result.message}
              </p>
            )}
          </div>
        </>
      )}

      {invoices.length === 0 && selectedCustomerId && !loadingInvoices && (
        <p className="text-muted-foreground text-sm text-center py-6">No outstanding invoices for this customer.</p>
      )}
    </div>
  );
}

// ---------- Vendor payment tab ----------
function VendorPaymentTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [bills, setBills] = useState<OutstandingBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get("/vendors?pageSize=500")
      .then((r) => setVendors(r.data.vendors || r.data || []))
      .catch(() => {});
  }, []);

  const loadBills = useCallback(async () => {
    if (!selectedVendorId) return;
    setLoadingBills(true); setBills([]); setSelectedBillIds(new Set());
    try {
      const res = await api.get(`/payment-batches/outstanding-bills?vendorId=${selectedVendorId}`);
      setBills(res.data || []);
    } catch { setBills([]); }
    finally { setLoadingBills(false); }
  }, [selectedVendorId]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const toggleBill = (id: string) =>
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const totalSelected = bills
    .filter((b) => selectedBillIds.has(b.id))
    .reduce((s, b) => s + b.balance, 0);

  const submit = async () => {
    if (selectedBillIds.size === 0) { setResult({ success: false, message: "Select at least one bill." }); return; }
    const allocs = bills
      .filter((b) => selectedBillIds.has(b.id))
      .map((b) => ({ vendorBillId: b.id, amount: b.balance }));

    setSubmitting(true); setResult(null);
    try {
      const res = await api.post("/payment-batches", {
        batchType: "VENDOR",
        entityId: selectedVendorId,
        notes: notes || undefined,
        allocations: allocs,
      });
      const { errors } = res.data;
      if (errors?.length > 0) {
        setResult({ success: false, message: `Partial success. Errors: ${errors.join("; ")}` });
      } else {
        setResult({ success: true, message: `Payment batch ${res.data.batch.batchNumber} created.` });
      }
      loadBills();
    } catch (e: any) {
      setResult({ success: false, message: e.response?.data?.error || e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Vendor</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm bg-background"
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <Button variant="outline" onClick={loadBills} disabled={!selectedVendorId || loadingBills}>
          <Search className="h-4 w-4 mr-1" />
          {loadingBills ? "Loading…" : "Load Outstanding"}
        </Button>
      </div>

      {bills.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            Select bills to pay in this batch. Each bill is paid in full.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => toggleBill(b.id)}>
                      <TableCell>
                        <input type="checkbox" readOnly checked={selectedBillIds.has(b.id)} />
                      </TableCell>
                      <TableCell className="font-mono">{b.billNumber}</TableCell>
                      <TableCell>{fmtDate(b.dueDate)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {b.currency} {fmt(b.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bank transfer ref #456"
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm">
                {selectedBillIds.size} bill{selectedBillIds.size !== 1 ? "s" : ""} selected —{" "}
                Total: <span className="font-semibold font-mono">{fmt(totalSelected)}</span>
              </div>
              <Button onClick={submit} disabled={submitting || selectedBillIds.size === 0}>
                {submitting ? "Processing…" : "Pay Selected Bills"}
              </Button>
            </div>
            {result && (
              <p className={`text-sm ${result.success ? "text-green-600" : "text-destructive"}`}>
                {result.message}
              </p>
            )}
          </div>
        </>
      )}

      {bills.length === 0 && selectedVendorId && !loadingBills && (
        <p className="text-muted-foreground text-sm text-center py-6">No outstanding bills for this vendor.</p>
      )}
    </div>
  );
}

// ---------- Main page ----------
export function PaymentMatching() {
  const [tab, setTab] = useState<"customer" | "vendor">("customer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Matching</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Allocate a single payment receipt or disbursement across multiple outstanding invoices or bills.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button variant={tab === "customer" ? "primary" : "ghost"} size="sm" onClick={() => setTab("customer")}>
          <CreditCard className="h-4 w-4 mr-1" /> Customer Receipts
        </Button>
        <Button variant={tab === "vendor" ? "primary" : "ghost"} size="sm" onClick={() => setTab("vendor")}>
          <RefreshCw className="h-4 w-4 mr-1" /> Vendor Payments
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tab === "customer" ? "Receive Customer Payment" : "Pay Vendor Bills"}</CardTitle>
        </CardHeader>
        <CardContent>
          {tab === "customer" ? <CustomerPaymentTab /> : <VendorPaymentTab />}
        </CardContent>
      </Card>
    </div>
  );
}
