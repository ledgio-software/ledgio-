import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Plus, X, ChevronRight, ChevronLeft, Check, Edit2, Trash2, ClipboardList } from 'lucide-react';

// ── IEF Framework (mirrors backend constant) ───────────────────────────────────
const IEF_FRAMEWORK = [
  {
    code: 'D1',
    domain: 'Leadership & Management',
    color: 'blue',
    indicators: [
      { code: 'D1.1', label: 'School vision, mission and values' },
      { code: 'D1.2', label: 'School improvement planning' },
      { code: 'D1.3', label: 'Teacher management and deployment' },
      { code: 'D1.4', label: 'Resource management and accountability' },
      { code: 'D1.5', label: 'Monitoring, evaluation and review' },
    ],
  },
  {
    code: 'D2',
    domain: 'Teaching & Learning',
    color: 'emerald',
    indicators: [
      { code: 'D2.1', label: 'Lesson preparation and scheme of work' },
      { code: 'D2.2', label: 'Curriculum coverage and delivery' },
      { code: 'D2.3', label: 'Assessment of and for learning' },
      { code: 'D2.4', label: 'Inclusive classroom practices' },
      { code: 'D2.5', label: 'Learning environment and resources' },
    ],
  },
  {
    code: 'D3',
    domain: 'Learner Development & Support',
    color: 'purple',
    indicators: [
      { code: 'D3.1', label: 'Learner welfare and safeguarding' },
      { code: 'D3.2', label: 'Guidance and counselling services' },
      { code: 'D3.3', label: 'Co-curricular and extra-curricular activities' },
      { code: 'D3.4', label: 'Health, nutrition and hygiene' },
      { code: 'D3.5', label: 'Special educational needs support' },
    ],
  },
  {
    code: 'D4',
    domain: 'Partnership, Collaboration & Communication',
    color: 'amber',
    indicators: [
      { code: 'D4.1', label: 'Parental and community engagement' },
      { code: 'D4.2', label: 'Stakeholder collaboration' },
      { code: 'D4.3', label: 'Communication systems and channels' },
      { code: 'D4.4', label: 'External partnerships and networks' },
    ],
  },
] as const;

const SCORE_LABELS: Record<number, string> = { 1: 'Inadequate', 2: 'Adequate', 3: 'Good', 4: 'Outstanding' };
const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  3: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  4: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};
const DOMAIN_BG: Record<string, string> = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
};
const DOMAIN_TEXT: Record<string, string> = {
  blue: 'text-blue-700 dark:text-blue-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  purple: 'text-purple-700 dark:text-purple-300',
  amber: 'text-amber-700 dark:text-amber-300',
};

function overallLabelColor(label: string) {
  if (label === 'Outstanding') return 'text-emerald-600 dark:text-emerald-400';
  if (label === 'Good')        return 'text-blue-600 dark:text-blue-400';
  if (label === 'Adequate')    return 'text-amber-600 dark:text-amber-400';
  if (label === 'Inadequate')  return 'text-red-600 dark:text-red-400';
  return 'text-secondary-500';
}

interface DomainScore { code: string; domain: string; avg: number | null; rated: number; total: number }
interface Assessment {
  id: string;
  title: string;
  date: string;
  status: string;
  ratedCount: number;
  overallAvg: number | null;
  overallLabel: string;
  domainScores: DomainScore[];
}
interface Rating { id: string; indicatorCode: string; score: number; notes: string | null }
interface DetailedAssessment extends Assessment { ratings: Rating[] }

