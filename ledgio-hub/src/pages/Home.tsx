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
  Lock,
  Globe,
  TrendingUp,
  Clock,
  FileText,
  RefreshCw,
  Star,
  Database,
  Smartphone,
  ChevronDown,
  X,
} from 'lucide-react';
import { SECTORS } from '../lib/sectors';
import { SectorIcon } from '../lib/sectorIcons';
import { useState } from 'react';

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

const TESTIMONIALS = [
  {
    quote: 'With Ledgio, we can see our Mobile Money collections, stock levels, and daily P&L all in one place. My Monday morning report lands in my inbox automatically — I haven\'t had to log in just to check the numbers.',
    name: 'Abena M.',
    role: 'Owner, Supermarket',
    location: 'Greater Accra',
    stars: 5,
  },
  {
    quote: 'Our school bursar used to spend two days every term just reconciling fee receipts. With Ledgio\'s student ledger and fund accounting, that\'s down to a single morning. The income & expenditure report is exactly what our board expects.',
    name: 'Emmanuel K.',
    role: 'Head Teacher',
    location: 'Ashanti Region',
    stars: 5,
  },
  {
    quote: 'The NHIS claims module alone paid for the subscription in the first month. We no longer lose track of billed prescriptions. Every claim is itemised, ready to submit, and tied back to the prescription register.',
    name: 'Adwoa O.',
    role: 'Pharmacy Manager',
    location: 'Western Region',
    stars: 5,
  },
];

const INTEGRATIONS = [
  { name: 'MTN MoMo', desc: 'Collections & disbursements', color: 'bg-yellow-500/10 border-yellow-600/30 text-yellow-300', emoji: '📱' },
  { name: 'Telecel Ghana', desc: 'Mobile Money payments', color: 'bg-red-500/10 border-red-600/30 text-red-300', emoji: '📡' },
  { name: 'AirtelTigo', desc: 'Mobile Money collections', color: 'bg-orange-500/10 border-orange-600/30 text-orange-300', emoji: '🔗' },
  { name: 'GRA e-VAT', desc: 'Electronic invoice compliance', color: 'bg-blue-500/10 border-blue-600/30 text-blue-300', emoji: '🏛️' },
  { name: 'NHIS', desc: 'Claims management', color: 'bg-green-500/10 border-green-600/30 text-green-300', emoji: '🏥' },
  { name: 'SSNIT', desc: 'Payroll deductions', color: 'bg-purple-500/10 border-purple-600/30 text-purple-300', emoji: '🛡️' },
  { name: 'Mono Bank Feed', desc: 'Automated bank reconciliation', color: 'bg-cyan-500/10 border-cyan-600/30 text-cyan-300', emoji: '🏦' },
  { name: 'NEPP', desc: 'Pharmacy e-prescriptions', color: 'bg-rose-500/10 border-rose-600/30 text-rose-300', emoji: '💊' },
];

const COMPARISON = [
  { feature: 'Double-entry accounting engine', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'Mobile Money (MTN, Telecel, AirtelTigo)', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'GRA e-VAT compliance', ledgio: true, spreadsheets: false, basic: '⚠️ Manual' },
  { feature: 'NHIS claims management', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'SSNIT payroll integration', ledgio: true, spreadsheets: false, basic: '⚠️ Manual' },
  { feature: 'Sector-specific chart of accounts', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'Automatic weekly financial email', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'Dedicated database schema per business', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'Approval workflows & audit trail', ledgio: true, spreadsheets: false, basic: false },
  { feature: 'Offline sync & mobile access', ledgio: true, spreadsheets: '⚠️ Limited', basic: '⚠️ Limited' },
  { feature: 'Setup or implementation cost', ledgio: 'GH₵0', spreadsheets: 'GH₵0', basic: 'GH₵500–5,000+' },
  { feature: 'Real-time multi-user access', ledgio: true, spreadsheets: false, basic: true },
];

