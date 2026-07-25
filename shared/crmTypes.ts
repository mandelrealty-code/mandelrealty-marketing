/** Shared CRM types + preset next-step checklist for post-call workflow */

export type LeadStatus =
  | "new"
  | "qualified"
  | "low_fit"
  | "call_done"
  | "needs_shane"
  | "onboarding"
  | "won"
  | "skip";

export type NeedsFrom = "none" | "shane" | "partner" | "client";

export type NextAction = {
  id: string;
  label: string;
  done: boolean;
  owner: "shane" | "partner" | "client";
};

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
  new: "New — booked",
  qualified: "Qualified",
  low_fit: "Low fit",
  call_done: "Call done",
  needs_shane: "Needs Shane",
  onboarding: "Onboarding",
  won: "Won",
  skip: "Skip",
};

export const NEEDS_FROM_LABEL: Record<NeedsFrom, string> = {
  none: "No one — waiting",
  shane: "Shane",
  partner: "Partner (caller)",
  client: "Waiting on client",
};

/** Default checklist partners can tick after a call */
export const NEXT_ACTION_PRESETS: Omit<NextAction, "done">[] = [
  { id: "cohost", label: "Setup cohost access", owner: "shane" },
  { id: "contract", label: "Send / sign contract", owner: "shane" },
  { id: "listing_link", label: "Get Airbnb listing link", owner: "partner" },
  { id: "comps", label: "Pull comps / earnings review", owner: "shane" },
  { id: "follow_up", label: "Schedule follow-up call", owner: "partner" },
  { id: "onboard_dash", label: "Onboard to dashboard", owner: "shane" },
  { id: "pricing", label: "Set pricing / calendar", owner: "shane" },
  { id: "photos", label: "Photo / listing upgrades", owner: "shane" },
];

export function normalizeNextActions(raw: unknown): NextAction[] {
  if (!Array.isArray(raw)) return [];
  const out: NextAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!id || !label) continue;
    const ownerRaw = String(row.owner ?? "shane");
    const owner =
      ownerRaw === "partner" || ownerRaw === "client" || ownerRaw === "shane"
        ? ownerRaw
        : "shane";
    out.push({ id, label, done: Boolean(row.done), owner });
  }
  return out;
}

export function openActionsForShane(actions: NextAction[]): NextAction[] {
  return actions.filter((a) => a.owner === "shane" && !a.done);
}
