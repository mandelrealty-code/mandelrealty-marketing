import { useEffect } from "react";

/** Scroll to #hash after layout settles (fonts, images, animations). */
export function useScrollToHash() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;

    let cancelled = false;

    const scroll = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "auto", block: "start" });
    };

    scroll();
    const raf = requestAnimationFrame(scroll);
    const timers = [50, 150, 400, 900].map((ms) => window.setTimeout(scroll, ms));
    void document.fonts.ready.then(scroll);

    const onHashChange = () => {
      const next = window.location.hash.replace(/^#/, "");
      if (!next) return;
      requestAnimationFrame(() => {
        document.getElementById(next)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}
