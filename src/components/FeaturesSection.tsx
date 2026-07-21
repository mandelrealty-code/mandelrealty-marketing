import { FEATURE_CARDS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

export function FeaturesSection() {
  return (
    <section className="border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            What we handle for you
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mrg-muted">
            A proven system that compounds: better reviews drive more visibility, and more
            visibility drives more revenue.
          </p>
        </SectionReveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FEATURE_CARDS.map((card, i) => (
            <SectionReveal key={card.step} delay={i * 0.05}>
              <article className="h-full rounded-2xl bg-mrg-surface-elevated p-6 sm:p-7">
                <p className="text-sm font-semibold text-mrg-gold">{card.step}</p>
                <h3 className="mt-3 text-xl font-semibold text-mrg-text">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-mrg-muted">{card.detail}</p>
              </article>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal delay={0.12} className="mt-10">
          <p className="rounded-2xl bg-mrg-surface px-5 py-4 text-center text-sm text-mrg-muted sm:text-base">
            Serving hosts across Canada and the United States — hands-on or fully virtual
            management, always completely hands-off for you.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
