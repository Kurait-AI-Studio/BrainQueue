// Single source of truth for marketing strings + where the CTAs point.
// Set NEXT_PUBLIC_APP_URL in Vercel (or .env.local) to the deployed BrainQueue app
// so "Clear my mind" / "Sign in" send visitors straight into the product.
export const site = {
  name: "BrainQueue",
  tagline: "Clear my mind with BrainQueue.",
  description:
    "BrainQueue turns the mental mess into clarity. Capture every thought, idea, reminder and unfinished task in its rawest form — AI organizes, scores and gives you one realistic next step. ADHD-friendly by design, useful for every busy mind.",
  url: "https://brainqueue.app",
  // Where the product itself lives (sign-in / app). Falls back to a sensible default.
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.brainqueue.app",
  ogImage: "/og.png",
  twitter: "@brainqueue",
} as const;

export const ctaPrimary = "Clear my mind with BrainQueue";
