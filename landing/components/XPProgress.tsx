import { Reveal } from "./ui/Reveal";
import { Section, Heading } from "./ui/primitives";
import { XpDemo } from "./XpDemo";

export function XPProgress() {
  return (
    <Section className="py-24 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Heading>Progress should feel visible.</Heading>
          <p className="mt-5 text-pretty leading-relaxed text-muted">
            BrainQueue turns completion into visible momentum. Earn XP for doing tasks, finishing
            focus sets, and returning to the things you usually avoid.
          </p>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink/85">
            Progress is not about being perfect. It is about noticing that you are moving.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <XpDemo />
        </Reveal>
      </div>
    </Section>
  );
}
