import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { HOW_CARDS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

function HowStep({
  step,
  title,
  detail,
  index,
  isLast,
}: (typeof HOW_CARDS)[number] & { index: number; isLast: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className="relative flex gap-5 sm:gap-6"
      initial={{ opacity: 0, x: 24 }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-center">
        <motion.div
          className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-mrg-gold/35 bg-mrg-bg font-display text-sm text-mrg-gold shadow-[0_0_24px_rgba(201,168,76,0.12)]"
          initial={{ scale: 0.6 }}
          animate={inView ? { scale: 1 } : { scale: 0.6 }}
          transition={{ duration: 0.4, delay: index * 0.08 + 0.1, type: "spring", stiffness: 280 }}
        >
          {step}
        </motion.div>
        {!isLast && (
          <motion.div
            className="mt-2 w-px flex-1 min-h-[3rem] bg-gradient-to-b from-mrg-gold/40 via-mrg-border to-mrg-border/30"
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08 + 0.2 }}
            style={{ originY: 0 }}
          />
        )}
      </div>

      <motion.div
        className="group relative mb-8 flex-1 rounded-2xl border border-mrg-border/80 bg-mrg-surface/80 p-5 backdrop-blur-sm sm:mb-10 sm:p-6"
        whileHover={reducedMotion ? undefined : { x: 6, borderColor: "rgba(201, 168, 76, 0.35)" }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-mrg-gold/[0.04] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <p className="relative font-medium leading-snug text-mrg-text sm:text-lg">{title}</p>
        <p className="relative mt-2 text-sm leading-relaxed text-mrg-muted">{detail}</p>
      </motion.div>
    </motion.div>
  );
}

export function HowSection() {
  return (
    <section className="relative overflow-hidden border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_0%_50%,rgba(201,168,76,0.06),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:items-start">
          <div className="lg:sticky lg:top-28">
            <SectionReveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
                The playbook
              </p>
              <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">How We Doubled It</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-mrg-muted">
                Five moves on the same Toronto unit. No renovation. No platform change. Just a
                better operator.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.12} className="mt-10 hidden lg:block">
              <div className="border-l-2 border-mrg-gold/40 pl-6">
                <p className="font-display text-2xl italic leading-snug text-mrg-text">
                  The listing was working against the owner.
                </p>
                <p className="mt-3 text-lg text-mrg-gold">We turned it around in weeks.</p>
              </div>
            </SectionReveal>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -left-3 top-0 bottom-0 hidden w-px bg-mrg-border/50 sm:block" />
            {HOW_CARDS.map((card, i) => (
              <HowStep
                key={card.step}
                {...card}
                index={i}
                isLast={i === HOW_CARDS.length - 1}
              />
            ))}
          </div>
        </div>

        <SectionReveal delay={0.15} className="mt-4 border-t border-mrg-border/40 pt-10 lg:hidden">
          <div className="border-l-2 border-mrg-gold/40 pl-6">
            <p className="font-display text-xl italic leading-snug text-mrg-text">
              The listing was working against the owner.
            </p>
            <p className="mt-2 text-base text-mrg-gold">We turned it around in weeks.</p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
