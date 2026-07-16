import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const auditSection = document.getElementById("audit");
      const auditTop = auditSection?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const hasScrolledPastHero = window.scrollY > 420;
      const isNearAuditForm = auditTop < window.innerHeight * 0.75;

      setVisible(hasScrolledPastHero && !isNearAuditForm);
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
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <a
            href="#audit"
            className="mx-auto flex max-w-sm items-center justify-between rounded-full border border-mrg-gold/35 bg-mrg-bg/95 px-4 py-3 text-sm font-semibold text-mrg-text shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
          >
            <span>Book free audit</span>
            <span className="rounded-full bg-mrg-gold px-3 py-1 text-xs uppercase tracking-wide text-mrg-bg">
              15 min
            </span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
