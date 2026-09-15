import { useState, useEffect, useCallback, useMemo } from "react";
import { Briefcase, Plus, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ChevronUp, DollarSign, Calendar, TrendingUp, Search } from "lucide-react";
import { api } from "../../lib/api";
import { confirm } from "../../components/ui/AlertDialog";

interface JobCostLine {
  id: string;
  type: string;
  description: string;
  quantity: string;
  unitCost: string;
  amount: string;
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  customerId: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  invoiceId: string | null;
  budget: string | null;
  costLines: JobCostLine[];
}

interface Customer { id: string; name: string; }
interface Account { id: string; name: string; code: string; }

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const COST_LINE_TYPES = ["MATERIAL", "LABOUR", "OVERHEAD", "SUBCONTRACT"];

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", customerId: "", startDate: "", endDate: "", description: "", budget: "" });
  const [newLine, setNewLine] = useState({ type: "MATERIAL", description: "", quantity: "1", unitCost: "", accountId: "" });
  const [lineJobId, setLineJobId] = useState<string | null>(null);
  const [addingLineForJob, setAddingLineForJob] = useState<string | null>(null);
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState("");

  const displayedJobs = useMemo(() => {
    const q = jobSearch.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter((j) => {
      const custName = (customers.find((c) => c.id === j.customerId)?.name ?? "").toLowerCase();
      return j.name.toLowerCase().includes(q) || custName.includes(q);
    });
  }, [jobs, jobSearch, customers]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [jRes, cRes, aRes] = await Promise.all([
        api.get("/jobs"),
        api.get("/invoices/customers"),
        api.get("/accounts"),
      ]);
      setJobs(jRes.data.data || []);
      setCustomers(cRes.data.data?.customers || []);
      setAccounts(aRes.data.data?.accounts || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load jobs.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError(null);
    try {
      await api.post("/jobs", {
        name: form.name,
        customerId: form.customerId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        description: form.description || null,
        budget: form.budget ? parseFloat(form.budget) : null,
      });
      setShowCreate(false); setForm({ name: "", customerId: "", startDate: "", endDate: "", description: "", budget: "" });
      flash("Job created."); fetchAll();
    } catch (e: any) { setError(e?.response?.data?.error || "Create failed."); }
  };

  const handleAddLine = async (jobId: string) => {
    if (addingLineForJob === jobId) return;
    const qty = parseFloat(newLine.quantity);
    const cost = parseFloat(newLine.unitCost);
    if (!newLine.description.trim() || isNaN(qty) || isNaN(cost)) { setError("Fill in description, quantity, and unit cost."); return; }
    setError(null);
    setAddingLineForJob(jobId);
    try {
      const res = await api.post(`/jobs/${jobId}/cost-lines`, {
        type: newLine.type, description: newLine.description, quantity: qty, unitCost: cost,
        ...(newLine.accountId ? { accountId: newLine.accountId } : {}),
      });
      setNewLine({ type: "MATERIAL", description: "", quantity: "1", unitCost: "", accountId: "" });
      setLineJobId(null);
      const warn = res.data?.journalWarning;
      if (warn) setError(`Cost line added — GL warning: ${warn}`);
      else flash("Cost line added.");
      fetchAll();
    } catch (e: any) { setError(e?.response?.data?.error || "Failed to add cost line."); }
    finally { setAddingLineForJob(null); }
  };

  const handleComplete = async (jobId: string) => {
    if (completingJobId === jobId) return;
    if (!await confirm({ title: "Mark job as Completed?", description: "A COGS journal will be posted.", confirmLabel: "Complete", variant: "warning" })) return;
    setCompletingJobId(jobId);
    try {
      const res = await api.post(`/jobs/${jobId}/complete`);
      const warn = res.data?.journalWarning;
      if (warn) setError(`Job completed — GL warning: ${warn}`);
      else flash("Job completed.");
      fetchAll();
    } catch (e: any) { setError(e?.response?.data?.error || "Failed to complete job."); }
    finally { setCompletingJobId(null); }
  };

  const handleCancel = async (jobId: string) => {
    if (!await confirm({ title: "Cancel this job?", confirmLabel: "Cancel Job" })) return;
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      flash("Job cancelled."); fetchAll();
    } catch (e: any) { setError(e?.response?.data?.error || "Failed to cancel job."); }
  };

  const totalCost = (job: Job) => (job.costLines || []).reduce((s, l) => s + Number(l.amount), 0);

