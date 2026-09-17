import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Shield,
  Zap,
  CreditCard,
  BarChart3,
  Users,
  CheckCircle2,
  Quote,
} from 'lucide-react';
import { SECTORS } from '../lib/sectors';

const CAPABILITY_CARDS = [
  {
    title: 'Automate your accounts',
    body: 'Full double-entry accounting engine posts every sale, invoice, and expense to your books in real time. No manual journals. No delays.',
    Icon: BarChart3,
    color: 'from-brand-900 to-blue-950',
  },
  {
    title: 'Stay tax-compliant',
    body: 'GRA e-VAT integration, NHIS claims management, and SSNIT payroll compliance — built in and ready to use from day one.',
    Icon: Shield,
    color: 'from-blue-950 to-indigo-950',
  },
  {
    title: 'Manage your team',
    body: 'Run payroll, generate payslips, enforce approval workflows, and give every staff member the exact access they need — nothing more.',
    Icon: Users,
    color: 'from-indigo-950 to-violet-950',
  },
  {
    title: 'Accept Mobile Money',
    body: 'MTN, Telecel, and AirtelTigo collections built in. Every payment posts to the correct account instantly — zero manual reconciliation.',
    Icon: CreditCard,
    color: 'from-violet-950 to-brand-950',
  },
  {
    title: 'Know your numbers',
    body: 'Real-time P&L, Cash Flow, Balance Sheet, and analytics dashboard. Automated weekly financial email every Monday at 8 AM.',
    Icon: Zap,
    color: 'from-brand-950 to-teal-950',
  },
];

const WHY_STATS = [
  {
    value: '7',
    label: 'Sectors served',
    body: 'Purpose-built solutions for retail, schools, churches, pharmacies, manufacturers, enterprise businesses, and professional service firms.',
    link: { label: 'Explore sector solutions', to: '/for/retail' },
  },
  {
    value: '15+',
    label: 'Core modules',
    body: 'Every workspace ships with invoicing, payroll, Mobile Money, inventory, bank reconciliation, and full double-entry accounting — out of the box.',
    link: { label: 'See all features', to: '/features' },
  },
  {
    value: 'GH₵0',
    label: 'Setup or implementation fee',
    body: 'No consultants, no implementation costs. Your workspace is provisioned in under 5 minutes and ready to use immediately.',
    link: { label: 'View pricing', to: '/pricing' },
  },
  {
    value: '100%',
    label: 'Data isolation per tenant',
    body: 'Every business gets its own dedicated PostgreSQL schema. Your data is never mixed with another tenant\'s — ever.',
    link: { label: 'How it works', to: '/how-it-works' },
  },
];

