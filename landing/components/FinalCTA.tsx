import { Reveal } from "./ui/Reveal";
import { Section, CtaPrimary } from "./ui/primitives";

export function FinalCTA() {
  return (
    <Section className="py-28 sm:py-36">
      <Reveal className="relative mx-auto max-w-3xl overflow-hidden rounded-[32px] border border-accent/20 px-6 py-16 text-center sm:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 w-[28rem] max-w-full -translate-y-1/2 rounded-full bg-accent/10 blur-[80px]" />

        <h2 className="relative font-display text-3xl font-medium leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.6rem]">
          You do not need to remember everything.
          <br className="hidden sm:block" /> You just need a place to put it.
        </h2>
        <p className="relative mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-muted">
          Start by capturing what is on your mind. As you use BrainQueue, it learns how you work best
          and helps you make progress toward what matters to you.
        </p>

        <div className="relative mt-9 flex justify-center">
          <CtaPrimary>Clear my mind with BrainQueue</CtaPrimary>
        </div>
        <p className="relative mt-5 text-sm text-faint">
          A calmer system today. A smarter one every week.
        </p>
      </Reveal>
    </Section>
  );
}
