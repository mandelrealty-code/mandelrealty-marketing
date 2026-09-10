import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { ESSENTIALS_HTML } from "./essentialsContent";
import "./essentials.css";

/**
 * Managed Essentials landing page — ported from Claude Design export.
 * Plans dropdown: CSS hover + touch toggle; FAQ: native details; proof chart in orange.
 */
export function EssentialsPage() {
  useEffect(() => {
    document.title = "Managed Essentials | Mandel Realty Group";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Managed Essentials by Mandel Realty Group. Fixed monthly fee: Message & Book $199 or Message & Optimize $349. You keep cleaning and ops. Book a free 15-minute call.",
      );
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const root = document.querySelector(".mrg-es");
    if (!root) return;

    const chartMount = document.getElementById("mrg-es-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings accent="orange" />);
    }

    const plans = root.querySelector(".mrg-es-plans") as HTMLElement | null;
    const trigger = root.querySelector(".mrg-es-plans-trigger") as HTMLButtonElement | null;
    const onPlansClick = (e: Event) => {
      if (!plans || !trigger) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mrg-es-plans-panel a")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (t?.closest?.(".mrg-es-plans-trigger")) {
        e.preventDefault();
        e.stopPropagation();
        const open = plans.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } else if (!t?.closest?.(".mrg-es-plans")) {
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
      className="mrg-es-root"
      dangerouslySetInnerHTML={{ __html: ESSENTIALS_HTML }}
    />
  );
}
