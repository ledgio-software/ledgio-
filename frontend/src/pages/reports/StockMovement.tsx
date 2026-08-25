import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { exportToCsv } from "../../lib/exportCsv";

interface MovementRow {
  date: string;
  type: string;
  reference: string;
  qtyChange: number;
  runningBalance: number;
  warehouseId: string;
  warehouseName: string;
  notes: string | null;
}

interface ItemInfo {
  id: string;
  name?: string;
  sku?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const TYPE_COLORS: Record<string, string> = {
  "POS Sale": "destructive",
  "Invoice": "destructive",
  "Purchase Receipt": "default",
  "Adjustment": "secondary",
  "Transfer In": "default",
  "Transfer Out": "destructive",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function StockMovement() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    item: ItemInfo;
    openingBalance: number;
    closingBalance: number;
    movements: MovementRow[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/inventory/items"),
      api.get("/inventory/warehouses"),
    ]).then(([itemsRes, whRes]) => {
      setItems(itemsRes.data.items || itemsRes.data.data || []);
      setWarehouses(whRes.data.warehouses || whRes.data.data || []);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ itemId, startDate, endDate });
      if (warehouseId) params.set("warehouseId", warehouseId);
      const res = await api.get(`/reports/stock-movement?${params}`);
      setResult(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load stock movement report.");
    } finally {
      setLoading(false);
    }
  }, [itemId, warehouseId, startDate, endDate]);

  function handleExportCsv() {
    if (!result) return;
    const rows = result.movements.map((m) => ({
      Date: new Date(m.date).toLocaleDateString("en-GH"),
      Type: m.type,
      Reference: m.reference,
      Warehouse: m.warehouseName,
      "Qty Change": m.qtyChange > 0 ? `+${m.qtyChange}` : String(m.qtyChange),
      Balance: String(m.runningBalance),
      Notes: m.notes || "",
    }));
    exportToCsv(rows, `stock-movement-${result.item.name || itemId}.csv`);
  }

  const netChange = result ? result.closingBalance - result.openingBalance : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Stock Movement Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Every stock-in and stock-out event for an item over a period
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!result || result.movements.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Item</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
              >
                <option value="">— Select item —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Warehouse (optional)</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button onClick={load} disabled={loading || !itemId} size="sm">
              {loading ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {loading ? "Loading…" : "Run"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Opening Balance</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{result.openingBalance}</p>
                <p className="text-xs text-muted-foreground">units</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock In</p>
                <p className="mt-1 text-2xl font-bold text-green-600 tabular-nums">
                  +{result.movements.filter(m => m.qtyChange > 0).reduce((s, m) => s + m.qtyChange, 0)}
                </p>
                <p className="text-xs text-muted-foreground">units received</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock Out</p>
                <p className="mt-1 text-2xl font-bold text-red-600 tabular-nums">
                  {result.movements.filter(m => m.qtyChange < 0).reduce((s, m) => s + m.qtyChange, 0)}
                </p>
                <p className="text-xs text-muted-foreground">units issued</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closing Balance</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{result.closingBalance}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {netChange >= 0
                    ? <ArrowUpRight className="h-3 w-3 text-green-600" />
                    : <ArrowDownRight className="h-3 w-3 text-red-600" />}
                  {netChange >= 0 ? `+${netChange}` : netChange} net
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Movements table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {result.item.name || "Item"} — Movements
              </CardTitle>
              <CardDescription>
                {result.movements.length} event{result.movements.length !== 1 ? "s" : ""} in selected period
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {result.movements.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No stock movements found for the selected period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Qty Change</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.movements.map((m, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(m.date).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={(TYPE_COLORS[m.type] as any) || "secondary"}>
                            {m.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.reference}</TableCell>
                        <TableCell className="text-sm">{m.warehouseName}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold tabular-nums ${m.qtyChange > 0 ? "text-green-600" : "text-red-600"}`}>
                          {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {m.runningBalance}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.notes || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!result && !loading && (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Select an item and click Run to view stock movements.</p>
        </div>
      )}
    </div>
  );
}
