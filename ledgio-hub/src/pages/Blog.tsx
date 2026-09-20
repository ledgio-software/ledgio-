import { ArrowRight } from 'lucide-react';

const POSTS = [
  {
    slug: 'fund-accounting-for-churches',
    category: 'Churches & NGOs',
    categoryColor: 'text-purple-400 bg-purple-950/60 border-purple-700/40',
    date: 'September 2026',
    title: 'Why Churches Need Fund Accounting — Not a Generic P&L',
    excerpt: 'A standard Profit & Loss statement tells a church almost nothing useful. Here\'s why restricted fund accounting is the right way to manage church finances and how Ledgio implements it.',
  },
  {
    slug: 'school-fees-term-management',
    category: 'Schools',
    categoryColor: 'text-sky-400 bg-sky-950/60 border-sky-700/40',
    date: 'September 2026',
    title: 'How to Manage School Fees by Term Without a Spreadsheet',
    excerpt: 'Tracking tuition, exam fees, PTA levies, and boarding fees across hundreds of students in a spreadsheet is a recipe for errors. There\'s a better way.',
  },
  {
    slug: 'pos-receipt-fraud-prevention',
    category: 'Retail',
    categoryColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-700/40',
    date: 'August 2026',
    title: 'How the Force-Print Receipt Gate Prevents POS Fraud',
    excerpt: 'The gap between what a cashier charges a customer and what they record is one of the most common sources of retail loss. Here\'s how Ledgio closes it.',
  },
  {
    slug: 'ghana-mobile-money-accounting',
    category: 'All Sectors',
    categoryColor: 'text-brand-400 bg-brand-950/60 border-brand-700/40',
    date: 'August 2026',
    title: 'Accounting for Mobile Money in Ghana: MTN, Telecel & AirtelTigo',
    excerpt: 'Mobile Money is how Ghana transacts. Here\'s how Ledgio handles MTN MoMo, Telecel Cash, and AirtelTigo collections — and posts every one to your ledger automatically.',
  },
  {
    slug: 'nhis-claims-pharmacy',
    category: 'Pharmacy',
    categoryColor: 'text-rose-400 bg-rose-950/60 border-rose-700/40',
    date: 'July 2026',
    title: 'NHIS Claims Management for Community Pharmacies',
    excerpt: 'Managing NHIS claims manually is time-consuming and error-prone. Ledgio\'s pharmacy module tracks every NHIS prescription and generates submission-ready claim reports.',
  },
  {
    slug: 'job-costing-manufacturing',
    category: 'Manufacturing',
    categoryColor: 'text-amber-400 bg-amber-950/60 border-amber-700/40',
    date: 'July 2026',
    title: 'Do You Know the True Cost of Your Production Jobs?',
    excerpt: 'Most manufacturers in Ghana estimate job costs. With Ledgio\'s job costing module, you know exactly — materials, labour, overhead, and margin — for every job you complete.',
  },
];

export function Blog() {
  return (
    <div className="min-h-screen">
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(5,150,105,0.10)_0%,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-950/60 border border-brand-700/40 text-brand-300 text-[10px] font-black uppercase tracking-widest mb-6">
              Ledgio Blog
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">Insights for African Businesses</h1>
            <p className="text-ink-400 text-sm leading-relaxed">
              Practical accounting, compliance, and business management guides for retail, schools, churches, pharmacies, and more across Ghana and Africa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.map((post) => (
              <article
                key={post.slug}
                className="flex flex-col bg-ink-900/60 border border-ink-800/60 rounded-2xl overflow-hidden hover:bg-ink-800/60 transition-colors group"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${post.categoryColor}`}>
                      {post.category}
                    </span>
                    <span className="text-xs text-ink-600">{post.date}</span>
                  </div>
                  <h2 className="text-base font-bold text-white mb-3 leading-snug group-hover:text-brand-300 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-ink-400 leading-relaxed flex-1">{post.excerpt}</p>
                  <div className="mt-5 flex items-center gap-1 text-xs font-bold text-brand-400">
                    Read article <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 text-center p-8 bg-ink-900/40 border border-ink-800/60 rounded-2xl max-w-xl mx-auto">
            <h3 className="text-base font-black text-white mb-2">Want us to cover a specific topic?</h3>
            <p className="text-sm text-ink-400 mb-4">Send us your questions and we'll write a guide for it.</p>
            <a href="mailto:ledgioapp@gmail.com" className="text-sm font-bold text-brand-400 hover:text-brand-300 transition-colors">
              ledgioapp@gmail.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
