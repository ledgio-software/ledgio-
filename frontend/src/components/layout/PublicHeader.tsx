import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Menu, X } from "lucide-react";
import { Button } from "../ui/Button";

const NAV_ITEMS = [
  { label: "Features", to: "/features" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Pricing", to: "/#pricing" },
  { label: "Terms & SLA", to: "/legal" },
];

export function PublicHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-secondary-800/80 bg-secondary-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3" onClick={() => setMenuOpen(false)}>
          <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-blue-600 rounded-xl shadow-lg shadow-emerald-950">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            Ledg<span className="text-emerald-400">io</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-secondary-300">
          {NAV_ITEMS.map((item) => (
            <Link key={item.label} to={item.to} className="hover:text-emerald-400 transition-colors">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
            className="border-secondary-700 text-secondary-200 hover:bg-secondary-800 hover:text-white"
          >
            Member Login
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/register")}
            className="hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 font-bold"
          >
            Register Business Free
          </Button>

          {/* Hamburger — visible on mobile only */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-secondary-300 hover:text-white hover:bg-secondary-800 transition-colors"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-secondary-800 bg-secondary-950">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm font-medium text-secondary-200 hover:bg-secondary-800 hover:text-emerald-400 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-secondary-800">
              <Button
                variant="primary"
                onClick={() => { setMenuOpen(false); navigate("/register"); }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Register Business Free
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
