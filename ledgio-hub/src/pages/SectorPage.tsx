import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { SectorData } from '../lib/sectors';

interface Props {
  sector: SectorData;
}

export function SectorPage({ sector }: Props) {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <img
          src={sector.heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.14] mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/40" />
        <div className={`absolute inset-0 bg-gradient-to-br ${sector.accent.from} ${sector.accent.to} opacity-[0.08]`} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 ${sector.accent.badge}`}>
              <span className="text-base">{sector.icon}</span>
              {sector.label}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
              {sector.hero.headline}
            </h1>
            <p className="text-lg text-ink-300 leading-relaxed mb-10 max-w-2xl">
              {sector.hero.sub}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://ledgio-fawn.vercel.app/register"
                className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r ${sector.accent.from} ${sector.accent.to} shadow-lg transition-opacity hover:opacity-90`}
              >
                {sector.hero.cta} <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/demo"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800 transition-colors"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-ink-800/60 bg-ink-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-ink-800/60">
            {sector.stats.map((s) => (
              <div key={s.label} className="text-center px-4">
                <div className={`text-2xl sm:text-3xl font-black mb-1 ${sector.accent.text}`}>{s.value}</div>
                <div className="text-xs text-ink-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Everything {sector.label} Need
            </h2>
            <p className="text-ink-400 text-sm leading-relaxed">
              {sector.tagline} Every feature below is included in your Ledgio workspace from day one.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sector.features.map((f) => (
              <div
                key={f.title}
                className={`bg-ink-900/60 border ${sector.accent.border} rounded-2xl p-6 hover:bg-ink-800/60 transition-colors`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${sector.accent.text}`} />
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                </div>
                <p className="text-xs text-ink-400 leading-relaxed pl-8">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">How It Works</h2>
            <p className="text-ink-400 text-sm">Get up and running in less than a day — no technical setup, no implementation fee.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sector.howItWorks.map((h) => (
              <div key={h.step} className="relative">
                <div className={`text-5xl font-black mb-4 ${sector.accent.text} opacity-30`}>{h.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{h.title}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`relative rounded-3xl bg-gradient-to-br ${sector.accent.from} ${sector.accent.to} p-12 sm:p-16 overflow-hidden`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.3)_0%,transparent_70%)]" />
            <div className="relative max-w-2xl">
              <div className="text-4xl mb-4">{sector.icon}</div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Ready to get started?
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-8">
                Register your {sector.label.toLowerCase()} workspace in under 5 minutes. No credit card required. No setup fee. Your data is yours.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://ledgio-fawn.vercel.app/register"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-white text-ink-900 hover:bg-ink-100 transition-colors shadow-lg"
                >
                  {sector.hero.cta} <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/demo"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
