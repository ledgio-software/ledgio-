import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { AlertTriangle, Loader2, Printer } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface Defaulter {
  student: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    className: string;
    guardianName: string;
    guardianPhone: string;
  };
  totalOwed: number;
  totalPaid: number;
  balance: number;
  daysOverdue: number;
  paymentStatus: "partial" | "unpaid";
}

export function FeeDefaulters() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedTermId) return;
    setLoading(true);
    try {
      const res = await api.get(`/school/reports/fee-defaulters?termId=${selectedTermId}`);
      setDefaulters(res.data?.data?.defaulters ?? []);
    } catch {
      showToast("Failed to load defaulters report", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBalance = defaulters.reduce((s, d) => s + d.balance, 0);
  const selectedTerm = terms.find((t) => t.id === selectedTermId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-semibold">Fee Defaulters</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border rounded px-3 py-1.5 text-sm bg-background"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            <option value="">— Select Term —</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

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
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        {selectedTermId
                          ? "No defaulters for this term."
                          : "Select a term to view defaulters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    defaulters.map((d) => (
                      <TableRow key={d.student.id}>
                        <TableCell>
                          <div className="font-medium">
                            {d.student.firstName} {d.student.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{d.student.studentCode}</div>
                        </TableCell>
                        <TableCell>{d.student.className}</TableCell>
                        <TableCell>{d.student.guardianName}</TableCell>
                        <TableCell>{d.student.guardianPhone}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.totalOwed)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(d.totalPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-red-600">
                          {fmt(d.balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.daysOverdue > 0 ? (
                            <span className={d.daysOverdue > 30 ? "text-red-600 font-medium" : "text-amber-600"}>
                              {d.daysOverdue}d
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              d.paymentStatus === "partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {d.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {defaulters.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {defaulters.length} defaulter{defaulters.length !== 1 ? "s" : ""} ·{" "}
                  {selectedTerm ? `${selectedTerm.name} (${selectedTerm.academicYear})` : ""}
                </span>
                <span className="font-semibold text-red-600">
                  Total Outstanding: {fmt(totalBalance)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
