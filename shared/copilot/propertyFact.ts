/**
 * Property facts come from a live Knowledge Hub read, the same one the stay checks use.
 * A failed or empty read is said plainly. The property is never dropped.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { hasHubSecret, HUB_SECRET_NOTE } from "./hubSecrets.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { isManagedUnit } from "./managedUnits.js";
import { activeMemoryClaims } from "./memoryFiles.js";

type Listing = { id: string; label: string; blob: string };

const STOP = new Set([
  "where", "are", "the", "at", "house", "what", "is", "a", "an", "how", "which", "there",
  "do", "you", "know", "property", "unit", "home", "in", "on", "of", "for", "and", "to", "my", "our",
  "kept", "keep", "located", "stored", "found", "left", "put", "does", "stay",
]);

const PLACE = new Set(["shaw", "street", "charlotte", "roseglor", "scarborough", "jays", "blue", "way", "crescent"]);

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
  const topics = topicWords(question);
  const memory = await rememberedFact(listing, topics);
  const hub = await readPropertyHub(listing.id);
  const hubLines = hub.ok ? matchingLines(hub.text, topics) : [];
  const hubFact = hubLines.join(" ");
  if (memory && hubFact && conflicts(memory, hubFact)) {
    return `${sentence(hubFact)} That is at ${listing.label}, from the Knowledge Hub. The saved memory differs: ${sentence(memory)}`;
  }
  if (memory) return `${sentence(memory)} That is at ${listing.label}, from saved memory.`;
  if (!hub.ok || !hub.text.trim()) return `The Knowledge Hub didn't return for ${listing.label}.`;
  if (!hubLines.length) return `The Knowledge Hub for ${listing.label} was read. It does not mention that.`;
  return `${sentence(hubFact)} That is at ${listing.label}, from the Knowledge Hub.`;
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

function topicWords(question: string): string[] {
  return (question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => {
    if (word.length <= 2 || STOP.has(word) || PLACE.has(word) || /^\d+$/.test(word)) return false;
    return true;
  });
}

function stem(word: string): string {
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}

function hasWord(text: string, word: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes(word) || lower.includes(stem(word));
}

function aboutFact(text: string, topics: string[]): boolean {
  return topics.length > 0 && topics.every((word) => hasWord(text, word));
}

function matchingLines(hub: string, topics: string[]): string[] {
  return hub.split("\n").map((line) => line.trim()).filter((line) => aboutFact(line, topics));
}

function mentionsProperty(text: string, listing: Listing): boolean {
  const blob = text.toLowerCase();
  if (/roseglor|scarborough/.test(listing.blob) && /roseglor|scarborough/.test(blob)) return true;
  if (/charlotte/.test(listing.blob) && (/charlotte/.test(blob) || /\b606\b/.test(blob))) return true;
  if (/blue jays/.test(listing.blob) && (/blue jays/.test(blob) || /\b318\b/.test(blob))) return true;
  if (/\bshaw\b/.test(listing.blob) && /\bshaw\b/.test(blob)) return true;
  return false;
}

async function rememberedFact(listing: Listing, topics: string[]): Promise<string> {
  const claims = await activeMemoryClaims().catch(() => []);
  const hits = claims.filter((claim) => {
    const blob = `${claim.quote}\n${claim.body}\n${claim.path}`;
    return mentionsProperty(blob, listing) && aboutFact(blob, topics);
  });
  const claim = hits[hits.length - 1];
  if (!claim) return "";
  const line = claim.body.split("\n").map((row) => row.trim()).find((row) => aboutFact(row, topics));
  const quote = claim.quote.replace(/^(please\s+)?(remember|keep)\s+(this|that)?[:,]?\s*/i, "").trim();
  return (line || quote).replace(/\s+/g, " ").trim();
}

function placeValue(text: string): string {
  const found = text.match(/\b(?:kept|stored|located|left|found|is|are)\s+(?:in|on|at|inside|under)\s+(?:the\s+)?([^.]*)/i);
  return (found?.[1] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function conflicts(memory: string, hub: string): boolean {
  const saved = placeValue(memory);
  const live = placeValue(hub);
  if (!saved || !live) return false;
  return !saved.includes(live) && !live.includes(saved);
}

function sentence(fact: string): string {
  const clean = fact.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const spoken = clean.charAt(0).toUpperCase() + clean.slice(1);
  return `${spoken}.`;
}
