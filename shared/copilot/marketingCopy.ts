/**
 * Marketing copy is writing. It uses the listing's Knowledge Hub and is not posted.
 * "I don't have a tool" is only for an action that needs a system this chat cannot reach.
 */

import { readPropertyHub } from "./knowledgeHub.js";
import { matchManagedListings } from "./propertyFact.js";

const FEATURE = /\b(sleeps|parking|deck|backyard|yard|patio|kitchen|bedroom|bath|balcony|view|wifi)\b/i;
const RULE = /\b(quiet hours|shoes|laundry|garbage|no visitors|check-?out|check-?in|netflix|no pets|no smoking|no events)\b/i;

export function asksMarketingDraft(text: string): boolean {
  if (!/\b(draft|write|compose)\b/i.test(text)) return false;
  if (/\b(caption|blurb)\b/i.test(text)) return true;
  return /\b(instagram|facebook|tiktok|social|listing)\b/i.test(text) && /\b(post|copy|caption|blurb|market)\b/i.test(text);
}

/** Posting, sending, or publishing needs a system this chat does not have. */
export function asksUnreachableAction(text: string): boolean {
  if (asksMarketingDraft(text) && !/\b(publish|upload|schedule|post (it|this|that)|put (it|this) on)\b/i.test(text)) return false;
  return /\b(instagram|facebook|tiktok|whatsapp|linkedin)\b/i.test(text) && /\b(post|publish|upload|schedule|send)\b/i.test(text);
}

function channel(text: string): string {
  if (/whatsapp/i.test(text)) return "WhatsApp";
  if (/facebook/i.test(text)) return "Facebook";
  if (/tiktok/i.test(text)) return "TikTok";
  if (/linkedin/i.test(text)) return "LinkedIn";
  return "Instagram";
}

function featureSentences(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.split(/\n+/)) {
    for (const sentence of chunk.split(/(?<=\.)\s+/)) {
      const line = sentence.trim();
      if (!line || RULE.test(line) || !FEATURE.test(line)) continue;
      const exact = line.endsWith(".") ? line : `${line}.`;
      if (!out.includes(exact)) out.push(exact);
    }
  }
  return out;
}

function occasion(text: string): string {
  if (/\bfall weekend\b/i.test(text)) return "Fall weekend";
  if (/\bweekend\b/i.test(text)) return "A weekend";
  return "";
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
  const hub = await readPropertyHub(listing.id);
  if (!hub.ok || !hub.text.trim()) return `The Knowledge Hub didn't return for ${listing.label}. Nothing was posted.`;
  const features = featureSentences(hub.text);
  if (!features.length) return `The Knowledge Hub for ${listing.label} was read. It does not list features to market. Nothing was posted.`;
  const lead = occasion(asked) ? `${occasion(asked)} at ${listing.label}.` : `${listing.label}.`;
  const posted = asksUnreachableAction(asked) ? `I don't have a tool to post to ${channel(asked)}. Nothing was posted.` : "Nothing was posted.";
  return [lead, ...features, "", posted].join("\n");
}
