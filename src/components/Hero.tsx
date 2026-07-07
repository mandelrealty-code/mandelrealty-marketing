import { CountUp } from "./CountUp";
import { SectionReveal } from "./SectionReveal";
import { AuditButton, PhoneLink } from "./ui";
import { HERO_AMOUNT } from "../lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-mrg-border/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,168,76,0.12),transparent)]" />
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <SectionReveal>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Toronto Short-Term Rental Management
          </p>
          <h1 className="font-display text-[clamp(3.5rem,14vw,7.5rem)] leading-[0.95] tracking-tight text-mrg-text">
            <CountUp value={HERO_AMOUNT} />
            <span className="text-mrg-gold">.</span>
          </h1>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mrg-muted sm:text-xl sm:leading-relaxed">
            That's what this Toronto Airbnb made in all of 2025. We matched it in our first two
            months.
          </p>
          <p className="mt-3 text-base font-medium text-mrg-text sm:text-lg">
            Same unit. Same platform. Different manager.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.2} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <AuditButton size="large" />
          <PhoneLink className="text-center text-lg sm:text-left" />
        </SectionReveal>

        <SectionReveal delay={0.25}>
          <p className="mt-6 text-center text-xs text-mrg-muted sm:text-left">
            No obligation · Toronto only · 15 minutes · No pitch
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
