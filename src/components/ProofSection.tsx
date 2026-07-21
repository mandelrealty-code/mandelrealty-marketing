import { SectionReveal } from "./SectionReveal";
import { EarningsComparisonChart } from "./EarningsComparisonChart";
import { DashboardScreenshotThumbs } from "./DashboardScreenshotThumbs";
import { EARNINGS_SUMMARY } from "../lib/constants";

const DASHBOARD_SHOTS = [
  {
    src: "/proof/2025-comparison-full.png",
    thumb: "/proof/2025-comparison.png",
    label: "2025 · before MRG",
    alt: "Full Airbnb earnings comparison for 2025 before Mandel Realty Group",
  },
  {
    src: "/proof/2026-comparison-full.png",
    thumb: "/proof/2026-comparison.png",
    label: "2026 · with MRG",
    alt: "Full Airbnb earnings comparison for 2026 with Mandel Realty Group",
  },
] as const;

export function ProofSection() {
  return (
    <section id="proof" className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-green">
            Verified results
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            Real listing. Real Airbnb earnings.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mrg-muted">
            We took over this unit in May 2026. Same property, same platform — full-year trend,
            month by month.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.06} className="mt-12">
          <div className="rounded-3xl bg-mrg-surface p-5 ring-1 ring-white/10 sm:p-8">
            <EarningsComparisonChart />
            <div className="mt-5 border-t border-white/8 pt-5">
              <DashboardScreenshotThumbs shots={[...DASHBOARD_SHOTS]} />
            </div>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.1} className="mt-8">
          <p className="rounded-2xl bg-mrg-surface-elevated px-6 py-5 text-center text-base leading-relaxed text-mrg-text sm:text-lg">
            Just <span className="font-semibold text-mrg-gold">4 months</span> of 2026 ($
            {EARNINGS_SUMMARY.mayAug2026.toLocaleString()}) already beat the host&apos;s{" "}
            <span className="font-semibold text-mrg-gold">entire 2025</span> ($
            {EARNINGS_SUMMARY.year2025.toLocaleString()}) — same unit, same platform.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
