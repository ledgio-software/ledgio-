import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  BarChart2, Activity, Briefcase, Link2, Database, FileText,
  MessageSquare, TrendingUp, Zap, AlertTriangle, Shield,
  Gift, Heart, UserMinus, BookOpen, DollarSign, Radio,
  Bug, LogOut, User,
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
  | 'revenue' | 'debuglogs';

const TAB_META: Record<TabId, { label: string; icon: React.ReactNode; accent: string }> = {
  broadcast:    { label: 'Broadcast',        icon: <Radio className="h-4 w-4" />,        accent: 'text-amber-400 border-amber-400' },
  health:       { label: 'Health',           icon: <Activity className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  performance:  { label: 'Performance',      icon: <BarChart2 className="h-4 w-4" />,     accent: 'text-amber-400 border-amber-400' },
  jobs:         { label: 'Jobs',             icon: <Briefcase className="h-4 w-4" />,     accent: 'text-amber-400 border-amber-400' },
  integrations: { label: 'Integrations',     icon: <Link2 className="h-4 w-4" />,         accent: 'text-amber-400 border-amber-400' },
  schemas:      { label: 'Schemas',          icon: <Database className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  audit:        { label: 'Audit Logs',       icon: <FileText className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  onboard:      { label: 'Onboard',          icon: <BookOpen className="h-4 w-4" />,      accent: 'text-amber-400 border-amber-400' },
  feedback:     { label: 'Feedback',         icon: <MessageSquare className="h-4 w-4" />, accent: 'text-amber-400 border-amber-400' },
  analytics:    { label: 'Analytics',        icon: <TrendingUp className="h-4 w-4" />,    accent: 'text-amber-400 border-amber-400' },
  errors:       { label: 'Error Logs',       icon: <Zap className="h-4 w-4" />,           accent: 'text-amber-400 border-amber-400' },
  safety:       { label: 'Safety',           icon: <Shield className="h-4 w-4" />,        accent: 'text-red-400 border-red-500' },
  referral:     { label: 'Referrals',        icon: <Gift className="h-4 w-4" />,          accent: 'text-amber-400 border-amber-400' },
  clienthealth: { label: 'Client Health',    icon: <Heart className="h-4 w-4" />,         accent: 'text-emerald-400 border-emerald-400' },
  churnrisk:    { label: 'Churn Risk',       icon: <UserMinus className="h-4 w-4" />,     accent: 'text-rose-400 border-rose-400' },
  onboarding:   { label: 'Onboarding Intel', icon: <BookOpen className="h-4 w-4" />,      accent: 'text-violet-400 border-violet-400' },
  revenue:      { label: 'Revenue',          icon: <DollarSign className="h-4 w-4" />,    accent: 'text-cyan-400 border-cyan-400' },
  debuglogs:    { label: 'Debug Logs',       icon: <Bug className="h-4 w-4" />,           accent: 'text-violet-400 border-violet-400' },
};

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-400', cyan: 'text-cyan-400', emerald: 'text-emerald-400',
  rose: 'text-rose-400', violet: 'text-violet-400', amber: 'text-amber-400',
  indigo: 'text-indigo-400', slate: 'text-slate-300',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Placeholder panel ────────────────────────────────────────────────────────
function PlaceholderPanel({ tab, teamToken }: { tab: TabId; teamToken: string }) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const endpointMap: Partial<Record<TabId, string>> = {
    performance:  '/admin/metrics',
    jobs:         '/admin/jobs',
    errors:       '/admin/error-logs',
    feedback:     '/admin/feedback',
    analytics:    '/admin/analytics',
    clienthealth: '/admin/client-health',
    churnrisk:    '/admin/churn-risk',
    onboarding:   '/admin/onboarding',
    revenue:      '/admin/revenue',
    debuglogs:    '/admin/debug/logs',
    referral:     '/admin/referrals/partners',
  };

  const endpoint = endpointMap[tab];

  useEffect(() => {
    if (!endpoint) { setLoading(false); return; }
    api.get(endpoint, { headers: { 'x-team-token': teamToken } })
      .then((res) => setData(JSON.stringify(res.data, null, 2)))
      .catch(() => setErr('Failed to load data.'))
      .finally(() => setLoading(false));
  }, [endpoint, teamToken]);

  const meta = TAB_META[tab];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`${meta.accent.split(' ')[0]}`}>{meta.icon}</div>
        <h2 className="text-white text-lg font-semibold">{meta.label}</h2>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
        </div>
      )}
      {err && <p className="text-rose-400 text-sm">{err}</p>}
      {data && (
        <pre className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white/70 overflow-auto max-h-[60vh] font-mono leading-relaxed">
          {data}
        </pre>
      )}
      {!loading && !err && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
          <div className="text-4xl opacity-30">{meta.icon}</div>
          <p className="text-sm">No live data endpoint for this panel.</p>
          <p className="text-xs">Full interactive view coming soon.</p>
        </div>
      )}
    </div>
  );
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
          {/* Member chip */}
          <button
            onClick={() => setIsChangingPin((v) => !v)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full pl-1.5 pr-3 py-1 transition-colors"
          >
            <div className={`h-6 w-6 rounded-full bg-white/10 flex items-center justify-center`}>
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
            <PlaceholderPanel tab={activeTab} teamToken={teamToken} />
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
