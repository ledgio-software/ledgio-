import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Shield, Zap, Globe } from 'lucide-react';
import { SECTORS } from '../lib/sectors';

const TRUST_STATS = [
  { value: '7', label: 'Industry sectors' },
  { value: '100%', label: 'Data isolation per tenant' },
  { value: '0', label: 'Setup or implementation fee' },
  { value: 'Ghana', label: 'Built for Africa' },
];

const GLOBAL_FEATURES = [
  { icon: Shield, title: 'Bank-grade data isolation', body: 'Every business gets its own dedicated PostgreSQL schema. Your data is never mixed with another tenant.' },
  { icon: Zap, title: 'Real-time sync', body: 'Every transaction posts to your books instantly. No end-of-day batch runs. No delays.' },
  { icon: Globe, title: 'Built for Ghana & Africa', body: 'Mobile Money (MTN, Telecel, AirtelTigo), Ghana VAT, SSNIT payroll, and GRA e-VAT compliance built in.' },
];

export function Home() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(5,150,105,0.15)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-xs font-bold uppercase tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Enterprise Accounting for Every Sector
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            One Platform.{' '}
            <span className="bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">
              Every Sector.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-ink-300 leading-relaxed max-w-2xl mx-auto mb-10">
            Ledgio is a multi-tenant ERP and accounting platform built for retail shops, schools, churches, pharmacies, manufacturers, and professional firms across Africa.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://app.ledgio.io/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-950 transition-colors"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800 transition-colors"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Trust stats */}
      <section className="border-y border-ink-800/60 bg-ink-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-ink-800/60">
            {TRUST_STATS.map((s) => (
              <div key={s.label} className="text-center px-4">
                <div className="text-2xl sm:text-3xl font-black text-brand-400 mb-1">{s.value}</div>
                <div className="text-xs text-ink-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sector picker */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for Your Sector
            </h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              Choose your sector below to see the features, workflows, and reports designed specifically for your type of organisation.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SECTORS.map((s) => (
              <Link
                key={s.slug}
                to={`/for/${s.slug}`}
                className={`group flex flex-col bg-ink-900/60 border ${s.accent.border} rounded-2xl p-6 hover:bg-ink-800/60 transition-all hover:scale-[1.02]`}
              >
                <div className="text-3xl mb-4">{s.icon}</div>
                <h3 className={`text-base font-bold text-white mb-2 group-hover:${s.accent.text.replace('text-','text-')} transition-colors`}>
                  {s.label}
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed flex-1">{s.tagline}</p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${s.accent.text}`}>
                  See features <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Global features */}
      <section className="py-24 border-t border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Platform Foundations</h2>
            <p className="text-ink-400 text-sm">Every Ledgio workspace — regardless of sector — is built on the same enterprise-grade core.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {GLOBAL_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-8">
                  <div className="p-3 bg-brand-950/60 rounded-xl w-fit mb-5">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-ink-400 leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What every sector gets */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Included in Every Plan</h2>
            <p className="text-ink-400 text-sm">These features ship with every Ledgio workspace, across every sector.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
            {[
              'Double-entry accounting engine',
              'Dedicated PostgreSQL schema per tenant',
              'Role-based access control',
              'Full audit trail on every record',
              'Mobile Money collections (MTN, Telecel, AirtelTigo)',
              'Bank reconciliation',
              'Payroll & payslip generation',
              'Vendor bills & accounts payable',
              'Customer invoicing & accounts receivable',
              'Budgets & budget tracking',
              'Recurring transactions',
              'Weekly automated financial email',
              'Approval workflows',
              'SMS shortage alerts',
              'Analytics dashboard',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 bg-ink-900/40 border border-ink-800/40 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span className="text-sm text-ink-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 border-t border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-600 to-blue-700 p-12 sm:p-16 overflow-hidden text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Find your sector and get started today
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-8">
                No credit card. No setup fee. Your workspace is provisioned in under 5 minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="https://app.ledgio.io/register"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm bg-white text-ink-900 hover:bg-ink-100 transition-colors shadow-lg"
                >
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Book a Demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
