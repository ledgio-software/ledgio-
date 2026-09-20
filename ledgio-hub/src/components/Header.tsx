import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Logo, Wordmark } from './Logo';
import { useOnboarding } from '../lib/onboardingContext';

const SECTORS = [
  { label: 'Small Retail & Shops', to: '/for/retail' },
  { label: 'Enterprise & Multi-Branch', to: '/for/enterprise' },
  { label: 'Schools', to: '/for/schools' },
  { label: 'Churches & NGOs', to: '/for/churches-ngos' },
  { label: 'Pharmacy', to: '/for/pharmacy' },
  { label: 'Manufacturing', to: '/for/manufacturing' },
  { label: 'Professional Services', to: '/for/professional-services' },
];

const NAV = [
  { label: 'Why Ledgio', to: '/about' },
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
];

const MOBILE_NAV = [
  { label: 'Why Ledgio', to: '/about' },
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
  { label: 'FAQ', to: '/faq' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const location = useLocation();
  const { open: openOnboarding } = useOnboarding();

  const isActive = (to: string) => location.pathname === to;
  const close = () => { setMenuOpen(false); setMobileSolutionsOpen(false); };

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800/70 bg-ink-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3" onClick={close}>
          <Logo size={36} />
          <Wordmark />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-ink-300">

          {/* Solutions dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
          >
            <button className="flex items-center gap-1 hover:text-brand-400 transition-colors">
              Solutions <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {solutionsOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-60">
                <div className="bg-ink-900 border border-ink-700/60 rounded-xl shadow-2xl shadow-black/60 p-2">
                  {SECTORS.map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className="block px-3 py-2.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-brand-400 rounded-lg transition-colors"
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`hover:text-brand-400 transition-colors ${isActive(item.to) ? 'text-brand-400' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="https://ledgio-fawn.vercel.app/login"
            className="text-sm font-medium text-ink-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-ink-800"
          >
            Sign In
          </a>
          <button
            onClick={() => openOnboarding()}
            className="text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-brand-950"
          >
            Get Started Free
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="lg:hidden p-2 rounded-lg text-ink-300 hover:text-white hover:bg-ink-800 transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden border-t border-ink-800 bg-ink-950">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col">

            {/* Solutions accordion */}
            <button
              onClick={() => setMobileSolutionsOpen((o) => !o)}
              className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-ink-300 hover:text-brand-400 transition-colors"
            >
              Solutions
              <ChevronRight className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? 'rotate-90' : ''}`} />
            </button>
            {mobileSolutionsOpen && (
              <div className="pl-3 pb-1 space-y-0.5">
                {SECTORS.map((s) => (
                  <Link
                    key={s.to}
                    to={s.to}
                    onClick={close}
                    className="flex items-center justify-between px-3 py-2.5 text-sm text-ink-400 hover:text-brand-400 rounded-lg transition-colors"
                  >
                    {s.label}
                    <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                  </Link>
                ))}
              </div>
            )}

            {/* Flat nav links */}
            {MOBILE_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={close}
                className={`flex items-center justify-between px-3 py-3 text-sm font-medium transition-colors ${isActive(item.to) ? 'text-brand-400' : 'text-ink-300 hover:text-brand-400'}`}
              >
                {item.label}
                <ChevronRight className="h-4 w-4 opacity-40" />
              </Link>
            ))}

            {/* Mobile CTAs */}
            <div className="border-t border-ink-800 pt-4 mt-3 flex flex-col gap-3">
              <a href="https://ledgio-fawn.vercel.app/login" className="block text-center py-2.5 text-sm font-medium text-ink-300 border border-ink-700 rounded-xl hover:bg-ink-800 transition-colors">
                Sign In
              </a>
              <button onClick={() => { openOnboarding(); close(); }} className="block w-full text-center py-3 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors">
                Get Started Free
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
