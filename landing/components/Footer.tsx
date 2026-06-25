import { Logo } from "./Logo";
import { Section } from "./ui/primitives";
import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-line py-12">
      <Section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-faint">
            ADHD-friendly by design. Useful for every busy mind.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted">
          <a href="#how" className="transition-colors hover:text-ink">How it works</a>
          <a href="#focus-sets" className="transition-colors hover:text-ink">Focus sets</a>
          <a href="#personalization" className="transition-colors hover:text-ink">Personalization</a>
          <a href={site.appUrl} className="transition-colors hover:text-ink">Sign in</a>
        </nav>
      </Section>

      <Section className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-xs text-faint sm:flex-row">
        <span>© {new Date().getFullYear()} {site.name}. Less remembering. More living.</span>
        <span>Get it out of your head.</span>
      </Section>
    </footer>
  );
}
