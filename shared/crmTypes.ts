/** Lead pipeline + offer path for the AI closer CRM */

export type LeadStatus =
  | "new"
  | "engaging"
  | "nurturing"
  | "interested"
  | "booked"
  | "call_done"
  | "won"
  | "low_fit"
  | "skip";

/** What the AI is selling / routing this lead toward */
export type OfferPath = "management" | "makeover" | "education" | "unknown";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "engaging",
  "nurturing",
  "interested",
  "booked",
  "call_done",
  "won",
  "low_fit",
  "skip",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  engaging: "Engaging",
  nurturing: "Nurturing",
  interested: "Interested",
  booked: "Booked",
  call_done: "Call done",
  won: "Won",
  low_fit: "Low fit",
  skip: "Skip",
};

/** Short journey copy for the list / detail header */
export const STATUS_JOURNEY: Record<LeadStatus, string> = {
  new: "Just imported — AI will open",
  engaging: "AI is actively texting",
  nurturing: "Education path — follow up later",
  interested: "Ready for a call / offer",
  booked: "Call booked — AI stopped",
  call_done: "Call completed",
  won: "Closed won",
  low_fit: "Not a fit",
  skip: "Stopped / opted out",
};

export const OFFER_PATHS: OfferPath[] = [
  "management",
  "makeover",
  "education",
  "unknown",
];

export const OFFER_PATH_LABEL: Record<OfferPath, string> = {
  management: "Full-service management",
  makeover: "Airbnb makeover",
  education: "Learn / guides",
  unknown: "Offer TBD",
};

export const PIPELINE_STATUSES: LeadStatus[] = [
  "new",
  "engaging",
  "nurturing",
  "interested",
  "booked",
  "call_done",
  "won",
  "low_fit",
  "skip",
];

/** Map legacy DB values if migration not applied yet */
export function normalizeLeadStatus(raw: string | null | undefined): LeadStatus {
  const s = String(raw ?? "new");
  if (s === "qualified" || s === "needs_shane") return "engaging";
  if (s === "onboarding") return "won";
  if ((LEAD_STATUSES as string[]).includes(s)) return s as LeadStatus;
  return "new";
}

export function normalizeOfferPath(raw: string | null | undefined): OfferPath {
  const s = String(raw ?? "unknown");
  if ((OFFER_PATHS as string[]).includes(s)) return s as OfferPath;
  return "unknown";
}

/**
 * Infer closer path from Meta/form answers.
 * Ad creatives can still override via source text (makeover / management keywords).
 */
export function inferOfferPath(input: {
  hasListing?: string | null;
  propertyStage?: string | null;
  source?: string | null;
  rawAnswers?: Record<string, string>;
}): OfferPath {
  const blob = [
    input.source ?? "",
    ...Object.values(input.rawAnswers ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  if (/makeover|free makeover|furnish|staging|photo package/.test(blob)) {
    return "makeover";
  }
  if (
    /full.?service|management|co-?host|property management|growth\s*fee|growth\s*plan|badge|self[_\s-]?managed|self manage/.test(
      blob,
    )
  ) {
    return "management";
  }

  // Curious / no property → education (guides), not a dead lead
  if (input.propertyStage === "researching") return "education";
  if (input.hasListing === "no" && !input.propertyStage) return "education";

  // Live listing or owns/buying → sell management (or makeover if ad said so above)
  if (
    input.hasListing === "yes" ||
    input.propertyStage === "own_ready" ||
    input.propertyStage === "buying"
  ) {
    return "management";
  }

  return "unknown";
}
