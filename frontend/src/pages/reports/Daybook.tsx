import { useState, useEffect, useCallback } from "react";
import { BookMarked, RefreshCw, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { useTenantSettings } from "../../hooks/useTenantSettings";
import { api } from "../../lib/api";
import { exportToCsv } from "../../lib/exportCsv";

interface DaybookLine {
  lineId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string | null;
}

interface DaybookVoucher {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  lines: DaybookLine[];
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    minimumFractionDigits: 2,
  }).format(amount);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function Daybook() {
  const { settings } = useTenantSettings();
  const currency = settings?.baseCurrency || "GHS";

  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [page, setPage] = useState(1);
  const [vouchers, setVouchers] = useState<DaybookVoucher[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (pg = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: String(pg),
        pageSize: "50",
      });
      const res = await api.get(`/reports/daybook?${params}`);
      setVouchers(res.data.data.vouchers);
      setPagination(res.data.data.pagination);
      setPage(pg);
      // Expand all by default on a fresh load
      setExpandedIds(new Set(res.data.data.vouchers.map((v: DaybookVoucher) => v.entryId)));
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load daybook.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, page]);

  useEffect(() => {
    void load(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportCsv() {
    const rows: Record<string, string>[] = [];
    for (const v of vouchers) {
      for (const l of v.lines) {
        rows.push({
          Date: new Date(v.entryDate).toLocaleDateString("en-GH"),
          "Voucher No": v.entryNumber,
          Description: v.description || "",
          Account: `${l.accountCode} — ${l.accountName}`,
          "Line Note": l.description || "",
          Debit: l.debit > 0 ? String(l.debit) : "",
          Credit: l.credit > 0 ? String(l.credit) : "",
        });
      }
    }
    exportToCsv(`daybook_${startDate}_${endDate}.csv`, rows);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-secondary-900 dark:text-secondary-50">Daybook</h1>
            <p className="text-sm text-muted-foreground">
              All posted vouchers in chronological order
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={vouchers.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
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
            <Button onClick={() => load(1)} disabled={loading} size="sm">
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

      {/* Voucher list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Vouchers
            {pagination && (
              <span className="ml-2 font-normal text-muted-foreground text-sm">
                ({pagination.total} total)
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Click a row to expand / collapse its debit–credit breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {vouchers.length === 0 && !loading && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No posted vouchers found for the selected period.
            </p>
          )}

          <div className="divide-y divide-border">
            {vouchers.map((v) => {
              const expanded = expandedIds.has(v.entryId);
              const totalDebit = v.lines.reduce((s, l) => s + l.debit, 0);
              const totalCredit = v.lines.reduce((s, l) => s + l.credit, 0);
              return (
                <div key={v.entryId}>
                  {/* Voucher header row */}
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(v.entryId)}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">
                      {new Date(v.entryDate).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="w-32 shrink-0 font-mono text-xs font-medium text-primary">
                      {v.entryNumber}
                    </span>
                    <span className="flex-1 truncate text-sm">{v.description || "—"}</span>
                    <span className="ml-auto shrink-0 font-mono text-sm tabular-nums">
                      {fmt(totalDebit, currency)}
                    </span>
                  </button>

                  {/* Lines */}
                  {expanded && (
                    <div className="border-t border-border bg-muted/20 px-6 pb-3 pt-2 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Account</TableHead>
                            <TableHead className="text-xs">Note</TableHead>
                            <TableHead className="text-right text-xs">Debit</TableHead>
                            <TableHead className="text-right text-xs">Credit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {v.lines.map((l) => (
                            <TableRow key={l.lineId}>
                              <TableCell className="py-1.5 text-sm">
                                <span className="font-mono text-xs text-muted-foreground mr-2">{l.accountCode}</span>
                                {l.accountName}
                              </TableCell>
                              <TableCell className="py-1.5 text-xs text-muted-foreground">
                                {l.description || ""}
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-mono text-sm tabular-nums">
                                {l.debit > 0 ? fmt(l.debit, currency) : ""}
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-mono text-sm tabular-nums">
                                {l.credit > 0 ? fmt(l.credit, currency) : ""}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow className="border-t border-border font-semibold">
                            <TableCell colSpan={2} className="py-1.5 text-xs text-muted-foreground">
                              Total
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-sm tabular-nums">
                              {fmt(totalDebit, currency)}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-sm tabular-nums">
                              {fmt(totalCredit, currency)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => load(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
