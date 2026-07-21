import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FAQ_ITEMS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionReveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            Questions, <span className="text-mrg-gold">answered</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mrg-muted">
            Everything hosts ask us before they get started.
          </p>
        </SectionReveal>

        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <SectionReveal key={item.q} delay={i * 0.03}>
                <div className="rounded-2xl bg-mrg-surface-elevated">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left sm:px-6"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-mrg-text">{item.q}</span>
                    <span className="mt-0.5 shrink-0 text-mrg-gold" aria-hidden>
                      {isOpen ? "×" : "+"}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-mrg-muted sm:px-6">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </SectionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
