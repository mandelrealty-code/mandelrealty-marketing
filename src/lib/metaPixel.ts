declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      push?: (...args: unknown[]) => void;
      loaded?: boolean;
      version?: string;
    };
    _fbq?: Window["fbq"];
  }
}

/** Public Meta Pixel ID — safe in client JS. Override with VITE_META_PIXEL_ID if needed. */
const PIXEL_ID =
  import.meta.env.VITE_META_PIXEL_ID?.trim() || "1583026230149842";

/**
 * Base Meta Pixel — PageView on load. Set VITE_META_PIXEL_ID in Vercel / .env.local.
 */
export function initMetaPixel(): void {
  if (!PIXEL_ID || typeof window === "undefined") return;

  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      const fn = window.fbq!;
      if (fn.callMethod) {
        fn.callMethod(...args);
      } else {
        (fn.queue = fn.queue || []).push(args);
      }
    } as NonNullable<Window["fbq"]>;

    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    window._fbq = n;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  }

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

/**
 * Lead conversion — fire once per successful booking (thank-you page).
 */
export function trackMetaLead(): void {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;

  const key = `mrg_meta_lead_${PIXEL_ID}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode — still fire */
  }

  window.fbq("track", "Lead");
}
