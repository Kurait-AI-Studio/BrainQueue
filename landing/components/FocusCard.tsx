import { Chip } from "./ui/primitives";

/**
 * The resolved "one clear next step" card — the top of the visual hierarchy.
 * Pure CSS/SVG, no images.
 */
export function FocusCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-strong w-[19rem] max-w-full rounded-[20px] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-faint">
          Focus mode
        </span>
        <span className="text-[0.68rem] font-medium text-faint">Task 1 of 3</span>
      </div>

      <div className="flex items-start gap-3.5">
        <ScoreRing value={92} />
        <div className="min-w-0">
          <h3 className="text-[1.02rem] font-semibold leading-snug text-ink">
            Reply to nephrologist email
          </h3>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
            Short and factual. Confirm your next appointment.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip>Due today</Chip>
        <Chip>Low energy</Chip>
        <Chip>2 min</Chip>
        <span className="inline-flex items-center rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[0.72rem] font-semibold text-accent">
          +50 XP
        </span>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-accent py-3 text-[0.9rem] font-semibold text-[#0a0a0d] transition-transform duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100"
      >
        Mark done
      </button>
      <p className="mt-2.5 text-center text-[0.72rem] text-faint">
        The next task appears after completion.
      </p>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="#bef24a"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 28 28)"
      />
      <text
        x="28"
        y="32"
        textAnchor="middle"
        className="fill-ink font-semibold"
        style={{ fontSize: "0.82rem" }}
      >
        {value}
      </text>
    </svg>
  );
}
