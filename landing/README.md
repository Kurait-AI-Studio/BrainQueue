# BrainQueue — Landing

The marketing/landing site for BrainQueue. It's a **separate Next.js app** that lives
alongside the product (the Vite SPA in the repo root). The landing page is the
intermediate page a visitor sees before converting — its CTAs point straight into the app.

- **Next.js 15** (App Router) · **Tailwind v4** (CSS-first, see `app/globals.css`)
- **Framer Motion** (`motion`) for the scroll-driven hero
- SEO-first: metadata + OpenGraph + Twitter, JSON-LD, `sitemap.xml`, `robots.txt`,
  and a build-time generated social card (`app/opengraph-image.tsx`)
- Fonts: **Fraunces** (editorial headlines) + **Plus Jakarta Sans** (UI), via `next/font`

## Run

```bash
cd landing
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Configure where the CTAs go

Every "Clear my mind" / "Sign in" / "Get started" button points at the product app.
Set this in `.env.local` (and in the Vercel project):

```bash
NEXT_PUBLIC_APP_URL=https://your-brainqueue-app-url
```

Defaults to `https://app.brainqueue.app` if unset (see `config/site.ts`). Update
`site.url` in the same file to the landing page's own production domain (used for
canonical URLs, sitemap, and OG `metadataBase`).

## Deploy (Vercel)

Deploy as its **own Vercel project** with **Root Directory = `landing`** (the product app
in the repo root has its own lockfile; `next.config.mjs` pins `outputFileTracingRoot`
to this folder so the two don't collide).

## Structure

```
app/
  layout.tsx          metadata/SEO, fonts, JSON-LD
  page.tsx            assembles the sections in order
  globals.css         Tailwind v4 @theme tokens + base styles
  opengraph-image.tsx generated 1200×630 social card
  sitemap.ts robots.ts
components/
  Hero.tsx            scroll-linked stage (useScroll → ThoughtCloud + FocusCard)
  ThoughtCloud.tsx    grey dots → AI node → colored category clusters → tags
  FocusCard.tsx       the resolved "one clear next step" card
  Manifesto / Recognition / HowItWorks / Clarity / FocusSets /
  AvoidedTasks / Personalization / XPProgress / FinalCTA / Footer / Nav / Logo
  ui/                 Reveal (scroll-in), primitives (Section, Heading, CTAs, …)
lib/
  tokens.ts           brand + category palette
  dots.ts             deterministic seeded dot field (no hydration drift)
config/
  site.ts             copy + CTA target
```

## Motion & accessibility

Everything respects `prefers-reduced-motion`: the hero collapses to a gentle fade
(no movement), the ambient drift and node pulse stop, and `Reveal` stops translating.
The dot field is **deterministic** (seeded PRNG) so server and client render identically.
