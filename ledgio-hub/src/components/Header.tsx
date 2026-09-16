import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Logo, Wordmark } from './Logo';

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
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const location = useLocation();

  const isActive = (to: string) => location.pathname === to;

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800/70 bg-ink-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
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

        {/* CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="https://app.ledgio.io/login"
            className="text-sm font-medium text-ink-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-ink-800"
          >
            Sign In
          </a>
          <a
            href="https://app.ledgio.io/register"
            className="text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-brand-950"
          >
            Get Started Free
          </a>
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
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-ink-500">Solutions</p>
            {SECTORS.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-brand-400 rounded-lg transition-colors"
              >
                {s.label}
              </Link>
            ))}
            <div className="border-t border-ink-800 my-2" />
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-brand-400 rounded-lg transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-ink-800 pt-4 mt-2 flex flex-col gap-3">
              <a href="https://app.ledgio.io/login" className="block text-center py-2.5 text-sm font-medium text-ink-300 border border-ink-700 rounded-xl hover:bg-ink-800 transition-colors">
                Sign In
              </a>
              <a href="https://app.ledgio.io/register" className="block text-center py-2.5 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors">
                Get Started Free
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