export function Home() {
  const [activeQuote] = useState(0);

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-28 sm:pt-28 sm:pb-36 overflow-hidden">
        {/* bg layers */}
        <img
          src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1920&q=80&auto=format&fit=crop"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/70 to-ink-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* Announcement pill */}
          <a
            href="https://ledgio-fawn.vercel.app/register?sector=pharmacy"
            className="inline-flex flex-col items-center px-5 py-3 mb-10 rounded-2xl border border-brand-700/40 bg-brand-950/50 backdrop-blur-sm hover:bg-brand-950/70 transition-colors group"
          >
            <span className="text-[11px] font-black uppercase tracking-widest text-brand-200">
              Now live: Pharmacy module
            </span>
            <span className="flex items-center gap-1 text-brand-400 text-sm font-semibold mt-0.5">
              NHIS claims · GRA e-VAT · Drug interaction checks
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </a>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.08] tracking-tight mb-6">
            Accounting software built{' '}
            <span className="bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">
              for Africa
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink-300 leading-relaxed max-w-2xl mx-auto mb-10">
            Control your financial information across every sector — retail, schools, pharmacies, churches, manufacturing, and more.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/for/retail"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-950/60 transition-colors"
            >
              Explore sector solutions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800/60 transition-colors"
            >
              Explore all features
            </Link>
          </div>
        </div>

        {/* Sector scroll bar */}
        <div className="relative mt-16 overflow-hidden">
          <div className="flex gap-4 animate-[scroll_30s_linear_infinite] w-max">
            {[...SECTORS, ...SECTORS].map((s, i) => (
              <Link
                key={i}
                to={`/for/${s.slug}`}
                className="flex-shrink-0 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-ink-700/60 bg-ink-900/60 backdrop-blur-sm text-ink-300 text-sm font-medium hover:border-brand-600/60 hover:text-brand-300 transition-colors"
              >
                <span className="text-lg leading-none">{s.icon}</span>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Here's what Ledgio can do for you ── */}
      <section className="py-24 bg-ink-900/30 border-y border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Here's what Ledgio can do for you
            </h2>
            <p className="text-ink-400 text-base leading-relaxed">
              Ledgio helps businesses securely manage and automate their finances — transforming raw transactions into trusted, real-time accounting information.
            </p>
          </div>

          {/* Horizontal scroll cards */}
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-5">
            {CAPABILITY_CARDS.map((card) => {
              const Icon = card.Icon;
              return (
                <div
                  key={card.title}
                  className={`flex-shrink-0 w-[280px] lg:w-auto snap-start bg-gradient-to-b ${card.color} border border-white/5 rounded-2xl p-7 flex flex-col`}
                >
                  <div className="p-2.5 bg-white/10 rounded-xl w-fit mb-5">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-3">{card.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed flex-1">{card.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Why Ledgio? ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Why Ledgio?</h2>
            <p className="text-ink-400 text-base leading-relaxed">
              Ledgio brings enterprise-grade accounting to every type of African business — with zero implementation cost and real-time financial clarity from day one.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
            {WHY_STATS.map((s) => (
              <div key={s.label} className="space-y-4">
                <div className="text-5xl sm:text-6xl font-black text-brand-400">{s.value}</div>
                <div className="text-base font-bold text-white">{s.label}</div>
                <p className="text-sm text-ink-400 leading-relaxed">{s.body}</p>
                <Link
                  to={s.link.to}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {s.link.label} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Customer quote ── */}
      <section className="py-24 border-t border-ink-800/60 bg-ink-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Quote className="h-10 w-10 text-brand-600/60 mx-auto mb-8" />
          <blockquote className="text-xl sm:text-2xl font-medium text-white leading-relaxed mb-8">
            "With Ledgio, we can see our Mobile Money collections, stock levels, and daily P&L all in one place.
            Our Monday morning report lands in my inbox automatically — I haven't had to log in just to check the numbers."
          </blockquote>
          <div className="text-sm text-ink-500">
            <span className="font-bold text-ink-300">Business owner</span>
            <span className="mx-2">·</span>
            <span>Small Retail, Greater Accra</span>
          </div>
          <div className="mt-8">
            <a
              href="https://ledgio-fawn.vercel.app/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-lg shadow-brand-950/50"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Sector solutions ── */}
      <section className="py-24 border-t border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
              Industry Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for your sector
            </h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              Choose your sector to see the features, workflows, and reports designed specifically for your type of organisation.
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
                <h3 className="text-base font-bold text-white mb-2">
                  {s.label}
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed flex-1">{s.tagline}</p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${s.accent.text}`}>
                  See features <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform foundations ── */}
      <section className="py-24 border-t border-ink-800/60 bg-ink-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Included in every plan</h2>
            <p className="text-ink-400 text-sm">These features ship with every Ledgio workspace, across every sector.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
            {[
              'Double-entry accounting engine',
              'Dedicated PostgreSQL schema per tenant',
              'Role-based access control',
              'Full audit trail on every record',
              'Mobile Money (MTN, Telecel, AirtelTigo)',
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

      {/* ── Final CTA ── */}
      <section className="py-24 border-t border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-600 to-blue-700 p-12 sm:p-16 overflow-hidden text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10)_0%,transparent_60%)]" />
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Find your sector and get started today
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-8">
                No credit card. No setup fee. Your workspace is provisioned in under 5 minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="https://ledgio-fawn.vercel.app/register"
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
