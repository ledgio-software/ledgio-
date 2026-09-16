import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import { SECTORS } from './lib/sectors';

function SectorRoute() {
  const { slug } = useParams<{ slug: string }>();
  const sector = SECTORS.find((s) => s.slug === slug);
  if (!sector) return <Navigate to="/" replace />;
  return <SectorPage sector={sector} />;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
