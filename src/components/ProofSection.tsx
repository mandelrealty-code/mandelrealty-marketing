import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { BAR_COMPARISONS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

const GROWTH_SCREENSHOTS = [
  {
    year: "2025",
    period: "Before MRG",
    amount: "$26,995",
    src: "/proof/2025-comparison.png",
    alt: "Airbnb earnings comparison showing 2025 monthly earnings before MRG",
  },
  {
    year: "2026",
    period: "With MRG",
    amount: "$33,713",
    src: "/proof/2026-comparison.png",
    alt: "Airbnb earnings comparison showing 2026 monthly earnings with MRG",
  },
] as const;

function GrowthComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reducedMotion = useReducedMotion();

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_50%,rgba(201,168,76,0.1),transparent)]" />

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
        From the Airbnb host dashboard — May–Aug 2026 beat all of 2025
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
}: (typeof BAR_COMPARISONS)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const max = withMrg * 1.1;

  return (
    <div ref={ref} className="rounded-2xl border border-mrg-border bg-mrg-surface p-5 sm:p-6">
      <p className="mb-5 text-sm font-semibold text-mrg-text">{month}</p>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-mrg-muted">
            <span>Before MRG</span>
            <span className="font-medium text-mrg-text">{beforeLabel}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-mrg-surface-elevated">
            <motion.div
              className="h-full rounded-full bg-mrg-muted/50"
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
          <div className="h-3 overflow-hidden rounded-full bg-mrg-surface-elevated">
            <motion.div
              className="h-full rounded-full bg-mrg-gold"
              initial={{ width: 0 }}
              animate={inView ? { width: `${(withMrg / max) * 100}%` } : { width: 0 }}
              transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>
    </div>
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

        <SectionReveal delay={0.1} className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-mrg-border text-xs uppercase tracking-wider text-mrg-muted">
                <th className="pb-4 pr-4 font-semibold">Period</th>
                <th className="pb-4 pr-4 font-semibold">Before MRG (2025)</th>
                <th className="pb-4 pr-4 font-semibold">With MRG (2026)</th>
                <th className="pb-4 font-semibold">Lift</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Full Year 2025", "$26,995", "—", "Entire year before MRG"],
                ["May 2026", "$1,886", "$3,748", "+99%"],
                ["June 2026", "$0 (empty)", "$8,755", "MRG filled it"],
                ["July 2026", "$5,370", "$10,235", "+90%"],
                ["August 2026", "$5,729", "$10,975", "+91%"],
              ].map(([period, before, withMrg, lift]) => (
                <tr key={period} className="border-b border-mrg-border/50">
                  <td className="py-4 pr-4 text-mrg-text">{period}</td>
                  <td className="py-4 pr-4 text-mrg-muted">{before}</td>
                  <td className="py-4 pr-4 font-medium text-mrg-text">{withMrg}</td>
                  <td className="py-4 text-mrg-gold">{lift}</td>
                </tr>
              ))}
              <tr className="bg-mrg-gold/10">
                <td className="py-4 pr-4 font-semibold text-mrg-text">May–Aug Total</td>
                <td className="py-4 pr-4 font-semibold text-mrg-text">$12,985</td>
                <td className="py-4 pr-4 font-display text-xl text-mrg-gold">$33,713</td>
                <td className="py-4 font-semibold text-mrg-gold">+159%</td>
              </tr>
            </tbody>
          </table>
        </SectionReveal>

        <SectionReveal delay={0.15} className="mt-8">
          <div className="rounded-2xl border border-mrg-gold/30 bg-mrg-gold/10 px-6 py-5 sm:px-8 sm:py-6">
            <p className="font-display text-xl text-mrg-text sm:text-2xl">
              4 months under MRG beat the entire previous year.{" "}
              <span className="text-mrg-gold">$33,713 vs $26,995.</span>
            </p>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.2} className="mt-12 grid gap-6 sm:grid-cols-2">
          {BAR_COMPARISONS.map((bar) => (
            <MonthBars key={bar.month} {...bar} />
          ))}
        </SectionReveal>

        <p className="mt-8 text-xs leading-relaxed text-mrg-muted">
          All figures CAD, gross host earnings before management fee. July &amp; August are
          full-season, apples-to-apples comparisons.
        </p>
      </div>
    </section>
  );
}
