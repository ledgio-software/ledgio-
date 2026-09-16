import { ArrowRight, CheckCircle2 } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'For individuals and very small businesses getting started.',
    highlight: false,
    features: [
      'Up to 2 users',
      'Invoicing & basic accounts',
      'POS (1 till)',
      'Basic inventory',
      'Bank reconciliation',
      'Customer & supplier management',
      'Weekly P&L email',
      'Dedicated database schema',
    ],
    cta: 'Get Started Free',
    href: 'https://app.ledgio.io/register',
  },
  {
    name: 'Professional',
    price: '₵299',
    period: '/ month',
    description: 'For growing businesses that need the full platform.',
    highlight: true,
    features: [
      'Up to 10 users',
      'All Starter features',
      'Multi-warehouse / godown',
      'Payroll management',
      'Budgets & variance tracking',
      'Approval workflows',
      'Mobile Money collections',
      'SMS shortage alerts',
      'Student / fund accounting (sector)',
      'Recurring transactions',
      'Advanced analytics dashboard',
      'Priority support',
    ],
    cta: 'Start Professional Trial',
    href: 'https://app.ledgio.io/register',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organisations with advanced requirements.',
    highlight: false,
    features: [
      'Unlimited users',
      'All Professional features',
      'Unlimited branches & warehouses',
      'Custom approval chain configuration',
      'Dedicated account manager',
      'SLA-backed support',
      'Mono bank feed integration',
      'Custom reporting & exports',
      'White-glove onboarding',
    ],
    cta: 'Contact Sales',
    href: '/demo',
  },
];

const FAQ = [
  { q: 'Can I start on the free Starter plan and upgrade later?', a: 'Yes. You can upgrade at any time from your Settings. Your workspace moves to the new tier instantly.' },
  { q: 'How is billing handled?', a: 'Professional plans are billed monthly via Mobile Money (MTN, Telecel, AirtelTigo) or card. Enterprise plans are invoiced quarterly.' },
  { q: 'Is there a setup or implementation fee?', a: 'No. Registration provisions your workspace instantly — no consultant, no setup charge.' },
  { q: 'Do all sectors have access to the same plans?', a: 'Yes. All plans are available to every sector — Retail, Schools, Churches, Pharmacy, Manufacturing, and Professional Services.' },
];

export function Pricing() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
            Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4">
            Simple, Honest Pricing
          </h1>
          <p className="text-lg text-ink-300 max-w-xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees, no implementation charges, no surprises.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-brand-950/80 to-ink-900 border-2 border-brand-600/60 shadow-2xl shadow-brand-950'
                    : 'bg-ink-900/60 border border-ink-800/60'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-black text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-ink-500">{plan.period}</span>}
                </div>
                <p className="text-xs text-ink-500 mb-6 leading-relaxed">{plan.description}</p>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-300">
                      <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`block text-center py-3.5 rounded-xl font-bold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-950'
                      : 'border border-ink-700 text-ink-200 hover:bg-ink-800'
                  }`}
                >
                  {plan.cta} {plan.highlight && <ArrowRight className="inline h-4 w-4" />}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-ink-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white mb-10 text-center">Pricing Questions</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="bg-ink-900/60 border border-ink-800/60 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-2">{item.q}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
