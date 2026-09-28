import { useEffect } from "react";

/** Scroll to #hash after layout settles, and when an in-page anchor is clicked. */
export function useScrollToHash() {
  useEffect(() => {
    let cancelled = false;

    const scrollToId = (id: string, behavior: ScrollBehavior) => {
      if (cancelled || !id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior, block: "start" });
    };

    const currentId = () => window.location.hash.replace(/^#/, "");

    const scroll = () => scrollToId(currentId(), "auto");
    scroll();
    const raf = requestAnimationFrame(scroll);
    const timers = [50, 150, 400, 900].map((ms) => window.setTimeout(scroll, ms));
    void document.fonts.ready.then(scroll);

    const onHashChange = () => scrollToId(currentId(), "smooth");

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#") || href.length < 2) return;
      const id = decodeURIComponent(href.slice(1));
      const el = document.getElementById(id);
      if (!el) return;
      event.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.location.hash !== href) {
        history.pushState(null, "", href);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    document.addEventListener("click", onClick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, []);
}
