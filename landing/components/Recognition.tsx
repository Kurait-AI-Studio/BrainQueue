import { Reveal } from "./ui/Reveal";
import { Section, Heading, Lede } from "./ui/primitives";

const CARDS = [
  {
    title: "Mental clutter",
    body: "Thoughts keep resurfacing because your brain is trying not to lose them.",
  },
  {
    title: "Task paralysis",
    body: "When there are too many possible next steps, choosing one can feel impossible.",
  },
  {
    title: "Invisible workload",
    body: "Remembering what needs to be done is work, even before you begin doing it.",
  },
  {
    title: "Guilt-driven productivity",
    body: "A long task list can make you feel behind instead of helping you move forward.",
  },
];

export function Recognition() {
  return (
    <Section className="py-24 sm:py-28">
      <Reveal className="max-w-2xl">
        <Heading>
          When your brain is busy remembering, it has less room to think.
        </Heading>
        <Lede className="mt-5">
          Open loops take up space: messages to answer, appointments to book, ideas not to lose,
          tasks you keep postponing. When they all stay in your head, they do not stay quiet.
        </Lede>
      </Reveal>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2">
        {CARDS.map((c, i) => (
          <Reveal as="li" key={c.title} delay={i * 0.06}>
            <div className="glass h-full rounded-[var(--radius-card)] p-6">
              <h3 className="text-lg font-semibold text-ink">{c.title}</h3>
              <p className="mt-2 text-pretty leading-relaxed text-muted">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
