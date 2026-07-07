import { HOW_CARDS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

export function HowSection() {
  return (
    <section className="border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionReveal>
          <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">How We Doubled It</h2>
        </SectionReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_CARDS.map((card, i) => (
            <SectionReveal key={card.title} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-mrg-border bg-mrg-surface p-6 transition-colors hover:border-mrg-gold/30">
                <span className="text-2xl" aria-hidden>
                  {card.icon}
                </span>
                <p className="mt-4 font-medium leading-snug text-mrg-text">{card.title}</p>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal delay={0.2} className="mt-10">
          <p className="text-lg text-mrg-muted">
            The listing was working against the owner.{" "}
            <span className="text-mrg-text">We turned it around in weeks.</span>
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
