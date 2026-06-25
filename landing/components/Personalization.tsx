import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow } from "./ui/primitives";

const STAGES = [
  {
    when: "Week 1",
    label: "Learning your rhythm",
    insight: "Short tasks work best after work.",
  },
  {
    when: "Week 3",
    label: "Recognizing momentum",
    insight: "You complete health tasks more often when paired with quick wins.",
  },
  {
    when: "Month 2",
    label: "Adapting your focus sets",
    insight: "Your current focus set balances urgent life admin with progress toward your goals.",
  },
];

const CARDS = [
  {
    title: "Learns your real capacity",
    body: "Plans improve around the time, effort, and energy that are actually realistic for you.",
  },
  {
    title: "Understands what unlocks momentum",
    body: "BrainQueue notices whether you respond better to quick wins, satisfying tasks, or deep-focus sessions.",
  },
  {
    title: "Connects daily tasks to bigger goals",
    body: "Small actions become easier to prioritize when they support what you want to achieve.",
  },
  {
    title: "Adapts without pressure",
    body: "If a plan does not fit your day, BrainQueue learns from that too. No guilt required.",
  },
];

export function Personalization() {
  return (
    <Section id="personalization" className="scroll-mt-24 py-24 sm:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>Gets to know you</Eyebrow>
        <Heading className="mt-5">The more you use it, the more it understands your life.</Heading>
        <p className="mt-5 text-pretty leading-relaxed text-muted">
          BrainQueue learns what actually works for you: the tasks you tend to finish, the time you
          realistically have, the energy you need, and the goals that matter most.
        </p>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink/85">
          Over time, BrainQueue stops giving generic productivity advice and starts suggesting plans
          that fit your real patterns.
        </p>
      </Reveal>

      {/* progression timeline */}
      <Reveal delay={0.08} className="mt-14">
        <div className="grid gap-4 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <div key={s.when} className="relative glass rounded-[var(--radius-card)] p-6">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-accent/40 bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">
                  {s.when}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-medium text-ink">{s.label}</h3>
              <p className="mt-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-sm italic text-muted">
                “{s.insight}”
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.12} className="mt-8 text-center">
        <p className="font-display text-xl text-accent">Your choices make the suggestions smarter.</p>
      </Reveal>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {CARDS.map((c, i) => (
          <Reveal as="li" key={c.title} delay={i * 0.06}>
            <div className="glass h-full rounded-[var(--radius-card)] p-6">
              <h4 className="text-lg font-semibold text-ink">{c.title}</h4>
              <p className="mt-2 text-pretty leading-relaxed text-muted">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>

      {/* privacy reassurance */}
      <Reveal delay={0.1} className="mt-12">
        <div className="glass-strong flex flex-col items-start gap-3 rounded-[var(--radius-card)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-pretty text-muted">
            <span className="font-semibold text-ink">Your patterns stay yours.</span>{" "}
            Personalization reduces friction. It does not create pressure.
          </p>
          <span className="shrink-0 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
            You stay in control
          </span>
        </div>
      </Reveal>
    </Section>
  );
}
