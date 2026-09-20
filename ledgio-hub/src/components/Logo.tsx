export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lg-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#059669" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#lg-grad)" />
      <rect x="12" y="26" width="6" height="12" rx="1.5" fill="#ffffff" />
      <rect x="21" y="18" width="6" height="20" rx="1.5" fill="#ffffff" />
      <rect x="30" y="10" width="6" height="28" rx="1.5" fill="#ffffff" fillOpacity="0.92" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`text-2xl font-black tracking-tight text-white ${className}`}>
      Ledg<span className="text-brand-400">io</span>
    </span>
  );
}
