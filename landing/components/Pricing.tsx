import { Reveal } from "./ui/Reveal";
import { Section, Heading, Eyebrow } from "./ui/primitives";
import { site } from "@/config/site";

type Plan = {
  name: string;
  priceMonthly: string;
  priceYearly: string;
  yearlyNote: string;
  blurb: string;
  cta: string;
  featured?: boolean;
  badge?: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "BrainQueue",
    priceMonthly: "$9.99",
    priceYearly: "$85",
    yearlyNote: "billed yearly · about $7/mo · save 29%",
    blurb: "The full app. Capture the mess, get clarity, and a system that learns how you work.",
    cta: "Clear my mind with BrainQueue",
    featured: true,
    badge: "Start here",
    features: [
      "Unlimited brain dumps",
      "AI organizes, scores and gives one next step",
      "Personalized focus sets",
      "Progress and XP",
      "Personalization that improves every week",
    ],
  },
  {
    name: "BrainQueue Plus",
    priceMonthly: "$19.99",
    priceYearly: "$179",
    yearlyNote: "billed yearly · about $15/mo · save 25%",
    blurb: "For when you want BrainQueue to do the work, not just plan it.",
    cta: "Get Plus",
    features: [
      "Everything in BrainQueue",
      "AI drafts your delegatable tasks (emails, messages, replies)",
      "Calendar and email integrations",
      "Weekly review and deeper analytics",
      "Priority access to new AI features",
    ],
  },
];

export function Pricing() {
  return (
    <Section id="pricing" className="scroll-mt-24 py-24 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>Pricing</Eyebrow>
        <Heading className="mt-5">One calm system. Two ways to use it.</Heading>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-muted">
          Start with the full app for less than a coffee a week. Move up when you want BrainQueue to
          take work off your plate, not just organize it.
        </p>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-4xl items-start gap-5 lg:grid-cols-2">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.08}>
            <article
              className={`relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] p-7 sm:p-8 ${
                p.featured
                  ? "border border-accent/45 bg-white/[0.04] shadow-[0_30px_70px_-30px_rgba(190,242,74,0.35)]"
                  : "glass"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-medium text-ink">{p.name}</h3>
                {p.badge && (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[0.7rem] font-bold text-[#0a0a0d]">
                    {p.badge}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-medium leading-none text-ink">
                  {p.priceMonthly}
                </span>
                <span className="text-sm text-faint">/month</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                or <span className="font-semibold text-ink">{p.priceYearly}/year</span>
              </p>
              <p className="text-[0.78rem] text-faint">{p.yearlyNote}</p>

              <p className="mt-5 text-pretty text-sm leading-relaxed text-muted">{p.blurb}</p>

              <ul className="mt-6 space-y-3 border-t border-line pt-6">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm leading-relaxed text-ink/85">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-1 shrink-0 text-accent"
                      aria-hidden
                    >
                      <path
                        d="M3 8.5l3.2 3.2L13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={site.appUrl}
                className={`mt-7 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition-transform duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100 ${
                  p.featured
                    ? "bg-accent text-[#0a0a0d]"
                    : "border border-accent/45 bg-accent-soft text-accent"
                }`}
              >
                {p.cta}
              </a>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.12} className="mt-8 text-center">
        <p className="text-sm text-faint">
          Start free, no card required. Cancel anytime. Your founding price stays locked.
        </p>
      </Reveal>
    </Section>
  );
}
