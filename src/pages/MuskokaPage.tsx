import { useEffect, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { MUSKOKA_HTML } from "./muskokaContent";
import "./muskoka.css";

/**
 * Muskoka cottage management landing — ported from Claude Design export.
 * FAQ: native details; proof chart in gold (hub accent).
 */
export function MuskokaPage() {
  useEffect(() => {
    document.title = "Muskoka Cottage Management | Mandel Realty Group";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Muskoka cottage and short-term rental management by Mandel Realty Group. Dynamic pricing, turnovers, and 5-star guest ops for Bracebridge, Gravenhurst, Huntsville, Lake of Bays and Port Carling. Call (647) 381-7325.",
      );
    }
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://www.mandelrealtygroup.com/muskoka");

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  // Mount after HTML is in the DOM. Depend on MUSKOKA_HTML so HMR content
  // updates remount the chart instead of leaving an empty placeholder.
  useLayoutEffect(() => {
    const chartMount = document.getElementById("mrg-mu-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings accent="gold" />);
    }

    // Fade-in reveals (Design Canvas data-reveal)
    const revealNodes = Array.from(
      document.querySelectorAll<HTMLElement>(".mrg-mu [data-reveal]"),
    );
    revealNodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translateY(14px)";
      n.style.transition = "opacity 520ms ease, transform 520ms ease";
    });
    const showReveal = (n: HTMLElement) => {
      n.style.opacity = "1";
      n.style.transform = "none";
    };
    let revealIo: IntersectionObserver | null = null;
    let revealFallback: number | undefined;
    if (!("IntersectionObserver" in window)) {
      revealNodes.forEach(showReveal);
    } else {
      revealIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const el = e.target as HTMLElement;
            const d = (parseInt(el.getAttribute("data-reveal") || "1", 10) || 1) - 1;
            el.style.transitionDelay = `${Math.min(d, 5) * 60}ms`;
            showReveal(el);
            revealIo?.unobserve(el);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
      );
      revealNodes.forEach((n) => revealIo!.observe(n));
      revealFallback = window.setTimeout(() => revealNodes.forEach(showReveal), 2600);
    }

    // Reality section scroll progress rail
    const list = document.getElementById("mu-reality-list");
    const fill = document.getElementById("mu-reality-fill");
    const steps = list
      ? Array.from(list.querySelectorAll<HTMLElement>("[data-mu-step]"))
      : [];
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let onScroll: (() => void) | null = null;

    if (list && fill) {
      if (reduceMotion) {
        fill.style.height = "100%";
        steps.forEach((s) => {
          s.style.color = "#8a6f2e";
        });
      } else {
        let ticking = false;
        const update = () => {
          ticking = false;
          const r = list.getBoundingClientRect();
          const mark = window.innerHeight * 0.62;
          const span = Math.max(r.height - 48, 1);
          const p = Math.min(1, Math.max(0, (mark - (r.top + 24)) / span));
          fill.style.height = `${p * span}px`;
          const reached = r.top + 24 + p * span;
          steps.forEach((s) => {
            const sr = s.getBoundingClientRect();
            s.style.color =
              sr.top + sr.height / 2 <= reached + 4 ? "#8a6f2e" : "#c9c9c9";
          });
        };
        onScroll = () => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
          }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
      }
    }

    return () => {
      chartRoot?.unmount();
      revealIo?.disconnect();
      if (revealFallback) window.clearTimeout(revealFallback);
      if (onScroll) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    };
  }, [MUSKOKA_HTML]);

  return (
    <div
      className="mrg-mu-root"
      dangerouslySetInnerHTML={{ __html: MUSKOKA_HTML }}
    />
  );
}
