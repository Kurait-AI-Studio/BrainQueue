"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Logo } from "./Logo";
import { site } from "@/config/site";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#focus-sets", label: "Focus sets" },
  { href: "#pricing", label: "Pricing" },
  { href: "#personalization", label: "Personalization" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // Motion's scrollY (rAF-batched) instead of a raw scroll listener.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  // lock body scroll + close on Escape while the mobile sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled || open ? "glass-strong mx-3 sm:mx-auto" : "border border-transparent"
        }`}
      >
        <a href="#top" aria-label="BrainQueue home" onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={site.appUrl}
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href={site.appUrl}
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-[#0a0a0d] transition-transform duration-200 hover:scale-[1.03] motion-reduce:hover:scale-100"
          >
            Get started
          </a>

          {/* hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="-mr-1 grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-white/5 md:hidden"
          >
            <span className="relative block h-3.5 w-5" aria-hidden>
              <span
                className={`absolute left-0 top-0 h-[2px] w-5 rounded-full bg-current transition-transform duration-300 ${
                  open ? "translate-y-[6px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[6px] h-[2px] w-5 rounded-full bg-current transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-[12px] h-[2px] w-5 rounded-full bg-current transition-transform duration-300 ${
                  open ? "-translate-y-[6px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong mx-3 mt-2 overflow-hidden rounded-3xl p-2 md:hidden"
          >
            <nav className="flex flex-col" aria-label="Mobile">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3.5 text-[0.95rem] font-medium text-ink transition-colors hover:bg-white/5"
                >
                  {l.label}
                </a>
              ))}
              <a
                href={site.appUrl}
                onClick={() => setOpen(false)}
                className="mt-1 rounded-2xl px-4 py-3.5 text-[0.95rem] font-medium text-muted transition-colors hover:bg-white/5"
              >
                Sign in
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
