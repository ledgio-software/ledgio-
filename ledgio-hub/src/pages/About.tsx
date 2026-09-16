import { ArrowRight, Users, Target, Heart } from 'lucide-react';

const TEAM = [
  { name: 'Sandra', role: 'Sales Executive', phone: '+233 24 805 1379' },
  { name: 'Erasmus Asare', role: 'Consultant Manager', phone: '+233 55 405 1068' },
  { name: 'Exceltrine Abena Ntewusu', role: 'Customer Care Representative', phone: '+233 59 850 0298' },
];

const VALUES = [
  { icon: Target, title: 'Precision', body: 'Every number must be correct. We build accounting software — accuracy is non-negotiable.' },
  { icon: Users, title: 'Accessibility', body: 'Powerful accounting should not require a finance degree to operate. We design for the business owner, not just the accountant.' },
  { icon: Heart, title: 'Trust', body: 'Your business data is private, isolated, and yours. We never share, sell, or aggregate tenant data.' },
];

export function About() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
              About Ledgio
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
              Accounting Built<br />
              <span className="bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">for Africa</span>
            </h1>
            <p className="text-lg text-ink-300 leading-relaxed max-w-2xl">
              Ledgio is an enterprise-grade, multi-tenant ERP and accounting platform designed specifically for businesses, schools, churches, pharmacies, and nonprofits across Ghana and Africa. We believe every organisation — regardless of size or sector — deserves accurate, trustworthy financial management tools.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 border-t border-ink-800/60 bg-ink-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-black text-white mb-6">Our Mission</h2>
              <p className="text-ink-300 leading-relaxed mb-4">
                Africa's businesses have been underserved by accounting software for too long. Generic, Western-market tools don't understand Mobile Money, don't support Ghana's chart of accounts, and don't account for how schools manage fees by term or how churches manage restricted donor funds.
              </p>
              <p className="text-ink-300 leading-relaxed mb-4">
                We built Ledgio from the ground up to solve these problems — with sector-specific workflows, local payment integrations, and a focus on the real-world challenges faced by African businesses every day.
              </p>
              <p className="text-ink-300 leading-relaxed">
                Every business on Ledgio gets its own completely isolated database schema. Your books are yours — private, secure, and never mixed with another tenant's data.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {VALUES.map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.title} className="flex gap-4 bg-ink-900/60 border border-ink-800/60 rounded-2xl p-6">
                    <div className="p-2.5 bg-brand-950/60 rounded-xl h-fit">
                      <Icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1.5">{v.title}</h3>
                      <p className="text-sm text-ink-400 leading-relaxed">{v.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl font-black text-white mb-4">Talk to the Team</h2>
            <p className="text-ink-400 text-sm">Real people. Real support. We're available to walk you through the platform or answer any questions.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {TEAM.map((t) => (
              <div key={t.name} className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-600 to-blue-600 flex items-center justify-center text-xl font-black text-white mx-auto mb-4">
                  {t.name[0]}
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{t.name}</h3>
                <p className="text-xs text-ink-500 mb-4">{t.role}</p>
                <a href={`tel:${t.phone.replace(/\s/g,'')}`} className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium">
                  {t.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-ink-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-4">Ready to see Ledgio in action?</h2>
          <p className="text-ink-400 text-sm mb-8">Register free or book a demo with one of our team.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://app.ledgio.io/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-lg">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/demo" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-ink-200 border border-ink-700 hover:bg-ink-800 transition-colors">
              Book a Demo
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
