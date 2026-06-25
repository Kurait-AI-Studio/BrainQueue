"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { Logo } from "./Logo";
import { site } from "@/config/site";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#focus-sets", label: "Focus sets" },
  { href: "#personalization", label: "Personalization" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  // Motion's scrollY (rAF-batched) instead of a raw scroll listener.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled ? "glass-strong mx-3 sm:mx-auto" : "border border-transparent"
        }`}
      >
        <a href="#top" aria-label="BrainQueue home">
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
        </div>
      </div>
    </header>
  );
}
