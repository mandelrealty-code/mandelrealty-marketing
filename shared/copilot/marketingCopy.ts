/**
 * Marketing copy is writing. It uses the listing's public title, description,
 * neighbourhood, and guest-facing amenities. It is not posted.
 * A caption that repeats the listing title, is mostly fragments, or still contains
 * house-manual terms is rewritten from that public material and the draft is not shown.
 * "I don't have a tool" is only for an action that needs a system this chat cannot reach.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { matchManagedListings } from "./propertyFact.js";
import { parityEnabled } from "./parity/flag.js";
import { parityListingMaterial } from "./parity/world.js";

/** House-manual words. A caption that contains one is not shown. */
export const INTERNAL_TERMS = [
  "lock box",
  "lockbox",
  "garage remote",
  "closet",
  "closets",
  "storage",
  "stored",
  "cleaning",
  "check-out",
  "checkout",
  "check out",
  "house manual",
  "keys",
  "garbage",
  "laundry",
  "quiet hours",
  "shoes",
] as const;

type PublicListing = {
  title: string;
  description: string;
  neighbourhood: string;
  amenities: string[];
};

export function asksMarketingDraft(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  if (/\b(caption|blurb)\b/i.test(asked)) return !/\b(publish|upload|schedule)\b/i.test(asked);
  if (!/\b(draft|write|compose)\b/i.test(asked)) return false;
  return /\b(instagram|facebook|tiktok|social|listing)\b/i.test(asked) && /\b(post|copy|market)\b/i.test(asked);
}

/** Posting, sending, or publishing needs a system this chat does not have. */
export function asksUnreachableAction(text: string): boolean {
  if (asksMarketingDraft(text) && !/\b(publish|upload|schedule|post (it|this|that)|put (it|this) on)\b/i.test(text)) return false;
  return /\b(instagram|facebook|tiktok|whatsapp|linkedin)\b/i.test(text) && /\b(post|publish|upload|schedule|send)\b/i.test(text);
}

function termPattern(term: string): RegExp {
  const body = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
  return new RegExp(`\\b${body}\\b`, "i");
}

export function hasInternalContent(text: string): boolean {
  return INTERNAL_TERMS.some((term) => termPattern(term).test(text));
}

function channel(text: string): string {
  if (/whatsapp/i.test(text)) return "WhatsApp";
  if (/facebook/i.test(text)) return "Facebook";
  if (/tiktok/i.test(text)) return "TikTok";
  if (/linkedin/i.test(text)) return "LinkedIn";
  return "Instagram";
}

function neighbourhoodOf(address: string, fallback: string): string {
  const display = address.replace(/^\d+\s*,?\s*/, "").trim();
  return display || fallback;
}

async function publicListing(id: string, label: string): Promise<PublicListing> {
  if (parityEnabled()) {
    const row = parityListingMaterial(id);
    if (row) {
      return {
        title: row.title || label,
        description: row.description,
        neighbourhood: row.neighbourhood || neighbourhoodOf(row.address, label),
        amenities: row.amenities,
      };
    }
  }
  const rows = await listPmProperties().catch(() => []);
  const property = rows.find((row) => (row.hospitable_property_id || row.id) === id);
  const title = property?.name.trim() || label;
  const address = property?.address.trim() || "";
  return { title, description: "", neighbourhood: neighbourhoodOf(address, label), amenities: [] };
}

