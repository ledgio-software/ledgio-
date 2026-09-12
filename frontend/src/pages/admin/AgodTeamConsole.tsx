import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  BarChart2, Activity, Briefcase, Link2, Database, FileText,
  MessageSquare, TrendingUp, Zap, Shield,
  Gift, Heart, UserMinus, BookOpen, DollarSign, Radio,
  Bug, LogOut, User, Search, CreditCard, Ticket, Clock,
  GitBranch, Users, RefreshCw, AlertTriangle, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Plus, Pencil,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  assignedTabs: string[];
}

type TabId =
  | 'broadcast' | 'health' | 'performance' | 'jobs' | 'integrations'
  | 'schemas' | 'audit' | 'onboard' | 'feedback' | 'analytics' | 'errors'
  | 'safety' | 'referral' | 'clienthealth' | 'churnrisk' | 'onboarding'
  | 'revenue' | 'debuglogs'
  | 'tenantinspector' | 'failedpayments' | 'supportqueue' | 'slowqueries'
  | 'schemadiff' | 'cohort';

const TAB_META: Record<TabId, { label: string; icon: ReactNode; accent: string }> = {
  broadcast:       { label: 'Broadcast',        icon: <Radio className="h-4 w-4" />,        accent: 'text-amber-400 border-amber-400' },
  health:          { label: 'Health',            icon: <Activity className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  performance:     { label: 'Performance',       icon: <BarChart2 className="h-4 w-4" />,     accent: 'text-amber-400 border-amber-400' },
  jobs:            { label: 'Jobs',              icon: <Briefcase className="h-4 w-4" />,     accent: 'text-amber-400 border-amber-400' },
  integrations:    { label: 'Integrations',      icon: <Link2 className="h-4 w-4" />,         accent: 'text-amber-400 border-amber-400' },
  schemas:         { label: 'Schemas',           icon: <Database className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  audit:           { label: 'Audit Logs',        icon: <FileText className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  onboard:         { label: 'Onboard',           icon: <BookOpen className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  feedback:        { label: 'Feedback',          icon: <MessageSquare className="h-4 w-4" />, accent: 'text-amber-400 border-amber-400' },
  analytics:       { label: 'Analytics',         icon: <TrendingUp className="h-4 w-4" />,    accent: 'text-amber-400 border-amber-400' },
  errors:          { label: 'Error Logs',        icon: <Zap className="h-4 w-4" />,           accent: 'text-amber-400 border-amber-400' },
  safety:          { label: 'Safety',            icon: <Shield className="h-4 w-4" />,        accent: 'text-red-400 border-red-500' },
  referral:        { label: 'Referrals',         icon: <Gift className="h-4 w-4" />,          accent: 'text-amber-400 border-amber-400' },
  clienthealth:    { label: 'Client Health',     icon: <Heart className="h-4 w-4" />,         accent: 'text-emerald-400 border-emerald-400' },
  churnrisk:       { label: 'Churn Risk',        icon: <UserMinus className="h-4 w-4" />,     accent: 'text-rose-400 border-rose-400' },
  onboarding:      { label: 'Onboarding Intel',  icon: <BookOpen className="h-4 w-4" />,      accent: 'text-violet-400 border-violet-400' },
  revenue:         { label: 'Revenue',           icon: <DollarSign className="h-4 w-4" />,    accent: 'text-cyan-400 border-cyan-400' },
  debuglogs:       { label: 'Debug Logs',        icon: <Bug className="h-4 w-4" />,           accent: 'text-violet-400 border-violet-400' },
  // New panels
  tenantinspector: { label: 'Tenant Inspector',  icon: <Search className="h-4 w-4" />,        accent: 'text-sky-400 border-sky-400' },
  failedpayments:  { label: 'Failed Payments',   icon: <CreditCard className="h-4 w-4" />,    accent: 'text-rose-400 border-rose-400' },
  supportqueue:    { label: 'Support Queue',     icon: <Ticket className="h-4 w-4" />,        accent: 'text-orange-400 border-orange-400' },
  slowqueries:     { label: 'Slow Queries',      icon: <Clock className="h-4 w-4" />,         accent: 'text-yellow-400 border-yellow-400' },
  schemadiff:      { label: 'Schema Diff',       icon: <GitBranch className="h-4 w-4" />,     accent: 'text-emerald-400 border-emerald-400' },
  cohort:          { label: 'Cohort View',       icon: <Users className="h-4 w-4" />,         accent: 'text-indigo-400 border-indigo-400' },
};

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-400', cyan: 'text-cyan-400', emerald: 'text-emerald-400',
  rose: 'text-rose-400', violet: 'text-violet-400', amber: 'text-amber-400',
  indigo: 'text-indigo-400', slate: 'text-slate-300',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Static placeholder (tabs with no live endpoint) ──────────────────────────
function NoDataPanel({ tab }: { tab: TabId }) {
  const meta = TAB_META[tab];
  return (
    <div className="p-6">
      <PanelHeader tab={tab} />
      <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
        <div className="opacity-30">{meta.icon}</div>
        <p className="text-sm">No live data endpoint for this panel.</p>
      </div>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-white/30 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Performance Panel ─────────────────────────────────────────────────────────
function PerformancePanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/metrics', teamToken);

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="p-6">
      <PanelHeader tab="performance">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Requests" value={data.requests.toLocaleString()} />
            <StatTile label="Avg Latency" value={`${data.avgLatencyMs}ms`} color={data.avgLatencyMs > 500 ? 'text-amber-400' : 'text-emerald-400'} />
            <StatTile label="Error Rate" value={`${(data.errorRate * 100).toFixed(1)}%`} color={data.errorRate > 0.01 ? 'text-rose-400' : 'text-emerald-400'} />
            <StatTile label="Uptime" value={fmtUptime(data.uptime)} sub={data.nodeVersion} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-white/40 text-xs mb-1">Heap Used</p>
              <p className="text-white text-lg font-bold">{data.memory?.heapUsedMb?.toFixed(1)} MB</p>
              <p className="text-white/20 text-xs">RSS {data.memory?.rssMb?.toFixed(1)} MB</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-white/40 text-xs mb-1">Total Errors</p>
              <p className={`text-lg font-bold ${data.errors > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{data.errors}</p>
              <p className="text-white/20 text-xs">since last restart</p>
            </div>
          </div>
          {data.buckets && data.buckets.length > 0 && (
            <>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Recent Buckets (5-min windows)</p>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Time</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Reqs</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Errors</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Avg ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.buckets].reverse().slice(0, 20).map((b: any, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 text-white/50 font-mono">{new Date(b.ts).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-right text-white/70">{b.requests}</td>
                        <td className={`px-3 py-2 text-right ${b.errors > 0 ? 'text-rose-400' : 'text-white/30'}`}>{b.errors}</td>
                        <td className="px-3 py-2 text-right text-white/50">{b.avgMs ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Error Logs Panel ──────────────────────────────────────────────────────────
function ErrorLogsPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/error-logs', teamToken);
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/error-logs', { headers: { 'x-team-token': teamToken } });
      reload();
    } catch { /* ignore */ } finally { setClearing(false); }
  };

  const entries: any[] = data?.errors ?? [];

  return (
    <div className="p-6">
      <PanelHeader tab="errors">
        <div className="ml-auto flex items-center gap-2">
          {entries.length > 0 && (
            <button onClick={clear} disabled={clearing}
              className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
              {clearing ? 'Clearing…' : 'Clear log'}
            </button>
          )}
          <button onClick={reload} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && data && (
        <>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-white/30 gap-2">
              <CheckCircle className="h-10 w-10" />
              <p className="text-sm">No errors in buffer.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-white/30 text-xs mb-3">{data.count} error{data.count !== 1 ? 's' : ''} in buffer</p>
              {entries.map((e: any, i: number) => (
                <div key={i} className="bg-rose-500/5 border border-rose-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-rose-300 text-sm font-medium line-clamp-2">{e.message ?? e.error ?? 'Unknown error'}</p>
                      {e.source && <p className="text-white/30 text-xs font-mono mt-0.5 truncate">{e.source}</p>}
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {e.count > 1 && <span className="text-amber-400 text-xs">{e.count}× occurrences</span>}
                        {e.route && <span className="text-white/30 text-xs font-mono">{e.route}</span>}
                        <span className="text-white/20 text-xs ml-auto">{e.lastSeen ? new Date(e.lastSeen).toLocaleString() : (e.ts ? new Date(e.ts).toLocaleString() : '')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Feedback Panel ────────────────────────────────────────────────────────────
const FEEDBACK_STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-500/20 text-amber-400',
  IN_REVIEW: 'bg-violet-500/20 text-violet-400',
  RESOLVED: 'bg-emerald-500/20 text-emerald-400',
  CLOSED: 'bg-white/10 text-white/40',
};

function FeedbackPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/feedback', teamToken);
  const items: any[] = data?.items ?? [];

  return (
    <div className="p-6">
      <PanelHeader tab="feedback">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && data && (
        <>
          {data.pagination && (
            <p className="text-white/30 text-xs mb-3">{data.pagination.total} feedback entries</p>
          )}
          {items.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">No feedback yet.</div>
          ) : (
            <div className="space-y-2">
              {items.map((f: any) => (
                <div key={f.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {f.category && (
                          <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded">{f.category}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${FEEDBACK_STATUS_STYLE[f.status] ?? 'bg-white/10 text-white/40'}`}>
                          {f.status}
                        </span>
                        {f.tenant?.name && (
                          <span className="text-white/30 text-xs">{f.tenant.name}</span>
                        )}
                        <span className="text-white/20 text-xs ml-auto">{new Date(f.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-white/70 text-sm mt-1.5 line-clamp-3">{f.message ?? f.content ?? f.body ?? '—'}</p>
                      {f.userEmail && <p className="text-white/25 text-xs mt-1">{f.userEmail}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
function AnalyticsPanel({ teamToken }: { teamToken: string }) {
  const [days, setDays] = useState(28);
  const endpoint = `/admin/analytics?days=${days}`;
  const { data, loading, err, reload } = useAdminFetch<any>(endpoint, teamToken, [days]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="p-6">
      <PanelHeader tab="analytics">
        <div className="ml-auto flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden text-xs">
            {[7, 28, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 transition-colors ${days === d ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={reload} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && data && !data.configured && (
        <div className="flex flex-col items-center py-16 text-white/30 gap-2">
          <TrendingUp className="h-10 w-10 opacity-30" />
          <p className="text-sm">Google Analytics not configured.</p>
          <p className="text-xs">Set GA_PROPERTY_ID and service-account credentials to enable.</p>
        </div>
      )}
      {!loading && data && data.configured && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Total Users" value={data.totalUsers?.toLocaleString() ?? '—'} color="text-sky-400" />
            <StatTile label="New Users" value={data.newUsers?.toLocaleString() ?? '—'} />
            <StatTile label="Sessions" value={data.sessions?.toLocaleString() ?? '—'} />
            <StatTile label="Page Views" value={data.pageViews?.toLocaleString() ?? '—'} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatTile label="Avg Session" value={fmtDuration(data.avgSessionDuration ?? 0)} />
            <StatTile label="Active Now" value={data.activeUsers ?? 0} color="text-emerald-400" />
          </div>

          {data.topPages?.length > 0 && (
            <div className="mb-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Top Pages</p>
              <div className="space-y-1">
                {data.topPages.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg text-xs">
                    <span className="text-white/20 w-4 text-right flex-shrink-0">{i + 1}</span>
                    <span className="text-white/60 font-mono flex-1 truncate">{p.page}</span>
                    <span className="text-white/40 flex-shrink-0">{p.views?.toLocaleString()} views</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.topCountries?.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Top Countries</p>
              <div className="flex flex-wrap gap-2">
                {data.topCountries.map((c: any, i: number) => (
                  <span key={i} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-white/60">{c.country}</span>
                    <span className="text-white/30 ml-1.5">{c.users}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Client Health Panel ───────────────────────────────────────────────────────
const CHURN_RISK_STYLE: Record<string, string> = {
  high: 'bg-rose-500/20 text-rose-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-emerald-500/20 text-emerald-400',
  none: 'bg-white/5 text-white/30',
};

function ClientHealthPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/client-health', teamToken);
  const tenants: any[] = data?.tenants ?? [];
  const s = data?.summary;

  return (
    <div className="p-6">
      <PanelHeader tab="clienthealth">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Total" value={s.totalTenants} />
            <StatTile label="Active" value={s.activeTenants} color="text-emerald-400" />
            <StatTile label="High Risk" value={s.highRiskTenants} color="text-rose-400" />
            <StatTile label="Dormant" value={s.dormantTenants} color="text-amber-400" />
          </div>
          <div className="space-y-1.5 max-h-[55vh] overflow-auto">
            {tenants.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">{t.name}</span>
                    <span className="text-white/25 text-xs">{t.slug}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-white/25 text-xs">Tier {t.tier}</span>
                    <span className="text-white/25 text-xs">{t.userCount} users</span>
                    {t.daysSinceActivity !== null && (
                      <span className={`text-xs ${t.daysSinceActivity >= 14 ? 'text-amber-400' : 'text-white/25'}`}>
                        active {t.daysSinceActivity}d ago
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${CHURN_RISK_STYLE[t.churnRisk] ?? 'bg-white/5 text-white/30'}`}>
                  {t.churnRisk}
                </span>
                <span className={`text-xs flex-shrink-0 ${t.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : t.subscriptionStatus === 'TRIAL' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {t.subscriptionStatus}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Churn Risk Panel ──────────────────────────────────────────────────────────
const BUCKET_LABEL: Record<string, string> = {
  expired: 'Expired', trial_critical: 'Trial Critical', trial_soon: 'Trial Soon',
  trial_watch: 'Trial Watch', renewal_soon: 'Renewal Soon', dormant: 'Dormant',
};
const BUCKET_STYLE: Record<string, string> = {
  expired: 'bg-red-500/20 text-red-400',
  trial_critical: 'bg-rose-500/20 text-rose-400',
  trial_soon: 'bg-orange-500/20 text-orange-400',
  renewal_soon: 'bg-amber-500/20 text-amber-400',
  dormant: 'bg-white/10 text-white/50',
  trial_watch: 'bg-sky-500/20 text-sky-400',
};

function ChurnRiskPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/churn-risk', teamToken);
  const tenants: any[] = data?.tenants ?? [];
  const s = data?.summary;

  return (
    <div className="p-6">
      <PanelHeader tab="churnrisk">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && s && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {([
              { k: 'expired', label: 'Expired', v: s.expired, c: 'text-red-400' },
              { k: 'tc', label: 'Trial Crit.', v: s.trialCritical, c: 'text-rose-400' },
              { k: 'ts', label: 'Trial Soon', v: s.trialSoon, c: 'text-orange-400' },
              { k: 'rs', label: 'Renewal', v: s.renewalSoon, c: 'text-amber-400' },
              { k: 'dm', label: 'Dormant', v: s.dormant, c: 'text-white/50' },
              { k: 'ni', label: 'Low Adopt.', v: s.notEmbedded, c: 'text-sky-400' },
            ] as const).map(({ k, label, v, c }) => (
              <div key={k} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-center">
                <p className={`text-lg font-bold ${c}`}>{v}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {tenants.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-white/30 gap-2">
              <CheckCircle className="h-8 w-8" />
              <p className="text-sm">No at-risk tenants.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[50vh] overflow-auto">
              {tenants.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm truncate">{t.name}</span>
                      <span className="text-white/25 text-xs">{t.slug}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs flex-wrap">
                      {t.trialDaysLeft !== null && <span className="text-white/30">trial ends {t.trialDaysLeft}d</span>}
                      {t.paidDaysLeft !== null && <span className="text-white/30">renews {t.paidDaysLeft}d</span>}
                      {t.daysSinceActivity !== null && <span className="text-white/30">active {t.daysSinceActivity}d ago</span>}
                      <span className="text-white/20">adopt {t.adoptionScore}/5</span>
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${BUCKET_STYLE[t.bucket] ?? 'bg-white/10 text-white/40'}`}>
                    {BUCKET_LABEL[t.bucket] ?? t.bucket}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Onboarding Intel Panel ────────────────────────────────────────────────────
const MILESTONE_LABELS: Record<string, string> = {
  teamMemberAdded: 'Team', firstJournalPosted: 'Journal',
  firstInvoiceSent: 'Invoice', firstSaleRecorded: 'Sale',
  firstInventoryItem: 'Inventory', bankConnected: 'Bank',
  firstReconciliation: 'Reconcile',
};

function OnboardingPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/onboarding', teamToken);
  const tenants: any[] = data?.tenants ?? [];
  const s = data?.summary;
  const totalSteps: number = data?.totalSteps ?? 8;

  return (
    <div className="p-6">
      <PanelHeader tab="onboarding">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Total" value={s.total} />
            <StatTile label="Fully Done" value={s.fullyOnboarded} color="text-emerald-400" />
            <StatTile label="Stuck" value={s.stuck} color="text-rose-400" />
            <StatTile label="Avg Completion" value={`${s.avgCompletionPct}%`} color="text-sky-400" />
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {tenants.map((t: any) => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{t.name}</span>
                      {t.isStuck && <span className="text-xs bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full flex-shrink-0">stuck</span>}
                    </div>
                    <p className="text-white/30 text-xs">{t.daysSinceSignup}d old · {t.userCount} users</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${t.completionPct >= 75 ? 'text-emerald-400' : t.completionPct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {t.completionPct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${t.completionPct >= 75 ? 'bg-emerald-500' : t.completionPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${t.completionPct}%` }}
                  />
                </div>
                {/* Milestone chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>Setup</span>
                  {t.milestoneDetail && Object.entries(t.milestoneDetail).map(([k, done]) => (
                    <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                      {MILESTONE_LABELS[k] ?? k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {tenants.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">No tenants yet.</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Revenue Panel ─────────────────────────────────────────────────────────────
function RevenuePanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/revenue', teamToken);
  const s = data?.summary;

  return (
    <div className="p-6">
      <PanelHeader tab="revenue">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && s && (
        <>
          {/* Big MRR/ARR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="MRR (GHS)" value={`₵${s.mrr.toLocaleString()}`} color="text-cyan-400" />
            <StatTile label="ARR (proj.)" value={`₵${s.arr.toLocaleString()}`} color="text-cyan-300" />
            <StatTile label="Trial Pipeline" value={`₵${s.trialPipelineValue.toLocaleString()}`} color="text-amber-400" />
            <StatTile label="At Risk" value={`₵${s.revenueAtRisk.toLocaleString()}`} color={s.revenueAtRisk > 0 ? 'text-rose-400' : 'text-white/30'} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Active Paid" value={s.activePaid} color="text-emerald-400" />
            <StatTile label="On Trial" value={s.trial} color="text-amber-400" />
            <StatTile label="Expired" value={s.expired} color={s.expired > 0 ? 'text-rose-400' : 'text-white/30'} />
            <StatTile label="Conversion" value={`${s.trialConversionRate}%`} />
          </div>

          {/* Tier breakdown */}
          {data.tierBreakdown?.length > 0 && (
            <div className="mb-6">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Tier Breakdown</p>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Plan</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Price</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Tenants</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tierBreakdown.map((t: any) => (
                      <tr key={t.tier} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white/70">{t.name}</td>
                        <td className="px-3 py-2 text-right text-white/50">₵{t.priceGhs}</td>
                        <td className="px-3 py-2 text-right text-white/70">{t.activeCount}</td>
                        <td className="px-3 py-2 text-right text-cyan-400 font-medium">₵{t.tierMrr.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Renewals due */}
          {data.renewalsDue?.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Renewals Due (next 30d)</p>
              <div className="space-y-1.5">
                {data.renewalsDue.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs">
                    <span className="text-white/70 flex-1 truncate">{t.name}</span>
                    <span className="text-amber-400">{t.renewalDaysLeft}d left</span>
                    <span className="text-white/30">₵{t.priceGhs}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Debug Logs Panel ──────────────────────────────────────────────────────────
const LOG_LEVEL_STYLE: Record<string, string> = {
  ok: 'text-emerald-400', warn: 'text-amber-400', error: 'text-rose-400',
};

function DebugLogsPanel({ teamToken }: { teamToken: string }) {
  const [level, setLevel] = useState<'' | 'ok' | 'warn' | 'error'>('');
  const endpoint = `/admin/debug/logs${level ? `?level=${level}` : ''}`;
  const { data, loading, err, reload } = useAdminFetch<any>(endpoint, teamToken, [level]);
  const [clearing, setClearing] = useState(false);

  const entries: any[] = data?.entries ?? [];

  const clear = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/debug/logs', { headers: { 'x-team-token': teamToken } });
      reload();
    } catch { /* ignore */ } finally { setClearing(false); }
  };

  return (
    <div className="p-6">
      <PanelHeader tab="debuglogs">
        <div className="ml-auto flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden text-xs">
            {(['', 'error', 'warn', 'ok'] as const).map((l) => (
              <button key={l} onClick={() => setLevel(l)}
                className={`px-3 py-1.5 transition-colors ${level === l ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {l === '' ? 'All' : l}
              </button>
            ))}
          </div>
          {entries.length > 0 && (
            <button onClick={clear} disabled={clearing}
              className="text-xs bg-white/5 hover:bg-white/10 text-white/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
              {clearing ? '…' : 'Clear'}
            </button>
          )}
          <button onClick={reload} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PanelHeader>

      {data?.stats && (
        <div className="flex gap-4 mb-4 text-xs text-white/30">
          <span>Total: {data.total}</span>
          {data.stats.errors > 0 && <span className="text-rose-400">{data.stats.errors} errors</span>}
          {data.stats.warnings > 0 && <span className="text-amber-400">{data.stats.warnings} warns</span>}
        </div>
      )}

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">No log entries.</div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-1 max-h-[55vh] overflow-auto font-mono">
          {entries.map((e: any) => (
            <div key={e.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-white/5 border border-white/5 ${e.level === 'error' ? 'border-rose-500/20' : e.level === 'warn' ? 'border-amber-500/10' : ''}`}>
              <span className={`w-10 flex-shrink-0 font-bold ${LOG_LEVEL_STYLE[e.level] ?? 'text-white/40'}`}>{e.status}</span>
              <span className="text-white/50 flex-shrink-0">{e.method}</span>
              <span className="text-white/60 flex-1 truncate">{e.path}</span>
              <span className={`flex-shrink-0 ${e.durationMs > 500 ? 'text-amber-400' : 'text-white/25'}`}>{e.durationMs}ms</span>
              {e.errorMessage && <span className="text-rose-400 truncate max-w-[200px]">{e.errorMessage}</span>}
              <span className="text-white/15 flex-shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Referral Panel ────────────────────────────────────────────────────────────
function ReferralPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/referrals/partners', teamToken);
  const partners: any[] = data?.partners ?? [];

  return (
    <div className="p-6">
      <PanelHeader tab="referral">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>
      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {!loading && (
        <>
          {partners.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">No referral partners yet.</div>
          ) : (
            <div className="space-y-2">
              {partners.map((p: any) => (
                <div key={p.id} className={`bg-white/5 border rounded-xl px-4 py-3 ${p.isActive ? 'border-white/10' : 'border-white/5 opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{p.name}</span>
                        <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded font-mono">{p.code}</span>
                        {!p.isActive && <span className="text-xs text-white/25">inactive</span>}
                      </div>
                      {p.contacts && <p className="text-white/30 text-xs mt-0.5">{p.contacts}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-cyan-400 text-sm font-bold">₵{p.totalMrr?.toLocaleString() ?? 0} MRR</p>
                      <p className="text-white/30 text-xs">{p.commissionRate}% → ₵{p.commissionDue?.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-white/30">
                    <span>{p.tenantCount} tenant{p.tenantCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────
function PanelHeader({ tab, children }: { tab: TabId; children?: ReactNode }) {
  const meta = TAB_META[tab];
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={meta.accent.split(' ')[0]}>{meta.icon}</div>
      <h2 className="text-white text-lg font-semibold">{meta.label}</h2>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}

function useAdminFetch<T>(endpoint: string, teamToken: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const reload = useCallback(() => {
    if (!teamToken) { setLoading(false); return; }
    setLoading(true); setErr('');
    api.get(endpoint, { headers: { 'x-team-token': teamToken } })
      .then((r) => setData(r.data.data ?? r.data))
      .catch((e: unknown) => {
        const status = (e as any)?.response?.status;
        if (status === 401) {
          sessionStorage.removeItem('agod-team-token');
          sessionStorage.removeItem('agod-team-member');
          window.location.replace('/agod/login');
        } else {
          setErr((e as any)?.response?.data?.error ?? 'Failed to load.');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, teamToken, ...deps]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, err, reload };
}

// ── Tenant Inspector ─────────────────────────────────────────────────────────
function TenantInspectorPanel({ teamToken }: { teamToken: string }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const endpoint = `/admin/tenants${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ''}`;
  const { data: tenants, loading, err, reload } = useAdminFetch<any[]>(endpoint, teamToken, [debouncedQ]);

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'text-emerald-400', TRIAL: 'text-amber-400',
    GRACE: 'text-orange-400', EXPIRED: 'text-rose-400', SUSPENDED: 'text-red-500',
  };

  return (
    <div className="p-6">
      <PanelHeader tab="tenantinspector">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or slug…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && tenants && (
        <div className="space-y-2">
          {tenants.length === 0 && <p className="text-white/30 text-sm text-center py-8">No tenants found.</p>}
          {tenants.map((t) => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">{t.name}</span>
                    <span className="text-white/30 text-xs">{t.slug}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs font-medium ${STATUS_COLOR[t.subscriptionStatus] ?? 'text-white/40'}`}>
                      {t.subscriptionStatus}
                    </span>
                    <span className="text-white/25 text-xs">Tier {t.tier}</span>
                    <span className="text-white/25 text-xs">{t.activeUsers} users</span>
                    {t.isLive && <span className="text-emerald-400 text-xs">● Live</span>}
                  </div>
                </div>
                {expanded === t.id
                  ? <ChevronUp className="h-4 w-4 text-white/30 flex-shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0" />}
              </button>

              {expanded === t.id && (
                <div className="border-t border-white/10 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <Row label="ID" value={t.id} mono />
                  <Row label="Schema" value={t.schema} mono />
                  <Row label="Org type" value={t.orgType} />
                  <Row label="Business type" value={t.businessType ?? '—'} />
                  <Row label="Created" value={new Date(t.createdAt).toLocaleDateString()} />
                  <Row label="Last activity" value={t.lastActivity ? new Date(t.lastActivity).toLocaleString() : '—'} />
                  <Row label="Trial ends" value={t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'} />
                  <Row label="Paid until" value={t.subscriptionPaidUntil ? new Date(t.subscriptionPaidUntil).toLocaleDateString() : '—'} />
                  <Row label="Referral code" value={t.referralCode ?? '—'} />
                  <Row label="Active users" value={String(t.activeUsers)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-white/30">{label}: </span>
      <span className={`text-white/70 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Failed Payments ───────────────────────────────────────────────────────────
function FailedPaymentsPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any[]>('/admin/failed-payments', teamToken);
  const [retrying, setRetrying] = useState<string | null>(null);

  const retry = async (chargeId: string) => {
    setRetrying(chargeId);
    try {
      await api.post(`/admin/failed-payments/${chargeId}/retry`, {}, { headers: { 'x-team-token': teamToken } });
      reload();
    } catch {
      // error shown inline
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="p-6">
      <PanelHeader tab="failedpayments">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && data && (
        <div className="space-y-4">
          {data.length === 0 && (
            <div className="flex flex-col items-center py-16 text-white/30 gap-2">
              <CheckCircle className="h-10 w-10" />
              <p className="text-sm">No failed or stale payments.</p>
            </div>
          )}
          {data.map((group) => (
            <div key={group.tenantId} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <div>
                  <p className="text-white text-sm font-medium">{group.tenantName}</p>
                  <p className="text-white/30 text-xs">{group.tenantSlug}</p>
                </div>
                <div className="ml-auto flex gap-3 text-xs">
                  {group.failedCount > 0 && <span className="text-rose-400">{group.failedCount} failed</span>}
                  {group.staleCount > 0 && <span className="text-amber-400">{group.staleCount} stale</span>}
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {group.charges.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-xs font-mono truncate">{c.reference}</p>
                      <p className="text-white/30 text-xs">
                        {c.currency} {Number(c.amount).toLocaleString()} · {c.invoice?.customer?.name ?? '—'}
                        {c.failureReason && <span className="text-rose-400 ml-2">{c.failureReason}</span>}
                      </p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.status === 'FAILED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {c.status}
                    </span>
                    <button
                      onClick={() => retry(c.id)}
                      disabled={retrying === c.id}
                      className="text-xs bg-white/5 hover:bg-violet-600/30 text-white/50 hover:text-violet-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {retrying === c.id ? '…' : 'Retry'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Support Queue ─────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400',
  HIGH: 'bg-rose-500/20 text-rose-400',
  MEDIUM: 'bg-amber-500/20 text-amber-400',
  LOW: 'bg-white/10 text-white/40',
};

const STATUS_ICON: Record<string, ReactNode> = {
  OPEN: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  IN_PROGRESS: <RefreshCw className="h-3.5 w-3.5 text-violet-400" />,
  RESOLVED: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
  CLOSED: <XCircle className="h-3.5 w-3.5 text-white/30" />,
};

function SupportQueuePanel({ teamToken, member }: { teamToken: string; member: TeamMember }) {
  const { data: tickets, loading, err, reload } = useAdminFetch<any[]>('/admin/support-queue', teamToken);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/support-queue', {
        title: newTitle, description: newDesc, priority: newPriority,
        assignedTo: member.id,
      }, { headers: { 'x-team-token': teamToken } });
      setNewTitle(''); setNewDesc(''); setShowNew(false);
      reload();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/support-queue/${id}`, { status }, { headers: { 'x-team-token': teamToken } });
      setEditId(null);
      reload();
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6">
      <PanelHeader tab="supportqueue">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Ticket
        </button>
      </PanelHeader>

      {showNew && (
        <form onSubmit={createTicket} className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
          <input
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500"
          />
          <textarea
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description…" rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 resize-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
            >
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowNew(false)} className="ml-auto text-white/40 hover:text-white/70 text-sm px-3 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && tickets && (
        <div className="space-y-2">
          {tickets.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">No tickets yet.</div>
          )}
          {tickets.map((t) => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{STATUS_ICON[t.status] ?? <AlertTriangle className="h-3.5 w-3.5 text-white/30" />}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{t.title}</p>
                  <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{t.description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] ?? 'bg-white/10 text-white/40'}`}>
                      {t.priority}
                    </span>
                    {t.assignedTo && <span className="text-white/30 text-xs">→ {t.assignedTo}</span>}
                    {t.tenantName && <span className="text-white/30 text-xs">Tenant: {t.tenantName}</span>}
                    <span className="text-white/20 text-xs ml-auto">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {editId === t.id ? (
                    <div className="flex gap-1">
                      {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                        <button key={s} onClick={() => updateStatus(t.id, s)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${t.status === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                          {s === 'IN_PROGRESS' ? 'In Progress' : s[0] + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                      <button onClick={() => setEditId(null)} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditId(t.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slow Queries ──────────────────────────────────────────────────────────────
function SlowQueriesPanel({ teamToken }: { teamToken: string }) {
  const [view, setView] = useState<'top10' | 'recent'>('top10');
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/slow-queries', teamToken);

  const entries: any[] = view === 'top10' ? (data?.top10ByDuration ?? []) : (data?.recent ?? []);

  return (
    <div className="p-6">
      <PanelHeader tab="slowqueries">
        <div className="ml-auto flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden text-xs">
            {(['top10', 'recent'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${view === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {v === 'top10' ? 'Top 10' : 'Recent'}
              </button>
            ))}
          </div>
          <button onClick={reload} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PanelHeader>

      {data && (
        <p className="text-white/30 text-xs mb-4">{data.totalCaptured} slow queries captured since last restart</p>
      )}

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center py-16 text-white/30 gap-2">
          <CheckCircle className="h-10 w-10" />
          <p className="text-sm">No slow queries captured yet.</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 mb-1.5">
                <span className={`text-xs font-bold ${e.level === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                  {e.durationMs}ms
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${e.level === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {e.level}
                </span>
                <span className="text-white/25 text-xs ml-auto">{new Date(e.ts).toLocaleString()}</span>
              </div>
              <pre className="text-white/50 text-xs font-mono truncate">{e.query}</pre>
              {e.target && <p className="text-white/20 text-xs mt-1">{e.target}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Schema Diff ───────────────────────────────────────────────────────────────
function SchemaDiffPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<any>('/admin/schema-diff', teamToken);

  const STATUS_STYLE: Record<string, string> = {
    APPLIED: 'bg-emerald-500/20 text-emerald-400',
    ROLLED_BACK: 'bg-rose-500/20 text-rose-400',
    FAILED: 'bg-red-500/20 text-red-400',
    IN_PROGRESS: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="p-6">
      <PanelHeader tab="schemadiff">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Applied', val: data.summary.applied, color: 'text-emerald-400' },
              { label: 'Failed', val: data.summary.failed, color: 'text-red-400' },
              { label: 'In Progress', val: data.summary.inProgress, color: 'text-amber-400' },
              { label: 'Total', val: data.summary.total, color: 'text-white/70' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{val}</p>
                <p className="text-white/30 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {data.summary.latestMigration && (
            <p className="text-white/30 text-xs mb-4">
              Latest: <span className="text-white/60 font-mono">{data.summary.latestMigration.name}</span>
              {' '}applied {new Date(data.summary.latestMigration.appliedAt).toLocaleString()}
            </p>
          )}

          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Migrations</p>
          <div className="space-y-1.5 max-h-64 overflow-auto mb-6">
            {data.migrations.map((m: any) => (
              <div key={m.name} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[m.status] ?? 'bg-white/10 text-white/40'}`}>
                  {m.status}
                </span>
                <span className="text-white/60 text-xs font-mono truncate flex-1">{m.name}</span>
                <span className="text-white/20 text-xs flex-shrink-0">
                  {m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Tenant Schemas ({data.tenantSchemas.length})</p>
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {data.tenantSchemas.map((t: any) => (
              <div key={t.tenantId} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-xs">
                <span className="text-white/70 flex-1 truncate">{t.name}</span>
                <span className="text-white/30 font-mono">{t.schema}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Cohort View ───────────────────────────────────────────────────────────────
function CohortPanel({ teamToken }: { teamToken: string }) {
  const [days, setDays] = useState(7);
  const endpoint = `/admin/cohort?days=${days}`;
  const { data, loading, err, reload } = useAdminFetch<any[]>(endpoint, teamToken, [days]);

  const STEP_COLOR: Record<string, string> = {
    'Live (first transaction posted)': 'text-emerald-400',
    'Active (using the app)': 'text-sky-400',
    'Invited team': 'text-violet-400',
    'Setup wizard completed': 'text-amber-400',
    'Registered': 'text-white/40',
  };

  return (
    <div className="p-6">
      <PanelHeader tab="cohort">
        <div className="ml-auto flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden text-xs">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 transition-colors ${days === d ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={reload} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PanelHeader>

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && data && (
        <>
          {data.length === 0 && (
            <p className="text-white/30 text-sm text-center py-12">No new tenants in the last {days} days.</p>
          )}
          <div className="space-y-2">
            {data.map((t) => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{t.name}</span>
                      <span className="text-white/30 text-xs">{t.slug}</span>
                    </div>
                    <p className={`text-xs mt-0.5 font-medium ${STEP_COLOR[t.onboardingStep] ?? 'text-white/40'}`}>
                      {t.onboardingStep}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white/50 text-xs">{t.daysSinceSignup}d ago</p>
                    <p className="text-white/30 text-xs">{t.activeUsers} users</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.subscriptionStatus === 'TRIAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {t.subscriptionStatus}
                  </span>
                  <span className="text-white/20 text-xs">{t.orgType}</span>
                  {t.referralCode && <span className="text-white/20 text-xs">ref: {t.referralCode}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Job Retry Panel ───────────────────────────────────────────────────────────
interface JobInfo {
  name: string;
  schedule: string;
  lastRun?: { success: boolean; at: string; durationMs: number; error?: string };
}

interface JobsResponse {
  jobs: JobInfo[];
  failedCount: number;
  failedJobs: JobInfo[];
}

function JobRetryPanel({ teamToken }: { teamToken: string }) {
  const { data, loading, err, reload } = useAdminFetch<JobsResponse>('/admin/jobs', teamToken);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<Record<string, string>>({});

  const trigger = async (name: string) => {
    setTriggering(name);
    setTriggerMsg((prev) => ({ ...prev, [name]: '' }));
    try {
      await api.post(
        `/admin/jobs/${encodeURIComponent(name)}/trigger`,
        {},
        { headers: { 'x-team-token': teamToken } },
      );
      setTriggerMsg((prev) => ({ ...prev, [name]: 'Triggered!' }));
      setTimeout(() => {
        setTriggerMsg((prev) => { const n = { ...prev }; delete n[name]; return n; });
        reload();
      }, 1500);
    } catch (e: any) {
      setTriggerMsg((prev) => ({ ...prev, [name]: e?.response?.data?.error ?? 'Failed' }));
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="p-6">
      <PanelHeader tab="jobs">
        <button onClick={reload} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </PanelHeader>

      {loading && <Spinner />}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {!loading && data && (
        <>
          {data.failedCount > 0 && (
            <div className="flex items-center gap-2 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <p className="text-rose-300 text-sm font-medium">{data.failedCount} failed job{data.failedCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          <div className="space-y-2">
            {data.jobs.map((job) => {
              const failed = job.lastRun && !job.lastRun.success;
              const msg = triggerMsg[job.name];
              return (
                <div
                  key={job.name}
                  className={`bg-white/5 border rounded-xl px-4 py-3 ${failed ? 'border-rose-500/30' : 'border-white/10'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {failed
                          ? <XCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                          : <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                        <span className="text-white text-sm font-medium font-mono">{job.name}</span>
                      </div>
                      <p className="text-white/30 text-xs mt-0.5 pl-5">{job.schedule}</p>
                      {job.lastRun && (
                        <p className="text-white/25 text-xs pl-5 mt-0.5">
                          Last run {new Date(job.lastRun.at).toLocaleString()} — {job.lastRun.durationMs}ms
                        </p>
                      )}
                      {failed && job.lastRun?.error && (
                        <p className="text-rose-400 text-xs pl-5 mt-1 font-mono line-clamp-2">{job.lastRun.error}</p>
                      )}
                      {msg && (
                        <p className={`text-xs pl-5 mt-1 ${msg === 'Triggered!' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {msg}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => trigger(job.name)}
                      disabled={triggering === job.name}
                      className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        failed
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-white/50 border border-white/10'
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${triggering === job.name ? 'animate-spin' : ''}`} />
                      {triggering === job.name ? 'Running…' : 'Run now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Panel router ─────────────────────────────────────────────────────────────
function PanelContent({ tab, teamToken, member }: { tab: TabId; teamToken: string; member: TeamMember }) {
  switch (tab) {
    case 'jobs':            return <JobRetryPanel teamToken={teamToken} />;
    case 'tenantinspector': return <TenantInspectorPanel teamToken={teamToken} />;
    case 'failedpayments':  return <FailedPaymentsPanel teamToken={teamToken} />;
    case 'supportqueue':    return <SupportQueuePanel teamToken={teamToken} member={member} />;
    case 'slowqueries':     return <SlowQueriesPanel teamToken={teamToken} />;
    case 'schemadiff':      return <SchemaDiffPanel teamToken={teamToken} />;
    case 'cohort':          return <CohortPanel teamToken={teamToken} />;
    case 'performance':     return <PerformancePanel teamToken={teamToken} />;
    case 'errors':          return <ErrorLogsPanel teamToken={teamToken} />;
    case 'feedback':        return <FeedbackPanel teamToken={teamToken} />;
    case 'analytics':       return <AnalyticsPanel teamToken={teamToken} />;
    case 'clienthealth':    return <ClientHealthPanel teamToken={teamToken} />;
    case 'churnrisk':       return <ChurnRiskPanel teamToken={teamToken} />;
    case 'onboarding':      return <OnboardingPanel teamToken={teamToken} />;
    case 'revenue':         return <RevenuePanel teamToken={teamToken} />;
    case 'debuglogs':       return <DebugLogsPanel teamToken={teamToken} />;
    case 'referral':        return <ReferralPanel teamToken={teamToken} />;
    default:                return <NoDataPanel tab={tab} />;
  }
}

// ── Main console ─────────────────────────────────────────────────────────────
export function AgodTeamConsole() {
  const navigate = useNavigate();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [teamToken, setTeamToken] = useState('');
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('agod-team-token');
    const raw = sessionStorage.getItem('agod-team-member');
    if (!token || !raw) {
      navigate('/agod/login', { replace: true });
      return;
    }
    try {
      const m: TeamMember = JSON.parse(raw);
      setMember(m);
      setTeamToken(token);
      setActiveTab((m.assignedTabs[0] as TabId) ?? null);
    } catch {
      navigate('/agod/login', { replace: true });
    }
  }, [navigate]);

  const handleSignOut = useCallback(() => {
    sessionStorage.removeItem('agod-team-token');
    sessionStorage.removeItem('agod-team-member');
    navigate('/agod/login', { replace: true });
  }, [navigate]);

  const handleChangePin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) return;
    try {
      await api.post('/admin/team/change-pin', { newPin }, { headers: { 'x-team-token': teamToken } });
      setPinMsg('PIN updated successfully.');
      setNewPin('');
      setTimeout(() => { setIsChangingPin(false); setPinMsg(''); }, 2000);
    } catch {
      setPinMsg('Failed to update PIN.');
    }
  }, [newPin, teamToken]);

  if (!member) return null;

  const colorClass = COLOR_MAP[member.color] ?? 'text-slate-300';
  const assignedTabs = member.assignedTabs as TabId[];

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      {/* Top nav */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">AG</span>
          </div>
          <div>
            <p className="text-white text-xs font-semibold leading-none">AGOD Software Solutions</p>
            <p className="text-white/30 text-[9px] tracking-widest uppercase">Admin Console</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setIsChangingPin((v) => !v)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full pl-1.5 pr-3 py-1 transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
              <span className={`text-[10px] font-bold ${colorClass}`}>{initials(member.name)}</span>
            </div>
            <span className="text-white/70 text-xs">{member.name}</span>
            <User className="h-3 w-3 text-white/30" />
          </button>

          <button
            onClick={handleSignOut}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-white/40 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Change PIN modal */}
      {isChangingPin && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setIsChangingPin(false)}>
          <div className="bg-[#0d1320] border border-white/10 rounded-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-1">Change PIN</h3>
            <p className="text-white/40 text-xs mb-4">Choose a PIN of 4–16 characters.</p>
            <form onSubmit={handleChangePin} className="space-y-3">
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN"
                maxLength={16}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 tracking-widest"
              />
              {pinMsg && <p className={`text-xs ${pinMsg.includes('success') ? 'text-emerald-400' : 'text-rose-400'}`}>{pinMsg}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsChangingPin(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 text-sm py-2 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={newPin.length < 4} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm py-2 rounded-xl transition-colors">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar nav */}
        <aside className="w-52 flex-shrink-0 border-r border-white/5 flex flex-col py-4 gap-1 px-2 overflow-y-auto">
          <p className="text-white/25 text-[10px] tracking-widest uppercase px-3 mb-2">Your Panels</p>
          {assignedTabs.map((tab) => {
            const meta = TAB_META[tab];
            if (!meta) return null;
            const isActive = activeTab === tab;
            const [accentText] = meta.accent.split(' ');
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                  isActive
                    ? `bg-white/5 ${accentText} font-medium`
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}

          <div className="mt-auto pt-4 border-t border-white/5 mx-1">
            <div className="px-2">
              <p className="text-white/20 text-[10px] leading-tight">{member.role}</p>
              <p className="text-white/10 text-[10px]">{assignedTabs.length} panels assigned</p>
            </div>
          </div>
        </aside>

        {/* Panel content */}
        <main className="flex-1 overflow-auto bg-[#09101c]">
          {activeTab ? (
            <PanelContent tab={activeTab} teamToken={teamToken} member={member} />
          ) : (
            <div className="flex items-center justify-center h-full text-white/20 text-sm">
              Select a panel from the sidebar
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
