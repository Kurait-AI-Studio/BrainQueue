import { Reveal } from "./ui/Reveal";
import { Section, Heading } from "./ui/primitives";
import { CATEGORIES } from "@/lib/tokens";

export function Clarity() {
  return (
    <Section className="py-24 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Heading>
          Clarity is not having fewer things to do.
          <br className="hidden sm:block" /> It is knowing what deserves your attention now.
        </Heading>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-muted">
          BrainQueue does not pretend your life has only three tasks. It simply keeps the rest quiet
          while you deal with the one in front of you.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-16">
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <Stage label="Everything in your head">
            <div className="relative h-36">
              {SCATTER.map((d, i) => (
                <span
                  key={i}
                  className="absolute rounded-full bg-faint"
                  style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, opacity: d.o }}
                />
              ))}
            </div>
          </Stage>

          <Arrow />

          <Stage label="Organized for you">
            <div className="relative h-36">
              {Object.values(CATEGORIES).slice(0, 4).map((c, i) => (
                <div
                  key={c.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${[28, 70, 30, 72][i]}%`, top: `${[30, 28, 72, 70][i]}%` }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="rounded-full"
                        style={{ width: 9 - j, height: 9 - j, background: c.color, opacity: 0.8 - j * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Stage>

          <Arrow />

          <Stage label="One thing now" highlight>
            <div className="grid h-36 place-items-center">
              <div className="glass-strong w-full rounded-xl p-4 text-left">
                <div className="text-[0.66rem] uppercase tracking-[0.16em] text-faint">Focus</div>
                <div className="mt-1 text-sm font-semibold text-ink">Reply to nephrologist</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-3/4 rounded-full bg-accent" />
                </div>
              </div>
            </div>
          </Stage>
        </div>
      </Reveal>
    </Section>
  );
}

const SCATTER = [
  { x: 12, y: 20, s: 14, o: 0.5 }, { x: 38, y: 12, s: 22, o: 0.7 }, { x: 64, y: 24, s: 12, o: 0.4 },
  { x: 82, y: 16, s: 18, o: 0.6 }, { x: 22, y: 50, s: 26, o: 0.55 }, { x: 50, y: 44, s: 16, o: 0.7 },
  { x: 74, y: 52, s: 20, o: 0.5 }, { x: 90, y: 60, s: 12, o: 0.4 }, { x: 14, y: 78, s: 18, o: 0.6 },
  { x: 42, y: 80, s: 14, o: 0.45 }, { x: 66, y: 82, s: 22, o: 0.6 }, { x: 86, y: 86, s: 14, o: 0.4 },
];

function Stage({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border p-4 ${
        highlight ? "border-accent/30 bg-accent-soft/40" : "border-line bg-white/[0.015]"
      }`}
    >
      {children}
      <div className="mt-3 text-center text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="34" height="16" viewBox="0 0 34 16" fill="none" aria-hidden className="mx-auto rotate-90 md:rotate-0">
      <path d="M2 8h28M24 3l6 5-6 5" stroke="#5b6472" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
