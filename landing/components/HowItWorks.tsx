import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow, Chip } from "./ui/primitives";

export function HowItWorks() {
  return (
    <Section id="how" className="scroll-mt-24 py-24 sm:py-28">
      <Reveal className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <Heading className="mt-5">Get it out. Let it become clear.</Heading>
      </Reveal>

      <ol className="mt-16 space-y-6">
        <Step
          n={1}
          title="Capture it raw"
          body="Write exactly as your thoughts arrive. Fragments, reminders, ideas, worries, errands, voice-note-style sentences. No formatting required."
          visual={<CaptureVisual />}
        />
        <Step
          n={2}
          title="BrainQueue creates clarity"
          body="AI separates the noise into real tasks, understands context, and scores what matters based on urgency, importance, duration, effort, energy, pleasure, and your current situation."
          footnote="You do not have to decide everything at once."
          visual={<ScoreVisual />}
        />
        <Step
          n={3}
          title="Do one thing"
          body="Choose a focus set that fits your current reality. In Focus Mode, only the current task is visible. The future can wait."
          footnote="Less switching. Less negotiating with yourself. More momentum."
          visual={<FocusVisual />}
          last
        />
      </ol>
    </Section>
  );
}

function Step({
  n,
  title,
  body,
  footnote,
  visual,
  last,
}: {
  n: number;
  title: string;
  body: string;
  footnote?: string;
  visual: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Reveal as="li" className="relative grid gap-6 md:grid-cols-2 md:items-center md:gap-12">
      <div className="relative md:pl-16">
        {/* step marker + connecting lime path */}
        <div className="absolute left-0 top-0 hidden md:block">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-accent/40 bg-accent-soft font-display text-lg text-accent">
            {n}
          </div>
          {!last && (
            <div className="mx-auto mt-2 h-[calc(100%+1.5rem)] w-px bg-gradient-to-b from-accent/40 to-transparent" />
          )}
        </div>

        <div className="mb-3 flex items-center gap-3 md:hidden">
          <div className="grid h-9 w-9 place-items-center rounded-full border border-accent/40 bg-accent-soft text-sm text-accent">
            {n}
          </div>
        </div>

        <h3 className="font-display text-2xl font-medium text-ink">{title}</h3>
        <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted">{body}</p>
        {footnote && <p className="mt-3 text-sm italic text-faint">{footnote}</p>}
      </div>

      <div className="md:order-last">{visual}</div>
    </Reveal>
  );
}

function CaptureVisual() {
  return (
    <div className="glass-strong rounded-[var(--radius-card)] p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
        <span className="ml-2 text-[0.7rem] uppercase tracking-[0.16em] text-faint">Brain dump</span>
      </div>
      <p className="text-pretty font-mono text-[0.92rem] leading-relaxed text-ink/85">
        Call the pharmacy, idea for client proposal, find blood pressure prescription, ask Sarah
        about Friday, renew insurance, maybe research that course…
        <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent" />
      </p>
    </div>
  );
}

function ScoreVisual() {
  const rows: [string, string][] = [
    ["Urgency", "High"],
    ["Importance", "High"],
    ["Effort", "5 min"],
    ["Energy", "Low"],
    ["Pleasure", "Medium"],
  ];
  return (
    <div className="glass-strong rounded-[var(--radius-card)] p-5">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-ink">Find blood pressure prescription</h4>
        <span className="rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-xs font-bold text-accent">
          Score 92
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-line pb-2">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-sm font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FocusVisual() {
  return (
    <div className="glass-strong relative overflow-hidden rounded-[var(--radius-card)] p-7 text-center">
      <div className="absolute inset-x-0 top-0 mx-auto h-32 w-32 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      <span className="relative text-[0.7rem] uppercase tracking-[0.18em] text-faint">Task 1 of 3</span>
      <h4 className="relative mt-3 font-display text-2xl font-medium text-ink">Renew insurance</h4>
      <p className="relative mt-2 text-sm text-muted">Find the policy number — that is the only step right now.</p>
      <div className="relative mt-4 flex items-center justify-center gap-2">
        <Chip>12:00</Chip>
        <Chip>Low energy</Chip>
      </div>
      <button
        type="button"
        className="relative mt-5 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-[#0a0a0d]"
      >
        Mark done
      </button>
      <p className="relative mt-2.5 text-xs text-faint">The next task appears after completion.</p>
    </div>
  );
}
