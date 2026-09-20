import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnboarding } from '../lib/onboardingContext';
import { SECTOR_PRICING, DEFAULT_SECTOR_SLUG } from '../lib/sectorPricing';
import { SectorIcon } from '../lib/sectorIcons';

const SECTOR_TABS = SECTOR_PRICING.map((s) => ({ slug: s.sectorSlug, label: s.label }));

const FAQ = [
  { q: 'Is there a free trial?', a: 'Yes. Every new account starts on a free trial so you can explore the platform before choosing a plan. No credit card required to register.' },
  { q: 'How is billing handled?', a: 'Plans are billed monthly via Mobile Money (MTN, Telecel, AirtelTigo) or card through Paystack. Your subscription renews automatically every 30 days.' },
  { q: 'Is there a setup or implementation fee?', a: 'No. Registration provisions your workspace instantly — no consultant, no setup charge, no implementation fee.' },
  { q: 'Can I upgrade or downgrade my plan?', a: 'Yes. You can upgrade at any time from your Settings. Your workspace moves to the new tier instantly.' },
  { q: 'Do all sectors have their own pricing?', a: 'Yes. Each sector is priced based on the depth of features it includes. Select your sector above to see the relevant plans.' },
];

export function Pricing() {
  const { open: openOnboarding } = useOnboarding();
  const [activeSector, setActiveSector] = useState(DEFAULT_SECTOR_SLUG);

  const sectorData = SECTOR_PRICING.find((s) => s.sectorSlug === activeSector)!;

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
            Priced for Your Sector
          </h1>
          <p className="text-lg text-ink-300 max-w-xl mx-auto">
            Each sector is priced based on what it includes. Select yours below to see the right plan for your organisation.
          </p>
        </div>
      </section>

      {/* Sector tabs */}
      <section className="pb-4 pt-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {SECTOR_TABS.map((tab) => (
              <button
                key={tab.slug}
                onClick={() => setActiveSector(tab.slug)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeSector === tab.slug
                    ? 'bg-brand-600 border-brand-500 text-white shadow-lg'
                    : 'bg-ink-900/60 border-ink-800/60 text-ink-400 hover:text-white hover:border-ink-700'
                }`}
              >
                <SectorIcon slug={tab.slug} className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {sectorData.tiers.map((plan) => (
              <div
                key={plan.slug}
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
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-ink-500">{plan.period}</span>}
                </div>
                <p className="text-[11px] text-brand-400 font-medium mb-2">{plan.seats}</p>
                <p className="text-xs text-ink-500 mb-6 leading-relaxed">{plan.description}</p>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-300">
                      <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.enterprise ? (
                  <Link
                    to="/demo"
                    className="block text-center py-3.5 rounded-xl font-bold text-sm transition-colors border border-ink-700 text-ink-200 hover:bg-ink-800"
                  >
                    Contact Sales
                  </Link>
                ) : (
                  <button
                    onClick={() => openOnboarding(activeSector)}
                    className={`block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-colors ${
                      plan.highlight
                        ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-950'
                        : 'border border-ink-700 text-ink-200 hover:bg-ink-800'
                    }`}
                  >
                    Get Started {plan.highlight && <ArrowRight className="inline h-4 w-4" />}
                  </button>
                )}
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
