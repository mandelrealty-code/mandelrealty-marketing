import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { setPageSeo } from "../lib/pageSeo";
import { FURNITURE_HTML } from "./furnitureContent";
import "./furniture.css";

/**
 * Furniture Investment landing page — ported from Claude Design export.
 * Plans dropdown: CSS hover + touch toggle; FAQ: native details; proof chart in yellow.
 */
export function FurniturePage() {
  useEffect(() => {
    setPageSeo({
      title: "Furniture Investment | Mandel Realty Group",
      description:
        "Furniture Investment by Mandel Realty Group. $0 upfront furnish if approved. 24-month free transfer. Pairs with Standard 20% or Full Service 25% only. Book a free 15-minute call.",
      path: "/furniture",
    });

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const root = document.querySelector(".mrg-fu");
    if (!root) return;

    const chartMount = document.getElementById("mrg-fu-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings accent="yellow" />);
    }

    const plans = root.querySelector(".mrg-fu-plans") as HTMLElement | null;
    const trigger = root.querySelector(".mrg-fu-plans-trigger") as HTMLButtonElement | null;
    const onPlansClick = (e: Event) => {
      if (!plans || !trigger) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mrg-fu-plans-panel a")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (t?.closest?.(".mrg-fu-plans-trigger")) {
        e.preventDefault();
        e.stopPropagation();
        const open = plans.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } else if (!t?.closest?.(".mrg-fu-plans")) {
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
      className="mrg-fu-root"
      dangerouslySetInnerHTML={{ __html: FURNITURE_HTML }}
    />
  );
}
