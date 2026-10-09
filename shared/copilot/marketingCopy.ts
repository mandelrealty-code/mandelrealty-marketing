/**
 * Marketing copy is writing. It uses the listing's public title, description,
 * neighbourhood, and guest-facing amenities. It is not posted.
 * A caption that still contains house-manual terms is rewritten from that public
 * material and the internal draft is not shown.
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

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
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

function openingLine(asked: string, neighbourhood: string, title: string): string {
  const place = neighbourhood.split(",")[0]?.trim() || title;
  if (/\bfall weekend\b/i.test(asked)) return `A fall weekend on ${place}.`;
  if (/\bweekend\b/i.test(asked)) return `A weekend on ${place}.`;
  return `${title}.`;
}

function hashtagLine(asked: string, neighbourhood: string): string {
  const place = (neighbourhood.split(",")[0] ?? "").replace(/[^A-Za-z]/g, "");
  const tags: string[] = [];
  if (place) tags.push(`#${place}`);
  if (/toronto/i.test(neighbourhood)) tags.push("#Toronto");
  if (/\bfall weekend\b/i.test(asked)) tags.push("#FallWeekend");
  return tags.join(" ");
}

function proseSentences(sentences: string[], amenities: string[], title: string, neighbourhood: string): string[] {
  const body: string[] = [];
  for (const sentence of sentences) {
    if (body.length >= 2) break;
    body.push(ensurePeriod(sentence));
  }
  if (amenities.length && body.length < 4) body.push(`Guests have ${listPhrase(amenities.slice(0, 4))}.`);
  if (body.length < 2) body.push(`The house is ${title} in ${neighbourhood}.`);
  if (body.length < 2) body.push(`It is a comfortable stay in ${neighbourhood}.`);
  return body.slice(0, 4);
}

function formatCaption(asked: string, listing: PublicListing, sentences: string[], amenities: string[]): string {
  const opening = openingLine(asked, listing.neighbourhood, listing.title);
  const paragraph = proseSentences(sentences, amenities, listing.title, listing.neighbourhood).join(" ");
  const tags = hashtagLine(asked, listing.neighbourhood);
  const posted = asksUnreachableAction(asked) ? `I don't have a tool to post to ${channel(asked)}. Nothing was posted.` : "Nothing was posted.";
  return [opening, "", paragraph, ...(tags ? ["", tags] : []), "", posted].join("\n");
}

function captionProse(caption: string): string {
  return caption.split("\n").filter((line) => line.trim() && !/^nothing was posted\.$/i.test(line.trim()) && !/^i don't have a tool/i.test(line.trim())).join("\n");
}

/** Finished prose from public listing material. An internal draft is replaced, not shown. */
function captionFromListing(asked: string, listing: PublicListing): string {
  const rawSentences = sentencesOf(listing.description);
  const rawAmenities = listing.amenities.map((item) => item.trim()).filter(Boolean);
  const first = formatCaption(asked, listing, rawSentences, rawAmenities);
  if (!hasInternalContent(captionProse(first))) return first;
  const cleanSentences = rawSentences.filter((sentence) => !hasInternalContent(sentence));
  const cleanAmenities = rawAmenities.filter((item) => !hasInternalContent(item));
  const regenerated = formatCaption(asked, listing, cleanSentences, cleanAmenities);
  if (!hasInternalContent(captionProse(regenerated))) return regenerated;
  return formatCaption(asked, { ...listing, description: "", amenities: [] }, [], []);
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
