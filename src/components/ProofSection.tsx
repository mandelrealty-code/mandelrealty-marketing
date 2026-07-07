import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { BAR_COMPARISONS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

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
            Every figure below is pulled directly from the Airbnb host dashboard. Screenshots on file.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.1} className="mt-12 overflow-x-auto">
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

        <SectionReveal delay={0.25} className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            "Airbnb earnings dashboard — full year 2025",
            "Airbnb earnings dashboard — May–Aug 2026 comparison",
            "Superhost badge — earned first season under MRG",
          ].map((caption) => (
            <div
              key={caption}
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-dashed border-mrg-border bg-mrg-surface p-4 text-center"
            >
              <span className="mb-2 text-2xl opacity-40">📊</span>
              <p className="text-xs text-mrg-muted">{caption}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-mrg-gold/70">
                Screenshot placeholder
              </p>
            </div>
          ))}
        </SectionReveal>
      </div>
    </section>
  );
}
