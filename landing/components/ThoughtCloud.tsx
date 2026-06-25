"use client";

import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { generateDots, type Dot as DotData } from "@/lib/dots";
import { CATEGORIES, TAG_ORDER, type CategoryKey } from "@/lib/tokens";

/**
 * The scroll-driven hero visual.
 *   grey scattered thoughts  →  AI sorting node  →  colored category clusters  →  tags
 * Driven entirely by `progress` (0 → 1), so it reverses smoothly on upward scroll.
 * Under prefers-reduced-motion it renders the final organized state with a gentle fade —
 * no movement.
 */
export function ThoughtCloud({ progress }: { progress: MotionValue<number> }) {
  const reduced = !!useReducedMotion();
  const [count, setCount] = useState(48);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setCount(mq.matches ? 24 : 48);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const dots = useMemo(() => generateDots(count), [count]);
  const tagKeys = count <= 24 ? TAG_ORDER.slice(0, 3) : TAG_ORDER.slice(0, 4);

  return (
    <div className="absolute inset-0 overflow-visible" aria-hidden>
      <AiNode progress={progress} reduced={reduced} />
      {dots.map((d) => (
        <Dot key={d.id} d={d} progress={progress} reduced={reduced} />
      ))}
      {tagKeys.map((k) => (
        <Tag key={k} cat={k} progress={progress} reduced={reduced} />
      ))}
    </div>
  );
}

function Dot({ d, progress, reduced }: { d: DotData; progress: MotionValue<number>; reduced: boolean }) {
  // Hooks are unconditional; we just ignore them in the reduced branch.
  const left = useTransform(progress, [0, 0.62], [`${d.startX}%`, `${d.endX}%`]);
  const top = useTransform(progress, [0, 0.62], [`${d.startY}%`, `${d.endY}%`]);
  const opacity = useTransform(progress, [0, 0.5], [d.startOpacity, d.endOpacity]);
  const scale = useTransform(progress, [0, 0.62], [0.9, 1]);
  const background = useTransform(progress, [0.32, 0.78], [d.grey, d.color]);

  if (reduced) {
    return (
      <motion.span
        className="absolute rounded-full"
        style={{
          left: `${d.endX}%`,
          top: `${d.endY}%`,
          width: d.size,
          height: d.size,
          x: "-50%",
          y: "-50%",
          background: d.color,
        }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: d.endOpacity }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    );
  }

  return (
    <motion.span
      className="absolute will-change-transform"
      style={{ left, top, x: "-50%", y: "-50%", scale, opacity }}
    >
      <motion.span
        className={`block rounded-full ${d.drift ? "dot-float" : ""}`}
        style={{
          width: d.size,
          height: d.size,
          background,
          filter: d.depth < 0.4 ? "blur(1px)" : undefined,
          // stagger the gentle drift so they don't pulse in unison
          animationDelay: d.drift ? `${(d.id % 7) * 0.6}s` : undefined,
        }}
      />
    </motion.span>
  );
}

function AiNode({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const opacity = useTransform(progress, [0.06, 0.32, 0.9], [0.25, 1, 0.7]);
  const scale = useTransform(progress, [0.06, 0.4], [0.8, 1]);
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[46%]"
      style={reduced ? { opacity: 0.85 } : { opacity, scale, x: "-50%", y: "-50%" }}
    >
      <div className="node-pulse relative grid h-16 w-16 place-items-center rounded-full">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
        <div className="absolute inset-0 rounded-full border border-accent/40" />
        <div className="absolute inset-[22%] rounded-full border border-accent/25" />
        <div className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_18px_4px_rgba(190,242,74,0.6)]" />
      </div>
    </motion.div>
  );
}

function Tag({ cat, progress, reduced }: { cat: CategoryKey; progress: MotionValue<number>; reduced: boolean }) {
  const { label, color, anchor } = CATEGORIES[cat];
  // Tags fade in only after the dots have mostly reached their clusters.
  const opacity = useTransform(progress, [0.72, 0.9], [0, 1]);
  const y = useTransform(progress, [0.72, 0.9], [8, 0]);

  // Nudge the pill just outside the cluster centre so it doesn't sit on the dots.
  const offY = anchor.y > 50 ? 13 : -13;

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${anchor.x}%`,
        top: `calc(${anchor.y}% + ${offY}px)`,
        x: "-50%",
        ...(reduced ? { opacity: 1 } : { opacity, y }),
      }}
    >
      <span className="glass-strong inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-medium text-ink/90">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
    </motion.div>
  );
}
