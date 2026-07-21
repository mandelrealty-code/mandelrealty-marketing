import { motion, useReducedMotion } from "framer-motion";
import { CHAIN_OUTCOME, CHAIN_STEPS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";
import { CallButton, WhatsAppButton } from "./ui";

type StepId = (typeof CHAIN_STEPS)[number]["id"] | typeof CHAIN_OUTCOME.id;

function ChainIcon({ id, className = "h-6 w-6" }: { id: StepId; className?: string }) {
  const stroke = "currentColor";
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "systems":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
    case "experience":
      return (
        <svg {...props}>
          <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
          <path d="M8 10h.01M12 10h.01M16 10h.01" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...props}>
          <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8z" />
        </svg>
      );
    case "visibility":
      return (
        <svg {...props}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "bookings":
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
          <path d="M8 14h3M13 14h3M8 17h3" />
        </svg>
      );
    case "money":
      return (
        <svg {...props}>
          <path d="M4 19V9M9 19V5M14 19v-7M19 19V8" />
          <path d="M3 19h18" />
        </svg>
      );
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

export function HowSection() {
  const reducedMotion = useReducedMotion();
  const total = CHAIN_STEPS.length;

  return (
    <section id="how" className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <SectionReveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            How it <span className="text-mrg-gold">works</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mrg-muted">
            A simple chain reaction that turns your property into a revenue machine.
          </p>
        </SectionReveal>

        {/* Mobile / tablet: vertical reaction timeline */}
        <div className="relative mx-auto mt-14 max-w-md lg:hidden">
          <div className="absolute left-[1.65rem] top-4 bottom-24 w-px bg-white/10" aria-hidden />
          <motion.div
            className="absolute left-[1.65rem] top-4 w-px origin-top bg-gradient-to-b from-mrg-gold via-mrg-gold to-mrg-gold/40"
            initial={reducedMotion ? { scaleY: 1 } : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: reducedMotion ? 0 : 1.6, ease }}
            style={{ bottom: "6rem" }}
            aria-hidden
          />

          <ol className="space-y-5">
            {CHAIN_STEPS.map((step, i) => (
              <motion.li
                key={step.id}
                className="relative flex gap-4"
                initial={reducedMotion ? false : { opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.1, ease }}
              >
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mrg-surface-elevated text-mrg-text ring-1 ring-white/10">
                  <ChainIcon id={step.id} />
                </div>
                <div className="pt-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mrg-muted">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 font-semibold text-mrg-text">{step.label}</p>
                  <p className="mt-1 text-sm text-mrg-muted">{step.detail}</p>
                </div>
              </motion.li>
            ))}

            <motion.li
              className="relative flex gap-4 pt-2"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: 0.45, ease }}
            >
              <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mrg-gold text-black shadow-[0_0_32px_rgba(245,197,24,0.35)]">
                <ChainIcon id={CHAIN_OUTCOME.id} className="h-6 w-6" />
              </div>
              <div className="pt-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                  Result
                </p>
                <p className="mt-1 text-xl font-bold text-mrg-gold">{CHAIN_OUTCOME.label}</p>
                <p className="mt-1 text-sm text-mrg-muted">{CHAIN_OUTCOME.detail}</p>
              </div>
            </motion.li>
          </ol>
        </div>

        {/* Desktop: horizontal chain with draw-in connectors */}
        <div className="mt-16 hidden lg:block">
          <div className="relative">
            {/* Base track */}
            <div
              className="absolute left-[6%] right-[6%] top-[2.25rem] h-px bg-white/10"
              aria-hidden
            />
            <motion.div
              className="absolute left-[6%] top-[2.25rem] h-px w-[88%] origin-left bg-mrg-gold"
              initial={reducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: reducedMotion ? 0 : 1.35, ease }}
              aria-hidden
            />

            {/* Traveling pulse along the chain */}
            {!reducedMotion && (
              <motion.span
                className="pointer-events-none absolute top-[2.25rem] h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-mrg-gold shadow-[0_0_16px_rgba(245,197,24,0.8)]"
                initial={{ left: "6%", opacity: 0 }}
                whileInView={{
                  left: ["6%", "94%"],
                  opacity: [0, 1, 1, 0],
                }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1.5, ease, delay: 0.15 }}
                aria-hidden
              />
            )}

            <ol className="relative grid grid-cols-5 gap-3">
              {CHAIN_STEPS.map((step, i) => (
                <motion.li
                  key={step.id}
                  className="flex flex-col items-center text-center"
                  initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease }}
                >
                  <motion.div
                    className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-mrg-surface-elevated text-mrg-text ring-1 ring-white/10"
                    whileInView={
                      reducedMotion
                        ? undefined
                        : {
                            boxShadow: [
                              "0 0 0 rgba(245,197,24,0)",
                              "0 0 28px rgba(245,197,24,0.25)",
                              "0 0 0 rgba(245,197,24,0)",
                            ],
                          }
                    }
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.15 }}
                  >
                    <ChainIcon id={step.id} className="h-7 w-7" />
                  </motion.div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-mrg-muted">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-mrg-text">{step.label}</p>
                  <p className="mt-1.5 max-w-[9.5rem] text-xs leading-relaxed text-mrg-muted">
                    {step.detail}
                  </p>
                </motion.li>
              ))}
            </ol>
          </div>

          {/* Drop to outcome */}
          <div className="mt-10 flex flex-col items-center">
            <motion.div
              className="h-10 w-px origin-top bg-gradient-to-b from-mrg-gold to-mrg-gold/30"
              initial={reducedMotion ? { scaleY: 1 } : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: reducedMotion ? 0 : 1.2, ease }}
              aria-hidden
            />
            <motion.div
              className="mt-4 flex max-w-sm flex-col items-center rounded-3xl bg-mrg-surface-elevated px-8 py-7 text-center ring-1 ring-white/10"
              initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: reducedMotion ? 0 : 1.35, ease }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mrg-gold text-black shadow-[0_0_36px_rgba(245,197,24,0.4)]">
                <ChainIcon id={CHAIN_OUTCOME.id} className="h-7 w-7" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
                The payoff
              </p>
              <p className="mt-2 text-2xl font-bold text-mrg-gold">{CHAIN_OUTCOME.label}</p>
              <p className="mt-2 text-sm text-mrg-muted">{CHAIN_OUTCOME.detail}</p>
              <p className="mt-3 text-xs text-mrg-muted/80">
                {total} steps. One compounding result.
              </p>
            </motion.div>
          </div>
        </div>

        <SectionReveal delay={0.12} className="mt-16">
          <div
            id="mid-cta"
            className="rounded-3xl bg-mrg-surface-elevated px-6 py-10 text-center sm:px-12 sm:py-14"
          >
            <h3 className="text-2xl font-bold tracking-tight text-mrg-text sm:text-3xl">
              Ready to start the chain reaction?
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-mrg-muted">
              Let&apos;s talk about how we can transform your property&apos;s performance.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <WhatsAppButton label="Chat on WhatsApp" size="large" className="w-full sm:w-auto" />
              <CallButton variant="white" size="large" className="w-full sm:w-auto" />
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
