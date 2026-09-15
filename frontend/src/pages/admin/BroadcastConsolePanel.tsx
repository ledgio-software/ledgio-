/**
 * Shared broadcast panel — reused by AdminCoreEngine and AgodTeamConsole.
 * When `adminHeaders` is provided (AdminCoreEngine has a session token),
 * it is used directly. Otherwise a passcode field is shown so a team member
 * (e.g. PM) can authorize the broadcast themselves.
 */
import { useState } from 'react';
import {
  Radio, Send, CheckCircle2, AlertOctagon, Sparkles, Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';

interface BroadcastResult {
  totalTargeted?: number;
  emailSentCount?: number;
  smsSentCount?: number;
  failedCount?: number;
}

interface Props {
  /** When provided (AdminCoreEngine), these headers are sent with the request.
   *  When absent (team console), the panel shows its own passcode input. */
  adminHeaders?: Record<string, string>;
}

const TEMPLATES = {
  UPGRADE: {
    subject: 'System upgrade deployed (v2.5)',
    message:
      "We've deployed performance upgrades to Ledgio. This includes faster POS till closeouts, real-time inventory re-allocation, and quicker SMS alerts.",
  },
  MAINTENANCE: {
    subject: 'Scheduled maintenance this Sunday',
    message:
      'Ledgio will undergo routine server maintenance this Sunday between 02:00 AM and 02:15 AM UTC. Database connections will be briefly paused during this window.',
  },
  NEWS: {
    subject: 'New feature: automated weekly email reports',
    message:
      'You can now configure automated Monday 8:00 AM Profit & Loss PDF reports sent to your email. Configure this in Settings.',
  },
} as const;

export function BroadcastConsolePanel({ adminHeaders }: Props) {
  const needsPasscode = !adminHeaders;

  const [passcode, setPasscode]     = useState('');
  const [subject, setSubject]       = useState('System Maintenance & Upgrade Notice');
  const [message, setMessage]       = useState(
    'Ledgio ERP will undergo a scheduled system upgrade on Sunday at 2:00 AM UTC. Expect approximately 15 minutes of downtime. Thank you for your patience!',
  );
  const [channel, setChannel]       = useState<'EMAIL' | 'SMS' | 'BOTH'>('BOTH');
  const [targetTier, setTargetTier] = useState('ALL');
  const [isSending, setIsSending]   = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  function applyTemplate(type: keyof typeof TEMPLATES) {
    setSubject(TEMPLATES[type].subject);
    setMessage(TEMPLATES[type].message);
  }

  async function handleExecuteBroadcast() {
    setIsSending(true);
    setBroadcastResult(null);
    setError(null);
    try {
      const headers: Record<string, string> = adminHeaders
        ? adminHeaders
        : { 'x-admin-passcode': passcode };

      const res = await api.post('/admin/broadcast/send', {
        subject,
        message,
        channel,
        targetTier: targetTier === 'ALL' ? undefined : Number(targetTier),
        ...(needsPasscode ? { passcode } : {}),
      }, { headers });

      if (res.data.success) {
        setBroadcastResult(res.data.data);
        setConfirmStep(false);
        if (needsPasscode) setPasscode('');
      } else {
        setError(res.data.error ?? 'Broadcast failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Request failed.');
    } finally {
      setIsSending(false);
    }
  }

  const inputCls =
    'w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500';
  const textareaCls =
    'w-full p-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans';

  return (
    <div className="space-y-6">
      {/* Passcode field (team console only) */}
      {needsPasscode && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary-300">Master Passcode</label>
          <input
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder="Required to authorize broadcast"
            className={inputCls}
          />
        </div>
      )}

      {/* Template buttons */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-secondary-300 flex items-center">
          <Sparkles className="h-4 w-4 mr-1 text-amber-400" />
          Quick Load Announcement Templates
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => applyTemplate('UPGRADE')}
            className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors">
            🚀 System Upgrade Announcement
          </button>
          <button type="button" onClick={() => applyTemplate('MAINTENANCE')}
            className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors">
            🛠 Scheduled Maintenance Alert
          </button>
          <button type="button" onClick={() => applyTemplate('NEWS')}
            className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors">
            🎁 Feature Release Announcement
          </button>
        </div>
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary-300">Target Audience</label>
          <select value={targetTier} onChange={e => setTargetTier(e.target.value)} className={inputCls}>
            <option value="ALL">All Business Owners (All Tenants)</option>
            <option value="1">Tier 1 Starter Tenants</option>
            <option value="2">Tier 2 Professional Tenants</option>
            <option value="3">Tier 3 Enterprise Tenants</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary-300">Announcement Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary-300">Dispatch Channels</label>
          <select value={channel} onChange={e => setChannel(e.target.value as 'EMAIL' | 'SMS' | 'BOTH')} className={inputCls}>
            <option value="BOTH">Email (Gmail SMTP) &amp; SMS (Android Gateway)</option>
            <option value="EMAIL">Email Only (Gmail SMTP)</option>
            <option value="SMS">SMS Only (Android Gateway)</option>
          </select>
        </div>
      </div>

      {/* Message body */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-secondary-300">Broadcast Message Body</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className={textareaCls} />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Success result */}
      {broadcastResult && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-lg text-xs space-y-2">
          <div className="flex items-center font-bold text-emerald-400 text-sm">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            System Broadcast Dispatched Successfully!
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
            <div className="p-2 bg-emerald-900/40 rounded">Total Targeted: <strong>{broadcastResult.totalTargeted}</strong></div>
            <div className="p-2 bg-emerald-900/40 rounded">Emails Sent: <strong>{broadcastResult.emailSentCount}</strong></div>
            <div className="p-2 bg-emerald-900/40 rounded">SMS Sent: <strong>{broadcastResult.smsSentCount}</strong></div>
            <div className="p-2 bg-emerald-900/40 rounded">Failures: <strong>{broadcastResult.failedCount}</strong></div>
          </div>
        </div>
      )}

      {/* Confirm + send */}
      {confirmStep ? (
        <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-lg space-y-3">
          <div className="flex items-center text-amber-300 font-bold text-xs">
            <AlertOctagon className="h-5 w-5 mr-2 text-amber-500" />
            Confirm System-Wide Upgrade Broadcast Dispatch?
          </div>
          <p className="text-[11px] text-secondary-300">
            This action will immediately send an Email &amp; SMS notification to all registered business owners across tenant schemas.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExecuteBroadcast}
              disabled={isSending || (needsPasscode && !passcode)}
              className="flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, Execute Broadcast Now
            </button>
            <button
              type="button"
              onClick={() => setConfirmStep(false)}
              className="px-5 py-2.5 border border-secondary-700 text-secondary-300 hover:bg-secondary-800 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center pt-4 border-t border-secondary-800">
          <span className="text-[11px] text-secondary-400">Batch-processed in 15-user chunks with 500ms safety delay</span>
          <button
            type="button"
            onClick={() => setConfirmStep(true)}
            disabled={needsPasscode && !passcode}
            className="flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Send className="mr-2 h-4 w-4" />
            Broadcast System Announcement
          </button>
        </div>
      )}
    </div>
  );
}

/** Standalone wrapper used by AgodTeamConsole's BroadcastPanel slot */
export function StandaloneBroadcastPanel() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Radio className="h-4 w-4 text-amber-400" />
        <h2 className="text-base font-semibold text-white">System-Wide Email &amp; SMS Broadcast Console</h2>
      </div>
      <p className="text-xs text-secondary-400 mb-6">
        Dispatch batch upgrade notices, maintenance alerts, or feature releases to all registered business owners
        across SMS (Android Gateway) and Email (Gmail SMTP).
      </p>
      <BroadcastConsolePanel />
    </div>
  );
}
