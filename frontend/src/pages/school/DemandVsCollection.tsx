import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { BarChart3, Loader2, Printer } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface ReportRow {
  scheduleId: string;
  feeName: string;
  className: string;
  dueDate: string | null;
  eligibleStudents: number;
  invoicesGenerated: number;
  demand: number;
  collected: number;
  balance: number;
  collectionRate: number;
  paidCount: number;
}

interface Totals {
  demand: number;
  collected: number;
  balance: number;
}

export function DemandVsCollection() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ demand: 0, collected: 0, balance: 0 });
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
      const res = await api.get(`/school/reports/demand-vs-collection?termId=${selectedTermId}`);
      setRows(res.data?.data?.rows ?? []);
      setTotals(res.data?.data?.totals ?? { demand: 0, collected: 0, balance: 0 });
    } catch {
      showToast("Failed to load report", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedTerm = terms.find((t) => t.id === selectedTermId);
  const overallRate =
    totals.demand > 0 ? Math.round((totals.collected / totals.demand) * 100) : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Demand vs Collection</h1>
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

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Demand", value: fmt(totals.demand), color: "text-foreground" },
            { label: "Collected", value: fmt(totals.collected), color: "text-green-600" },
            { label: "Outstanding", value: fmt(totals.balance), color: "text-red-600" },
            {
              label: "Collection Rate",
              value: `${overallRate}%`,
              color: overallRate >= 80 ? "text-green-600" : overallRate >= 50 ? "text-amber-600" : "text-red-600",
            },
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
                    <TableHead>Fee Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Demand</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        {selectedTermId
                          ? "No fee schedules for this term."
                          : "Select a term to view the report."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.scheduleId}>
                        <TableCell className="font-medium">{r.feeName}</TableCell>
                        <TableCell>{r.className}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.eligibleStudents}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.invoicesGenerated}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.demand)}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-700">
                          {fmt(r.collected)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {fmt(r.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-green-500"
                                style={{ width: `${Math.min(100, r.collectionRate)}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm tabular-nums font-medium ${
                                r.collectionRate >= 80
                                  ? "text-green-600"
                                  : r.collectionRate >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {r.collectionRate}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {rows.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between text-sm font-semibold">
                <span>
                  Totals · {selectedTerm ? `${selectedTerm.name} (${selectedTerm.academicYear})` : ""}
                </span>
                <div className="flex gap-6 tabular-nums">
                  <span>{fmt(totals.demand)}</span>
                  <span className="text-green-700">{fmt(totals.collected)}</span>
                  <span className="text-red-600">{fmt(totals.balance)}</span>
                  <span
                    className={
                      overallRate >= 80
                        ? "text-green-600"
                        : overallRate >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                    }
                  >
                    {overallRate}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
