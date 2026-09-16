import { ArrowRight } from 'lucide-react';
import { SECTORS } from '../lib/sectors';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    step: '01',
    title: 'Register in 5 minutes',
    body: 'Create your account, enter your business or organisation name, and choose your sector. No credit card required. No setup fee.',
  },
  {
    step: '02',
    title: 'Choose your sector',
    body: 'Your sector selection provisions a dedicated workspace — with the right chart of accounts, navigation, and features for your type of organisation. Built for you from day one.',
  },
  {
    step: '03',
    title: 'Invite your team',
    body: 'Add your accountant, managers, cashiers, and staff. Each user gets a role with appropriate access. No one sees more than they should.',
  },
  {
    step: '04',
    title: 'Set up your data',
    body: 'Add your products, customers, suppliers, and opening balances. Import from a spreadsheet or enter manually. The onboarding wizard guides you through each step.',
  },
  {
    step: '05',
    title: 'Start transacting',
    body: 'Issue invoices, record sales on the POS, collect fees, accept Mobile Money — every transaction posts to your books automatically as you go.',
  },
  {
    step: '06',
    title: 'Stay in control',
    body: 'Check your analytics dashboard, read the weekly financial email, approve expenses, and run reports — all from one place, on any device.',
  },
];

export function HowItWorks() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
            How It Works
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Up and Running<br />in Under a Day
          </h1>
          <p className="text-lg text-ink-300 max-w-2xl mx-auto leading-relaxed">
            No implementation consultant. No technical setup. No training course. Ledgio is designed for business owners, not accountants.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-ink-800/60 hidden sm:block" />
            <div className="space-y-10">
              {STEPS.map((s) => (
                <div key={s.step} className="relative flex gap-8 sm:gap-12 items-start">
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-brand-600 to-blue-600 flex items-center justify-center shadow-lg">
                    <span className="text-sm sm:text-base font-black text-white">{s.step}</span>
                  </div>
                  <div className="pt-2 sm:pt-3 flex-1">
                    <h3 className="text-lg font-black text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-ink-400 leading-relaxed max-w-2xl">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sector-specific flows */}
      <section className="py-24 border-t border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black text-white mb-4">See How It Works for Your Sector</h2>
            <p className="text-ink-400 text-sm">Every sector has its own tailored onboarding flow and workflow. Select yours below.</p>
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
                  See how it works <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-4">Ready to get started?</h2>
          <p className="text-ink-400 text-sm mb-8">Your workspace is ready in 5 minutes. No credit card. No setup fee.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://app.ledgio.io/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-lg">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/demo" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800 transition-colors">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
