/**
 * Property facts come from a live Knowledge Hub read, the same one the stay checks use.
 * A failed or empty read is said plainly. The property is never dropped.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { hasHubSecret, HUB_SECRET_NOTE } from "./hubSecrets.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { isManagedUnit } from "./managedUnits.js";

type Listing = { id: string; label: string; blob: string };

const STOP = new Set([
  "where", "are", "the", "at", "house", "what", "is", "a", "an", "how", "which", "there",
  "do", "you", "know", "property", "unit", "home", "in", "on", "of", "for", "and", "to", "my", "our",
]);

export function asksPropertyFact(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  if (/\b(reservation|check-?ins?|check-?outs?|checking in|guest messages?|how many)\b/i.test(asked)) return false;
  const place = /charlotte|roseglor|scarborough|spacious 3br|blue jays|\bshaw\b|\b606\b|\b318\b/i.test(asked);
  const fact = /\b(where|what|which|how|are the|is the|are there|is there)\b/i.test(asked);
  return place && fact;
}

export async function answerPropertyFact(question: string): Promise<string | null> {
  if (!asksPropertyFact(question)) return null;
  const listing = pickListing(question, await managedListings());
  if (!listing) return null;
  if (hasHubSecret(question)) return `${HUB_SECRET_NOTE} That is for ${listing.label}.`;
  const hub = await readPropertyHub(listing.id);
  if (!hub.ok || !hub.text.trim()) return `The Knowledge Hub didn't return for ${listing.label}.`;
  const lines = matchingLines(hub.text, question);
  if (!lines.length) return `The Knowledge Hub for ${listing.label} was read. It does not mention that.`;
  const fact = lines.join(" ");
  const sentence = /[.!?]$/.test(fact) ? fact : `${fact}.`;
  return `${sentence} That is at ${listing.label}, from the Knowledge Hub.`;
}

async function managedListings(): Promise<Listing[]> {
  const rows = (await listPmProperties().catch(() => [])).filter((row) => isManagedUnit(row.name, row.address));
  return rows.map((row) => {
    const label = labelFor(row.name, row.address);
    return {
      id: (row.hospitable_property_id || row.id).trim(),
      label,
      blob: `${label} ${row.name} ${row.address}`.toLowerCase(),
    };
  }).filter((row) => row.id);
}

function pickListing(question: string, listings: Listing[]): Listing | null {
  const text = question.toLowerCase();
  const hits = listings.filter((row) => {
    if (/scarborough|roseglor|spacious 3br/.test(text) && /roseglor|spacious 3br/.test(row.blob)) return true;
    if ((/charlotte/.test(text) || /\b606\b/.test(text)) && /charlotte/.test(row.blob) && /\b606\b/.test(row.blob)) return true;
    if ((/blue jays/.test(text) || /\b318\b/.test(text)) && /blue jays/.test(row.blob)) return true;
    if (/\bshaw\b/.test(text) && /\bshaw\b/.test(row.blob)) return true;
    return false;
  });
  return hits.length === 1 ? hits[0] : null;
}

function labelFor(name: string, address: string): string {
  const blob = `${name} ${address}`.toLowerCase();
  if (/charlotte/.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  if (/roseglor/.test(blob) || /spacious 3br/.test(blob)) return "Roseglor";
  if (/blue jays/.test(blob)) return "20 Blue Jays Way";
  if (/\bshaw\b/.test(blob)) return "1065 Shaw Street";
  return name;
}

function matchingLines(hub: string, question: string): string[] {
  const keys = (question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2 && !STOP.has(word));
  if (!keys.length) return [];
  return hub.split("\n").map((line) => line.trim()).filter((line) => {
    const lower = line.toLowerCase();
    return keys.some((key) => lower.includes(key));
  });
}
