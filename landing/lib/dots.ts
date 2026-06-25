import { CATEGORIES, CategoryKey } from "./tokens";

// Deterministic dot field so server and client render identically (no hydration drift).
// mulberry32 — tiny seeded PRNG.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Dot = {
  id: number;
  size: number; // px
  startX: number; // % of stage
  startY: number;
  endX: number;
  endY: number;
  category: CategoryKey;
  color: string;
  /** muted dots stay grey/transparent even after sorting — keeps the field calm */
  muted: boolean;
  startOpacity: number;
  endOpacity: number;
  grey: string; // starting grey shade
  depth: number; // 0 (back) .. 1 (front)
  drift: number; // ambient drift amplitude in px (front dots only)
};

const GREYS = ["#3a3f49", "#4a505c", "#5b6672", "#727b8a", "#8a93a3"];

// Bias category mix toward calm: lots of quick/admin, fewer health.
const MIX: CategoryKey[] = [
  "quick", "quick", "quick",
  "urgent", "urgent",
  "deep", "deep",
  "admin", "admin", "admin",
  "health",
];

export function generateDots(count: number, seed = 7): Dot[] {
  const rand = mulberry32(seed);
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const category = MIX[Math.floor(rand() * MIX.length)];
    const cat = CATEGORIES[category];

    // Organic, irregular size range (10–48px) weighted toward smaller.
    const size = Math.round(10 + Math.pow(rand(), 1.7) * 38);
    const depth = rand();

    // Scattered start — irregular, some clumping handled by the eye via varied opacity.
    const startX = 6 + rand() * 88;
    const startY = 6 + rand() * 88;

    // End — cluster around the category anchor with small organic jitter.
    const spread = 9 + rand() * 7;
    const ang = rand() * Math.PI * 2;
    const rad = Math.pow(rand(), 0.6) * spread;
    const endX = clamp(cat.anchor.x + Math.cos(ang) * rad, 4, 96);
    const endY = clamp(cat.anchor.y + Math.sin(ang) * rad * 0.85, 4, 96);

    // ~45% stay muted (grey-ish, low opacity) so the page reads calm, not rainbow.
    const muted = rand() < 0.45;
    const grey = GREYS[Math.floor(rand() * GREYS.length)];

    dots.push({
      id: i,
      size,
      startX,
      startY,
      endX,
      endY,
      category,
      color: muted ? grey : cat.color,
      muted,
      startOpacity: 0.18 + depth * 0.45,
      endOpacity: muted ? 0.16 + depth * 0.22 : 0.5 + depth * 0.45,
      grey,
      depth,
      drift: depth > 0.6 ? 1 + rand() * 2 : 0,
    });
  }
  return dots;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
