import { Reveal } from "./ui/Reveal";
import { Section, Heading, Chip } from "./ui/primitives";

const CARDS = [
  {
    title: "Breaks resistance into smaller starts",
    body: "Make the first step small enough to begin.",
  },
  {
    title: "Matches the task to your capacity",
    body: "Not every task belongs in every moment.",
  },
  {
    title: "Builds momentum around hard tasks",
    body: "Pair avoidance-heavy tasks with achievable wins.",
  },
  {
    title: "Rewards progress, not perfection",
    body: "XP makes completion visible without turning life into a game.",
  },
];

export function AvoidedTasks() {
  return (
    <Section className="py-24 sm:py-28">
      <Reveal className="max-w-2xl">
        <Heading>
          The tasks you avoid need a better moment, not more guilt.
        </Heading>
        <p className="mt-5 text-pretty leading-relaxed text-muted">
          BrainQueue notices which tasks you keep postponing and helps make them easier to approach.
        </p>
      </Reveal>

      {/* before / after */}
      <Reveal delay={0.08} className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line bg-white/[0.015] p-6">
          <div className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">
            Before
          </div>
          <h3 className="text-lg font-semibold text-muted line-through decoration-faint/60">
            Call insurance
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-faint">
            <li>Postponed 4 times</li>
            <li>Feels too big</li>
            <li>Unclear next step</li>
          </ul>
        </div>

        <div className="rounded-[var(--radius-card)] border border-accent/25 bg-accent-soft/40 p-6">
          <div className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            After
          </div>
          <h3 className="text-lg font-semibold text-ink">Find insurance number</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>2 min</Chip>
            <Chip>Low-energy friendly</Chip>
            <Chip>Paired with a quick win</Chip>
            <span className="inline-flex items-center rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[0.72rem] font-semibold text-accent">
              +50 XP when completed
            </span>
          </div>
        </div>
      </Reveal>

      <ul className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c, i) => (
          <Reveal as="li" key={c.title} delay={i * 0.06}>
            <div className="border-t border-line pt-4">
              <span className="font-display text-xl text-accent">{`0${i + 1}`}</span>
              <h4 className="mt-2 font-semibold leading-snug text-ink">{c.title}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
