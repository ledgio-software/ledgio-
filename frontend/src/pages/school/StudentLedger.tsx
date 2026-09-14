import { useState, useCallback } from "react";
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

export function StudentLedger() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const doSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await api.get(`/school/students?search=${encodeURIComponent(searchQuery.trim())}&limit=10`);
      setSearchResults(res.data?.data?.students ?? []);
    } catch {
      showToast("Search failed", "error");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, showToast]);

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Student Ledger</h1>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Search by name, student code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={doSearch} disabled={searching}>
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
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>

          {/* Summary tiles */}
          {summary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Charged", value: fmt(summary.totalCharged), color: "text-foreground" },
                { label: "Total Paid", value: fmt(summary.totalPaid), color: "text-green-600" },
                { label: "Outstanding", value: fmt(summary.balance), color: summary.balance > 0 ? "text-red-600" : "text-green-600" },
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
                      {ledger.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                            No fee records found for this student.
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledger.map((row) => (
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
