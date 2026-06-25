import type { ReactNode } from "react";
import { site } from "@/config/site";

// ── Layout ───────────────────────────────────────────────────────────────────
export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>
      {children}
    </section>
  );
}

// ── Typographic helpers ──────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-accent/90">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

export function Heading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-display text-balance text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-ink sm:text-4xl md:text-[2.9rem] ${className}`}
    >
      {children}
    </h2>
  );
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-pretty text-[1.02rem] leading-relaxed text-muted sm:text-lg ${className}`}>
      {children}
    </p>
  );
}

// ── Pills & chips ────────────────────────────────────────────────────────────
export function Pill({
  children,
  color = "#bef24a",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      style={{ borderColor: `${color}40`, background: `${color}14`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-white/[0.03] px-2 py-1 text-[0.72rem] font-medium text-muted">
      {children}
    </span>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div className={`${strong ? "glass-strong" : "glass"} rounded-[var(--radius-card)] ${className}`}>
      {children}
    </div>
  );
}

// ── Calls to action ──────────────────────────────────────────────────────────
export function CtaPrimary({
  children,
  className = "",
  href = site.appUrl,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[0.95rem] font-semibold text-[#0a0a0d] shadow-[0_0_0_1px_rgba(190,242,74,0.4),0_18px_50px_-12px_rgba(190,242,74,0.45)] transition-transform duration-200 hover:scale-[1.02] focus-visible:scale-[1.02] motion-reduce:hover:scale-100 ${className}`}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
        aria-hidden
      >
        <path d="M3 8h9M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function CtaGhost({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white/[0.02] px-6 py-3.5 text-[0.95rem] font-semibold text-ink transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.05] ${className}`}
    >
      {children}
    </a>
  );
}
