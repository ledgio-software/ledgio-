import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { BookOpen, ChevronDown, ChevronRight, Loader2, Printer, Search } from "lucide-react";

interface StudentResult {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface LedgerRow {
  invoiceId: string;
  invoiceNumber: string;
  feeName: string;
  termName: string;
  academicYear: string;
  dueDate: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  payments: Payment[];
}

interface LedgerSummary {
  totalCharged: number;
  totalPaid: number;
  balance: number;
}

interface SchoolClass {
  id: string;
  name: string;
}

export function StudentLedger() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [termFilter, setTermFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    api.get("/school/classes").then((res) => {
      setClasses(res.data?.data?.classes ?? []);
    }).catch(() => {});
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const doSearch = useCallback(async (overrideClass?: string) => {
    const cls = overrideClass !== undefined ? overrideClass : classFilter;
    if (searchQuery.trim().length < 2 && !cls) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (cls) params.set("className", cls);
      const res = await api.get(`/school/students?${params.toString()}`);
      setSearchResults(res.data?.data?.students ?? []);
    } catch {
      showToast("Search failed", "error");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, classFilter, showToast]);

  const loadLedger = useCallback(async (student: StudentResult) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setSearchQuery("");
    setExpandedRows(new Set());
    setLoading(true);
    try {
      const res = await api.get(`/school/reports/student-ledger/${student.id}`);
      setLedger(res.data?.data?.ledger ?? []);
      setSummary(res.data?.data?.summary ?? null);
    } catch {
      showToast("Failed to load ledger", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const methodLabel = (m: string) =>
    ({ CASH: "Cash", MOBILE_MONEY: "Mobile Money", CHEQUE: "Cheque", BANK_TRANSFER: "Bank Transfer", MANUAL: "Manual", PAYSTACK: "Paystack" }[m] ?? m);

  const termOptions = useMemo(() => {
    const seen = new Set<string>();
    return ledger
      .filter((r) => { if (seen.has(r.termName)) return false; seen.add(r.termName); return true; })
      .map((r) => ({ label: `${r.termName} ${r.academicYear}`, value: r.termName }));
  }, [ledger]);

  const filteredLedger = useMemo(() => ledger.filter((r) => {
    if (termFilter && r.termName !== termFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  }), [ledger, termFilter, statusFilter]);

  const filteredSummary = useMemo(() => ({
    totalCharged: filteredLedger.reduce((s, r) => s + r.total, 0),
    totalPaid: filteredLedger.reduce((s, r) => s + r.amountPaid, 0),
    balance: filteredLedger.reduce((s, r) => s + r.balance, 0),
  }), [filteredLedger]);

  function handlePrint() {
    if (!selectedStudent) return;
    const rows = filteredLedger.length > 0 ? filteredLedger : ledger;
    const totalCharged = rows.reduce((s, r) => s + r.total, 0);
    const totalPaid = rows.reduce((s, r) => s + r.amountPaid, 0);
    const balance = rows.reduce((s, r) => s + r.balance, 0);
    const now = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const rowsHtml = rows.map((r) => {
      const payments = r.payments.map((p) =>
        `<tr style="background:#f9fafb"><td style="padding:4px 12px 4px 28px;color:#6b7280;font-style:italic" colspan="3">${methodLabel(p.method)} — ${fmtDate(p.paidAt)}</td><td style="padding:4px 12px;text-align:right;color:#16a34a">${fmt(p.amount)}</td><td colspan="2"></td></tr>`
      ).join("");
      const statusColor = r.status === "PAID" ? "#15803d" : r.status === "PARTIALLY_PAID" ? "#92400e" : "#b91c1c";
      const statusBg = r.status === "PAID" ? "#dcfce7" : r.status === "PARTIALLY_PAID" ? "#fef3c7" : "#fee2e2";
      return `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px"><strong>${r.feeName}</strong><br><small style="color:#6b7280">${r.termName} · ${r.academicYear}</small></td>
          <td style="padding:8px 12px;text-align:center;font-size:12px">${r.invoiceNumber}</td>
          <td style="padding:8px 12px;text-align:center;font-size:12px">${fmtDate(r.dueDate)}</td>
          <td style="padding:8px 12px;text-align:right">${fmt(r.total)}</td>
          <td style="padding:8px 12px;text-align:right;color:#16a34a">${fmt(r.amountPaid)}</td>
          <td style="padding:8px 12px;text-align:right;color:${r.balance > 0 ? "#b91c1c" : "#6b7280"}">${fmt(r.balance)}</td>
          <td style="padding:8px 12px;text-align:center"><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600">${r.status === "PARTIALLY_PAID" ? "Partial" : r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span></td>
        </tr>${payments}`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Student Ledger — ${selectedStudent.firstName} ${selectedStudent.lastName}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; font-weight: normal; color: #6b7280; margin: 0 0 16px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
      .school { font-size: 11px; color: #6b7280; text-align: right; }
      .tiles { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
      .tile { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
      .tile-label { font-size: 11px; color: #6b7280; } .tile-value { font-size: 18px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="header">
      <div>
        <h1>${selectedStudent.firstName} ${selectedStudent.lastName}</h1>
        <h2>${selectedStudent.studentCode} · ${selectedStudent.className} · Guardian: ${selectedStudent.guardianName} (${selectedStudent.guardianPhone})</h2>
      </div>
      <div class="school"><strong>Student Fee Ledger</strong><br>Printed: ${now}</div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="tile-label">Total Charged</div><div class="tile-value">${fmt(totalCharged)}</div></div>
      <div class="tile"><div class="tile-label">Total Paid</div><div class="tile-value" style="color:#16a34a">${fmt(totalPaid)}</div></div>
      <div class="tile"><div class="tile-label">Outstanding</div><div class="tile-value" style="color:${balance > 0 ? "#b91c1c" : "#16a34a"}">${fmt(balance)}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Fee / Term</th><th style="text-align:center">Invoice #</th><th style="text-align:center">Due Date</th>
        <th style="text-align:right">Charged</th><th style="text-align:right">Paid</th>
        <th style="text-align:right">Balance</th><th style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr style="border-top:2px solid #111;font-weight:700">
        <td colspan="3" style="padding:8px 12px">TOTAL</td>
        <td style="padding:8px 12px;text-align:right">${fmt(totalCharged)}</td>
        <td style="padding:8px 12px;text-align:right;color:#16a34a">${fmt(totalPaid)}</td>
        <td style="padding:8px 12px;text-align:right;color:${balance > 0 ? "#b91c1c" : "#6b7280"}">${fmt(balance)}</td>
        <td></td>
      </tr></tfoot>
    </table>
    <div class="footer">Generated by Ledgio · ${now}</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Student Ledger</h1>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              value={classFilter}
              onChange={(e) => {
                const val = e.target.value;
                setClassFilter(val);
                setSelectedStudent(null);
                setSearchResults([]);
                if (val) doSearch(val);
                else setSearchResults([]);
              }}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <Input
              placeholder="Search by name, student code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={() => doSearch()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded shadow-sm max-h-48 overflow-y-auto">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                  onClick={() => loadLedger(s)}
                >
                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                  <span className="text-muted-foreground">{s.studentCode} · {s.className}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <>
          {/* Student header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedStudent.firstName} {selectedStudent.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedStudent.studentCode} · {selectedStudent.className} · Guardian: {selectedStudent.guardianName} · {selectedStudent.guardianPhone}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print Receipt
            </Button>
          </div>

          {/* Filters */}
          {ledger.length > 0 && (
            <div className="flex flex-wrap gap-3 items-center">
              <select
                className="border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)}
              >
                <option value="">All Terms</option>
                {termOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                className="border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="SENT">Unpaid</option>
                <option value="PARTIALLY_PAID">Partial</option>
                <option value="PAID">Paid</option>
              </select>
              {(termFilter || statusFilter) && (
                <button
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => { setTermFilter(""); setStatusFilter(""); }}
                >
                  Clear filters
                </button>
              )}
              {(termFilter || statusFilter) && (
                <span className="text-xs text-muted-foreground">{filteredLedger.length} of {ledger.length} rows</span>
              )}
            </div>
          )}

          {/* Summary tiles */}
          {summary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Charged", value: fmt(filteredSummary.totalCharged), color: "text-foreground" },
                { label: "Total Paid", value: fmt(filteredSummary.totalPaid), color: "text-green-600" },
                { label: "Outstanding", value: fmt(filteredSummary.balance), color: filteredSummary.balance > 0 ? "text-red-600" : "text-green-600" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Fee / Term</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Charged</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLedger.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                            {ledger.length === 0 ? "No fee records found for this student." : "No records match the selected filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLedger.map((row) => (
                          <>
                            <TableRow
                              key={row.invoiceId}
                              className={row.payments.length > 0 ? "cursor-pointer hover:bg-accent/50" : ""}
                              onClick={() => row.payments.length > 0 && toggleRow(row.invoiceId)}
                            >
                              <TableCell>
                                {row.payments.length > 0 ? (
                                  expandedRows.has(row.invoiceId) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{row.feeName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {row.termName} · {row.academicYear}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{row.invoiceNumber}</TableCell>
                              <TableCell className="text-sm">{fmtDate(row.dueDate)}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(row.total)}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-700">{fmt(row.amountPaid)}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                <span className={row.balance > 0 ? "text-red-600" : "text-muted-foreground"}>
                                  {fmt(row.balance)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                    row.status === "PAID"
                                      ? "bg-green-100 text-green-800"
                                      : row.status === "PARTIALLY_PAID"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {row.status === "PARTIALLY_PAID" ? "Partial" : row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                                </span>
                              </TableCell>
                            </TableRow>
                            {expandedRows.has(row.invoiceId) &&
                              row.payments.map((p) => (
                                <TableRow key={p.id} className="bg-muted/30">
                                  <TableCell />
                                  <TableCell colSpan={2} className="pl-6 text-sm text-muted-foreground italic">
                                    Payment via {methodLabel(p.method)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{fmtDate(p.paidAt)}</TableCell>
                                  <TableCell />
                                  <TableCell className="text-right tabular-nums text-green-700 text-sm">{fmt(p.amount)}</TableCell>
                                  <TableCell colSpan={2} />
                                </TableRow>
                              ))}
                          </>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
