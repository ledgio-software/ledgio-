import { useState } from 'react';
import { Phone, Mail, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const SECTORS = [
  'Small Retail & Shops',
  'Enterprise & Multi-Branch Trading',
  'Schools',
  'Churches & NGOs',
  'Pharmacy',
  'Manufacturing',
  'Professional Services',
  'Other',
];

export function Demo() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', business: '', sector: '', message: '' });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://formspree.io/f/xzezbqpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or call us directly.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(5,150,105,0.12)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left */}
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
                Book a Demo
              </span>
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">
                See Ledgio in Your Sector
              </h1>
              <p className="text-ink-300 text-sm leading-relaxed mb-8">
                Book a 30-minute live demo with one of our consultants. We'll walk you through the features specific to your sector and answer any questions.
              </p>
              <div className="space-y-4 mb-10">
                {[
                  'Personalised walkthrough for your sector',
                  'Live Q&A with a Ledgio consultant',
                  'No obligation — no hard sell',
                  'We come to you (virtual or in-person in Accra)',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                    <span className="text-sm text-ink-300">{item}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 p-6 bg-ink-900/60 border border-ink-800/60 rounded-2xl">
                <h3 className="text-xs font-black uppercase tracking-widest text-ink-500 mb-4">Or call us directly</h3>
                {[
                  { name: 'Sandra', role: 'Sales Executive', phone: '+233 24 805 1379' },
                  { name: 'Erasmus Asare', role: 'Consultant Manager', phone: '+233 55 405 1068' },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-brand-600 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="text-white font-medium">{c.name}</span>
                      <span className="text-ink-500"> · {c.role} · </span>
                      <a href={`tel:${c.phone.replace(/\s/g,'')}`} className="text-brand-400 hover:text-brand-300 transition-colors">{c.phone}</a>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-brand-600 flex-shrink-0" />
                  <a href="mailto:ledgioapp@gmail.com" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">ledgioapp@gmail.com</a>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-ink-900/60 border border-ink-800/60 rounded-2xl p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-brand-400 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-white mb-2">Request Received!</h3>
                  <p className="text-ink-400 text-sm">One of our team will be in touch within 24 hours to schedule your demo.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-lg font-black text-white mb-6">Request a Demo</h3>
                  {[
                    { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com' },
                    { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+233 ...' },
                    { name: 'business', label: 'Business / Organisation Name', type: 'text', placeholder: 'Name of your business' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs font-bold text-ink-400 mb-1.5">{field.label}</label>
                      <input
                        name={field.name}
                        type={field.type}
                        placeholder={field.placeholder}
                        required
                        value={form[field.name as keyof typeof form]}
                        onChange={handleChange}
                        className="w-full bg-ink-800/60 border border-ink-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-ink-600 focus:outline-none focus:border-brand-600 transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-ink-400 mb-1.5">Your Sector</label>
                    <select
                      name="sector"
                      required
                      value={form.sector}
                      onChange={handleChange}
                      className="w-full bg-ink-800/60 border border-ink-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                    >
                      <option value="">Select your sector...</option>
                      {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-400 mb-1.5">Any specific questions? (optional)</label>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="Tell us what you'd like to see in the demo..."
                      value={form.message}
                      onChange={handleChange}
                      className="w-full bg-ink-800/60 border border-ink-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-ink-600 focus:outline-none focus:border-brand-600 transition-colors resize-none"
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl">
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-lg shadow-brand-950 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : 'Request Demo'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
