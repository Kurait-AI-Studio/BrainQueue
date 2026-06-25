"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { ThoughtCloud } from "./ThoughtCloud";
import { FocusCard } from "./FocusCard";
import { CtaPrimary, CtaGhost, Section } from "./ui/primitives";
import { ctaPrimary } from "@/config/site";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // The single clear focus task resolves into view as the thoughts get organized.
  const cardOpacity = useTransform(scrollYProgress, [0.5, 0.82], [0, 1]);
  const cardScale = useTransform(scrollYProgress, [0.5, 0.82], [0.94, 1]);
  const cardY = useTransform(scrollYProgress, [0.5, 0.82], [16, 0]);

  return (
    <section id="top" ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 flex min-h-[100dvh] items-center overflow-hidden">
        <Section className="grid w-full grid-cols-1 items-center gap-12 pt-24 pb-16 lg:grid-cols-[1.04fr_1fr] lg:gap-8 lg:pt-0 lg:pb-0">
          {/* Copy: always legible, sits above the dots */}
          <div className="relative z-20 max-w-xl">
            <h1 className="font-display text-[2.6rem] font-medium leading-[1.04] tracking-[-0.02em] text-ink sm:text-5xl md:text-6xl">
              Your brain is for <span className="text-accent">thinking</span>.
              <span className="block text-ink/65">Not for remembering everything.</span>
            </h1>

            <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-muted sm:text-lg">
              Capture every thought in its rawest form. BrainQueue makes the mental mess
              clear, then hands you one realistic next step.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaPrimary>{ctaPrimary}</CtaPrimary>
              <CtaGhost href="#how">See how it works</CtaGhost>
            </div>

            <p className="mt-4 text-sm text-faint">
              No perfect system required. Start with one messy thought.
            </p>
          </div>

          {/* Stage: the scroll-driven thought cloud + the resolved focus card */}
          <div className="relative h-[62vh] min-h-[440px] w-full lg:h-[82vh]">
            <ThoughtCloud progress={scrollYProgress} />

            <motion.div
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              style={
                reduced
                  ? undefined
                  : { opacity: cardOpacity, scale: cardScale, y: cardY }
              }
            >
              <FocusCard />
            </motion.div>
          </div>
        </Section>
      </div>
    </section>
  );
}
