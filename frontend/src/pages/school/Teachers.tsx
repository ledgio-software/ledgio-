import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Plus, Edit2, X, Trash2, AlertTriangle, ShieldCheck, Clock, BookOpen } from 'lucide-react';

const CPD_CATEGORIES = ['WORKSHOP', 'CONFERENCE', 'ONLINE_COURSE', 'PGDE', 'SEMINAR', 'SCHOOL_BASED', 'OTHER'] as const;
type CpdCategory = typeof CPD_CATEGORIES[number];

interface Teacher {
  id: string;
  staffId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  className: string | null;
  ntcLicenseNo: string | null;
  ntcIssueDate: string | null;
  ntcExpiryDate: string | null;
  isActive: boolean;
  licenseStatus: 'valid' | 'expiring' | 'expired' | 'none';
  cpdHoursThisYear: number;
  cpdTargetYear: number;
}

interface Summary {
  total: number;
  licensed: number;
  expiringSoon: number;
  expired: number;
  noLicense: number;
  cpdCompliant: number;
}

interface CpdActivity {
  id: string;
  title: string;
  category: CpdCategory;
  date: string;
  hours: number;
  provider: string | null;
  certificate: string | null;
}

const BLANK_TEACHER = {
  firstName: '', lastName: '', staffId: '', email: '', phone: '',
  subject: '', className: '', ntcLicenseNo: '', ntcIssueDate: '', ntcExpiryDate: '',
};

const BLANK_CPD = { title: '', category: 'WORKSHOP' as CpdCategory, date: '', hours: '', provider: '', certificate: '' };

function licenseStatusBadge(status: Teacher['licenseStatus']) {
  switch (status) {
    case 'valid':    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Licensed</span>;
    case 'expiring': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><Clock className="h-3 w-3" />Expiring</span>;
    case 'expired':  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"><AlertTriangle className="h-3 w-3" />Expired</span>;
    default:         return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">No License</span>;
  }
}

function CpdBar({ hours, target }: { hours: number; target: number }) {
  const pct = Math.min(100, (hours / target) * 100);
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 bg-secondary-200 dark:bg-secondary-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums whitespace-nowrap text-secondary-600 dark:text-secondary-400">
        {hours}/{target}h
      </span>
    </div>
  );
}

