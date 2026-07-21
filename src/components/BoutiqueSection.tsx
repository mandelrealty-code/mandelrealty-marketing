import { SectionReveal } from "./SectionReveal";
import { CallButton, EstimateButton } from "./ui";

export function BoutiqueSection() {
  return (
    <section className="border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-5">
        <SectionReveal>
          {/* Elevated surface only — no gold outline frame */}
          <div className="rounded-3xl bg-mrg-surface-elevated px-6 py-12 text-center sm:px-12 sm:py-16">
            <p className="mx-auto inline-flex rounded-full bg-mrg-bg px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-muted sm:text-xs">
              A boutique firm · Limited partnerships
            </p>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
              We only partner with{" "}
              <span className="text-mrg-gold">20 listings</span> at a time.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-mrg-muted">
              Capacity is capped on purpose. Every listing gets hands-on attention, real systems,
              and a team that treats your property like a business — not a line item.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-mrg-bg px-4 py-2 text-sm text-mrg-text">
              <span className="h-2 w-2 rounded-full bg-mrg-green" aria-hidden />
              A few partnership spots open right now
            </div>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <CallButton
                size="large"
                label="Call today to see if you're a fit"
                className="w-full sm:w-auto"
              />
              <EstimateButton
                size="large"
                variant="secondary"
                label="Check my fit online →"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
