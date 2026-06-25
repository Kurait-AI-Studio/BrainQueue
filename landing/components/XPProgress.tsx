import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow } from "./ui/primitives";

const REWARDS = [
  { xp: "+50 XP", label: "task done" },
  { xp: "+100 XP", label: "focus set complete" },
  { xp: "+250 XP", label: "no-skips bonus" },
];

export function XPProgress() {
  return (
    <Section className="py-24 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Progress</Eyebrow>
          <Heading className="mt-5">Progress should feel visible.</Heading>
          <p className="mt-5 text-pretty leading-relaxed text-muted">
            BrainQueue turns completion into visible momentum. Earn XP for doing tasks, finishing
            focus sets, and returning to the things you usually avoid.
          </p>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink/85">
            Progress is not about being perfect. It is about noticing that you are moving.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-strong rounded-[var(--radius-card)] p-7">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">
                  Level
                </div>
                <div className="font-display text-5xl font-medium text-ink">24</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-medium text-accent">1,250</div>
                <div className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">XP</div>
              </div>
            </div>

            {/* progress bar to next level */}
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-accent/70 to-accent" />
            </div>
            <div className="mt-2 flex justify-between text-[0.7rem] text-faint">
              <span>Level 24</span>
              <span>Level 25</span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {REWARDS.map((r) => (
                <div key={r.label} className="rounded-xl border border-line bg-white/[0.02] p-3 text-center">
                  <div className="font-display text-base font-medium text-accent">{r.xp}</div>
                  <div className="mt-1 text-[0.68rem] leading-tight text-muted">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
