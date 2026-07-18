import { CountUp } from "./CountUp";
import { SectionReveal } from "./SectionReveal";
import { AuditButton, CallButton } from "./ui";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { HERO_AMOUNT, PHONE } from "../lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-mrg-border/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,168,76,0.12),transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 sm:gap-12 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div>
          <SectionReveal>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
              Toronto Short-Term Rental Management
            </p>
            <h1 className="font-display text-[clamp(2.5rem,7vw,4.25rem)] leading-[1.05] tracking-tight text-mrg-text">
              <CountUp value={HERO_AMOUNT} startOnMount />
              <span className="text-mrg-gold">.</span>
            </h1>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <p className="mt-4 max-w-xl font-display text-[clamp(1.5rem,3.8vw,2.5rem)] leading-[1.12] text-mrg-text">
              That is what this Toronto Airbnb made in all of 2025.
            </p>
            <p className="mt-3 font-display text-[clamp(1.5rem,3.8vw,2.5rem)] italic leading-[1.12] text-mrg-gold">
              We beat the year in four months.
            </p>
          </SectionReveal>

          <SectionReveal delay={0.14}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-mrg-muted sm:text-lg">
              Same unit. Same platform. We relisted it, earned Superhost, and nearly doubled peak
              revenue. Real Airbnb earnings screenshots below — not numbers on a slide.
            </p>
          </SectionReveal>

          <SectionReveal delay={0.2} className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <AuditButton size="large" label="Get My Free Revenue Audit" />
              <CallButton size="large" label={`Call ${PHONE}`} />
            </div>
          </SectionReveal>
        </div>

        <SectionReveal delay={0.12} className="w-full lg:pt-2">
          <BeforeAfterSlider
            beforeSrc="/hero-before.png"
            afterSrc="/hero-unit.png"
            beforeAlt="Toronto Airbnb living room before Mandel Realty Group"
            afterAlt="Toronto Airbnb living room after Mandel Realty Group"
          />
        </SectionReveal>
      </div>
    </section>
  );
}
