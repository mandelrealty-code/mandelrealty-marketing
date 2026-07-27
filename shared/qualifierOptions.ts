/** Shared Instant Form / website funnel options */

export const PROPERTY_STAGES = [
  { value: "own_ready", label: "I own a property and I’m ready to start" },
  { value: "buying", label: "I’m buying / renovating soon" },
  { value: "researching", label: "Just researching (no property yet)" },
] as const;

export const STR_ALLOWED_OPTIONS = [
  { value: "yes", label: "Yes — Airbnb / STR is allowed" },
  { value: "no", label: "No — not allowed" },
  { value: "unsure", label: "Not sure" },
] as const;

export const PERMIT_OPTIONS = [
  { value: "have", label: "I already have an STR permit" },
  { value: "applying", label: "I’m applying / will apply" },
  { value: "unknown", label: "I don’t know if I need one" },
  { value: "not_planning", label: "Not planning to get one" },
] as const;

export type PropertyStage = (typeof PROPERTY_STAGES)[number]["value"];
export type StrAllowed = (typeof STR_ALLOWED_OPTIONS)[number]["value"];
export type PermitStatus = (typeof PERMIT_OPTIONS)[number]["value"];

export const PROPERTY_STAGE_SET = new Set<string>(PROPERTY_STAGES.map((o) => o.value));
export const STR_ALLOWED_SET = new Set<string>(STR_ALLOWED_OPTIONS.map((o) => o.value));
export const PERMIT_SET = new Set<string>(PERMIT_OPTIONS.map((o) => o.value));

export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_STAGES.map((o) => [o.value, o.label]),
);

export const STR_ALLOWED_LABEL: Record<string, string> = Object.fromEntries(
  STR_ALLOWED_OPTIONS.map((o) => [o.value, o.label]),
);

export const PERMIT_LABEL: Record<string, string> = Object.fromEntries(
  PERMIT_OPTIONS.map((o) => [o.value, o.label]),
);
