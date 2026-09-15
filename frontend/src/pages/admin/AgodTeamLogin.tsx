import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  assignedTabs: string[];
}

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
  blue:    { ring: 'ring-blue-500',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-500' },
  cyan:    { ring: 'ring-cyan-500',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-500' },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  rose:    { ring: 'ring-rose-500',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-500' },
  violet:  { ring: 'ring-violet-500',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-500' },
  amber:   { ring: 'ring-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500' },
  indigo:  { ring: 'ring-indigo-500',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  dot: 'bg-indigo-500' },
  slate:   { ring: 'ring-slate-400',   bg: 'bg-slate-500/10',   text: 'text-slate-300',   dot: 'bg-slate-400' },
};

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function AgodTeamLogin() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    // Redirect if already logged in
    const existing = sessionStorage.getItem('agod-team-token');
    if (existing) {
      navigate('/agod/console', { replace: true });
      return;
    }
    api.get('/admin/team/members')
      .then((res) => setMembers(res.data.data))
      .catch(() => setError('Failed to load team roster. Please try again.'))
      .finally(() => setLoadingMembers(false));
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !pin) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/team/login', { memberId: selected.id, pin });
      const { token, member } = res.data.data;
      sessionStorage.setItem('agod-team-token', token);
      sessionStorage.setItem('agod-team-member', JSON.stringify(member));
      navigate('/agod/console', { replace: true });
    } catch {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  const colors = selected ? (COLOR_MAP[selected.color] ?? COLOR_MAP.slate) : null;

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-wider">AG</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">AGOD Software Solutions</p>
            <p className="text-white/40 text-[10px] tracking-widest uppercase mt-0.5">Team Portal</p>
          </div>
        </div>
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title="System online" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero text */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {selected ? `Welcome, ${selected.name.split(' ')[0]}` : 'Team Access'}
          </h1>
          <p className="text-white/40 mt-2 text-sm">
            {selected
              ? 'Enter your PIN to continue to your dashboard'
              : 'Select your profile to sign in'}
          </p>
        </div>

        {!selected ? (
          /* Member card grid */
          <div className="w-full max-w-3xl">
            {loadingMembers ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {members.map((m) => {
                  const c = COLOR_MAP[m.color] ?? COLOR_MAP.slate;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setSelected(m); setPin(''); setError(''); }}
                      className={`group relative flex flex-col items-center gap-3 rounded-2xl border border-white/5 ${c.bg} p-5 hover:border-white/20 hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                    >
                      <div className={`h-14 w-14 rounded-full ring-2 ${c.ring} bg-[#0d1320] flex items-center justify-center`}>
                        <span className={`text-lg font-bold ${c.text}`}>{initials(m.name)}</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-sm font-semibold leading-tight">{m.name}</p>
                        <p className="text-white/40 text-[11px] mt-0.5 leading-tight">{m.role}</p>
                      </div>
                      <div className={`absolute top-3 right-3 h-2 w-2 rounded-full ${c.dot} opacity-60`} />
                    </button>
                  );
                })}
              </div>
            )}
            {error && <p className="text-rose-400 text-sm text-center mt-6">{error}</p>}
          </div>
        ) : (
          /* PIN entry */
          <div className="w-full max-w-xs">
            {/* Back + selected member */}
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => { setSelected(null); setPin(''); setError(''); }}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                ←
              </button>
              <div className={`h-10 w-10 rounded-full ring-2 ${colors!.ring} bg-[#0d1320] flex items-center justify-center flex-shrink-0`}>
                <span className={`text-sm font-bold ${colors!.text}`}>{initials(selected.name)}</span>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{selected.name}</p>
                <p className="text-white/40 text-[11px]">{selected.role}</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-white/50 text-xs mb-2 tracking-wider uppercase">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(''); }}
                  placeholder="Enter your PIN"
                  autoFocus
                  maxLength={16}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <span className="text-rose-400 text-xs">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-all duration-200"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>

              <p className="text-center text-white/25 text-[11px] mt-2">
                Default PIN for first login: <span className="font-mono text-white/40">0000</span>
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-3 flex items-center justify-between">
        <p className="text-white/20 text-[11px]">© 2026 AGOD Software Solutions</p>
        <p className="text-white/20 text-[11px]">Secure Team Portal</p>
      </footer>
    </div>
  );
}
