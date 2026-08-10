/** Lead pipeline statuses for the AI pre-closer CRM */

export type LeadStatus =
  | "new"
  | "engaging"
  | "interested"
  | "booked"
  | "call_done"
  | "needs_shane"
  | "won"
  | "low_fit"
  | "skip";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "engaging",
  "interested",
  "booked",
  "call_done",
  "needs_shane",
  "won",
  "low_fit",
  "skip",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  engaging: "Engaging",
  interested: "Interested",
  booked: "Booked",
  call_done: "Call done",
  needs_shane: "Needs Shane",
  won: "Won",
  low_fit: "Low fit",
  skip: "Skip",
};

/** Pipeline board column order (excludes terminal skip from main flow optional) */
export const PIPELINE_STATUSES: LeadStatus[] = [
  "new",
  "engaging",
  "interested",
  "booked",
  "call_done",
  "needs_shane",
  "won",
  "low_fit",
  "skip",
];

/** Map legacy DB values if migration not applied yet */
export function normalizeLeadStatus(raw: string | null | undefined): LeadStatus {
  const s = String(raw ?? "new");
  if (s === "qualified") return "engaging";
  if (s === "onboarding") return "won";
  if ((LEAD_STATUSES as string[]).includes(s)) return s as LeadStatus;
  return "new";
}
