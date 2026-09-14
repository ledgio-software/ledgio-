import { useState, useEffect } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { FileText, Loader2, Printer } from "lucide-react";

interface AcademicTerm { id: string; name: string; academicYear: string; isCurrent: boolean; }
interface Student { id: string; firstName: string; lastName: string; className: string; studentCode: string; }
interface SubjectResult { name: string; examType: string; score: number; maxScore: number; percent: number; grade: string; }
interface ReportCard {
  student: { id: string; studentCode: string; firstName: string; lastName: string; className: string };
  term: { id: string; name: string; academicYear: string };
  subjects: SubjectResult[];
  attendanceSummary: { present: number; absent: number; late: number; total: number };
  overallPercent: number;
  overallGrade: string;
  classRank?: number;
  classSize?: number;
  classAverage?: number;
}

function gradeColor(g: string) {
  if (g === "A") return "#16a34a"; if (g === "B") return "#2563eb";
  if (g === "C") return "#d97706"; if (g === "D") return "#ea580c"; return "#dc2626";
}

export function ReportCards() {
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/school/terms").then((r) => {
      const list: AcademicTerm[] = r.data?.data?.terms ?? [];
      setTerms(list);
      const current = list.find((t) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    });
    api.get("/school/students").then((r) => setStudents(r.data?.data?.students ?? []));
  }, []);

  async function load() {
    if (!selectedStudentId || !selectedTermId) { showToast("Select a student and term", "error"); return; }
    setLoading(true);
    try {
      const res = await api.get(`/school/report-cards?studentId=${selectedStudentId}&termId=${selectedTermId}`);
      setReportCard(res.data?.data ?? null);
    } catch { showToast("Failed to load report card", "error"); }
    finally { setLoading(false); }
  }

  function print() {
    if (!reportCard) return;
    const { student, term, subjects, attendanceSummary, overallPercent, overallGrade, classRank, classSize, classAverage } = reportCard;
    const html = `<!DOCTYPE html>
<html>
<head><title>Report Card</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
  h1 { text-align: center; font-size: 22px; margin: 0; }
  h2 { text-align: center; font-size: 16px; color: #555; margin: 4px 0 20px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #f3f4f6; font-weight: 600; }
  .grade { font-weight: bold; color: ${gradeColor(overallGrade)}; }
  .sig { margin-top: 60px; display: flex; justify-content: space-between; }
  .sig-line { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 12px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Student Report Card</h1>
<h2>${term.name} — ${term.academicYear}</h2>
<div class="info">
  <div><strong>Name:</strong> ${student.firstName} ${student.lastName}</div>
  <div><strong>Student ID:</strong> ${student.studentCode}</div>
  <div><strong>Class:</strong> ${student.className}</div>
  <div><strong>Overall:</strong> <span class="grade">${overallPercent}% — ${overallGrade}</span></div>
  ${classRank != null && classSize != null ? `<div><strong>Class Rank:</strong> ${classRank} / ${classSize}${classAverage != null ? ` &nbsp;·&nbsp; Class Avg: ${classAverage}%` : ""}</div>` : ""}
</div>
<table>
  <thead><tr><th>Subject</th><th>Exam Type</th><th>Score</th><th>Max</th><th>%</th><th>Grade</th></tr></thead>
  <tbody>
    ${subjects.map((s) => `<tr><td>${s.name}</td><td>${s.examType}</td><td>${s.score}</td><td>${s.maxScore}</td><td>${s.percent}%</td><td style="font-weight:bold;color:${gradeColor(s.grade)}">${s.grade}</td></tr>`).join("")}
  </tbody>
</table>
<h3>Attendance Summary</h3>
<table>
  <thead><tr><th>Present</th><th>Absent</th><th>Late</th><th>Total Days</th></tr></thead>
  <tbody><tr><td>${attendanceSummary.present}</td><td>${attendanceSummary.absent}</td><td>${attendanceSummary.late}</td><td>${attendanceSummary.total}</td></tr></tbody>
</table>
<div class="sig">
  <div class="sig-line">Class Teacher</div>
  <div class="sig-line">Head Teacher</div>
  <div class="sig-line">Parent / Guardian</div>
</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-semibold">Report Cards</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
            <option value="">— Select Student —</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.className})</option>)}
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
            <option value="">— Select Term —</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academicYear}){t.isCurrent ? " ★" : ""}</option>)}
          </select>
          <Button size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Generate
          </Button>
          {reportCard && (
            <Button variant="outline" size="sm" onClick={print}><Printer className="h-4 w-4 mr-1" />Print</Button>
          )}
        </div>
      </div>

      {reportCard && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="border-b pb-3">
              <h2 className="text-lg font-semibold">{reportCard.student.firstName} {reportCard.student.lastName}</h2>
              <p className="text-sm text-muted-foreground">{reportCard.student.studentCode} · {reportCard.student.className} · {reportCard.term.name} ({reportCard.term.academicYear})</p>
              <p className="mt-1 text-sm">
                Overall: <span className="font-bold">{reportCard.overallPercent}%</span> —{" "}
                <span className="font-bold" style={{ color: gradeColor(reportCard.overallGrade) }}>{reportCard.overallGrade}</span>
                {reportCard.classRank != null && reportCard.classSize != null && (
                  <span className="ml-3 text-muted-foreground">
                    Rank: <span className="font-bold text-foreground">{reportCard.classRank}</span> / {reportCard.classSize}
                    {reportCard.classAverage != null && (
                      <> · Class Avg: <span className="font-bold text-foreground">{reportCard.classAverage}%</span></>
                    )}
                  </span>
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportCard.subjects.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No assessments recorded for this term.</TableCell></TableRow>
                  ) : (
                    reportCard.subjects.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs">{s.examType}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.score}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.maxScore}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.percent}%</TableCell>
                        <TableCell><span className="font-bold" style={{ color: gradeColor(s.grade) }}>{s.grade}</span></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">Attendance Summary</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-700">Present: {reportCard.attendanceSummary.present}</span>
                <span className="text-red-600">Absent: {reportCard.attendanceSummary.absent}</span>
                <span className="text-amber-600">Late: {reportCard.attendanceSummary.late}</span>
                <span className="text-muted-foreground">Total Days: {reportCard.attendanceSummary.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!reportCard && !loading && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Select a student and term, then click Generate.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
