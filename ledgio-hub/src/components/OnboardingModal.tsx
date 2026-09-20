import { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SECTORS } from '../lib/sectors';
import { SectorIcon } from '../lib/sectorIcons';
import { SECTOR_PRICING, DEFAULT_SECTOR_SLUG } from '../lib/sectorPricing';

interface Props {
  open: boolean;
  preselectedSector?: string;
  onClose: () => void;
}

export function OnboardingModal({ open, preselectedSector, onClose }: Props) {
  const navigate = useNavigate();

  const startStep = preselectedSector ? 2 : 1;
  const [step, setStep] = useState(startStep);
  const [selectedSector, setSelectedSector] = useState(preselectedSector ?? '');
  const [redirecting, setRedirecting] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      const s = preselectedSector ?? '';
      setSelectedSector(s);
      setStep(s ? 2 : 1);
      setRedirecting(false);
    }
  }, [open, preselectedSector]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function chooseSector(slug: string) {
    setSelectedSector(slug);
    setStep(2);
  }

  const sectorPricing = SECTOR_PRICING.find((s) => s.sectorSlug === selectedSector)
    ?? SECTOR_PRICING.find((s) => s.sectorSlug === DEFAULT_SECTOR_SLUG)!;
  const plans = sectorPricing.tiers;

  function choosePlan(plan: typeof plans[number]) {
    if (plan.enterprise) {
      onClose();
      navigate('/demo');
      return;
    }
    setRedirecting(true);
    const url = `https://ledgio-fawn.vercel.app/register?sector=${selectedSector}&plan=${plan.slug}`;
    setTimeout(() => { window.location.href = url; }, 600);
  }

  const sectorLabel = SECTORS.find((s) => s.slug === selectedSector)?.label ?? '';
  const totalSteps = preselectedSector ? 1 : 2;
  const currentDisplay = preselectedSector ? 1 : step;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Get started with Ledgio"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-ink-950 border border-ink-800/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-800/60">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-0.5">
              Step {currentDisplay} of {totalSteps}
            </p>
            <h2 className="text-lg font-black text-white">
              {step === 1 ? 'Which sector describes your business?' : 'Choose your plan'}
            </h2>
            {step === 2 && sectorLabel && (
              <p className="text-xs text-ink-400 mt-0.5">
                Setting up your <span className="text-brand-300">{sectorLabel}</span> workspace
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-500 hover:text-white hover:bg-ink-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 max-h-[65vh] overflow-y-auto">

          {/* Step 1: Sector grid */}
          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SECTORS.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => chooseSector(s.slug)}
                  className="group text-left p-4 bg-ink-900/60 border border-ink-800/60 rounded-xl hover:bg-ink-800/80 hover:border-brand-700/60 transition-all"
                >
                  <div className="mb-3 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-brand-950/60 border border-brand-800/40 group-hover:bg-brand-900/60 transition-colors">
                    <SectorIcon slug={s.slug} className="h-4 w-4 text-brand-400" />
                  </div>
                  <div className="text-sm font-bold text-white leading-tight mb-1">{s.label}</div>
                  <div className="text-[11px] text-ink-500 leading-relaxed">{s.tagline.split('.')[0]}.</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Plan selection */}
          {step === 2 && (
            <div className="space-y-3">
              {redirecting ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
                  <p className="text-sm text-ink-300">Setting up your workspace…</p>
                </div>
              ) : (
                plans.map((plan) => (
                  <button
                    key={plan.slug}
                    onClick={() => choosePlan(plan)}
                    className={`group w-full text-left p-5 rounded-xl border transition-all ${
                      plan.highlight
                        ? 'bg-brand-950/60 border-brand-700/60 hover:bg-brand-950 hover:border-brand-600'
                        : 'bg-ink-900/60 border-ink-800/60 hover:bg-ink-800/80 hover:border-ink-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-black ${plan.highlight ? 'text-brand-300' : 'text-white'}`}>
                            {plan.name}
                          </span>
                          {plan.highlight && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand-600 text-white rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-400 mb-1">{plan.description}</p>
                        <p className="text-[11px] text-brand-400 font-medium mb-3">{plan.seats}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {plan.features.map((f) => (
                            <div key={f} className="flex items-center gap-1.5">
                              <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${plan.highlight ? 'text-brand-400' : 'text-ink-500'}`} />
                              <span className="text-[11px] text-ink-400">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-2xl font-black ${plan.highlight ? 'text-white' : 'text-ink-200'}`}>
                          {plan.price}
                        </div>
                        {plan.period && <div className="text-[11px] text-ink-500">{plan.period}</div>}
                        <div className={`mt-3 inline-flex items-center gap-1 text-xs font-bold ${plan.highlight ? 'text-brand-300' : 'text-ink-400'} group-hover:gap-2 transition-all`}>
                          {plan.enterprise ? 'Talk to sales' : 'Get started'} <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && !preselectedSector && !redirecting && (
          <div className="px-6 py-4 border-t border-ink-800/60">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-ink-500 hover:text-ink-300 transition-colors"
            >
              ← Change sector
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
