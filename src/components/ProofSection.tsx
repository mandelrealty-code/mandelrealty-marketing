import { SectionReveal } from "./SectionReveal";

function ProofShot({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[13.5rem] overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:max-w-[15rem]">
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function ProofSection() {
  return (
    <section id="proof" className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-green">
            Verified results
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            Real listing. Real Airbnb earnings.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-mrg-muted">
            We took over this unit in May 2026. Same property, same platform — here&apos;s the
            before and after, straight from the host&apos;s dashboard.
          </p>
        </SectionReveal>

        <div className="mt-12 grid grid-cols-1 items-start gap-5 sm:gap-6 md:grid-cols-2">
          <SectionReveal delay={0.06}>
            <article className="rounded-3xl border border-dashed border-white/15 bg-mrg-surface p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-mrg-muted">2025</span>
                <span className="text-mrg-muted">before us</span>
              </div>
              <ProofShot
                src="/proof/2025-comparison.png"
                alt="Airbnb earnings comparison showing 2025 monthly earnings through September before MRG"
              />
              <p className="mt-5 text-center text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl">
                $26,995
              </p>
              <p className="mt-1 text-center text-sm text-mrg-muted">Gross host earnings · full year</p>
            </article>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <article className="rounded-3xl bg-mrg-surface-elevated p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-mrg-green">May–Aug 2026 · 4 months</span>
                <span className="text-mrg-green">with us</span>
              </div>
              <ProofShot
                src="/proof/2026-comparison.png"
                alt="Airbnb earnings comparison showing 2026 monthly earnings through September with MRG"
              />
              <p className="mt-5 text-center text-3xl font-bold tracking-tight text-mrg-gold sm:text-4xl">
                $33,713
              </p>
              <p className="mt-1 text-center text-sm text-mrg-muted">Gross host earnings · 4 months</p>
            </article>
          </SectionReveal>
        </div>

        <SectionReveal delay={0.14} className="mt-8">
          <p className="rounded-2xl bg-mrg-surface-elevated px-6 py-5 text-center text-base leading-relaxed text-mrg-text sm:text-lg">
            Just <span className="font-semibold text-mrg-gold">4 months</span> of 2026 already beat
            the host&apos;s <span className="font-semibold text-mrg-gold">entire 2025</span> — same
            unit, same platform.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
