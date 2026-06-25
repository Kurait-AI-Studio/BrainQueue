export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
        {/* a queue of thoughts resolving into one lime focus dot */}
        <rect x="3" y="6" width="14" height="3.4" rx="1.7" fill="#5b6472" />
        <rect x="3" y="12.3" width="11" height="3.4" rx="1.7" fill="#727b8a" />
        <rect x="3" y="18.6" width="8" height="3.4" rx="1.7" fill="#9aa3b2" />
        <circle cx="22" cy="20.3" r="4.2" fill="#bef24a" />
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-[-0.01em] text-ink">BrainQueue</span>
    </span>
  );
}
