/** Plans shown on /book-a-call “what are you interested in?” */

export type BookCallPlanId =
  | "full-service"
  | "growth"
  | "essentials"
  | "furniture"
  | "not-sure";

export type BookCallPlan = {
  id: BookCallPlanId;
  label: string;
  blurb: string;
  /** Accent used for the picker swatch */
  accent: string;
};

export const BOOK_CALL_PLANS: readonly BookCallPlan[] = [
  {
    id: "full-service",
    label: "Full Service",
    blurb: "Hands-off ops · 20% or 25%",
    accent: "#2F6BFF",
  },
  {
    id: "growth",
    label: "Growth Partnership",
    blurb: "Live hosts · lower fee + upside",
    accent: "#12B76A",
  },
  {
    id: "essentials",
    label: "Managed Essentials",
    blurb: "Listing + pricing · fixed monthly",
    accent: "#FF4716",
  },
  {
    id: "furniture",
    label: "Furniture Investment",
    blurb: "$0 upfront furnish if approved",
    accent: "#F5C518",
  },
  {
    id: "not-sure",
    label: "Not sure yet",
    blurb: "Help me pick on the call",
    accent: "#8a8a8a",
  },
] as const;

const PLAN_BY_ID = Object.fromEntries(
  BOOK_CALL_PLANS.map((p) => [p.id, p]),
) as Record<BookCallPlanId, BookCallPlan>;

export function isBookCallPlanId(value: unknown): value is BookCallPlanId {
  return typeof value === "string" && value in PLAN_BY_ID;
}

export function normalizeBookCallPlanId(value: unknown): BookCallPlanId | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (isBookCallPlanId(raw)) return raw;
  // Aliases from older URLs / copy
  if (raw === "fullservice" || raw === "full" || raw === "management") return "full-service";
  if (raw === "growth-partnership" || raw === "growth-plan") return "growth";
  if (raw === "managed-essentials" || raw === "essential") return "essentials";
  if (raw === "furniture-investment" || raw === "furnish" || raw === "makeover") {
    return "furniture";
  }
  if (raw === "unsure" || raw === "help" || raw === "other") return "not-sure";
  return null;
}

export function bookCallPlanLabel(id: BookCallPlanId | null | undefined): string {
  if (!id) return "";
  return PLAN_BY_ID[id]?.label ?? id;
}
