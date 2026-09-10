import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HubProofEarnings } from "../components/HubProofEarnings";
import { MANAGEMENT_HUB_HTML } from "./managementHubContent";
import "./management-hub.css";

/**
 * New marketing homepage — markup ported 1:1 from Claude Design export,
 * with Design Canvas interactions converted to native details/summary
 * and user-provided Airbnb / Expedia / Booking.com logos.
 */
export function ManagementHubPage() {
  useEffect(() => {
    document.title =
      "Mandel Realty Group | Short-Term Rental Management · Canada & U.S.";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "We manage your short-term rental for you on Airbnb, Expedia, and Booking.com. Full Service, Growth, Essentials, and Furniture Investment. Book a free 15-minute call.",
      );
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const root = document.querySelector(".mrg-hub");
    if (!root) return;

    // Mount interactive earnings chart into proof section placeholder.
    const chartMount = document.getElementById("mrg-hub-proof-chart");
    let chartRoot: Root | null = null;
    if (chartMount) {
      chartRoot = createRoot(chartMount);
      chartRoot.render(<HubProofEarnings />);
    }

    // Plans dropdown: CSS hover on desktop; click toggles is-open for touch.
    const plans = root.querySelector(".mrg-plans") as HTMLElement | null;
    const trigger = root.querySelector(".mrg-plans-trigger") as HTMLButtonElement | null;
    const onPlansClick = (e: Event) => {
      if (!plans || !trigger) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".mrg-plans-panel a")) {
        plans.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (t?.closest?.(".mrg-plans-trigger")) {
        e.preventDefault();
        e.stopPropagation();
        const open = plans.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } else if (!t?.closest?.(".mrg-plans")) {
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
      className="mrg-hub-root"
      dangerouslySetInnerHTML={{ __html: MANAGEMENT_HUB_HTML }}
    />
  );
}
