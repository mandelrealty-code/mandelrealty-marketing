import { PRICING_TIERS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Simple, aligned pricing
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            We only win when you win.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mrg-muted">
            No big upfront fees. We charge a share of the revenue we generate — so our incentives
            are pointed at exactly one thing: growing your bottom line.
          </p>
        </SectionReveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <SectionReveal key={tier.id} delay={i * 0.05}>
              <article
                className={`relative flex h-full flex-col rounded-2xl p-6 sm:p-7 ${
                  tier.popular
                    ? "bg-mrg-surface-elevated ring-1 ring-white/10"
                    : "bg-mrg-surface"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mrg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-mrg-text">{tier.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mrg-muted">{tier.description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-mrg-text">
                      <span className="mt-0.5 text-mrg-green" aria-hidden>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/#fit-check"
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                    tier.popular
                      ? "bg-mrg-gold text-black hover:bg-mrg-gold-light"
                      : "border border-white/20 text-white hover:border-white/40 hover:bg-white/5"
                  }`}
                >
                  Get a custom quote
                </a>
              </article>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