const SECURITY_FEATURES = [
  {
    Icon: Database,
    title: 'Dedicated schema per business',
    body: 'Every Ledgio workspace runs in its own isolated PostgreSQL schema. Your data physically cannot be seen by, or mixed with, any other tenant\'s data — ever.',
  },
  {
    Icon: Lock,
    title: 'Role-based access control',
    body: 'Assign Cashier, Accountant, Manager, Auditor, or Admin roles. Each role is locked to exactly the screens and actions it needs — nothing more.',
  },
  {
    Icon: FileText,
    title: 'Tamper-proof audit trail',
    body: 'Every record — creation, edit, deletion — is written to an immutable audit log with a SHA-256 hash chain. Changes cannot be silently reversed.',
  },
  {
    Icon: RefreshCw,
    title: 'Offline-first sync engine',
    body: 'Changes made offline are queued in an encrypted outbox and synced when connectivity returns. You never lose a transaction.',
  },
  {
    Icon: Globe,
    title: 'HTTPS end-to-end',
    body: 'All traffic is encrypted in transit with TLS 1.3. API tokens are hashed with bcrypt. Passwords are never stored in plaintext.',
  },
  {
    Icon: Clock,
    title: '99.9% uptime SLA',
    body: 'Hosted on enterprise cloud infrastructure with automated backups every 6 hours. Your books are always available when you need them.',
  },
];

