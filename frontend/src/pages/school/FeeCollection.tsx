import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { BookOpen, Loader2, Phone } from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  isCurrent: boolean;
}

interface StudentRow {
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
  paymentStatus: "paid" | "partial" | "unpaid" | "not_generated";
}

interface Summary {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  notGenerated: number;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  not_generated: "No Invoice",
};

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  unpaid: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  not_generated: "bg-secondary-100 text-secondary-500 dark:bg-secondary-800",
};

export function FeeCollection() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    api.get("/school/terms").then((res) => {
      const t: AcademicTerm[] = res.data.data.terms;
      setTerms(t);
      const current = t.find((x) => x.isCurrent) ?? t[0];
      if (current) setSelectedTermId(current.id);
      else setLoading(false);
    }).catch(() => {
      showToast("Failed to load terms.", "error");
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedTermId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/school/fee-collection?termId=${selectedTermId}`);
      setRows(res.data.data.students);
      setSummary(res.data.data.summary);
    } catch {
      showToast("Failed to load fee collection data.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTermId, showToast]);

  useEffect(() => { if (selectedTermId) load(); }, [selectedTermId]);

  const classes = [...new Set(rows.map((r) => r.student.className))].sort();
  const filtered = rows.filter((r) => {
    const matchClass = !classFilter || r.student.className === classFilter;
    const matchStatus = !statusFilter || r.paymentStatus === statusFilter;
    return matchClass && matchStatus;
  });

  const fmt = (n: number) =>
    n.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-semibold text-secondary-900 dark:text-white">Fee Collection</h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300 whitespace-nowrap">Term:</label>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Students", value: summary.total, cls: "text-secondary-900 dark:text-white" },
            { label: "Paid", value: summary.paid, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Partial", value: summary.partial, cls: "text-amber-600 dark:text-amber-400" },
            { label: "Unpaid", value: summary.unpaid, cls: "text-red-600 dark:text-red-400" },
            { label: "No Invoice", value: summary.notGenerated, cls: "text-secondary-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-xs text-secondary-500 mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="not_generated">No Invoice</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-secondary-400" /></div>
          ) : !selectedTermId ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <BookOpen className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No academic terms found.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-secondary-500">
              <BookOpen className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{rows.length === 0 ? "No active students found." : "No students match your filters."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.student.id}>
                      <TableCell>
                        <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                        <div className="text-xs text-secondary-400 font-mono">{r.student.studentCode}</div>
                      </TableCell>
                      <TableCell>{r.student.className}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.student.guardianName}</div>
                        <a href={`tel:${r.student.guardianPhone}`} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                          <Phone className="w-3 h-3" />{r.student.guardianPhone}
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(r.totalOwed)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">{fmt(r.totalPaid)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">{r.balance > 0 ? fmt(r.balance) : "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[r.paymentStatus]}`}>
                          {STATUS_LABEL[r.paymentStatus]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
