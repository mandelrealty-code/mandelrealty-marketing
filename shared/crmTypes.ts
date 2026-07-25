/** Lead pipeline statuses for the admin inbox */

export type LeadStatus =
  | "new"
  | "qualified"
  | "low_fit"
  | "call_done"
  | "needs_shane"
  | "onboarding"
  | "won"
  | "skip";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "qualified",
  "low_fit",
  "call_done",
  "needs_shane",
  "onboarding",
  "won",
  "skip",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  low_fit: "Low fit",
  call_done: "Call done",
  needs_shane: "Needs Shane",
  onboarding: "Onboarding",
  won: "Won",
  skip: "Skip",
};
