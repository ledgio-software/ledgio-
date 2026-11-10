import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Building2, Users, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'https://ledgio-backend.onrender.com/api/v1';

interface PartnerInfo {
  name: string;
  code: string;
  commissionRate: number;
}

interface ReferredTenant {
  id: string;
  name: string;
  orgType: string | null;
  tier: string;
  subscriptionStatus: string;
  joinedAt: string;
}

interface PortalData {
  partner: PartnerInfo;
  tenants: ReferredTenant[];
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/60 border border-emerald-700/40 text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    );
  }
  if (s === 'TRIAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 border border-amber-700/40 text-amber-300">
        <Clock className="h-3 w-3" /> Trial
      </span>
    );
  }
  if (s === 'CANCELLED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/60 border border-red-700/40 text-red-400">
        <XCircle className="h-3 w-3" /> Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-ink-800 border border-ink-700 text-ink-400">
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Free: 'text-ink-400 bg-ink-800 border-ink-700',
    Starter: 'text-blue-300 bg-blue-950/60 border-blue-700/40',
    Professional: 'text-brand-300 bg-brand-950/60 border-brand-700/40',
    Enterprise: 'text-purple-300 bg-purple-950/60 border-purple-700/40',
  };
  const cls = colors[tier] ?? 'text-ink-400 bg-ink-800 border-ink-700';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {tier}
    </span>
  );
}

export function PartnerPortal() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    fetch(`${API}/referrals/portal/${partnerId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data);
        else setError(j.error ?? 'Failed to load portal.');
      })
      .catch(() => setError('Could not connect to server. Please try again.'))
      .finally(() => setLoading(false));
  }, [partnerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-400 text-sm">Loading portal…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Portal not found</h1>
          <p className="text-ink-400 text-sm">{error ?? 'This portal link is invalid or has been disabled.'}</p>
        </div>
      </div>
    );
  }

  const { partner, tenants } = data;
  const activeCount = tenants.filter(t => t.subscriptionStatus.toUpperCase() === 'ACTIVE').length;
  const trialCount = tenants.filter(t => t.subscriptionStatus.toUpperCase() === 'TRIAL').length;

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-4">
            Partner Portal
          </span>
          <h1 className="text-3xl font-black text-white mb-2">{partner.name}</h1>
          <p className="text-ink-400 text-sm">
            Referral code: <span className="font-bold text-white">{partner.code}</span>
            {' · '}
            Commission rate: <span className="font-bold text-brand-400">{partner.commissionRate}%</span>
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-6 text-center">
            <Users className="h-5 w-5 text-ink-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-white mb-1">{tenants.length}</div>
            <div className="text-xs text-ink-500 font-medium">Total referred</div>
          </div>
          <div className="bg-ink-900/60 border border-emerald-800/40 rounded-2xl p-6 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-emerald-400 mb-1">{activeCount}</div>
            <div className="text-xs text-ink-500 font-medium">Active (paying)</div>
          </div>
          <div className="bg-ink-900/60 border border-amber-800/40 rounded-2xl p-6 text-center">
            <TrendingUp className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-amber-400 mb-1">{trialCount}</div>
            <div className="text-xs text-ink-500 font-medium">On trial</div>
          </div>
        </div>

        {/* Table */}
        {tenants.length === 0 ? (
          <div className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-12 text-center">
            <Building2 className="h-10 w-10 text-ink-700 mx-auto mb-4" />
            <p className="text-ink-400 text-sm">No referred customers yet.</p>
            <p className="text-ink-600 text-xs mt-1">Share your referral link to get started.</p>
          </div>
        ) : (
          <div className="bg-ink-900/60 border border-ink-800/60 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-800/60">
              <h2 className="text-sm font-bold text-white">Referred Customers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800/60">
                    <th className="text-left px-6 py-3 text-xs font-bold text-ink-500 uppercase tracking-wide">Business</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-ink-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-ink-500 uppercase tracking-wide">Plan</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-ink-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-ink-500 uppercase tracking-wide">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, i) => (
                    <tr key={t.id} className={i < tenants.length - 1 ? 'border-b border-ink-800/40' : ''}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-blue-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                            {t.name[0]}
                          </div>
                          <span className="font-medium text-white">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-ink-400">{t.orgType ?? '—'}</td>
                      <td className="px-6 py-4"><TierBadge tier={t.tier} /></td>
                      <td className="px-6 py-4"><StatusBadge status={t.subscriptionStatus} /></td>
                      <td className="px-6 py-4 text-ink-500 text-xs">
                        {new Date(t.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-center text-ink-600 text-xs mt-8">
          This portal is private — only share this link with authorised team members.
        </p>
      </div>
    </div>
  );
}
