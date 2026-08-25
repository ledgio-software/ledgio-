import { useState, useEffect, useCallback } from "react";
import { Factory, Plus, Play, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit?: string;
}

interface BomLine {
  id: string;
  componentItemId: string;
  componentItem: InventoryItem;
  quantity: number;
}

interface BomTemplate {
  id: string;
  name: string;
  description?: string;
  finishedItemId: string;
  finishedItem: InventoryItem;
  outputQty: number;
  isActive: boolean;
  lines: BomLine[];
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  bomTemplateId: string;
  bomTemplate: { id: string; name: string };
  warehouseId: string;
  warehouse: { id: string; name: string };
  plannedQty: number;
  completedQty?: number;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, "default" | "warning" | "success" | "danger" | "secondary"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

function BomCard({ tpl, onToggle }: { tpl: BomTemplate; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{tpl.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Produces: <span className="font-medium">{tpl.finishedItem?.name}</span> × {tpl.outputQty}
            </p>
            {tpl.description && <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={tpl.isActive ? "success" : "secondary"}>{tpl.isActive ? "Active" : "Inactive"}</Badge>
            <Button size="sm" variant="ghost" onClick={onToggle}>
              {tpl.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Components</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty per run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tpl.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.componentItem?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.componentItem?.sku}</TableCell>
                  <TableCell className="text-right">{l.quantity} {l.componentItem?.unit || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

function CreateBomModal({
  items,
  onClose,
  onCreated,
}: {
  items: InventoryItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [finishedItemId, setFinishedItemId] = useState("");
  const [outputQty, setOutputQty] = useState("1");
  const [lines, setLines] = useState<{ componentItemId: string; quantity: string }[]>([
    { componentItemId: "", quantity: "1" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = () => setLines((p) => [...p, { componentItemId: "", quantity: "1" }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: "componentItemId" | "quantity", val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!finishedItemId) { setError("Finished item is required."); return; }
    if (lines.some((l) => !l.componentItemId || !l.quantity)) {
      setError("All component lines must have an item and quantity."); return;
    }
    setSaving(true);
    try {
      await api.post("/manufacturing/bom-templates", {
        name: name.trim(),
        description: description.trim() || undefined,
        finishedItemId,
        outputQty: Number(outputQty),
        lines: lines.map((l) => ({ componentItemId: l.componentItemId, quantity: Number(l.quantity) })),
      });
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create BOM template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">New BOM Template</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <input className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic Assembly v1" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Finished Item *</label>
              <select className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={finishedItemId} onChange={(e) => setFinishedItemId(e.target.value)}>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Output Qty *</label>
              <input type="number" min="0.0001" step="any" className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Components *</label>
              <Button size="sm" variant="ghost" onClick={addLine}><Plus size={13} className="mr-1" /> Add</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="flex-1 border rounded px-2 py-1.5 text-sm bg-background" value={l.componentItemId} onChange={(e) => updateLine(i, "componentItemId", e.target.value)}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
                <input type="number" min="0.0001" step="any" className="w-24 border rounded px-2 py-1.5 text-sm bg-background" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                {lines.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeLine(i)}><XCircle size={14} /></Button>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create BOM"}</Button>
        </div>
      </div>
    </div>
  );
}

function CreateOrderModal({
  templates,
  warehouses,
  onClose,
  onCreated,
}: {
  templates: BomTemplate[];
  warehouses: Warehouse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bomTemplateId, setBomTemplateId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [plannedQty, setPlannedQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!bomTemplateId) { setError("BOM template is required."); return; }
    if (!warehouseId) { setError("Warehouse is required."); return; }
    setSaving(true);
    try {
      await api.post("/manufacturing/production-orders", {
        bomTemplateId,
        warehouseId,
        plannedQty: Number(plannedQty),
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create production order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">New Production Order</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">BOM Template *</label>
            <select className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={bomTemplateId} onChange={(e) => setBomTemplateId(e.target.value)}>
              <option value="">Select template…</option>
              {templates.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Warehouse *</label>
            <select className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Planned Qty *</label>
            <input type="number" min="0.0001" step="any" className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create Order"}</Button>
        </div>
      </div>
    </div>
  );
}

function CompleteOrderModal({
  order,
  onClose,
  onCompleted,
}: {
  order: ProductionOrder;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [completedQty, setCompletedQty] = useState(String(order.plannedQty));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.put(`/manufacturing/production-orders/${order.id}/complete`, { completedQty: Number(completedQty) });
      onCompleted();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to complete production order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-1">Complete {order.orderNumber}</h2>
        <p className="text-sm text-muted-foreground mb-4">Planned: {order.plannedQty} units. Enter actual output.</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div>
          <label className="text-sm font-medium">Completed Qty *</label>
          <input type="number" min="0.0001" step="any" className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background" value={completedQty} onChange={(e) => setCompletedQty(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? "Processing…" : "Complete & Post Stock"}</Button>
        </div>
      </div>
    </div>
  );
}

export function Manufacturing() {
  const [tab, setTab] = useState<"bom" | "orders">("bom");
  const [templates, setTemplates] = useState<BomTemplate[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBomModal, setShowBomModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ProductionOrder | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tplRes, ordRes, whRes, itemRes] = await Promise.all([
        api.get("/manufacturing/bom-templates"),
        api.get("/manufacturing/production-orders"),
        api.get("/inventory/warehouses"),
        api.get("/inventory/items"),
      ]);
      setTemplates(tplRes.data.templates || []);
      setOrders(ordRes.data.orders || []);
      setWarehouses(whRes.data.data?.warehouses || []);
      setAllItems(itemRes.data.data?.items || []);
    } catch {
      setError("Failed to load manufacturing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBomActive = async (tpl: BomTemplate) => {
    setActionError(null);
    try {
      await api.put(`/manufacturing/bom-templates/${tpl.id}`, { isActive: !tpl.isActive });
      await load();
    } catch (e: any) {
      setActionError(e.response?.data?.error || "Failed to update BOM template.");
    }
  };

  const startOrder = async (order: ProductionOrder) => {
    setActionError(null);
    try {
      await api.put(`/manufacturing/production-orders/${order.id}/start`);
      await load();
    } catch (e: any) {
      setActionError(e.response?.data?.error || "Failed to start order.");
    }
  };

  const cancelOrder = async (order: ProductionOrder) => {
    if (!confirm(`Cancel ${order.orderNumber}?`)) return;
    setActionError(null);
    try {
      await api.put(`/manufacturing/production-orders/${order.id}/cancel`);
      await load();
    } catch (e: any) {
      setActionError(e.response?.data?.error || "Failed to cancel order.");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Factory size={24} className="text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Manufacturing</h1>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "bom" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("bom")}
        >
          Bill of Materials
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("orders")}
        >
          Production Orders
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {tab === "bom" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowBomModal(true)}>
              <Plus size={14} className="mr-1.5" /> New BOM Template
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No BOM templates yet. Create one to get started.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <BomCard key={tpl.id} tpl={tpl} onToggle={() => toggleBomActive(tpl)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowOrderModal(true)}>
              <Plus size={14} className="mr-1.5" /> New Production Order
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No production orders yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>BOM Template</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                        <TableCell>{o.bomTemplate?.name}</TableCell>
                        <TableCell>{o.warehouse?.name}</TableCell>
                        <TableCell className="text-right">{o.plannedQty}</TableCell>
                        <TableCell className="text-right">{o.completedQty ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[o.status] || "default"}>{o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {o.status === "DRAFT" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => startOrder(o)}>
                                  <Play size={12} className="mr-1" /> Start
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => cancelOrder(o)}>
                                  <XCircle size={12} />
                                </Button>
                              </>
                            )}
                            {o.status === "IN_PROGRESS" && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => setCompleteTarget(o)}>
                                  <CheckCircle size={12} className="mr-1" /> Complete
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => cancelOrder(o)}>
                                  <XCircle size={12} />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showBomModal && (
        <CreateBomModal
          items={allItems}
          onClose={() => setShowBomModal(false)}
          onCreated={() => { setShowBomModal(false); load(); }}
        />
      )}
      {showOrderModal && (
        <CreateOrderModal
          templates={templates}
          warehouses={warehouses}
          onClose={() => setShowOrderModal(false)}
          onCreated={() => { setShowOrderModal(false); load(); }}
        />
      )}
      {completeTarget && (
        <CompleteOrderModal
          order={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onCompleted={() => { setCompleteTarget(null); load(); }}
        />
      )}
    </div>
  );
}
