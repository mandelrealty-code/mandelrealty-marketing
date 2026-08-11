import type { HasListing } from "./auditEmails.js";
import {
  inferOfferPath,
  type LeadStatus,
  type OfferPath,
} from "./crmTypes.js";
import {
  PERMIT_OPTIONS,
  PROPERTY_STAGES,
  STR_ALLOWED_OPTIONS,
} from "./qualifierOptions.js";
import { parseMetaLeadWebhook } from "./parseMetaLeadWebhook.js";

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
  offerPath: OfferPath;
};

export type MetaImportDecision = {
  status: LeadStatus;
  qualifiesForBookEmail: boolean;
  reason: string;
  offerPath: OfferPath;
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
  const labeled = text.match(/^\s*(?:Full name|full_name)\s*\n\s*([^\n]+)/im);
  if (labeled) {
    const n = labeled[1].trim();
    if (n && isPlausiblePersonName(n)) return n;
  }
  const inline = text.match(/^\s*(?:Full name|full_name)\s*[:=]\s*([^\n]+)/im);
  if (inline) {
    const n = inline[1].trim();
    if (n && isPlausiblePersonName(n)) return n;
  }
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (first && isPlausiblePersonName(first) && first.length < 80) {
    return first;
  }
  if (email.includes("@")) return email.split("@")[0] || "";
  return "";
}

function isPlausiblePersonName(n: string): boolean {
  if (!n || /@/.test(n)) return false;
  if (/^l:\d+/i.test(n)) return false; // Meta lead id
  if (/^\+?\d[\d\s().-]{6,}$/.test(n)) return false;
  if (
    /^(id|created_time|ad_id|ad_name|full_name|email|phone|lead_status|campaign_name|form_name)$/i.test(
      n,
    )
  ) {
    return false;
  }
  if (/^lead added/i.test(n)) return false;
  return true;
}

/**
 * Parse a raw Meta Leads Center paste OR a Meta CSV/TSV export row into CRM fields.
 * Never invents answers — only maps what is in the paste/CSV.
 */
export function parseMetaLeadPaste(raw: string): ParsedMetaLead {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const fromCsv = tryParseMetaExportTable(text);
  if (fromCsv) return fromCsv;

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
    /paste your airbnb listing/,
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

  const permitRaw = answerAfter(text, [/str permit status/, /permit status/, /do you have an str/]);
  const permitStatus = mapByLabel(permitRaw, PERMIT_OPTIONS);
  if (permitRaw) rawAnswers.permit = permitRaw;

  if (!name) warnings.push("Could not find full name.");
  if (!email) warnings.push("Could not find email.");
  if (!phone) warnings.push("Could not find phone.");
  if (hasListing === "unknown") warnings.push("Could not tell if they have an Airbnb listing.");
  if (!propertyStage && stageRaw) {
    warnings.push(`Could not map process answer: "${stageRaw.slice(0, 80)}"`);
  }

  const offerPath = inferOfferPath({
    hasListing,
    propertyStage,
    source: "meta_instant_form",
    rawAnswers,
  });

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
    offerPath,
  };
}

/** Meta Ads Manager CSV/TSV export: header row + one or more data rows. */
function tryParseMetaExportTable(text: string): ParsedMetaLead | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  if (lines.length < 1) return null;

  const delim = detectDelim(lines[0]);
  const headerCells = parseDelimitedLine(lines[0], delim).map((h) => h.trim());
  if (!looksLikeMetaExportHeader(headerCells)) return null;

  const dataLines = lines.slice(1).filter((l) => l.trim());
  if (dataLines.length === 0) return null;

  const row = parseDelimitedLine(dataLines[0], delim);
  const map: Record<string, string> = {};
  headerCells.forEach((h, i) => {
    if (!h) return;
    const v = (row[i] ?? "").trim();
    if (v) map[h] = v;
  });

  if (!map.full_name && !map.email && !map.phone && !map.phone_number) {
    return null;
  }

  const parsed = parseMetaLeadWebhook(map);
  if ("error" in parsed) return null;

  if (dataLines.length > 1) {
    parsed.warnings.push(
      `Paste includes ${dataLines.length} CSV rows — only the first lead was read. Paste one data row (with headers) at a time.`,
    );
  }
  return parsed;
}

function detectDelim(headerLine: string): "," | "\t" {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs >= 2 && tabs >= commas / 3 ? "\t" : ",";
}

function looksLikeMetaExportHeader(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase()).join("|");
  const hasName = cells.some((c) => /^full_name$/i.test(c) || /^full name$/i.test(c));
  const hasContact = cells.some((c) => /^(email|phone|phone_number)$/i.test(c));
  const hasMeta =
    /created_time|campaign_name|form_name|ad_name|do_you_have_an_airbnb|where_are_you_in_the_process/.test(
      joined,
    );
  return (hasName || hasContact) && hasMeta;
}

function parseDelimitedLine(line: string, delim: "," | "\t"): string[] {
  if (delim === "\t") return line.split("\t");
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Decide CRM stage + whether AI/first SMS should fire.
 * Curious leads still get AI — always toward a call (guide landing not ready).
 */
export function decideMetaImport(parsed: ParsedMetaLead): MetaImportDecision {
  const offerPath = parsed.offerPath;

  if (parsed.strAllowed === "no" || parsed.permitStatus === "not_planning") {
    return {
      status: "low_fit",
      qualifiesForBookEmail: false,
      offerPath,
      reason:
        "Hard no (STR not allowed / not planning a permit). Saved as low fit; no auto SMS.",
    };
  }

  if (offerPath === "education" || parsed.propertyStage === "researching") {
    return {
      status: "new",
      qualifiesForBookEmail: true,
      offerPath: "education",
      reason:
        "Curious / learning path. AI will invite a free intro call (no guide link until landing is ready).",
    };
  }

  if (parsed.hasListing === "yes") {
    return {
      status: "new",
      qualifiesForBookEmail: true,
      offerPath,
      reason: `Live listing → ${offerPath} path. AI pre-closer will open with a personalized SMS.`,
    };
  }

  return {
    status: "new",
    qualifiesForBookEmail: true,
    offerPath,
    reason: `Routed to ${offerPath}. AI will personalize from form answers + knowledge base.`,
  };
}
