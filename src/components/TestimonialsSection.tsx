import { TESTIMONIALS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

function Stars() {
  return (
    <div className="flex gap-0.5 text-mrg-gold" aria-label="5 star rating">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden>
          ★
        </span>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            Don&apos;t take our <span className="text-mrg-gold">word</span> for it
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mrg-muted">
            Real hosts. Real results. Real peace of mind.
          </p>
        </SectionReveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((item, i) => (
            <SectionReveal key={item.name} delay={i * 0.05}>
              <article className="flex h-full flex-col rounded-2xl bg-mrg-surface-elevated p-6 sm:p-7">
                <Stars />
                <p className="mt-4 flex-1 text-[15px] leading-relaxed text-mrg-text">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-semibold text-mrg-text">{item.name}</p>
                    <p className="text-sm text-mrg-muted">{item.location}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-mrg-green/40 px-3 py-1 text-xs font-semibold text-mrg-green">
                    {item.badge}
                  </span>
                </div>
              </article>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
