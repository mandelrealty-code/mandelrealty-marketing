import { CountUp } from "./CountUp";
import { SectionReveal } from "./SectionReveal";
import { AuditButton } from "./ui";
import { HERO_AMOUNT } from "../lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-mrg-border/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,168,76,0.12),transparent)]" />
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <SectionReveal>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Toronto Short-Term Rental Management
          </p>
          <h1 className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.05] tracking-tight text-mrg-text">
            <CountUp value={HERO_AMOUNT} startOnMount />
            <span className="text-mrg-gold">.</span>
          </h1>
        </SectionReveal>

        <SectionReveal delay={0.08}>
          <p className="mt-4 max-w-3xl font-display text-[clamp(1.75rem,5vw,3rem)] leading-[1.1] text-mrg-text">
            That is what this Toronto Airbnb made in all of 2025.
          </p>
          <p className="mt-3 font-display text-[clamp(1.75rem,5vw,3rem)] italic leading-[1.1] text-mrg-gold">
            We matched it in two months.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.14}>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-mrg-muted sm:text-lg">
            Same unit. Same platform. We relisted it, earned Superhost, and nearly doubled peak
            revenue. Real Airbnb earnings screenshots below — not numbers on a slide.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.2} className="mt-10">
          <AuditButton size="large" label="Get My Free Revenue Audit" />
        </SectionReveal>
      </div>
    </section>
  );
}
