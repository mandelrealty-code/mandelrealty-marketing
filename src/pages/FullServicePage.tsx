import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { FULL_SERVICE_HTML } from "./fullServiceContent";
import "./full-service.css";

/**
 * Full Service Management landing page — ported from Claude Design export.
 * Plans dropdown uses CSS hover + touch toggle; FAQ uses native details.
 */
export function FullServicePage() {
  useEffect(() => {
    document.title = "Full Service Management | Mandel Realty Group";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Hands-off short-term rental management by Mandel Realty Group. Standard 20% or Full Service 25% of gross booking revenue. Book a free 15-minute call.",
      );
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const root = document.querySelector(".mrg-fs");
    if (!root) return;

    const chartMount = document.getElementById("mrg-fs-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings accent="blue" />);
    }

    const plans = root.querySelector(".mrg-fs-plans") as HTMLElement | null;
    const trigger = root.querySelector(".mrg-fs-plans-trigger") as HTMLButtonElement | null;
    const onPlansClick = (e: Event) => {
      if (!plans || !trigger) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mrg-fs-plans-panel a")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (t?.closest?.(".mrg-fs-plans-trigger")) {
        e.preventDefault();
        e.stopPropagation();
        const open = plans.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } else if (!t?.closest?.(".mrg-fs-plans")) {
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
      className="mrg-fs-root"
      dangerouslySetInnerHTML={{ __html: FULL_SERVICE_HTML }}
    />
  );
}