export function Teachers() {
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ ...BLANK_TEACHER });
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // CPD panel state
  const [cpdTeacherId, setCpdTeacherId] = useState<string | null>(null);
  const [cpdTeacherName, setCpdTeacherName] = useState('');
  const [activities, setActivities] = useState<CpdActivity[]>([]);
  const [cpdLoading, setCpdLoading] = useState(false);
  const [cpdForm, setCpdForm] = useState({ ...BLANK_CPD });
  const [addingCpd, setAddingCpd] = useState(false);
  const [cpdSaving, setCpdSaving] = useState(false);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/school/teachers');
      setTeachers(r.data.data.teachers);
      setSummary(r.data.data.summary);
    } catch {
      showToast('Failed to load teachers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const openAdd = () => {
    setEditTeacher(null);
    setForm({ ...BLANK_TEACHER });
    setShowModal(true);
  };

  const openEdit = (t: Teacher) => {
    setEditTeacher(t);
    setForm({
      firstName: t.firstName,
      lastName: t.lastName,
      staffId: t.staffId ?? '',
      email: t.email ?? '',
      phone: t.phone ?? '',
      subject: t.subject ?? '',
      className: t.className ?? '',
      ntcLicenseNo: t.ntcLicenseNo ?? '',
      ntcIssueDate: t.ntcIssueDate ? t.ntcIssueDate.slice(0, 10) : '',
      ntcExpiryDate: t.ntcExpiryDate ? t.ntcExpiryDate.slice(0, 10) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast('First name and last name are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editTeacher) {
        await api.put(`/school/teachers/${editTeacher.id}`, form);
        showToast('Teacher updated.', 'success');
      } else {
        await api.post('/school/teachers', form);
        showToast('Teacher added.', 'success');
      }
      setShowModal(false);
      loadTeachers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (t: Teacher) => {
    if (!window.confirm(`Deactivate ${t.firstName} ${t.lastName}? They will be hidden from active lists.`)) return;
    try {
      await api.delete(`/school/teachers/${t.id}`);
      showToast('Teacher deactivated.', 'success');
      loadTeachers();
    } catch {
      showToast('Failed to deactivate.', 'error');
    }
  };

  const openCpd = async (t: Teacher) => {
    setCpdTeacherId(t.id);
    setCpdTeacherName(`${t.firstName} ${t.lastName}`);
    setAddingCpd(false);
    setCpdForm({ ...BLANK_CPD });
    setCpdLoading(true);
    try {
      const r = await api.get(`/school/teachers/${t.id}/cpd`);
      setActivities(r.data.data.activities);
    } catch {
      showToast('Failed to load CPD activities.', 'error');
    } finally {
      setCpdLoading(false);
    }
  };

  const handleAddCpd = async () => {
    if (!cpdForm.title.trim() || !cpdForm.date || !cpdForm.hours) {
      showToast('Title, date, and hours are required.', 'error');
      return;
    }
    setCpdSaving(true);
    try {
      await api.post(`/school/teachers/${cpdTeacherId}/cpd`, {
        ...cpdForm,
        hours: Number(cpdForm.hours),
      });
      showToast('CPD activity recorded.', 'success');
      setCpdForm({ ...BLANK_CPD });
      setAddingCpd(false);
      const r = await api.get(`/school/teachers/${cpdTeacherId}/cpd`);
      setActivities(r.data.data.activities);
      loadTeachers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save activity.', 'error');
    } finally {
      setCpdSaving(false);
    }
  };

  const handleDeleteCpd = async (activityId: string) => {
    if (!window.confirm('Delete this CPD activity?')) return;
    try {
      await api.delete(`/school/teachers/${cpdTeacherId}/cpd/${activityId}`);
      showToast('Activity deleted.', 'success');
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
      loadTeachers();
    } catch {
      showToast('Failed to delete.', 'error');
    }
  };

  const visible = teachers.filter((t) => showInactive ? true : t.isActive);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary-900 dark:text-secondary-50">Teacher Registry</h2>
          <p className="text-secondary-500 dark:text-secondary-400 mt-1">NTC licence tracking and CPD hours management.</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />Add Teacher
        </Button>
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Active', value: summary.total, color: 'text-secondary-900 dark:text-secondary-50' },
            { label: 'Licensed', value: summary.licensed, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Expiring Soon', value: summary.expiringSoon, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Expired', value: summary.expired, color: 'text-red-600 dark:text-red-400' },
            { label: 'No License', value: summary.noLicense, color: 'text-secondary-500 dark:text-secondary-400' },
            { label: 'CPD Compliant', value: summary.cpdCompliant, color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teacher table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Teachers</CardTitle>
          <label className="flex items-center gap-2 text-xs text-secondary-500 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-secondary-400 text-sm">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-secondary-400 text-sm">No teachers found. Add your first teacher above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/50">
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Subject / Class</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">NTC Licence</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-secondary-600 dark:text-secondary-400">CPD This Year</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id}
                      className={`border-b border-secondary-100 dark:border-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-800/30 transition-colors ${!t.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-secondary-900 dark:text-secondary-50">{t.firstName} {t.lastName}</div>
                        {t.staffId && <div className="text-xs text-secondary-500">{t.staffId}</div>}
                      </td>
                      <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">
                        <div>{t.subject ?? '—'}</div>
                        {t.className && <div className="text-xs">{t.className}</div>}
                      </td>
                      <td className="px-4 py-3 text-secondary-600 dark:text-secondary-400">
                        <div>{t.ntcLicenseNo ?? '—'}</div>
                        {t.ntcExpiryDate && (
                          <div className="text-xs">Expires {new Date(t.ntcExpiryDate).toLocaleDateString()}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{licenseStatusBadge(t.licenseStatus)}</td>
                      <td className="px-4 py-3">
                        <CpdBar hours={t.cpdHoursThisYear} target={t.cpdTargetYear} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openCpd(t)}
                            className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-primary-600 transition-colors"
                            title="CPD Activities"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-primary-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {t.isActive && (
                            <button
                              onClick={() => handleDeactivate(t)}
                              className="p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500 hover:text-red-600 transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      {/* Add/Edit Teacher Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">
                {editTeacher ? 'Edit Teacher' : 'Add Teacher'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">First Name *</label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Ama" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Last Name *</label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Mensah" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Staff ID</label>
                  <Input value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} placeholder="GES-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Subject</label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ama@school.edu.gh" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0244000000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Class Assigned</label>
                <Input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="JHS 2A" />
              </div>
              <div className="border-t border-secondary-200 dark:border-secondary-700 pt-4">
                <p className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-3 uppercase tracking-wide">NTC Licence Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Licence Number</label>
                    <Input value={form.ntcLicenseNo} onChange={(e) => setForm({ ...form, ntcLicenseNo: e.target.value })} placeholder="NTC/0001/2022" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Issue Date</label>
                    <Input type="date" value={form.ntcIssueDate} onChange={(e) => setForm({ ...form, ntcIssueDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Expiry Date</label>
                    <Input type="date" value={form.ntcExpiryDate} onChange={(e) => setForm({ ...form, ntcExpiryDate: e.target.value })} />
                  </div>
                </div>
              </div>
              {editTeacher && (
                <div className="border-t border-secondary-200 dark:border-secondary-700 pt-4">
                  <label className="flex items-center gap-2 text-sm text-secondary-700 dark:text-secondary-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form as any).isActive ?? editTeacher.isActive}
                      onChange={(e) => setForm({ ...form, ...(e.target.checked ? {} : {}), ...(({ isActive: e.target.checked }) as any) })}
                      className="rounded"
                    />
                    Teacher is active
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-200 dark:border-secondary-700">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* CPD Activities Panel */}
      {cpdTeacherId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">CPD Activities</h3>
                <p className="text-xs text-secondary-500 dark:text-secondary-400">{cpdTeacherName}</p>
              </div>
              <button onClick={() => setCpdTeacherId(null)} className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {cpdLoading ? (
                <div className="text-center text-secondary-400 text-sm py-6">Loading…</div>
              ) : activities.length === 0 && !addingCpd ? (
                <p className="text-sm text-secondary-500 dark:text-secondary-400 text-center py-4">No CPD activities recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-secondary-200 dark:border-secondary-700">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-secondary-900 dark:text-secondary-50">{a.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{a.category.replace('_', ' ')}</span>
                          <span className="text-xs text-secondary-500">{new Date(a.date).toLocaleDateString()}</span>
                          <span className="text-xs font-medium text-secondary-700 dark:text-secondary-300">{a.hours}h</span>
                          {a.provider && <span className="text-xs text-secondary-500">{a.provider}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCpd(a.id)} className="text-secondary-400 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingCpd ? (
                <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-secondary-700 dark:text-secondary-300">New CPD Activity</p>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Title *</label>
                    <Input value={cpdForm.title} onChange={(e) => setCpdForm({ ...cpdForm, title: e.target.value })} placeholder="Maths Teaching Workshop" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Category *</label>
                      <select
                        value={cpdForm.category}
                        onChange={(e) => setCpdForm({ ...cpdForm, category: e.target.value as CpdCategory })}
                        className="w-full rounded-lg border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-50"
                      >
                        {CPD_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Hours *</label>
                      <Input type="number" min="0.5" max="200" step="0.5" value={cpdForm.hours} onChange={(e) => setCpdForm({ ...cpdForm, hours: e.target.value })} placeholder="8" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Date *</label>
                      <Input type="date" value={cpdForm.date} onChange={(e) => setCpdForm({ ...cpdForm, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Provider</label>
                      <Input value={cpdForm.provider} onChange={(e) => setCpdForm({ ...cpdForm, provider: e.target.value })} placeholder="GES / NTC" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Certificate Ref.</label>
                    <Input value={cpdForm.certificate} onChange={(e) => setCpdForm({ ...cpdForm, certificate: e.target.value })} placeholder="CERT-2025-001" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="primary" onClick={handleAddCpd} disabled={cpdSaving}>{cpdSaving ? 'Saving…' : 'Save Activity'}</Button>
                    <Button variant="outline" onClick={() => { setAddingCpd(false); setCpdForm({ ...BLANK_CPD }); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCpd(true)}
                  className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                >
                  <Plus className="h-4 w-4" />Log CPD Activity
                </button>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-secondary-200 dark:border-secondary-700">
              <Button variant="outline" onClick={() => setCpdTeacherId(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
