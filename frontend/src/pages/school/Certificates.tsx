import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { Award, Loader2, Plus, Printer } from "lucide-react";

interface Student { id: string; firstName: string; lastName: string; className: string; studentCode: string; }
interface Certificate {
  id: string; studentId: string; certificateType: string; issuedDate: string; issuedBy: string; notes?: string;
  student: Student | null;
}

const CERT_TYPES = ["LEAVING", "COMPLETION", "CONDUCT", "TRANSFER", "SCHOLARSHIP"];
const CERT_COLORS: Record<string, string> = {
  LEAVING: "bg-blue-100 text-blue-800", COMPLETION: "bg-green-100 text-green-800",
  CONDUCT: "bg-purple-100 text-purple-800", TRANSFER: "bg-amber-100 text-amber-800",
  SCHOLARSHIP: "bg-rose-100 text-rose-800",
};

export function Certificates() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canWrite = ["admin", "accountant"].includes((user?.role ?? "").toLowerCase());

  const [students, setStudents] = useState<Student[]>([]);
  const [filterStudentId, setFilterStudentId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ studentId: "", certificateType: "COMPLETION", issuedDate: new Date().toISOString().slice(0, 10), issuedBy: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/school/students").then((r) => setStudents(r.data?.data?.students ?? [])); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterStudentId) p.set("studentId", filterStudentId);
      if (filterType) p.set("type", filterType);
      const res = await api.get(`/school/certificates?${p}`);
      setCertificates(res.data?.data?.certificates ?? []);
    } catch { showToast("Failed to load certificates", "error"); }
    finally { setLoading(false); }
  }, [filterStudentId, filterType, showToast]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.studentId || !form.certificateType || !form.issuedDate || !form.issuedBy) {
      showToast("All required fields must be filled", "error"); return;
    }
    setSaving(true);
    try {
      await api.post("/school/certificates", { ...form, notes: form.notes || undefined });
      showToast("Certificate issued", "success");
      setShowModal(false); load();
    } catch { showToast("Failed to issue certificate", "error"); }
    finally { setSaving(false); }
  }

  function printCertificate(c: Certificate) {
    const s = c.student;
    const typeLabel = c.certificateType.charAt(0) + c.certificateType.slice(1).toLowerCase();
    const dateStr = new Date(c.issuedDate).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" });
    const html = `<!DOCTYPE html><html>
<head><title>Certificate</title>
<style>
  body { font-family: 'Georgia', serif; margin: 0; padding: 40px; text-align: center; }
  .border { border: 12px double #b8860b; padding: 40px; min-height: 600px; display: flex; flex-direction: column; justify-content: center; }
  h1 { font-size: 32px; color: #b8860b; letter-spacing: 3px; margin-bottom: 4px; }
  h2 { font-size: 20px; color: #555; margin: 0 0 40px; }
  .cert-body { font-size: 16px; line-height: 2; color: #333; }
  .student-name { font-size: 28px; font-weight: bold; color: #111; border-bottom: 2px solid #b8860b; display: inline-block; padding: 0 20px 4px; margin: 10px 0; }
  .sig-row { display: flex; justify-content: space-around; margin-top: 60px; }
  .sig-block { width: 180px; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; color: #555; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="border">
  <h1>CERTIFICATE OF ${c.certificateType}</h1>
  <h2>This is to certify that</h2>
  <div class="cert-body">
    <div class="student-name">${s ? `${s.firstName} ${s.lastName}` : "—"}</div>
    <p>${s ? `(${s.studentCode}, Class: ${s.className})` : ""}</p>
    <p>has been awarded this <strong>${typeLabel} Certificate</strong>${c.notes ? `<br><em>${c.notes}</em>` : ""}.</p>
    <p>Issued on <strong>${dateStr}</strong> by <strong>${c.issuedBy}</strong>.</p>
  </div>
  <div class="sig-row">
    <div class="sig-block">Class Teacher</div>
    <div class="sig-block">Head Teacher / Principal</div>
    <div class="sig-block">School Stamp</div>
  </div>
</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold">Certificates</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)}>
            <option value="">— All Students —</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.className})</option>)}
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-background" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">— All Types —</option>
            {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {canWrite && <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" />Issue Certificate</Button>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Issued Date</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No certificates found.</TableCell></TableRow>
                  ) : (
                    certificates.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.student?.firstName} {c.student?.lastName}<div className="text-xs text-muted-foreground">{c.student?.studentCode}</div></TableCell>
                        <TableCell>{c.student?.className}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded text-xs font-medium ${CERT_COLORS[c.certificateType] ?? ""}`}>{c.certificateType}</span></TableCell>
                        <TableCell>{new Date(c.issuedDate).toLocaleDateString()}</TableCell>
                        <TableCell>{c.issuedBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.notes ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => printCertificate(c)}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-3">
            <h2 className="text-base font-semibold">Issue Certificate</h2>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Student</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
                  <option value="">— Select Student —</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.className})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Certificate Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.certificateType} onChange={(e) => setForm((f) => ({ ...f, certificateType: e.target.value }))}>
                    {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Issued Date</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={form.issuedDate} onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Issued By</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm bg-background" placeholder="Staff name / Title" value={form.issuedBy} onChange={(e) => setForm((f) => ({ ...f, issuedBy: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm bg-background" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Issue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
