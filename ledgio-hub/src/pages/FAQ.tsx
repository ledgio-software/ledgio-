import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Registration only asks for your business details and admin account — no payment card is required to provision your workspace and start your free trial.',
  },
  {
    q: 'Is my business data kept separate from other companies?',
    a: 'Yes. Every business on Ledgio is provisioned its own dedicated PostgreSQL schema. Your ledgers, inventory, and reports are completely isolated from every other tenant on the platform.',
  },
  {
    q: 'Can I change my sector after I register?',
    a: 'Your sector (org type) is chosen at registration because it determines your chart of accounts, navigation, and reporting labels. If you need to change sectors, contact our support team who can assist with migration.',
  },
  {
    q: 'What Mobile Money providers are supported?',
    a: 'Ledgio supports MTN Mobile Money, Telecel Cash, and AirtelTigo Money natively. Every collection posts to your accounts receivable instantly.',
  },
  {
    q: 'How do the SMS shortage alerts work?',
    a: 'When a shop till closes with a cash shortage, an instant SMS alert is sent to your registered owner phone number — no matter where you are. Available on all plans.',
  },
  {
    q: 'What is included in the weekly email report?',
    a: 'Every Monday at 8:00 AM, an automated financial PDF is emailed to your admin address. For business tenants this is a Profit & Loss statement; for schools and NGOs it is an Income & Expenditure statement. No login required.',
  },
  {
    q: 'How does fund accounting work for schools and churches?',
    a: 'When you register as a School or Church/NGO, your workspace is provisioned with restricted and unrestricted fund structures. Every transaction is tagged to a fund at the point of entry, and you can generate a separate Balance Sheet and I&E statement for each fund.',
  },
  {
    q: 'Can multiple users access the same workspace?',
    a: 'Yes. You can invite unlimited team members and assign each one a role — Admin, Accountant, Cashier, Manager, Auditor, and more. Each role sees only the features and data appropriate for their function.',
  },
  {
    q: 'Is there an implementation or setup fee?',
    a: 'No. Registration provisions your dedicated workspace instantly — there is no separate implementation cost, onboarding fee, or consultant engagement required to get started.',
  },
  {
    q: 'Can I upgrade my plan later?',
    a: 'Yes. You can upgrade at any time from the Subscription tab in your Settings. Your workspace moves to the new tier instantly.',
  },
  {
    q: 'Is Ledgio GRA VAT compliant?',
    a: 'Yes. Ledgio supports Ghana Revenue Authority e-VAT invoice generation with compliant invoice references and QR codes. The Pharmacy module includes full GRA e-VAT integration at the point of dispense.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your data is stored on secure, encrypted servers. Each tenant has its own dedicated schema and your data is never shared, sold, or used for any purpose other than providing you with the Ledgio service.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-ink-800/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-ink-900/40 hover:bg-ink-800/40 transition-colors"
      >
        <span className="text-sm font-bold text-white pr-4">{q}</span>
        <ChevronDown className={`h-4 w-4 text-ink-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 py-4 bg-ink-900/20 border-t border-ink-800/40">
          <p className="text-sm text-ink-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  return (
    <div className="min-h-screen">
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(5,150,105,0.10)_0%,transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
              FAQ
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">Frequently Asked Questions</h1>
            <p className="text-ink-400 text-sm">Can't find your answer here? Call us or send an email and we'll get back to you within 24 hours.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <div className="mt-12 text-center p-8 bg-ink-900/40 border border-ink-800/60 rounded-2xl">
            <p className="text-sm text-ink-400 mb-4">Still have questions?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="mailto:hello@ledgio.io" className="text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">hello@ledgio.io</a>
              <span className="text-ink-700">·</span>
              <a href="tel:+233248051379" className="text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">+233 24 805 1379</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
