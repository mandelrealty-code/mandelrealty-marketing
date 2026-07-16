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
          className="fixed bottom-0 left-0 z-40 pr-[4.75rem] pl-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <a
            href="/#audit"
            className="flex w-full max-w-[19rem] items-center gap-3 rounded-full border border-mrg-gold/35 bg-mrg-bg/95 px-4 py-3 text-sm font-semibold text-mrg-text shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
          >
            <span className="min-w-0 flex-1 truncate">Book free audit</span>
            <span className="shrink-0 rounded-full bg-mrg-gold px-3 py-1 text-xs uppercase tracking-wide text-mrg-bg">
              15 min
            </span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
