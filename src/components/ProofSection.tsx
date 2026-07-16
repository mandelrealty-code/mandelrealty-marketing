import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { BAR_COMPARISONS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

const GROWTH_SCREENSHOTS = [
  {
    year: "2025",
    period: "May–Aug · before MRG",
    amount: "$12,985",
    src: "/proof/2025-comparison.png",
    alt: "Airbnb earnings comparison showing 2025 monthly earnings before MRG",
    note: "Dashboard shows full year — we compare the same four months only.",
  },
  {
    year: "2026",
    period: "May–Aug · with MRG",
    amount: "$33,713",
    src: "/proof/2026-comparison.png",
    alt: "Airbnb earnings comparison showing 2026 monthly earnings with MRG",
    note: "MRG took over in May 2026. Jan–Apr were not under MRG.",
  },
] as const;

function GrowthComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reducedMotion = useReducedMotion();

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_50%,rgba(201,168,76,0.1),transparent)]" />

      <motion.div
        className="mb-8 rounded-2xl border border-mrg-border/70 bg-mrg-surface/60 px-5 py-4 text-center sm:px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.45 }}
      >
        <p className="text-sm font-medium text-mrg-text">
          MRG took over this unit in <span className="text-mrg-gold">May 2026</span>.
        </p>
      </motion.div>

      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-end sm:justify-center sm:gap-5 md:gap-8">
        <motion.div
          className="flex w-[min(70vw,240px)] flex-col items-center sm:w-[220px] md:w-[250px]"
          initial={{ opacity: 0, y: 28, x: -16 }}
          animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
              {GROWTH_SCREENSHOTS[0].year}
            </p>
            <p className="mt-1 text-sm text-mrg-muted">{GROWTH_SCREENSHOTS[0].period}</p>
            <p className="mt-1 font-display text-2xl text-mrg-text sm:text-3xl">
              {GROWTH_SCREENSHOTS[0].amount}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-mrg-muted">{GROWTH_SCREENSHOTS[0].note}</p>
          </div>
          <motion.div
            className="w-full overflow-hidden rounded-[1.35rem] border border-mrg-border/50 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            whileHover={reducedMotion ? undefined : { y: -4 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <img
              src={GROWTH_SCREENSHOTS[0].src}
              alt={GROWTH_SCREENSHOTS[0].alt}
              className="block w-full"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </motion.div>

        <motion.div
          className="flex shrink-0 flex-col items-center gap-1.5 sm:mb-[38%] sm:pb-2"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.45, delay: 0.2, type: "spring", stiffness: 260, damping: 18 }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-mrg-gold/40 bg-mrg-bg shadow-lg sm:h-11 sm:w-11">
            <span className="font-display text-lg text-mrg-gold sm:text-xl">→</span>
          </div>
          <span className="rounded-full border border-mrg-gold/30 bg-mrg-gold/15 px-3 py-1 text-xs font-bold tracking-wide text-mrg-gold sm:text-sm">
            +159%
          </span>
        </motion.div>

        <motion.div
          className="flex w-[min(70vw,240px)] flex-col items-center sm:w-[220px] md:w-[250px]"
          initial={{ opacity: 0, y: 28, x: 16 }}
          animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
              {GROWTH_SCREENSHOTS[1].year}
            </p>
            <p className="mt-1 text-sm text-mrg-muted">{GROWTH_SCREENSHOTS[1].period}</p>
            <p className="mt-1 font-display text-2xl text-mrg-text sm:text-3xl">
              {GROWTH_SCREENSHOTS[1].amount}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-mrg-muted">{GROWTH_SCREENSHOTS[1].note}</p>
          </div>
          <motion.div
            className="w-full overflow-hidden rounded-[1.35rem] border border-mrg-gold/35 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-mrg-gold/25"
            whileHover={reducedMotion ? undefined : { y: -4 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <img
              src={GROWTH_SCREENSHOTS[1].src}
              alt={GROWTH_SCREENSHOTS[1].alt}
              className="block w-full"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </motion.div>
      </div>

      <motion.p
        className="mt-8 text-center text-sm text-mrg-muted"
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        Same four months (May–Aug) from the Airbnb host dashboard — +159% under MRG
      </motion.p>
    </div>
  );
}

function MonthBars({
  month,
  before,
  withMrg,
  beforeLabel,
  withMrgLabel,
  lift,
  index = 0,
}: (typeof BAR_COMPARISONS)[number] & { index?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const max = Math.max(withMrg, before, 1) * 1.08;

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border border-mrg-border/70 bg-mrg-surface/80 p-5 sm:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-mrg-text">{month}</p>
        <span className="rounded-full bg-mrg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-mrg-gold">
          {lift}
        </span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-mrg-muted">
            <span>Before</span>
            <span className="font-medium text-mrg-text">{beforeLabel}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-mrg-surface-elevated">
            <motion.div
              className="h-full rounded-full bg-mrg-muted/45"
              initial={{ width: 0 }}
              animate={inView ? { width: `${(before / max) * 100}%` } : { width: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-mrg-muted">
            <span>With MRG</span>
            <span className="font-semibold text-mrg-gold">{withMrgLabel}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-mrg-surface-elevated">
            <motion.div
              className="h-full rounded-full bg-mrg-gold"
              initial={{ width: 0 }}
              animate={inView ? { width: `${(withMrg / max) * 100}%` } : { width: 0 }}
              transition={{ duration: 1.05, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ProofSection() {
  return (
    <section id="proof" className="scroll-mt-20 border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionReveal>
          <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">The Numbers. Verified.</h2>
          <p className="mt-4 max-w-xl text-mrg-muted">
            Every figure below is pulled directly from the Airbnb host dashboard.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-12 sm:mt-14">
          <GrowthComparison />
        </SectionReveal>

        <SectionReveal delay={0.1} className="mt-14">
          <div className="overflow-hidden rounded-3xl border border-mrg-gold/30 bg-gradient-to-br from-mrg-gold/15 via-mrg-gold/5 to-transparent px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
              Full year vs four months
            </p>
            <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div>
                <p className="text-sm text-mrg-muted">Full year 2025</p>
                <p className="mt-1 font-display text-4xl text-mrg-text sm:text-5xl">$26,995</p>
              </div>
              <div className="hidden flex-col items-center gap-1 pb-2 sm:flex">
                <span className="font-display text-3xl text-mrg-gold">→</span>
                <span className="text-sm font-bold text-mrg-gold">+159%</span>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-mrg-muted">May–Aug 2026</p>
                <p className="mt-1 font-display text-4xl text-mrg-gold sm:text-5xl">$33,713</p>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-mrg-muted sm:text-lg">
              Four months under MRG beat the entire previous year — same unit, same platform.
            </p>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.15} className="mt-12">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.16em] text-mrg-muted">
            May–Aug, month by month
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {BAR_COMPARISONS.map((bar, i) => (
              <MonthBars key={bar.month} {...bar} index={i} />
            ))}
          </div>
        </SectionReveal>

        <p className="mt-8 text-xs leading-relaxed text-mrg-muted">
          All figures CAD, gross host earnings before management fee. MRG began managing this
          unit in May 2026; comparisons use May–Aug only. July &amp; August are full-season,
          apples-to-apples.
        </p>
      </div>
    </section>
  );
}
