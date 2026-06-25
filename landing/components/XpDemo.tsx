"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useAnimate,
  useInView,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "motion/react";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const START_PCT = 88; // level 6, almost full — one task tips it over
const CARRY_PCT = 16; // where level 7 starts after the level-up

/**
 * Scroll-triggered momentum demo: when it enters view, an example task is
 * completed, the XP bar fills, and you level up 6 -> 7. Motivated motion
 * (feedback + state transition), not a static dashboard bar.
 * Under reduced motion it renders the finished state with no movement.
 */
export function XpDemo() {
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, { once: true, amount: 0.55 });
  const reduced = useReducedMotion();

  const [level, setLevel] = useState(6);
  const [done, setDone] = useState(false);
  const xp = useMotionValue(1180);
  const xpText = useTransform(xp, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduced) {
      setLevel(7);
      setDone(true);
      xp.set(1230);
      animate("[data-bar]", { width: `${CARRY_PCT}%` }, { duration: 0 });
      return;
    }
    if (!inView) return;
    let cancelled = false;
    (async () => {
      await delay(450);
      if (cancelled) return;
      setDone(true);
      animate("[data-burst]", { opacity: [0, 1, 1, 0], y: [6, -12, -22, -34] }, { duration: 1.6, ease: "easeOut" });
      animate(xp, 1230, { duration: 1 });
      await animate("[data-bar]", { width: "100%" }, { duration: 0.95, ease: [0.22, 1, 0.36, 1] });
      if (cancelled) return;
      await delay(180);
      setLevel(7);
      await animate("[data-bar]", { width: "0%" }, { duration: 0.01 });
      await animate("[data-bar]", { width: `${CARRY_PCT}%` }, { duration: 0.85, ease: [0.22, 1, 0.36, 1] });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced]);

  return (
    <div ref={scope} className="glass-strong rounded-[var(--radius-card)] p-7">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">Level</div>
          <div className="font-display text-5xl font-medium leading-none text-ink">
            <motion.span
              key={level}
              initial={{ y: reduced ? 0 : -16, opacity: reduced ? 1 : 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="inline-block"
            >
              {level}
            </motion.span>
          </div>
        </div>
        <div className="text-right">
          <motion.div className="font-display text-2xl font-medium text-accent">{xpText}</motion.div>
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">XP</div>
        </div>
      </div>

      {/* the bar + the floating reward */}
      <div className="relative mt-5">
        <motion.span
          data-burst
          style={{ opacity: 0 }}
          className="pointer-events-none absolute -top-3 right-0 text-sm font-bold text-accent"
        >
          +50 XP
        </motion.span>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            data-bar
            style={{ width: `${START_PCT}%` }}
            className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent"
          />
        </div>
        <div className="mt-2 flex justify-between text-[0.7rem] text-faint">
          <span>Level 6</span>
          <span>Level 7</span>
        </div>
      </div>

      {/* the example task that gets completed */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5">
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors duration-300 ${
            done ? "border-accent bg-accent" : "border-white/25"
          }`}
        >
          <motion.svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            initial={false}
            animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            aria-hidden
          >
            <path d="M2.5 7.5l3 3 6-7" stroke="#0a0a0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </span>
        <span className={`text-sm transition-all duration-300 ${done ? "text-faint line-through" : "text-ink"}`}>
          Find insurance number
        </span>
        <span className="ml-auto rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[0.72rem] font-semibold text-accent">
          +50 XP
        </span>
      </div>
    </div>
  );
}
