import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow, CtaPrimary } from "./ui/primitives";

type SetCard = {
  name: string;
  accent: string;
  blurb: string;
  meta: { time: string; energy: string; xp: string };
  bestFor: string;
  tasks: string[];
  featured?: boolean;
};

// Balanced Flow sits in the middle, featured as the sensible default.
const SETS: SetCard[] = [
  {
    name: "Quick Wins",
    accent: "#5eead4",
    blurb: "Short tasks that reduce mental load and create momentum.",
    meta: { time: "25 min", energy: "Low energy", xp: "+180 XP" },
    bestFor: "I cannot start something big right now.",
    tasks: ["Buy batteries", "Confirm dinner reservation", "Find insurance number"],
  },
  {
    name: "Balanced Flow",
    accent: "#bef24a",
    blurb: "A mix of important, satisfying, and realistic tasks.",
    meta: { time: "45 min", energy: "Medium energy", xp: "+230 XP" },
    bestFor: "I want progress without burning out.",
    tasks: ["Reply to Sarah about Friday", "Draft client proposal outline", "Book dentist appointment"],
    featured: true,
  },
  {
    name: "Deep Focus",
    accent: "#a78bfa",
    blurb: "A carefully selected set for meaningful progress.",
    meta: { time: "70 min", energy: "High energy", xp: "+300 XP" },
    bestFor: "I have a real window to concentrate.",
    tasks: ["Write project research brief", "Review quarterly budget", "Plan course curriculum"],
  },
];

export function FocusSets() {
  return (
    <Section id="focus-sets" className="scroll-mt-24 py-24 sm:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>Focus sets</Eyebrow>
        <Heading className="mt-5">Not one perfect plan. Three good ways to move forward.</Heading>
        <p className="mt-5 text-pretty leading-relaxed text-muted">
          BrainQueue proposes a few focus sets based on your urgency, energy, available time, goals,
          and the tasks you are most likely to avoid.
        </p>
        <p className="mt-3 text-pretty leading-relaxed text-ink/80">
          Every focus set becomes more personal over time, shaped by what you choose, finish,
          postpone, and care about.
        </p>
      </Reveal>

      <div className="mt-14 grid items-center gap-5 lg:grid-cols-3">
        {SETS.map((s, i) => (
          <Reveal key={s.name} delay={i * 0.08}>
            <article
              className={`relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] ${
                s.featured
                  ? "border border-accent/45 bg-white/[0.04] shadow-[0_30px_70px_-30px_rgba(190,242,74,0.35)] lg:-translate-y-3 lg:pb-2"
                  : "glass"
              }`}
            >
              {/* thin category accent + featured tag */}
              <div className="h-[3px] w-full" style={{ background: s.accent }} />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-medium text-ink">{s.name}</h3>
                  {s.featured ? (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[0.7rem] font-bold text-[#0a0a0d]">
                      Start here
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-faint">{s.meta.xp}</span>
                  )}
                </div>

                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">{s.blurb}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-faint">
                  <span className="rounded-md border border-line px-2 py-1">{s.meta.time}</span>
                  <span className="rounded-md border border-line px-2 py-1">{s.meta.energy}</span>
                  {s.featured && <span className="rounded-md border border-line px-2 py-1">{s.meta.xp}</span>}
                </div>

                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {s.tasks.map((t) => (
                    <li key={t} className="py-2.5 text-sm text-ink/85">
                      {t}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-xs text-muted">
                  <span className="text-faint">Best for:</span> “{s.bestFor}”
                </p>

                <button
                  type="button"
                  className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-transform duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100 ${
                    s.featured
                      ? "bg-accent text-[#0a0a0d]"
                      : "border border-accent/45 bg-accent-soft text-accent"
                  }`}
                >
                  Choose this set
                </button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1} className="mt-12 text-center">
        <CtaPrimary>Clear my mind with BrainQueue</CtaPrimary>
      </Reveal>
    </Section>
  );
}
