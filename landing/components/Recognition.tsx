import { Reveal } from "./ui/Reveal";
import { Section, Heading, Lede } from "./ui/primitives";

const PAINS = [
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
      <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        <Reveal>
          <Heading>When your brain is busy remembering, it has less room to think.</Heading>
          <Lede className="mt-5">
            Open loops take up space: messages to answer, appointments to book, ideas not to lose,
            tasks you keep postponing. When they all stay in your head, they do not stay quiet.
          </Lede>
        </Reveal>

        {/* editorial hairline list, no cards */}
        <ul>
          {PAINS.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 0.06}>
              <div
                className={`border-t border-line py-6 sm:py-7 ${
                  i === 0 ? "lg:border-t-0 lg:pt-1" : ""
                }`}
              >
                <h3 className="text-xl font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 max-w-md text-pretty leading-relaxed text-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
