import { SectionReveal } from "./SectionReveal";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { CallButton, EstimateButton } from "./ui";
import { CTA_SUPPORT } from "../lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(245,197,24,0.08),transparent)]" />

      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <SectionReveal>
          {/* Fill-only badge — no gold outline */}
          <p className="mx-auto inline-flex max-w-full items-center rounded-full bg-mrg-surface-elevated px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-muted sm:text-xs">
            Hands-on &amp; virtual Airbnb management · Canada &amp; U.S.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.06}>
          <h1 className="mt-8 text-[clamp(2.4rem,8vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-mrg-text">
            Same property.
            <br />
            Same platform.
            <br />
            <span className="text-mrg-gold">Twice the profit.</span>
          </h1>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-mrg-muted sm:text-lg">
            Most hosts are earning 20–40% below what their listing is capable of — buried in guest
            messages, stuck with a manager who&apos;s coasting, or running a listing they know is
            underperforming. We run it professionally. You keep the profits.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.14} className="mt-8">
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <EstimateButton size="large" className="w-full sm:w-auto" />
            <CallButton
              size="large"
              variant="secondary"
              label="Call an expert now"
              className="w-full sm:w-auto"
            />
          </div>
          <p className="mt-4 text-sm text-mrg-muted">{CTA_SUPPORT}</p>
        </SectionReveal>
      </div>

      <SectionReveal delay={0.16} className="mx-auto mt-12 max-w-5xl px-5 sm:mt-16">
        <BeforeAfterSlider
          beforeSrc="/hero-before.png"
          afterSrc="/hero-unit.png"
          beforeAlt="Toronto Airbnb living room before Mandel Realty Group"
          afterAlt="Toronto Airbnb living room after Mandel Realty Group"
        />
      </SectionReveal>
    </section>
  );
}
