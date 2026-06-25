// Brand + category palette. Kept in sync with the product app's accent (#bef24a).
// The category colors are used ONLY on the hero dots/tags and a few accents — never
// as page-wide gradients — so the canvas stays calm.
export const COLORS = {
  bg: "#0a0a0d",
  ink: "#f5f7fa",
  muted: "#9aa3b2",
  accent: "#bef24a", // lime / chartreuse — the one brand accent
} as const;

export type CategoryKey = "quick" | "urgent" | "deep" | "admin" | "health";

export const CATEGORIES: Record<
  CategoryKey,
  { label: string; color: string; anchor: { x: number; y: number } }
> = {
  // anchor = final cluster centre, in % of the hero stage box
  quick: { label: "Quick wins", color: "#bef24a", anchor: { x: 30, y: 30 } },
  urgent: { label: "Urgent", color: "#ff9b54", anchor: { x: 72, y: 22 } },
  deep: { label: "Deep focus", color: "#a78bfa", anchor: { x: 76, y: 64 } },
  admin: { label: "Life admin", color: "#5eead4", anchor: { x: 26, y: 70 } },
  health: { label: "Health", color: "#fb9fc4", anchor: { x: 50, y: 48 } },
};

// Tags shown after the dots settle. Health is intentionally omitted on small screens.
export const TAG_ORDER: CategoryKey[] = ["quick", "urgent", "deep", "admin", "health"];