const FAQS = [
  {
    q: 'Do I need an accountant to use Ledgio?',
    a: 'No. Ledgio is designed for business owners with no accounting background. Every transaction you enter is automatically posted to the correct accounts. You see plain-language summaries — not journal entries.',
  },
  {
    q: 'How long does it take to get started?',
    a: 'Under 5 minutes. Create your account, select your sector, enter your business name, and your workspace is ready. No installation, no implementation consultant, no setup fee.',
  },
  {
    q: 'Can I switch sectors later?',
    a: 'You can contact support to discuss migrating your workspace. We recommend selecting your closest sector at registration — each sector ships with its own chart of accounts and workflows.',
  },
  {
    q: 'Is my financial data safe?',
    a: 'Yes. Every Ledgio workspace gets its own dedicated PostgreSQL database schema. Your data is never co-mingled with another business\'s data. All traffic is encrypted in transit (TLS 1.3) and at rest.',
  },
  {
    q: 'Does Ledgio work for businesses outside Ghana?',
    a: 'The core double-entry accounting, invoicing, payroll, and inventory features work for any business. The Ghana-specific integrations (GRA e-VAT, NHIS, SSNIT, MoMo) are active by default for Ghanaian businesses and can be disabled for others.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export all your data in CSV and PDF format at any time. We retain your workspace for 30 days after cancellation to allow final exports, then permanently delete it on your request.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-ink-800/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-ink-800/40 transition-colors"
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        {open ? <X className="h-4 w-4 text-ink-500 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-ink-500 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-ink-400 leading-relaxed border-t border-ink-800/60">
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

export function Home() {
  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-28 sm:pt-28 sm:pb-36 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1920&q=80&auto=format&fit=crop"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.15]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/60 via-ink-950/80 to-ink-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(5,150,105,0.15)_0%,transparent_70%)]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

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

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.08] tracking-tight mb-6">
            Accounting software built{' '}
            <span className="bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">
              for Africa
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink-300 leading-relaxed max-w-2xl mx-auto mb-10">
            One platform for every type of African business — retail shops, schools, pharmacies, churches, manufacturers, and enterprises. Real-time accounting, GRA compliance, and Mobile Money, all in one place.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <a
              href="https://ledgio-fawn.vercel.app/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-950/60 transition-colors"
            >
              Start free — no credit card <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800/60 transition-colors"
            >
              Explore all features
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-ink-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> GH₵0 setup fee</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> Ready in under 5 minutes</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> GRA e-VAT compliant</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> NHIS & SSNIT ready</span>
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
                <SectorIcon slug={s.slug} className="h-4 w-4 flex-shrink-0" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations / compliance strip ── */}
      <section className="py-16 border-y border-ink-800/60 bg-ink-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-black uppercase tracking-widest text-ink-600 mb-8">
            Built-in integrations & compliance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {INTEGRATIONS.map((intg) => (
              <div
                key={intg.name}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border ${intg.color} text-center`}
              >
                <span className="text-2xl">{intg.emoji}</span>
                <span className="text-[11px] font-bold leading-tight">{intg.name}</span>
                <span className="text-[10px] text-ink-500 leading-tight">{intg.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What Ledgio can do ── */}
      <section className="py-24 bg-ink-900/30 border-b border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Here's what Ledgio can do for you
            </h2>
            <p className="text-ink-400 text-base leading-relaxed">
              Ledgio helps businesses securely manage and automate their finances — transforming raw transactions into trusted, real-time accounting information.
            </p>
          </div>

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

      {/* ── Product showcase with image ── */}
      <section className="py-24 border-b border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
                Real-time financial clarity
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
                Your entire business in one dashboard
              </h2>
              <p className="text-ink-400 text-sm leading-relaxed mb-8">
                Stop piecing together spreadsheets. Ledgio gives you a live dashboard with your cash position, outstanding invoices, payroll liabilities, and stock levels — refreshed in real time, every time a transaction is posted.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  { icon: TrendingUp, text: 'Real-time Profit & Loss, Balance Sheet, and Cash Flow — no waiting for month-end' },
                  { icon: Smartphone, text: 'Mobile Money collections post automatically to the correct account — zero manual reconciliation' },
                  { icon: FileText, text: 'Automated weekly financial email every Monday at 8 AM — know your numbers before the week begins' },
                  { icon: BarChart3, text: 'Drill down from a summary number to the individual transaction in two clicks' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-brand-950/60 border border-brand-700/30 flex-shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-brand-400" />
                    </div>
                    <span className="text-sm text-ink-300 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
              <Link to="/features" className="inline-flex items-center gap-2 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">
                See all features <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80&auto=format&fit=crop"
                alt="Financial dashboard showing charts and analytics"
                className="rounded-2xl w-full object-cover shadow-2xl shadow-ink-950/80 border border-ink-800/40"
                style={{ height: '420px' }}
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                <div className="flex-1 bg-ink-900/90 backdrop-blur-sm border border-ink-700/60 rounded-xl px-4 py-3">
                  <div className="text-[10px] text-ink-500 font-medium mb-0.5">This week's revenue</div>
                  <div className="text-base font-black text-brand-400">GH₵ 48,320</div>
                </div>
                <div className="flex-1 bg-ink-900/90 backdrop-blur-sm border border-ink-700/60 rounded-xl px-4 py-3">
                  <div className="text-[10px] text-ink-500 font-medium mb-0.5">Outstanding invoices</div>
                  <div className="text-base font-black text-white">GH₵ 12,100</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Payroll & compliance showcase ── */}
      <section className="py-24 border-b border-ink-800/60 bg-ink-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80&auto=format&fit=crop"
                alt="Team payroll and HR management"
                className="rounded-2xl w-full object-cover shadow-2xl shadow-ink-950/80 border border-ink-800/40"
                style={{ height: '420px' }}
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 bg-ink-900/90 backdrop-blur-sm border border-ink-700/60 rounded-xl px-4 py-3">
                <div className="text-[10px] text-ink-500 font-medium mb-0.5">March payroll — 14 staff</div>
                <div className="text-base font-black text-white">SSNIT deducted · Payslips sent</div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-950/60 border border-blue-700/40 text-blue-300 text-[10px] font-black uppercase tracking-widest mb-6">
                Payroll & compliance
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
                Run payroll in minutes, not days
              </h2>
              <p className="text-ink-400 text-sm leading-relaxed mb-8">
                Ledgio handles Ghana payroll end to end — from calculating SSNIT contributions and income tax to generating and emailing individual payslips. Every payrun is posted to your accounts automatically.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'SSNIT deductions', desc: 'Calculated and posted automatically on every payrun' },
                  { label: 'Income tax (PAYE)', desc: 'Tax bands applied to each employee\'s gross pay' },
                  { label: 'Payslip generation', desc: 'PDF payslips emailed to each employee on approval' },
                  { label: 'Approval workflow', desc: 'Director sign-off required before payroll is posted' },
                ].map((item) => (
                  <div key={item.label} className="bg-ink-900/60 border border-ink-700/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-white">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-ink-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Ledgio? ── */}
      <section className="py-24 border-b border-ink-800/60">
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

      {/* ── Testimonials ── */}
      <section className="py-24 border-b border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What our customers say</h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              Business owners, school administrators, and pharmacy managers across Ghana rely on Ledgio every day.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-7 flex flex-col">
                <div className="flex items-center gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-brand-400 text-brand-400" />
                  ))}
                </div>
                <Quote className="h-7 w-7 text-brand-700/50 mb-4 flex-shrink-0" />
                <blockquote className="text-sm text-ink-300 leading-relaxed flex-1 mb-6">
                  "{t.quote}"
                </blockquote>
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{t.role} · {t.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sector solutions ── */}
      <section className="py-24 border-b border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
              Industry Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for your sector
            </h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              Generic accounting software doesn't understand how schools collect fees, how pharmacies bill NHIS, or how churches track restricted donor funds. Ledgio does — because each sector gets its own purpose-built workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SECTORS.map((s) => (
              <Link
                key={s.slug}
                to={`/for/${s.slug}`}
                className={`group flex flex-col bg-ink-900/60 border ${s.accent.border} rounded-2xl p-6 hover:bg-ink-800/60 transition-all hover:scale-[1.02]`}
              >
                <div className={`mb-4 inline-flex items-center justify-center h-11 w-11 rounded-xl ${s.accent.badge}`}>
                  <SectorIcon slug={s.slug} className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{s.label}</h3>
                <p className="text-xs text-ink-500 leading-relaxed flex-1">{s.tagline}</p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-bold ${s.accent.text}`}>
                  See features <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security & data protection ── */}
      <section className="py-24 border-b border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-950/60 border border-blue-700/40 text-blue-300 text-[10px] font-black uppercase tracking-widest mb-6">
                Security & data protection
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
                Your financial data is yours — and only yours
              </h2>
              <p className="text-ink-400 text-sm leading-relaxed mb-8">
                Ledgio is built on a strict multi-tenant architecture where your data never touches another business's schema. We've designed every layer — from the database to the API to the audit trail — with security as the starting point, not an afterthought.
              </p>
              <img
                src="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80&auto=format&fit=crop"
                alt="Secure server infrastructure"
                className="rounded-2xl w-full object-cover border border-ink-800/40 shadow-xl shadow-ink-950/60"
                style={{ height: '240px' }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECURITY_FEATURES.map(({ Icon, title, body }) => (
                <div key={title} className="bg-ink-900/60 border border-ink-800/50 rounded-2xl p-5">
                  <div className="p-2 bg-blue-950/60 border border-blue-700/30 rounded-lg w-fit mb-4">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                  <p className="text-xs text-ink-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform foundations ── */}
      <section className="py-24 border-b border-ink-800/60">
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

      {/* ── Comparison table ── */}
      <section className="py-24 border-b border-ink-800/60 bg-ink-900/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              How Ledgio compares
            </h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              Spreadsheets and generic software weren't built for African compliance or Mobile Money. Ledgio was.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-ink-800/60">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-ink-800/60 bg-ink-900/60">
                  <th className="text-left px-5 py-4 text-xs font-bold text-ink-400 w-1/2">Feature</th>
                  <th className="px-5 py-4 text-center text-xs font-bold text-brand-400">Ledgio</th>
                  <th className="px-5 py-4 text-center text-xs font-bold text-ink-400">Spreadsheets</th>
                  <th className="px-5 py-4 text-center text-xs font-bold text-ink-400">Generic software</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-ink-800/40 ${i % 2 === 0 ? 'bg-ink-900/30' : 'bg-transparent'}`}>
                    <td className="px-5 py-3.5 text-xs text-ink-300">{row.feature}</td>
                    <td className="px-5 py-3.5 text-center text-xs">
                      {row.ledgio === true ? <CheckCircle2 className="h-4 w-4 text-brand-500 mx-auto" /> : <span className="text-brand-400 font-bold">{row.ledgio}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs">
                      {row.spreadsheets === true ? <CheckCircle2 className="h-4 w-4 text-brand-500 mx-auto" /> : row.spreadsheets === false ? <X className="h-4 w-4 text-ink-600 mx-auto" /> : <span className="text-amber-400 font-bold">{row.spreadsheets}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs">
                      {row.basic === true ? <CheckCircle2 className="h-4 w-4 text-brand-500 mx-auto" /> : row.basic === false ? <X className="h-4 w-4 text-ink-600 mx-auto" /> : <span className="text-amber-400 font-bold">{row.basic}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 border-b border-ink-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Frequently asked questions</h2>
            <p className="text-ink-400 text-sm">Everything you need to know before getting started.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-ink-500 mb-3">Still have questions?</p>
            <Link to="/demo" className="inline-flex items-center gap-2 text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">
              Book a free demo call <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-600 to-blue-700 p-12 sm:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10)_0%,transparent_60%)]" />
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=70&auto=format&fit=crop"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"
            />
            <div className="relative max-w-2xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Find your sector and get started today
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-8">
                No credit card. No setup fee. Your workspace is provisioned in under 5 minutes — with the chart of accounts, reports, and workflows already configured for your type of business.
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
              <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-white/60">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-white/40" /> GH₵0 setup fee</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-white/40" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-white/40" /> Cancel anytime</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-white/40" /> Your data, your export</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
