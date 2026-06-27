import { Reveal } from "./ui/Reveal";
import { Section } from "./ui/primitives";

export function Manifesto() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="font-display text-2xl font-medium leading-[1.25] tracking-[-0.01em] text-ink sm:text-[2.1rem] sm:leading-[1.22]">
          Too much in your head becomes task paralysis.
          <br className="hidden sm:block" /> Too much on a list becomes guilt.
          <br className="hidden sm:block" />{" "}
          <span className="text-accent">BrainQueue creates clarity in between.</span>
        </p>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-muted">
          Get it out of your head first. Then decide what matters now.
        </p>
      </Reveal>

      {/* messy notes → one clear card */}
      <Reveal delay={0.1} className="mx-auto mt-14 flex max-w-2xl items-center justify-center gap-4 sm:gap-8">
        <div className="grid flex-1 gap-1.5 opacity-80">
          {["pay invoice", "call mum", "book dentist", "buy batteries"].map((t) => (
            <div
              key={t}
              className="truncate rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-sm text-faint"
            >
              {t}
            </div>
          ))}
        </div>
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" aria-hidden className="shrink-0">
          <path d="M2 10h32M28 4l8 6-8 6" stroke="#bef24a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="glass-strong flex-1 rounded-xl px-4 py-3.5">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-faint">Now</div>
          <div className="mt-1 text-sm font-semibold text-ink">Book dentist</div>
          <div className="mt-0.5 text-xs text-muted">2 min · low energy</div>
        </div>
      </Reveal>
    </Section>
  );
}
