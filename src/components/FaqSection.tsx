import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FAQ_ITEMS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-b border-mrg-border/40 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionReveal>
          <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">Questions</h2>
        </SectionReveal>

        <div className="mt-10 divide-y divide-mrg-border border-y border-mrg-border">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <SectionReveal key={item.q} delay={i * 0.04}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 py-5 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-mrg-text">{item.q}</span>
                  <span className="mt-0.5 shrink-0 text-mrg-gold">{isOpen ? "−" : "+"}</span>
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
                      <p className="pb-5 text-sm leading-relaxed text-mrg-muted">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SectionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
