import { CTA_HEADLINE, CTA_SUPPORT } from "../lib/constants";
import { CallButton, EmailCta } from "./ui";
import { SectionReveal } from "./SectionReveal";

export function MidAuditCta() {
  return (
    <section id="mid-cta" className="scroll-mt-24 border-b border-mrg-border/40 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <SectionReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Call our experts
          </p>
          <h2 className="mt-3 font-display text-3xl text-mrg-text sm:text-4xl">
            See what your unit can earn
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-mrg-muted">{CTA_SUPPORT}</p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-8">
          <div className="flex flex-col items-center gap-4">
            <CallButton size="large" label={CTA_HEADLINE} />
            <EmailCta />
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
