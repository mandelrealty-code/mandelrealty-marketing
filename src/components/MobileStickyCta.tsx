import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CTA_HEADLINE, EMAIL_HREF, PHONE_HREF } from "../lib/constants";

export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const estimateSection = document.getElementById("audit");
      const midCta = document.getElementById("mid-cta");
      const estimateTop = estimateSection?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const midTop = midCta?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const midBottom = midCta?.getBoundingClientRect().bottom ?? Number.NEGATIVE_INFINITY;
      const hasScrolledPastHero = window.scrollY > 420;
      const isNearEstimateForm = estimateTop < window.innerHeight * 0.75;
      const isNearMidForm =
        midTop < window.innerHeight * 0.85 && midBottom > window.innerHeight * 0.15;

      setVisible(hasScrolledPastHero && !isNearEstimateForm && !isNearMidForm);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-0 left-0 z-40 w-full pr-[4.75rem] pl-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex max-w-[22rem] gap-2">
            <a
              href={PHONE_HREF}
              className="inline-flex flex-[1.6] items-center justify-center gap-1.5 rounded-full bg-mrg-gold px-3 py-3 text-sm font-semibold text-mrg-bg shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
            >
              <span aria-hidden>☎</span>
              Call Experts
            </a>
            <a
              href={EMAIL_HREF}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-mrg-gold/40 bg-mrg-bg/95 px-3 py-3 text-sm font-semibold text-mrg-text shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              Email
            </a>
          </div>
          <p className="mt-1.5 pl-1 text-[11px] text-mrg-muted/80">{CTA_HEADLINE}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
