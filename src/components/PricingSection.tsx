import { ESSENTIAL_FEATURES, FULL_SERVICE_FEATURES } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";
import { AuditButton } from "./ui";

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-mrg-muted">
          <span className="mt-0.5 shrink-0 text-mrg-gold">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionReveal>
          <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">
            Two Plans. No Hidden Fees. No Lock-In.
          </h2>
        </SectionReveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <SectionReveal delay={0.05}>
            <div className="flex h-full flex-col rounded-2xl border border-mrg-border bg-mrg-surface p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-mrg-muted">
                Essential
              </p>
              <p className="mt-2 font-display text-4xl text-mrg-text">
                20% <span className="text-lg text-mrg-muted">+ HST</span>
              </p>
              <FeatureList items={ESSENTIAL_FEATURES} />
              <div className="mt-8">
                <AuditButton className="w-full" />
              </div>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div className="relative flex h-full flex-col rounded-2xl border-2 border-mrg-gold bg-mrg-surface-elevated p-8 shadow-[0_0_60px_rgba(201,168,76,0.08)]">
              <span className="absolute -top-3 right-6 rounded-full bg-mrg-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-mrg-bg">
                Recommended
              </span>
              <p className="text-sm font-semibold uppercase tracking-wider text-mrg-gold">
                Full Service ★
              </p>
              <p className="mt-2 font-display text-4xl text-mrg-text">
                25% <span className="text-lg text-mrg-muted">+ HST</span>
              </p>
              <p className="mt-4 text-sm text-mrg-muted">Everything in Essential, plus:</p>
              <FeatureList items={FULL_SERVICE_FEATURES} />
              <div className="mt-8">
                <AuditButton className="w-full" />
              </div>
            </div>
          </SectionReveal>
        </div>

        <SectionReveal delay={0.15} className="mt-10">
          <div className="rounded-2xl border border-mrg-border bg-mrg-surface px-6 py-6 sm:px-8">
            <p className="leading-relaxed text-mrg-muted">
              The difference on an $8,000/month property is $400 — that's one night. A guest who
              finds a burnt-out bulb leaves a 4-star review instead of 5. That costs you more than
              $400 in lost ranking and future bookings.{" "}
              <span className="font-medium text-mrg-text">
                Full Service gets that night back. And then some.
              </span>
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
