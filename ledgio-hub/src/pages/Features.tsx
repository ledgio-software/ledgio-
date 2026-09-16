import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SECTORS } from '../lib/sectors';

const CORE = [
  { title: 'Double-Entry Accounting Engine', body: 'Every transaction creates balanced journal entries automatically. No manual posting required.' },
  { title: 'Chart of Accounts', body: 'Sector-specific charts of accounts provisioned at registration — no setup needed.' },
  { title: 'Bank Reconciliation', body: 'Match your bank statement to your books in minutes. Mono bank feed integration available.' },
  { title: 'Invoicing & Accounts Receivable', body: 'Professional invoices, payment tracking, and aged receivables report — all built in.' },
  { title: 'Vendor Bills & Accounts Payable', body: 'Record supplier invoices, schedule payments, and maintain a complete payables ledger.' },
  { title: 'Payroll Management', body: 'Run payroll for your entire team with payslip generation, SSNIT, and income tax compliance.' },
  { title: 'Budgets & Variance Tracking', body: 'Set budgets by department or fund and compare actuals vs budget in real time.' },
  { title: 'Recurring Transactions', body: 'Automate standing orders, regular payments, and subscription billing. Set frequency and end conditions.' },
  { title: 'Approval Workflows', body: 'Multi-level approval chains for purchases, disbursements, and journal entries above configurable thresholds.' },
  { title: 'Mobile Money Collections', body: 'Accept MTN, Telecel, and AirtelTigo payments. Every collection posts to your accounts instantly.' },
  { title: 'Role-Based Access Control', body: 'Admin, Accountant, Manager, Cashier, Auditor — each role sees only what they need.' },
  { title: 'Full Audit Trail', body: 'Every record — created, edited, approved, deleted — is permanently logged with user identity and timestamp.' },
  { title: 'Analytics Dashboard', body: 'Revenue, costs, top customers, and cashflow projection in one executive view.' },
  { title: 'Weekly Financial Email', body: 'Automated P&L or I&E PDF emailed to your admin every Monday at 8 AM.' },
  { title: 'SMS Shortage Alerts', body: 'Instant SMS to the owner when any till closes with a cash shortage — wherever you are.' },
  { title: 'Per-Tenant Data Isolation', body: 'Your own dedicated PostgreSQL schema. Your data is never mixed with another tenant\'s.' },
];

export function Features() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
            Platform Features
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Everything Your Business Needs
          </h1>
          <p className="text-lg text-ink-300 max-w-2xl mx-auto leading-relaxed">
            Ledgio ships with a comprehensive feature set across every sector. Below are the core features every workspace gets — plus sector-specific additions for each industry.
          </p>
        </div>
      </section>

      {/* Core features grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white mb-10 text-center">Core Platform Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CORE.map((f) => (
              <div key={f.title} className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-5">
                <CheckCircle2 className="h-4 w-4 text-brand-500 mb-3" />
                <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-ink-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sector-specific features */}
      <section className="py-24 border-t border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black text-white mb-4">Sector-Specific Features</h2>
            <p className="text-ink-400 text-sm">Choose your sector to see the additional features built specifically for your industry.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SECTORS.map((s) => (
              <Link
                key={s.slug}
                to={`/for/${s.slug}`}
                className={`group flex flex-col bg-ink-900/60 border ${s.accent.border} rounded-2xl p-6 hover:bg-ink-800/60 transition-all`}
              >
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1.5">{s.label}</h3>
                <p className="text-xs text-ink-500 leading-relaxed flex-1">{s.tagline}</p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${s.accent.text}`}>
                  See features <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
