import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { AlertTriangle, RefreshCw, X, WifiOff } from "lucide-react";

interface SyncFailure {
  id: string;
  userId?: string;
  entityType: string;
  entityId?: string;
  operationKind: string;
  clientTxnId?: string;
  failureReason?: string;
  httpStatus?: number;
  createdAt: string;
}

interface Filters {
  entityType: string;
  operationKind: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = { entityType: "", operationKind: "", dateFrom: "", dateTo: "" };

function HttpStatusBadge({ status }: { status?: number }) {
  if (!status) return <span className="text-secondary-400">—</span>;
  const color =
    status >= 500
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : status >= 400
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {status}
    </span>
  );
}

export function SyncFailureLogs() {
  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const buildParams = useCallback((currentPage: number, f: Filters) => {
    const params: Record<string, string | number> = { page: currentPage, limit: 25 };
    if (f.entityType.trim()) params.entityType = f.entityType.trim();
    if (f.operationKind.trim()) params.operationKind = f.operationKind.trim();
    if (f.dateFrom) params.dateFrom = f.dateFrom;
    if (f.dateTo) params.dateTo = f.dateTo;
    return params;
  }, []);

  const fetchFailures = useCallback(async (currentPage: number, f: Filters) => {
    setIsLoading(true);
    try {
      const res = await api.get("/sync/failures", { params: buildParams(currentPage, f) });
      if (res.data.success) {
        setFailures(res.data.data.failures);
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotal(res.data.data.pagination.total || 0);
      }
    } catch {
      setFailures([]);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchFailures(page, appliedFilters);
  }, [fetchFailures, page, appliedFilters]);

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasActiveFilters = Object.values(appliedFilters).some((v) => v.trim() !== "");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">
            Sync Failure Log
          </h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            Client-side sync outbox failures — records what the server rejected and why.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchFailures(page, appliedFilters)} className="flex items-center">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <WifiOff className="mr-2 h-5 w-5 text-amber-500" />
            Offline Sync Failures
          </CardTitle>
          <CardDescription>
            Each row is one client operation that failed to sync. Persistent failures for the same entity may indicate a data conflict or a missing server-side record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800">
            <div>
              <label className="block text-[11px] font-medium text-secondary-500 mb-1">Entity Type</label>
              <Input
                placeholder="e.g. Invoice"
                className="h-9 text-xs"
                value={draftFilters.entityType}
                onChange={(e) => setDraftFilters((f) => ({ ...f, entityType: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-secondary-500 mb-1">Operation</label>
              <Input
                placeholder="e.g. create"
                className="h-9 text-xs"
                value={draftFilters.operationKind}
                onChange={(e) => setDraftFilters((f) => ({ ...f, operationKind: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-secondary-500 mb-1">From</label>
              <Input
                type="date"
                className="h-9 text-xs"
                value={draftFilters.dateFrom}
                onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-secondary-500 mb-1">To</label>
              <Input
                type="date"
                className="h-9 text-xs"
                value={draftFilters.dateTo}
                onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2 pt-1">
              <Button variant="primary" className="h-8 text-xs" onClick={applyFilters}>
                Apply Filters
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" className="h-8 text-xs flex items-center" onClick={clearFilters}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-secondary-500">Loading sync failures...</div>
          ) : failures.length === 0 ? (
            <div className="py-12 text-center text-sm text-secondary-500">
              <AlertTriangle className="mx-auto h-8 w-8 text-secondary-400 mb-2" />
              {hasActiveFilters
                ? "No failures match the current filters."
                : "No sync failures recorded. All client operations are syncing successfully."}
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary-500 mb-3">{total} failure{total !== 1 ? "s" : ""} found</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>HTTP Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Txn ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failures.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs text-secondary-500 whitespace-nowrap">
                        {new Date(f.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-secondary-900 dark:text-secondary-50">
                        {f.entityType}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-secondary-500">
                        {f.entityId ? f.entityId.slice(0, 12) + (f.entityId.length > 12 ? "…" : "") : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300">
                          {f.operationKind}
                        </span>
                      </TableCell>
                      <TableCell>
                        <HttpStatusBadge status={f.httpStatus ?? undefined} />
                      </TableCell>
                      <TableCell className="text-xs text-secondary-600 dark:text-secondary-400 max-w-xs truncate" title={f.failureReason ?? undefined}>
                        {f.failureReason || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-secondary-400">
                        {f.clientTxnId ? f.clientTxnId.slice(0, 10) + "…" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4 border-t border-secondary-200 dark:border-secondary-800">
                <p className="text-xs text-secondary-500">Page {page} of {totalPages}</p>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
