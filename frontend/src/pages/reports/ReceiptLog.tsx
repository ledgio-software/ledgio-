import { useState, useCallback, useEffect, Fragment } from "react";
import { Receipt, RefreshCw, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/utils";

interface ReceiptLine {
  itemName: string;
  itemSku: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

interface ReceiptRecord {
  id: string;
  receiptNo: string;
  amount: string;
  cashGiven: string;
  changeGiven: string;
  saleType: string;
  paymentMethod: string;
  status: string;
  createdByName: string | null;
  createdByUserId: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  lines: ReceiptLine[];
  till: { warehouse: { name: string } };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function ReceiptLog() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);

  const fetchReceipts = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), limit: '50' };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/tills/receipts', { params });
      setReceipts(res.data.data.receipts);
      setPagination(res.data.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load receipt log.');
    } finally {
      setLoading(false);
    }
  }, [from, to, page]);

  useEffect(() => { fetchReceipts(1); setPage(1); }, [from, to]);

  const openPdf = async (id: string) => {
    try {
      const res = await api.get(`/tills/sales/${id}/receipt.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      // Do not revoke the blob URL — the PDF viewer re-reads it when the user opens the print dialog.
    } catch {
      alert('Could not open receipt PDF.');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

  const totalAmount = receipts.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receipt Audit Log</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Every completed POS transaction — visible to admin and accountant only.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchReceipts(page)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-secondary-500 mb-1">From</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <label className="block text-xs text-secondary-500 mb-1">To</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                {pagination.total} receipts
              </CardTitle>
              <CardDescription>Period total: {formatMoney(totalAmount)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-secondary-400 py-8">No receipts found for this period.</TableCell>
                  </TableRow>
                )}
                {receipts.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-900/40"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <TableCell className="font-mono text-xs">{r.receiptNo}</TableCell>
                      <TableCell className="text-xs text-secondary-500">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-xs">{r.till?.warehouse?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.createdByName ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={r.saleType === 'WHOLESALE' ? 'secondary' : 'default'}>
                          {r.saleType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.paymentMethod}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(Number(r.amount))}</TableCell>
                      <TableCell>
                        {r.voidedAt ? (
                          <Badge variant="danger">VOIDED</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-xs text-primary underline hover:opacity-80"
                          onClick={e => { e.stopPropagation(); openPdf(r.id); }}
                        >
                          <Download className="h-3 w-3 inline mr-0.5" />PDF
                        </button>
                      </TableCell>
                    </TableRow>
                    {expanded === r.id && (
                      <TableRow className="bg-secondary-50 dark:bg-secondary-900/30">
                        <TableCell colSpan={9} className="py-2 px-4">
                          <div className="text-xs space-y-1">
                            {r.voidedAt && (
                              <div className="text-red-600 dark:text-red-400 font-medium">
                                Voided {formatDate(r.voidedAt)} by {r.voidedByName ?? 'unknown'} — {r.voidReason}
                              </div>
                            )}
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-secondary-400">
                                  <th className="pr-4 font-normal">Item</th>
                                  <th className="pr-4 font-normal">SKU</th>
                                  <th className="pr-4 font-normal text-right">Qty</th>
                                  <th className="pr-4 font-normal text-right">Unit Price</th>
                                  <th className="font-normal text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.lines.map((l, i) => (
                                  <tr key={i}>
                                    <td className="pr-4">{l.itemName}</td>
                                    <td className="pr-4 font-mono text-secondary-400">{l.itemSku}</td>
                                    <td className="pr-4 text-right tabular-nums">{l.quantity}</td>
                                    <td className="pr-4 text-right tabular-nums">{formatMoney(Number(l.unitPrice))}</td>
                                    <td className="text-right tabular-nums">{formatMoney(Number(l.total))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-secondary-500 pt-1">
                              Cash given: {formatMoney(Number(r.cashGiven))} — Change: {formatMoney(Number(r.changeGiven))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-secondary-800">
              <span className="text-xs text-secondary-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchReceipts(page - 1); }}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => { setPage(p => p + 1); fetchReceipts(page + 1); }}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
