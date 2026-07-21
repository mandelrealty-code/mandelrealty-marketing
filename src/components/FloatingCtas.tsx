import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CallButton, WhatsAppButton } from "./ui";

export function FloatingCtas() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const fit = document.getElementById("fit-check");
      const fitTop = fit?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const nearFit = fitTop < window.innerHeight * 0.7;
      setVisible(window.scrollY > 360 && !nearFit);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-3 z-40 flex flex-col items-start gap-2 sm:left-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <WhatsAppButton
            label="Chat on WhatsApp"
            size="compact"
            className="shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          />
          <CallButton size="compact" className="shadow-[0_12px_32px_rgba(0,0,0,0.45)]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
