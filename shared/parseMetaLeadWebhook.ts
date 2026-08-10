import type { HasListing } from "./auditEmails.js";
import {
  inferOfferPath,
  type OfferPath,
} from "./crmTypes.js";
import {
  PERMIT_OPTIONS,
  PROPERTY_STAGES,
  STR_ALLOWED_OPTIONS,
} from "./qualifierOptions.js";
import type { ParsedMetaLead } from "./parseMetaLeadPaste.js";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ']/g, "'")
    .replace(/[—–−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map(asString).filter(Boolean).join(", ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.values != null) return asString(o.values);
    if (o.value != null) return asString(o.value);
  }
  return "";
}

function mapHasListing(raw: string | null): HasListing {
  if (!raw) return "unknown";
  const n = norm(raw);
  if (/^yes\b/.test(n) || n.includes("live right now") || n === "yes") return "yes";
  if (
    /^no\b/.test(n) ||
    n.includes("not yet") ||
    n.includes("don't have") ||
    n.includes("do not have")
  ) {
    return "no";
  }
  return "unknown";
}

function mapByLabel(
  raw: string | null,
  options: readonly { value: string; label: string }[],
): string | null {
  if (!raw) return null;
  const n = norm(raw);
  for (const opt of options) {
    if (n === norm(opt.label) || n.includes(norm(opt.label))) return opt.value;
  }
  if (/own a property|ready to start|own_ready/.test(n)) return "own_ready";
  if (/buying|renovat/.test(n)) return "buying";
  if (/research|no property|curious/.test(n)) return "researching";
  if (/^yes\b|is allowed|str_allowed.?yes/.test(n)) return "yes";
  if (/^no\b|not allowed/.test(n)) return "no";
  if (/unsure|not sure/.test(n)) return "unsure";
  if (/already have|have a permit|\bhave\b/.test(n)) return "have";
  if (/applying|will apply/.test(n)) return "applying";
  if (/don'?t know|do not know|unknown/.test(n)) return "unknown";
  if (/not planning/.test(n)) return "not_planning";
  for (const opt of options) {
    if (n === opt.value) return opt.value;
  }
  return null;
}

/** Flatten Make / Meta Lead Ads field_data into a key→value map */
export function flattenMetaWebhookBody(
  body: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(body)) {
    if (k === "field_data" || k === "fieldData" || k === "answers" || k === "data") {
      continue;
    }
    const s = asString(v);
    if (s) out[k] = s;
  }

  const fieldData = body.field_data ?? body.fieldData;
  if (Array.isArray(fieldData)) {
    for (const item of fieldData) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const name = asString(row.name || row.key || row.question);
      const value = asString(row.values ?? row.value ?? row.answer);
      if (name && value) out[name] = value;
    }
  }

  const answers = body.answers;
  if (answers && typeof answers === "object" && !Array.isArray(answers)) {
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      const s = asString(v);
      if (s) out[k] = s;
    }
  }

  // Nested "data" object (Make sometimes wraps)
  const nested = body.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    Object.assign(out, flattenMetaWebhookBody(nested as Record<string, unknown>));
  }

  return out;
}

function pick(
  map: Record<string, string>,
  keys: string[],
): string {
  const lower = new Map(Object.entries(map).map(([k, v]) => [norm(k), v]));
  for (const key of keys) {
    const direct = map[key];
    if (direct?.trim()) return direct.trim();
    const soft = lower.get(norm(key));
    if (soft?.trim()) return soft.trim();
  }
  // fuzzy: key includes
  for (const want of keys) {
    const w = norm(want);
    for (const [k, v] of lower) {
      if (k.includes(w) && v.trim()) return v.trim();
    }
  }
  return "";
}

/**
 * Normalize Make.com / Meta Lead Ads JSON into ParsedMetaLead.
 * Accepts flat fields, field_data[], or answers{}.
 */
export function parseMetaLeadWebhook(
  body: Record<string, unknown>,
): ParsedMetaLead | { error: string } {
  const map = flattenMetaWebhookBody(body);
  if (Object.keys(map).length === 0) {
    return { error: "Empty webhook body." };
  }

  const first = pick(map, ["first_name", "firstName", "firstname"]);
  const last = pick(map, ["last_name", "lastName", "lastname"]);
  const full = pick(map, [
    "full_name",
    "fullName",
    "name",
    "Full name",
    "contact_name",
  ]);
  const name = full || [first, last].filter(Boolean).join(" ").trim();

  const email = pick(map, ["email", "email_address", "Email"]);
  const phone = pick(map, [
    "phone_number",
    "phone",
    "Phone number",
    "mobile",
    "phoneNumber",
  ]);

  const city = pick(map, [
    "city",
    "What city / area is the property in?",
    "city_area",
    "area",
    "address",
    "property_city",
  ]);

  const hasListingRaw = pick(map, [
    "has_listing",
    "Do you have an Airbnb listing live right now?",
    "airbnb_listing",
    "listing",
  ]);
  const propertyStageRaw = pick(map, [
    "property_stage",
    "Where are you in the process?",
    "process",
    "stage",
  ]);
  const strRaw = pick(map, [
    "str_allowed",
    "Does your building or area allow Airbnb",
    "Does your building or area allow Airbnb / short-term rentals?",
    "str",
  ]);
  const permitRaw = pick(map, [
    "permit_status",
    "STR permit status",
    "permit",
  ]);
  const earnings = pick(map, ["earnings", "monthly_earnings", "revenue"]);
  const listingTitle = pick(map, [
    "listing_title",
    "listing_url",
    "airbnb_url",
    "Listing title",
  ]);

  const campaign = pick(map, [
    "campaign_name",
    "campaignName",
    "ad_name",
    "adName",
    "adset_name",
    "form_name",
    "formName",
  ]);

  const hasListing = mapHasListing(hasListingRaw || null);
  const propertyStage = mapByLabel(propertyStageRaw || null, PROPERTY_STAGES);
  const strAllowed = mapByLabel(strRaw || null, STR_ALLOWED_OPTIONS);
  const permitStatus = mapByLabel(permitRaw || null, PERMIT_OPTIONS);

  const rawAnswers: Record<string, string> = { ...map };
  if (campaign) rawAnswers.campaign_or_ad = campaign;

  const warnings: string[] = [];
  if (!name) warnings.push("Missing name");
  if (!email) warnings.push("Missing email");
  if (!phone) warnings.push("Missing phone");

  const offerPath: OfferPath = inferOfferPath({
    hasListing,
    propertyStage,
    source: `meta_make ${campaign}`.trim(),
    rawAnswers,
  });

  if (!email && !phone) {
    return { error: "Need at least email or phone from Make payload." };
  }

  return {
    name: name || "Meta lead",
    email: email || `${phone.replace(/\D/g, "") || "unknown"}@meta-lead.local`,
    phone: phone || "unknown",
    address: city || "",
    hasListing,
    propertyStage,
    strAllowed,
    permitStatus,
    earnings,
    listingTitle,
    rawAnswers,
    warnings,
    offerPath,
  };
}