function ensurePeriod(line: string): string {
  const clean = line.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function listPhrase(items: string[]): string {
  const words = items.map((item) => {
    const clean = item.replace(/[.!?]+$/, "").trim();
    return clean.charAt(0).toLowerCase() + clean.slice(1);
  });
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

function placeName(neighbourhood: string): string {
  return neighbourhood.split(",")[0]?.trim() || "the neighbourhood";
}

function openingLine(asked: string, neighbourhood: string): string {
  const place = placeName(neighbourhood);
  const city = /toronto/i.test(neighbourhood) ? " in Toronto" : "";
  if (/\bfall weekend\b/i.test(asked)) return `A fall weekend on ${place} makes an easy getaway${city}.`;
  if (/\bweekend\b/i.test(asked)) return `A weekend on ${place} makes an easy getaway${city}.`;
  return `A stay on ${place} is ready for guests${city}.`;
}

function hashtagLine(asked: string, neighbourhood: string): string {
  const place = (neighbourhood.split(",")[0] ?? "").replace(/[^A-Za-z]/g, "");
  const tags: string[] = [];
  if (place) tags.push(`#${place}`);
  if (/toronto/i.test(neighbourhood)) tags.push("#Toronto");
  if (/\bfall weekend\b/i.test(asked)) tags.push("#FallWeekend");
  return tags.join(" ");
}

function spokenAmenity(item: string): string {
  const clean = item.replace(/[.!?]+$/, "").trim();
  const lower = clean.charAt(0).toLowerCase() + clean.slice(1);
  if (/^(a|an|the|free|private)\b/i.test(lower)) return lower;
  return `a ${lower}`;
}

function houseSentence(listing: PublicListing): string {
  const blob = `${listing.title} ${listing.description}`.toLowerCase();
  const beds = /two-bedroom|\b2\s*-?\s*br\b|\b2br\b/.test(blob) ? "two-bedroom" : "";
  const features = [/\byard\b/.test(blob) ? "a yard" : "", /\bparking\b/.test(blob) ? "parking" : ""].filter(Boolean);
  const feature = features.length === 2 ? "a yard and parking" : features[0] ?? "";
  const guests = /\bsix guests\b|\bsleeps six\b/.test(blob) ? ", with room for six guests" : "";
  if (beds && feature) return `The house is a ${beds} with ${feature}${guests}.`;
  if (feature) return `The house has ${feature}${guests}.`;
  return `The house is ready for guests on ${placeName(listing.neighbourhood)}.`;
}

function amenitySentence(amenities: string[]): string {
  if (!amenities.length) return "";
  return `Guests have ${listPhrase(amenities.slice(0, 4).map(spokenAmenity))}.`;
}

function normalizeCopy(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function repeatsTitle(caption: string, title: string): boolean {
  const hay = normalizeCopy(caption);
  const full = normalizeCopy(title);
  if (full.length >= 12 && hay.includes(full)) return true;
  return title.split(/\s*[|/]\s*/).some((part) => {
    const normalized = normalizeCopy(part);
    return (normalized.split(" ").length >= 3 || normalized.length >= 16) && normalized.length >= 10 && hay.includes(normalized);
  });
}

function isFullSentence(sentence: string): boolean {
  const clean = sentence.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length >= 5 && /[.!?]$/.test(clean) && !/[|/]/.test(clean);
}

function captionLines(caption: string): string[] {
  return caption.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && !/^nothing was posted\.?$/i.test(line) && !/^i don't have a tool/i.test(line));
}

function finishedSentences(caption: string): string[] {
  return captionLines(caption).join(" ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function mostlyFragments(caption: string): boolean {
  const lines = captionLines(caption);
  if (!lines.length) return true;
  const fragments = lines.filter((line) => !isFullSentence(line) && finishedSentences(line).every((sentence) => !isFullSentence(sentence)));
  return fragments.length > lines.length / 2;
}

function captionFails(caption: string, title: string): boolean {
  const sentences = finishedSentences(caption);
  const tags = caption.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("#"));
  return hasInternalContent(captionProse(caption))
    || repeatsTitle(caption, title)
    || sentences.length < 2
    || sentences.length > 3
    || sentences.some((sentence) => !isFullSentence(sentence))
    || mostlyFragments(caption)
    || tags.length !== 1;
}

function formatCaption(asked: string, listing: PublicListing, sentences: string[]): string {
  const tags = hashtagLine(asked, listing.neighbourhood);
  const posted = asksUnreachableAction(asked) ? `I don't have a tool to post to ${channel(asked)}. Nothing was posted.` : "Nothing was posted.";
  return [sentences.join(" "), ...(tags ? ["", tags] : []), "", posted].join("\n");
}

function captionProse(caption: string): string {
  return caption.split("\n").filter((line) => line.trim() && !/^nothing was posted\.$/i.test(line.trim()) && !/^i don't have a tool/i.test(line.trim())).join("\n");
}

function pastedTitle(listing: PublicListing): string {
  const chunks = `${listing.title} ${listing.description}`.split(/\s*[|/]\s*/).map((part) => ensurePeriod(part)).filter((part) => part.length > 1);
  return chunks.join("\n");
}

/** Finished prose from public listing material. A title paste or a fragment draft is replaced, not shown. */
function captionFromListing(asked: string, listing: PublicListing): string {
  const amenities = listing.amenities.map((item) => item.trim()).filter((item) => item && !hasInternalContent(item));
  const pasted = formatCaption(asked, listing, [pastedTitle(listing)]);
  const written = [
    openingLine(asked, listing.neighbourhood),
    houseSentence(listing),
    amenitySentence(amenities),
  ].filter(Boolean).slice(0, 3);
  const regenerated = formatCaption(asked, listing, written);
  if (captionFails(pasted, listing.title) && !captionFails(regenerated, listing.title)) return regenerated;
  if (!captionFails(regenerated, listing.title)) return regenerated;
  return formatCaption(asked, listing, [openingLine(asked, listing.neighbourhood), houseSentence({ ...listing, title: "", description: "" })]);
}

export async function answerMarketingCopy(question: string): Promise<string | null> {
  const asked = question.trim();
  if (!asked) return null;
  if (asksUnreachableAction(asked) && !asksMarketingDraft(asked)) {
    return `I don't have a tool to post to ${channel(asked)}. Nothing was posted.`;
  }
  if (!asksMarketingDraft(asked)) return null;
  const listings = await matchManagedListings(asked);
  if (!listings.length) return "I couldn't match that to a managed property. Nothing was posted.";
  if (listings.length > 1) {
    return `Which property should I use? I found ${listings.map((row) => row.label).join(" and ")}. Nothing was posted.`;
  }
  const listing = listings[0];
  if (!listing) return "I couldn't match that to a managed property. Nothing was posted.";
  const material = await publicListing(listing.id, listing.label);
  return captionFromListing(asked, material);
}
