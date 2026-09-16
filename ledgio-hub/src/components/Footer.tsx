import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { Logo, Wordmark } from './Logo';

const SOLUTIONS = [
  { label: 'Small Retail & Shops', to: '/for/retail' },
  { label: 'Enterprise & Multi-Branch', to: '/for/enterprise' },
  { label: 'Schools', to: '/for/schools' },
  { label: 'Churches & NGOs', to: '/for/churches-ngos' },
  { label: 'Pharmacy', to: '/for/pharmacy' },
  { label: 'Manufacturing', to: '/for/manufacturing' },
  { label: 'Professional Services', to: '/for/professional-services' },
];

const PRODUCT = [
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Blog', to: '/blog' },
];

const COMPANY = [
  { label: 'About Us', to: '/about' },
  { label: 'Book a Demo', to: '/demo' },
  { label: 'Terms & Conditions', to: '/legal/terms' },
  { label: 'Privacy Policy', to: '/legal/privacy' },
  { label: 'SLA', to: '/legal/sla' },
];

const CONTACTS = [
  { name: 'Sandra', role: 'Sales Executive', phone: '+233 24 805 1379' },
  { name: 'Erasmus Asare', role: 'Consultant Manager', phone: '+233 55 405 1068' },
  { name: 'Exceltrine Ntewusu', role: 'Customer Care', phone: '+233 59 850 0298' },
];

export function Footer() {
  return (
    <footer className="border-t border-ink-800/60 bg-ink-950 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-ink-800/60">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <Logo size={32} />
              <Wordmark />
            </Link>
            <p className="text-sm text-ink-500 leading-relaxed max-w-xs">
              Enterprise-grade accounting for every sector — retail, schools, churches, pharmacy, manufacturing, and more. Built for Africa.
            </p>
            <div className="mt-6 space-y-2">
              {CONTACTS.map((c) => (
                <div key={c.name} className="flex items-start gap-2 text-xs text-ink-500">
                  <Phone className="h-3.5 w-3.5 mt-0.5 text-brand-600 flex-shrink-0" />
                  <div>
                    <span className="text-ink-300 font-medium">{c.name}</span>
                    <span className="text-ink-600"> · {c.role} · </span>
                    <a href={`tel:${c.phone.replace(/\s/g,'')}`} className="hover:text-brand-400 transition-colors">{c.phone}</a>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-ink-500 mt-1">
                <Mail className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                <a href="mailto:ledgioapp@gmail.com" className="hover:text-brand-400 transition-colors">ledgioapp@gmail.com</a>
              </div>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-500 mb-4">Solutions</h4>
            <ul className="space-y-2.5">
              {SOLUTIONS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-500 mb-4">Product</h4>
            <ul className="space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-500 mb-4">Company</h4>
            <ul className="space-y-2.5">
              {COMPANY.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-600">
          <p>© {new Date().getFullYear()} Ledgio Software. All rights reserved.</p>
          <p>Built for businesses across Ghana and Africa.</p>
        </div>
      </div>
    </footer>
  );
}
