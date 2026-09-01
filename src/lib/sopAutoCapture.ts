/** Tunables for Scribe-style click + narration capture (no browser extension). */

export const SOP_AUTO_CAPTURE = {
  /** Minimum time between click-generated steps (prevents double-fires). */
  MIN_STEP_INTERVAL_MS: 900,
} as const;

export type SopSnapSource = "manual" | "click";

const ACTIONABLE_SELECTOR =
  'button, a, [role="button"], [role="tab"], [role="menuitem"], input, select, textarea, label, [data-sop-action]';

/** Best-effort label for what the user clicked (Scribe-style action title). */
export function describeClickTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof Element)) return null;

  const el = target.closest(ACTIONABLE_SELECTOR) ?? target;
  if (!(el instanceof Element)) return null;

  const aria =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("placeholder");
  if (aria?.trim()) return aria.trim();

  if (el instanceof HTMLInputElement) {
    const label = el.labels?.[0]?.textContent?.trim();
    if (label) return label;
    if (el.name) return el.name;
    if (el.type) return `${el.type} field`;
  }

  if (el instanceof HTMLSelectElement) {
    const label = el.labels?.[0]?.textContent?.trim();
    return label || "dropdown";
  }

  const text = el.textContent?.replace(/\s+/g, " ").trim();
  if (text && text.length > 0 && text.length <= 80) return text;

  const tag = el.tagName.toLowerCase();
  if (tag === "a" && el instanceof HTMLAnchorElement && el.pathname) {
    return el.pathname.split("/").filter(Boolean).pop() || "link";
  }

  return null;
}

/**
 * Scribe places voice narration in each step's instruction body; the click sets the action title.
 * - Title: what was clicked
 * - Description: what you said before that click (the transcript for this step)
 */
export function buildStepCopy(
  source: SopSnapSource,
  stepNum: number,
  narration: string,
  clickLabel?: string | null
): { title: string; description: string } {
  const spoken = narration.trim();
  const label = clickLabel?.trim();

  if (source === "click" && label) {
    const shortLabel = label.length > 55 ? `${label.slice(0, 52)}...` : label;
    return {
      title: `Click "${shortLabel}"`,
      description:
        spoken ||
        `Select ${shortLabel} to continue.`,
    };
  }

  if (spoken) {
    return {
      title: spoken.length > 55 ? `${spoken.slice(0, 52)}...` : spoken,
      description: spoken,
    };
  }

  return {
    title: `Step ${stepNum}: Action`,
    description: "Follow the instruction shown in the screenshot.",
  };
}

export function isCaptureControlClick(
  target: EventTarget | null,
  hudRoot: HTMLElement | null,
  pipMount: HTMLElement | null
): boolean {
  if (!target || !(target instanceof Node)) return false;
  if (hudRoot?.contains(target)) return true;
  if (pipMount?.contains(target)) return true;
  if (target instanceof Element && target.closest("[data-sop-capture-ignore]")) return true;
  return false;
}
