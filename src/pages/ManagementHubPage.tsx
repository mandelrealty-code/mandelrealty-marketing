import { useEffect } from "react";
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

    // Close Plans dropdown when a link inside is clicked (mobile UX).
    const root = document.querySelector(".mrg-hub");
    if (!root) return;
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const link = t?.closest?.(".mrg-plans-panel a");
      if (link) {
        const details = link.closest("details.mrg-plans");
        if (details) details.removeAttribute("open");
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      className="mrg-hub-root"
      // Exact Claude Design body (cleaned). Interactive bits use <details>.
      dangerouslySetInnerHTML={{ __html: MANAGEMENT_HUB_HTML }}
    />
  );
}
