import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow, CtaPrimary } from "./ui/primitives";

type SetCard = {
  name: string;
  accent: string;
  blurb: string;
  meta: { time: string; energy: string; xp: string };
  bestFor: string;
  tasks: string[];
};

const SETS: SetCard[] = [
  {
    name: "Balanced Flow",
    accent: "#bef24a",
    blurb: "A mix of important, satisfying, and realistic tasks.",
    meta: { time: "45 min", energy: "Medium energy", xp: "+230 XP" },
    bestFor: "I want progress without burning out.",
    tasks: ["Reply to Sarah about Friday", "Draft client proposal outline", "Book dentist appointment"],
  },
  {
    name: "Quick Wins",
    accent: "#5eead4",
    blurb: "Short tasks that reduce mental load and create momentum.",
    meta: { time: "25 min", energy: "Low energy", xp: "+180 XP" },
    bestFor: "I cannot start something big right now.",
    tasks: ["Buy batteries", "Confirm dinner reservation", "Find insurance number"],
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

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {SETS.map((s, i) => (
          <Reveal key={s.name} delay={i * 0.08}>
            <article
              className="group glass flex h-full flex-col rounded-[var(--radius-card)] p-6 transition-colors duration-300 hover:border-white/20"
              style={{ boxShadow: `inset 0 1px 0 ${s.accent}10` }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-medium text-ink">{s.name}</h3>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: `${s.accent}1f`, color: s.accent }}
                >
                  {s.meta.xp}
                </span>
              </div>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">{s.blurb}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-faint">
                <span className="rounded-md border border-line px-2 py-1">{s.meta.time}</span>
                <span className="rounded-md border border-line px-2 py-1">{s.meta.energy}</span>
              </div>

              <ul className="mt-5 space-y-2">
                {s.tasks.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-ink/85">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.accent }} />
                    {t}
                  </li>
                ))}
              </ul>

              <p className="mt-5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-xs text-muted">
                <span className="text-faint">Best for:</span> “{s.bestFor}”
              </p>

              <button
                type="button"
                className="mt-5 w-full rounded-xl border py-2.5 text-sm font-semibold transition-colors duration-200"
                style={{ borderColor: `${s.accent}55`, color: s.accent, background: `${s.accent}12` }}
              >
                Choose this set
              </button>
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
