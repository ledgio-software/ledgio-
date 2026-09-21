import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Plus, Minus } from 'lucide-react';
import { Logo, Wordmark } from './Logo';

const SOLUTIONS = [
  { label: 'Small Retail & Shops', to: '/for/retail' },
  { label: 'Hotels & Guest Houses', to: '/for/hospitality' },
  { label: 'Schools, Churches & NGOs', to: '/for/schools' },
  { label: 'Pharmacy', to: '/for/pharmacy' },
  { label: 'Wholesale & Distribution', to: '/for/wholesale' },
  { label: 'Professional Services', to: '/for/professional-services' },
  { label: 'Construction & Contractors', to: '/for/construction' },
  { label: 'Manufacturing', to: '/for/manufacturing' },
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

type Section = 'solutions' | 'product' | 'company' | 'contact' | null;

function FooterSection({ title, open, onToggle, children }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink-800/60 sm:border-0">
      <button
        onClick={onToggle}
        className="sm:hidden w-full flex items-center justify-between py-4 text-[10px] font-black uppercase tracking-widest text-ink-500"
      >
        {title}
        {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
      <h4 className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-ink-500 mb-4">{title}</h4>
      <div className={`sm:block overflow-hidden transition-all duration-200 ${open ? 'max-h-96 pb-4' : 'max-h-0 sm:max-h-none'}`}>
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  const [openSection, setOpenSection] = useState<Section>(null);
  const toggle = (s: Section) => setOpenSection((prev) => (prev === s ? null : s));

  return (
    <footer className="border-t border-ink-800/60 bg-ink-950 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 sm:gap-10 pb-12 border-b border-ink-800/60">

          {/* Brand */}
          <div className="lg:col-span-2 pb-8 sm:pb-0 border-b border-ink-800/60 sm:border-0 mb-4 sm:mb-0">
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
          <FooterSection title="Solutions" open={openSection === 'solutions'} onToggle={() => toggle('solutions')}>
            <ul className="space-y-2.5">
              {SOLUTIONS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Product */}
          <FooterSection title="Product" open={openSection === 'product'} onToggle={() => toggle('product')}>
            <ul className="space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Company */}
          <FooterSection title="Company" open={openSection === 'company'} onToggle={() => toggle('company')}>
            <ul className="space-y-2.5">
              {COMPANY.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-ink-400 hover:text-brand-400 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </FooterSection>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-600">
          <p>© {new Date().getFullYear()} Ledgio Software. All rights reserved.</p>
          <p>Built for businesses across Ghana and Africa.</p>
        </div>
      </div>
    </footer>
  );
}
