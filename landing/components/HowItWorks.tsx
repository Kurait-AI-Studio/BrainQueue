import { Reveal } from "./ui/Reveal";
import { Shot } from "./Shot";
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
          visual={
            <Shot
              src="/screens/brain-dump.png"
              alt="Pasting raw, unstructured notes into the BrainQueue brain dump"
              width={1468}
              height={972}
            />
          }
        />
        <Step
          n={2}
          title="BrainQueue creates clarity"
          body="AI separates the noise into real tasks, understands context, and scores what matters based on urgency, importance, duration, effort, energy, pleasure, and your current situation."
          footnote="You do not have to decide everything at once."
          visual={
            <Shot
              src="/screens/task-detail.png"
              alt="A task scored across urgency, importance, effort, energy and pleasure"
              width={1488}
              height={1230}
            />
          }
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

function FocusVisual() {
  return (
    <div className="glass-strong relative overflow-hidden rounded-[var(--radius-card)] p-7 text-center">
      <div className="absolute inset-x-0 top-0 mx-auto h-32 w-32 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      <span className="relative text-[0.7rem] uppercase tracking-[0.18em] text-faint">Task 1 of 3</span>
      <h4 className="relative mt-3 font-display text-2xl font-medium text-ink">Renew insurance</h4>
      <p className="relative mt-2 text-sm text-muted">Find the policy number. That is the only step right now.</p>
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