function BudgetProgress({ job }: { job: Job }) {
  const budget = job.budget ? Number(job.budget) : null;
  const actual = totalCost(job);
  if (!budget) return null;
  const pct = Math.min((actual / budget) * 100, 100);
  const over = actual > budget;
  return (
    <div className="px-4 pb-3 pt-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Budget usage</span>
        <span className={over ? "text-red-600 font-medium" : ""}>{pct.toFixed(0)}% {over ? "(over budget)" : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase size={22} /> Job Costing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track material, labour, overhead, and subcontract costs per job. WIP journals post automatically.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Plus size={14} /> New Job</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm"><AlertCircle size={15} /> {error}</div>}
      {success && <div className="flex items-center gap-2 text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm"><CheckCircle size={15} /> {success}</div>}

      {showCreate && (
        <div className="border rounded-lg p-5 bg-white dark:bg-secondary-800 dark:border-gray-700 space-y-4">
          <h2 className="text-sm font-semibold">New Job</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Job Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Customer</label>
              <select value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600">
                <option value="">No customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Deadline</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Budget (optional)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          placeholder="Search job name or customer…"
          className="w-full border rounded pl-8 pr-3 py-2 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600"
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
        />
      </div>

      {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}
      {!loading && jobs.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No jobs yet.</div>}
      {!loading && jobs.length > 0 && displayedJobs.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No jobs match the search.</div>}

      {displayedJobs.map((job) => (
        <div key={job.id} className="border rounded-lg bg-white dark:bg-secondary-800 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setExpandedId(expandedId === job.id ? null : job.id)} className="text-gray-400 shrink-0">
                {expandedId === job.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{job.jobNumber}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{job.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] || ""}`}>{job.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                  {job.budget && (
                    <span className="flex items-center gap-0.5">
                      <TrendingUp size={11} />Budget: {Number(job.budget).toFixed(2)}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5"><DollarSign size={11} />Cost: {totalCost(job).toFixed(2)}</span>
                  <span>{job.costLines.length} line{job.costLines.length !== 1 ? "s" : ""}</span>
                  {job.endDate && (
                    <span className="flex items-center gap-0.5"><Calendar size={11} />Due: {new Date(job.endDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {(job.status === "OPEN" || job.status === "IN_PROGRESS") && (
                <>
                  <button onClick={() => { setLineJobId(lineJobId === job.id ? null : job.id); setExpandedId(job.id); }} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">+ Cost Line</button>
                  <button onClick={() => handleComplete(job.id)} disabled={completingJobId === job.id} className="text-xs px-2 py-1 border border-green-300 text-green-700 rounded hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed">{completingJobId === job.id ? "Completing…" : "Complete"}</button>
                  <button onClick={() => handleCancel(job.id)} className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Cancel</button>
                </>
              )}
            </div>
          </div>

          <BudgetProgress job={job} />

          {expandedId === job.id && (
            <div className="border-t dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                      {["Type", "Description", "Qty", "Unit Cost", "Amount"].map((h) => (
                        <th key={h} className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {job.costLines.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">No cost lines yet.</td></tr>
                    )}
                    {job.costLines.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-xs font-mono">{l.type}</td>
                        <td className="px-4 py-2">{l.description}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{Number(l.unitCost).toFixed(4)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{Number(l.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {job.costLines.length > 0 && (
                      <tr className="bg-gray-50 dark:bg-gray-700/20 font-semibold">
                        <td colSpan={4} className="px-4 py-2 text-right text-xs">Total</td>
                        <td className="px-4 py-2 text-right tabular-nums">{totalCost(job).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add cost line inline form */}
              {lineJobId === job.id && (
                <div className="border-t dark:border-gray-700 p-4 bg-blue-50 dark:bg-blue-900/10 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Add Cost Line</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select value={newLine.type} onChange={(e) => setNewLine((n) => ({ ...n, type: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600">
                        {COST_LINE_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Description *</label>
                      <input value={newLine.description} onChange={(e) => setNewLine((n) => ({ ...n, description: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Account (optional)</label>
                      <select value={newLine.accountId} onChange={(e) => setNewLine((n) => ({ ...n, accountId: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600">
                        <option value="">Auto-resolve</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Quantity *</label>
                      <input type="number" min="0.0001" step="0.0001" value={newLine.quantity} onChange={(e) => setNewLine((n) => ({ ...n, quantity: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit Cost *</label>
                      <input type="number" min="0" step="0.01" value={newLine.unitCost} onChange={(e) => setNewLine((n) => ({ ...n, unitCost: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-secondary-800 dark:border-secondary-600" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddLine(job.id)} disabled={addingLineForJob === job.id} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{addingLineForJob === job.id ? "Adding…" : "Add Line"}</button>
                    <button onClick={() => setLineJobId(null)} className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