// ── Domain score bar ──────────────────────────────────────────────────────────
function DomainBar({ score, color }: { score: DomainScore; color: string }) {
  const pct = score.avg ? ((score.avg - 1) / 3) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-medium ${DOMAIN_TEXT[color]}`}>{score.domain}</span>
        <span className="text-xs text-secondary-500 tabular-nums">
          {score.avg ? score.avg.toFixed(1) : '—'} ({score.rated}/{score.total})
        </span>
      </div>
      <div className="h-2 bg-secondary-200 dark:bg-secondary-700 rounded-full">
        <div className={`h-2 rounded-full ${DOMAIN_BG[color]} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Assessment form ───────────────────────────────────────────────────────────
function AssessmentForm({ assessment, onClose, onSaved }: {
  assessment: DetailedAssessment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of assessment.ratings) m[r.indicatorCode] = r.score;
    return m;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const r of assessment.ratings) if (r.notes) m[r.indicatorCode] = r.notes;
    return m;
  });
  const [saving, setSaving] = useState(false);

  const domain = IEF_FRAMEWORK[tab];
  const totalDomains = IEF_FRAMEWORK.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const ratings = Object.entries(scores).map(([indicatorCode, score]) => ({
        indicatorCode, score, notes: notes[indicatorCode] || undefined,
      }));
      await api.put(`/school/nasia/assessments/${assessment.id}/ratings`, { ratings });
      showToast('Ratings saved.', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save ratings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const domainRated = domain.indicators.filter((i) => scores[i.code]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">{assessment.title}</h3>
            <p className="text-xs text-secondary-500 dark:text-secondary-400">NaSIA IEF Self-Assessment</p>
          </div>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Domain tabs */}
        <div className="flex gap-0 border-b border-secondary-200 dark:border-secondary-700 shrink-0 overflow-x-auto">
          {IEF_FRAMEWORK.map((d, i) => {
            const rated = d.indicators.filter((ind) => scores[ind.code]).length;
            return (
              <button
                key={d.code}
                onClick={() => setTab(i)}
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === i
                    ? `border-primary-600 text-primary-700 dark:text-primary-300 dark:border-primary-400`
                    : 'border-transparent text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300'
                }`}
              >
                {d.code} · {d.domain.split(' ')[0]}
                {rated === d.indicators.length && <Check className="inline h-3 w-3 ml-1 text-emerald-500" />}
              </button>
            );
          })}
        </div>

        {/* Indicators */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-semibold ${DOMAIN_TEXT[domain.color]}`}>{domain.domain}</p>
            <span className="text-xs text-secondary-500">{domainRated}/{domain.indicators.length} rated</span>
          </div>
          {domain.indicators.map((ind) => (
            <div key={ind.code} className="space-y-2">
              <p className="text-sm text-secondary-800 dark:text-secondary-200">
                <span className="font-mono text-xs text-secondary-400 mr-1">{ind.code}</span>
                {ind.label}
              </p>
              <div className="flex gap-2 flex-wrap">
                {([1, 2, 3, 4] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScores((prev) => ({ ...prev, [ind.code]: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      scores[ind.code] === s
                        ? `${SCORE_COLORS[s]} border-transparent ring-2 ring-offset-1 ring-current`
                        : 'border-secondary-200 dark:border-secondary-700 text-secondary-600 dark:text-secondary-400 hover:border-secondary-400'
                    }`}
                  >
                    {s} – {SCORE_LABELS[s]}
                  </button>
                ))}
              </div>
              {scores[ind.code] && (
                <input
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-secondary-200 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300 placeholder:text-secondary-400"
                  placeholder="Evidence / notes (optional)"
                  value={notes[ind.code] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [ind.code]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-200 dark:border-secondary-700 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setTab((t) => Math.max(0, t - 1))}
              disabled={tab === 0}
              className="flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />Prev
            </button>
            <button
              onClick={() => setTab((t) => Math.min(totalDomains - 1, t + 1))}
              disabled={tab === totalDomains - 1}
              className="flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700 disabled:opacity-30"
            >
              Next<ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Ratings'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function NasiaDashboard() {
  const { showToast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10) });
  const [creating, setCreating] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<DetailedAssessment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/school/nasia/assessments');
      setAssessments(r.data.data.assessments);
    } catch {
      showToast('Failed to load assessments.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newForm.title.trim() || !newForm.date) {
      showToast('Title and date are required.', 'error');
      return;
    }
    setCreating(true);
    try {
      const r = await api.post('/school/nasia/assessments', newForm);
      showToast('Assessment created.', 'success');
      setShowNewModal(false);
      setNewForm({ title: '', date: new Date().toISOString().slice(0, 10) });
      // Open the new assessment immediately for rating
      const id = r.data.data.assessment.id;
      const det = await api.get(`/school/nasia/assessments/${id}`);
      setEditingAssessment(det.data.data.assessment);
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to create.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openAssessment = async (id: string) => {
    try {
      const r = await api.get(`/school/nasia/assessments/${id}`);
      setEditingAssessment(r.data.data.assessment);
    } catch {
      showToast('Failed to load assessment.', 'error');
    }
  };

  const handleMarkComplete = async (a: Assessment) => {
    try {
      await api.put(`/school/nasia/assessments/${a.id}`, { status: a.status === 'completed' ? 'draft' : 'completed' });
      load();
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  const handleDelete = async (a: Assessment) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/school/nasia/assessments/${a.id}`);
      showToast('Assessment deleted.', 'success');
      load();
    } catch {
      showToast('Failed to delete.', 'error');
    }
  };

  const latest = assessments[0] ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">NaSIA Dashboard</h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">
            Self-assessment against Ghana's Inspection Evaluation Framework (IEF) — 4 domains, 19 indicators.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />New Assessment
        </Button>
      </div>

      {/* Latest assessment overview */}
      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Latest: {latest.title}</span>
                <span className={`text-sm font-normal ${overallLabelColor(latest.overallLabel)}`}>
                  {latest.overallLabel}
                  {latest.overallAvg && <span className="ml-1 text-xs tabular-nums">({latest.overallAvg.toFixed(1)}/4.0)</span>}
                </span>
              </CardTitle>
              <p className="text-xs text-secondary-500">{new Date(latest.date).toLocaleDateString()} · {latest.ratedCount} indicators rated</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {IEF_FRAMEWORK.map((d) => {
                const ds = latest.domainScores.find((x) => x.code === d.code);
                return ds ? <DomainBar key={d.code} score={ds} color={d.color} /> : null;
              })}
            </CardContent>
          </Card>

          {/* Score legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">NaSIA Rating Scale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([4, 3, 2, 1] as const).map((s) => (
                <div key={s} className="flex items-start gap-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${SCORE_COLORS[s]}`}>{s}</span>
                  <div>
                    <p className="text-sm font-medium text-secondary-800 dark:text-secondary-200">{SCORE_LABELS[s]}</p>
                    <p className="text-xs text-secondary-500">
                      {s === 4 && 'Exemplary practice; a model for others. All indicators met at a high standard.'}
                      {s === 3 && 'Meets expectations with clear strengths. Minor areas for improvement.'}
                      {s === 2 && 'Partially meets expectations. Significant improvement is required.'}
                      {s === 1 && 'Falls well below expectations. Urgent and substantial improvement needed.'}
                    </p>
                  </div>
                </div>
              ))}
              <div className="border-t dark:border-secondary-700 pt-3 text-xs text-secondary-500">
                Overall score is the mean of all rated indicators. Scores ≥ 3.5 = Outstanding · ≥ 2.5 = Good · ≥ 1.5 = Adequate · &lt; 1.5 = Inadequate.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assessment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assessment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-secondary-400 text-sm">Loading…</div>
          ) : assessments.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList className="h-10 w-10 text-secondary-300 dark:text-secondary-600 mx-auto mb-3" />
              <p className="text-sm text-secondary-500 dark:text-secondary-400">No assessments yet. Create your first NaSIA self-assessment to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/50">
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Assessment</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Overall</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Domain Scores</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-b border-secondary-100 dark:border-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-secondary-900 dark:text-secondary-50">{a.title}</td>
                      <td className="px-4 py-3 text-secondary-500">{new Date(a.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {a.overallAvg ? (
                          <span className={`font-semibold ${overallLabelColor(a.overallLabel)}`}>
                            {a.overallAvg.toFixed(1)} <span className="font-normal text-xs">({a.overallLabel})</span>
                          </span>
                        ) : <span className="text-secondary-400 text-xs">Not rated</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {IEF_FRAMEWORK.map((d) => {
                            const ds = a.domainScores.find((x) => x.code === d.code);
                            return (
                              <span key={d.code} title={d.domain} className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${ds?.avg ? SCORE_COLORS[Math.round(ds.avg)] : 'bg-secondary-100 text-secondary-400 dark:bg-secondary-800'}`}>
                                {ds?.avg ? ds.avg.toFixed(1) : '—'}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400'}`}>
                          {a.status === 'completed' ? 'Completed' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openAssessment(a.id)} className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-primary-600 transition-colors" title="Edit ratings">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleMarkComplete(a)} className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-emerald-600 transition-colors" title={a.status === 'completed' ? 'Revert to draft' : 'Mark complete'}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(a)} className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New assessment modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">New Self-Assessment</h3>
              <button onClick={() => setShowNewModal(false)} className="text-secondary-400 hover:text-secondary-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Title *</label>
                <Input
                  value={newForm.title}
                  onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="e.g. Term 2 2026 Self-Assessment"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Assessment Date *</label>
                <Input type="date" value={newForm.date} onChange={(e) => setNewForm({ ...newForm, date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-200 dark:border-secondary-700">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create & Rate'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rating form */}
      {editingAssessment && (
        <AssessmentForm
          assessment={editingAssessment}
          onClose={() => setEditingAssessment(null)}
          onSaved={() => { setEditingAssessment(null); load(); }}
        />
      )}
    </div>
  );
}
