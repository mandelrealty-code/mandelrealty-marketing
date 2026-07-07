import { SectionReveal } from "./SectionReveal";

export function MathSection() {
  return (
    <section className="border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionReveal>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="rounded-2xl border border-mrg-border bg-mrg-surface p-6">
                <p className="text-xs uppercase tracking-wider text-mrg-muted">Old manager</p>
                <p className="mt-2 text-lg leading-relaxed text-mrg-muted">
                  15% on an underperforming{" "}
                  <span className="font-semibold text-mrg-text">$5,000/month</span> = you keep{" "}
                  <span className="font-display text-2xl text-mrg-text">$4,250</span>
                </p>
              </div>
              <div className="rounded-2xl border border-mrg-gold/40 bg-mrg-gold/5 p-6">
                <p className="text-xs uppercase tracking-wider text-mrg-gold">MRG Essential</p>
                <p className="mt-2 text-lg leading-relaxed text-mrg-muted">
                  20% on an optimized{" "}
                  <span className="font-semibold text-mrg-text">$8,000/month</span> = you keep{" "}
                  <span className="font-display text-3xl text-mrg-gold">$6,400</span>
                </p>
              </div>
            </div>
            <div>
              <p className="font-display text-3xl leading-tight text-mrg-text sm:text-4xl">
                A lower fee on a weaker listing is the most expensive deal in short-term rental.
              </p>
              <p className="mt-4 text-lg text-mrg-gold">
                The fee isn't the cost. Underperformance is the cost.
              </p>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
