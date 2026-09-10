import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { GROWTH_HTML } from "./growthContent";
import "./growth.css";

/**
 * Growth Partnership landing page — ported from Claude Design export.
 * Plans dropdown: CSS hover + touch toggle; FAQ: native details; proof chart in green.
 */
export function GrowthPage() {
  useEffect(() => {
    document.title = "Growth Partnership | Mandel Realty Group";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Growth Partnership by Mandel Realty Group. Lower fee on your current number, bigger share only on growth. Aligned 10%/35% or Confidence 5%/45%. Live listing with history required.",
      );
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const root = document.querySelector(".mrg-gr");
    if (!root) return;

    const chartMount = document.getElementById("mrg-gr-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings accent="green" />);
    }

    const plans = root.querySelector(".mrg-gr-plans") as HTMLElement | null;
    const trigger = root.querySelector(".mrg-gr-plans-trigger") as HTMLButtonElement | null;
    const onPlansClick = (e: Event) => {
      if (!plans || !trigger) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mrg-gr-plans-panel a")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (t?.closest?.(".mrg-gr-plans-trigger")) {
        e.preventDefault();
        e.stopPropagation();
        const open = plans.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } else if (!t?.closest?.(".mrg-gr-plans")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }
    };
    document.addEventListener("click", onPlansClick, true);

    return () => {
      document.removeEventListener("click", onPlansClick, true);
      chartRoot?.unmount();
    };
  }, []);

  return (
    <div
      className="mrg-gr-root"
      dangerouslySetInnerHTML={{ __html: GROWTH_HTML }}
    />
  );
}
