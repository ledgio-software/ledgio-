import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Features } from './pages/Features';
import { HowItWorks } from './pages/HowItWorks';
import { Pricing } from './pages/Pricing';
import { About } from './pages/About';
import { Demo } from './pages/Demo';
import { FAQ } from './pages/FAQ';
import { Blog } from './pages/Blog';
import { SectorPage } from './pages/SectorPage';
import { PartnerPortal } from './pages/PartnerPortal';
import { SECTORS } from './lib/sectors';
import { OnboardingContext } from './lib/onboardingContext';
import { OnboardingModal } from './components/OnboardingModal';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function SectorRoute() {
  const { slug } = useParams<{ slug: string }>();
  const sector = SECTORS.find((s) => s.slug === slug);
  if (!sector) return <Navigate to="/" replace />;
  return <SectorPage sector={sector} />;
}

function AnnounceBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="bg-emerald-950 border-b border-emerald-700/40 px-4 py-2.5 flex items-center justify-center gap-3 text-xs text-emerald-200">
      <span>🚀 Construction &amp; Manufacturing sectors now live — purpose-built accounting for every business type</span>
      <a href="/for/construction" className="font-bold text-emerald-400 underline underline-offset-2 hover:text-emerald-300 whitespace-nowrap">
        Explore all 8 solutions →
      </a>
      <button
        onClick={() => setVisible(false)}
        className="ml-2 text-emerald-500 hover:text-emerald-200 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AnnounceBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function AppInner() {
  const [modalOpen, setModalOpen] = useState(false);
  const [preSector, setPreSector] = useState<string | undefined>();

  function openOnboarding(sectorSlug?: string) {
    setPreSector(sectorSlug);
    setModalOpen(true);
  }

  return (
    <OnboardingContext.Provider value={{ open: openOnboarding }}>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/for/:slug" element={<SectorRoute />} />
          <Route path="/partner/portal/:partnerId" element={<PartnerPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <OnboardingModal
        open={modalOpen}
        preselectedSector={preSector}
        onClose={() => setModalOpen(false)}
      />
    </OnboardingContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
