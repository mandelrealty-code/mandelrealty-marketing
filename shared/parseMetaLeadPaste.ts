import type { HasListing } from "./auditEmails.js";
import type { LeadStatus } from "./crmTypes.js";
import {
  PERMIT_OPTIONS,
  PROPERTY_STAGES,
  STR_ALLOWED_OPTIONS,
} from "./qualifierOptions.js";

export type ParsedMetaLead = {
  name: string;
  email: string;
  phone: string;
  address: string;
  hasListing: HasListing;
  propertyStage: string | null;
  strAllowed: string | null;
  permitStatus: string | null;
  earnings: string;
  listingTitle: string;
  rawAnswers: Record<string, string>;
  warnings: string[];
};

export type MetaImportDecision = {
  status: LeadStatus;
  qualifiesForBookEmail: boolean;
  reason: string;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ]/g, "'")
    .replace(/[—–−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function answerAfter(text: string, questionPatterns: RegExp[]): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const n = norm(line);
    if (!questionPatterns.some((re) => re.test(n))) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;
      const nn = norm(next);
      // Skip Meta UI chrome
      if (
        /^(view form|lead form id|submitted on|form answers|edit contact|labels help|add a label|data sharing|lead management|assigned to|stage|reminder|notes|write a note)/i.test(
          next,
        )
      ) {
        continue;
      }
      if (questionPatterns.some((re) => re.test(nn))) continue;
      return next;
    }
  }
  return null;
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
  // soft matches
  if (/own a property|ready to start/.test(n)) return "own_ready";
  if (/buying|renovat/.test(n)) return "buying";
  if (/research|no property/.test(n)) return "researching";
  if (/^yes\b|is allowed/.test(n)) return "yes";
  if (/^no\b|not allowed/.test(n)) return "no";
  if (/not sure|unsure/.test(n)) return "unsure";
  return null;
}

function extractEmail(text: string): string {
  const labeled = text.match(/^\s*Email\s*\n\s*([^\n]+)/im);
  if (labeled) {
    const e = labeled[1].trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return e;
  }
  const all = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return (all[0] ?? "").trim();
}

function extractPhone(text: string): string {
  const labeled = text.match(/^\s*Phone number\s*\n\s*([^\n]+)/im);
  if (labeled) {
    const p = labeled[1].trim();
    if (/\d{7,}/.test(p.replace(/\D/g, ""))) return p;
  }
  const plus = text.match(/\+\d[\d\s().-]{8,}\d/);
  if (plus) return plus[0].replace(/\s+/g, "");
  const north = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return north ? north[0].trim() : "";
}

function extractName(text: string, email: string): string {
  const labeled = text.match(/^\s*Full name\s*\n\s*([^\n]+)/im);
  if (labeled) {
    const n = labeled[1].trim();
    if (n && !/@/.test(n) && !/^\+?\d/.test(n)) return n;
  }
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (
    first &&
    !/@/.test(first) &&
    !/^\+?\d/.test(first) &&
    !/^lead added/i.test(first) &&
    first.length < 80
  ) {
    return first;
  }
  if (email.includes("@")) return email.split("@")[0] || "";
  return "";
}

/**
 * Parse a raw Meta Leads Center paste into CRM fields.
 */
export function parseMetaLeadPaste(raw: string): ParsedMetaLead {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const warnings: string[] = [];
  const rawAnswers: Record<string, string> = {};

  const email = extractEmail(text);
  const phone = extractPhone(text);
  const name = extractName(text, email);

  const listingRaw = answerAfter(text, [
    /do you have an airbnb listing/,
    /airbnb listing live/,
    /have an airbnb/,
  ]);
  if (listingRaw) rawAnswers.listing = listingRaw;

  const stageRaw = answerAfter(text, [
    /where are you in the process/,
    /where are you in/,
  ]);
  if (stageRaw) rawAnswers.stage = stageRaw;

  const strRaw = answerAfter(text, [
    /does your building or area allow/,
    /allow airbnb/,
    /short-term rentals/,
  ]);
  if (strRaw) rawAnswers.str = strRaw;

  const cityRaw = answerAfter(text, [
    /what city \/ area/,
    /what city/,
    /area is the property/,
  ]);
  if (cityRaw) rawAnswers.city = cityRaw;

  const earningsRaw = answerAfter(text, [
    /how much.*(earn|making|revenue)/,
    /monthly (earn|revenue)/,
    /current (earn|revenue)/,
  ]);
  if (earningsRaw) rawAnswers.earnings = earningsRaw;

  const listingTitleRaw = answerAfter(text, [
    /listing (title|name|link|url)/,
    /airbnb (link|url|title)/,
  ]);
  if (listingTitleRaw) rawAnswers.listingTitle = listingTitleRaw;

  const hasListing = mapHasListing(listingRaw);
  const propertyStage = mapByLabel(stageRaw, PROPERTY_STAGES);
  let strAllowed = mapByLabel(strRaw, STR_ALLOWED_OPTIONS);
  // mapByLabel may confuse yes/no with stages - refine STR
  if (strRaw) {
    const n = norm(strRaw);
    if (/not sure|unsure/.test(n)) strAllowed = "unsure";
    else if (/^no\b|not allowed/.test(n)) strAllowed = "no";
    else if (/^yes\b|is allowed|allowed/.test(n)) strAllowed = "yes";
  }

  const permitStatus = mapByLabel(
    answerAfter(text, [/permit/, /do you have an str/]),
    PERMIT_OPTIONS,
  );

  if (!name) warnings.push("Could not find full name.");
  if (!email) warnings.push("Could not find email.");
  if (!phone) warnings.push("Could not find phone.");
  if (hasListing === "unknown") warnings.push("Could not tell if they have an Airbnb listing.");

  return {
    name,
    email,
    phone,
    address: cityRaw?.trim() || "",
    hasListing,
    propertyStage,
    strAllowed,
    permitStatus,
    earnings: earningsRaw?.trim() || "",
    listingTitle: listingTitleRaw?.trim() || "",
    rawAnswers,
    warnings,
  };
}

/**
 * Decide CRM stage + whether AI/first SMS should fire.
 * Cold leads with a property path (own_ready / buying) get AI outreach even without a live listing.
 */
export function decideMetaImport(parsed: ParsedMetaLead): MetaImportDecision {
  const lowFit =
    parsed.propertyStage === "researching" ||
    parsed.strAllowed === "no" ||
    parsed.permitStatus === "not_planning";

  if (lowFit) {
    return {
      status: "low_fit",
      qualifiesForBookEmail: false,
      reason:
        "Marked low fit (researching / STR not allowed / not planning a permit). Saved to CRM; no auto SMS.",
    };
  }

  if (parsed.hasListing === "yes") {
    return {
      status: "new",
      qualifiesForBookEmail: true,
      reason: "Live Airbnb listing. AI pre-closer will send the first SMS (if AI is on).",
    };
  }

  if (parsed.hasListing === "no") {
    return {
      status: "new",
      qualifiesForBookEmail: true,
      reason:
        "No listing yet but looks workable — AI pre-closer will text to qualify and book a call (if AI is on).",
    };
  }

  return {
    status: "new",
    qualifiesForBookEmail: true,
    reason:
      "Listing status unclear. Saved as new; AI will still attempt a first SMS when enabled.",
  };
}
