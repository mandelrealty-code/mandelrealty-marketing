/**
 * "What kind of laundry detergent do we use?" is answered from the cleaner app's
 * saved item names. The photo catch already stored "Tide Pods". No separate type
 * is required. A name that does not say the kind is not treated as that kind.
 */

import { readCleanerUnit, type CleanerPicture } from "./cleanerRead.js";
import { copilotKeepsProperty } from "./hospitableConnection.js";
import { spokenLabel, textNamesProperty } from "./propertyIdentity.js";
import { withClientUnits } from "./reportClients.js";
import { ensureUnitSetups, type UnitSetup } from "./unitSetup.js";

type Kind = {
  label: string;
  says: (name: string) => boolean;
};

const PLACE = /charlotte|roseglor|scarborough|spacious 3br|blue jays|\bshaw\b|\b606\b|\b318\b/i;

const LAUNDRY: Kind = {
  label: "laundry detergent",
  says: (name) => {
    if (/\bdish|cascade\b/i.test(name)) return false;
    if (/\b(tide(?:\s+pods?)?|gain(?:\s+flings)?|persil|purex|cheer|dropps|tru earth|earth breeze|all free(?:\s*(?:&|and)\s*clear)?)\b/i.test(name)) return true;
    if (/\blaundry\b/i.test(name) && /\b(detergent|pods?|sheets?)\b/i.test(name)) return true;
    return /\bdetergent\b/i.test(name);
  },
};

const DISHWASHER: Kind = {
  label: "dishwasher detergent",
  says: (name) => {
    if (/\blaundry|tide\b/i.test(name)) return false;
    if (/\bcascade\b/i.test(name) || /^finish$/i.test(name.trim()) || /\bfinish\s+(?:quantum|pods?|tabs|detergent)\b/i.test(name)) return true;
    return /\bdishwasher\b/i.test(name) || /\bdish\s+(?:pods?|tabs|detergent)\b/i.test(name);
  },
};

const DISH_SOAP: Kind = {
  label: "dish soap",
  says: (name) => /\b(dawn|palmolive)\b/i.test(name) || (/\bdish\b/i.test(name) && /\bsoap\b/i.test(name)),
};

const HAND_SOAP: Kind = {
  label: "hand soap",
  says: (name) => /\bsoftsoap\b/i.test(name) || (/\bhand\b/i.test(name) && /\bsoap\b/i.test(name)),
};

const TOILET_PAPER: Kind = {
  label: "toilet paper",
  says: (name) => /\b(charmin|cottonelle|angel soft)\b/i.test(name) || (/\btoilet\b/i.test(name) && /\bpaper\b/i.test(name)),
};

const PAPER_TOWELS: Kind = {
  label: "paper towels",
  says: (name) => /\bbounty\b/i.test(name) || (/\bpaper\b/i.test(name) && /\btowels?\b/i.test(name)),
};

const BAGS: Kind = {
  label: "garbage bags",
  says: (name) => /\b(glad|hefty)\b/i.test(name) || (/\b(?:garbage|trash|kitchen)\b/i.test(name) && /\bbags?\b/i.test(name)),
};

const COFFEE: Kind = {
  label: "coffee pods",
  says: (name) => /\bk-?cups?\b/i.test(name) || (/\b(?:coffee|keurig)\b/i.test(name) && /\bpods?\b/i.test(name)),
};

const SHAMPOO: Kind = { label: "shampoo", says: (name) => /\bshampoo\b/i.test(name) };
const CONDITIONER: Kind = { label: "conditioner", says: (name) => /\bconditioner\b/i.test(name) };
const BODY_WASH: Kind = { label: "body wash", says: (name) => /\bbody wash\b/i.test(name) };
const SPONGES: Kind = { label: "sponges", says: (name) => /\bsponges?\b/i.test(name) };
const BLEACH: Kind = { label: "bleach", says: (name) => /\bbleach\b/i.test(name) };

function askedKind(text: string): Kind | null {
  const asked = text.toLowerCase();
  if (/\bdishwasher\b|\bdish\s+(?:pods?|tabs|detergent)\b/.test(asked)) return DISHWASHER;
  if (/\bdish soap\b/.test(asked)) return DISH_SOAP;
  if (/\bhand soap\b/.test(asked)) return HAND_SOAP;
  if (/\btoilet paper\b/.test(asked)) return TOILET_PAPER;
  if (/\bpaper towels?\b/.test(asked)) return PAPER_TOWELS;
  if (/\b(?:garbage|trash|kitchen) bags?\b/.test(asked)) return BAGS;
  if (/\b(?:coffee pods?|k-?cups?)\b/.test(asked)) return COFFEE;
  if (/\bshampoo\b/.test(asked)) return SHAMPOO;
  if (/\bconditioner\b/.test(asked)) return CONDITIONER;
  if (/\bbody wash\b/.test(asked)) return BODY_WASH;
  if (/\bsponges?\b/.test(asked)) return SPONGES;
  if (/\bbleach\b/.test(asked)) return BLEACH;
  if (/\blaundry\b|\bdetergent\b/.test(asked)) return LAUNDRY;
  return null;
}

/** A question about which saved product the units stock. Buying and location questions stay on their own paths. */
export function asksStockedKind(text: string): boolean {
  const asked = text.trim();
  if (!asked || !askedKind(asked)) return false;
  if (/\brunning low\b|\blow stock\b|\bsupply catalog\b/i.test(asked)) return false;
  if (/\bwhere\b/i.test(asked)) return false;
  if (/\b(order|buy|purchase|cheap(?:est)?|affordable|economical|restock)\b/i.test(asked)) return false;
  return /\b(kind|type|brand|which)\b/i.test(asked) || /\b(?:do|did)\s+we\b/i.test(asked) || /\bwe\s+(?:use|stock|have|keep)\b/i.test(asked);
}

function wantsOneUnit(text: string): boolean {
  return PLACE.test(text);
}

function joined(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function matchingNames(picture: CleanerPicture & { ok: true }, kind: Kind): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of picture.supplies) {
    const name = row.item.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key) || !kind.says(name)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

type Spoken = { text: string; matched: boolean; failed: boolean; error: string };

async function lineFor(unit: UnitSetup, kind: Kind, named: boolean): Promise<Spoken> {
  const place = spokenLabel(unit.name, unit.address);
  const picture = await readCleanerUnit({ propertyId: unit.propertyId, from: "2000-01-01", to: "2100-01-01" });
  if (!picture.ok) {
    return { text: `The inventory for ${place} didn't return. ${picture.error}`, matched: false, failed: true, error: picture.error };
  }
  const names = matchingNames(picture, kind);
  if (names.length) return { text: `${place} stocks ${joined(names)}.`, matched: true, failed: false, error: "" };
  if (!picture.supplies.length && !picture.complete) {
    return { text: `The inventory read is incomplete for ${place}.`, matched: false, failed: true, error: "" };
  }
  const missing = `The inventory for ${place} was read. It does not name a ${kind.label}.`;
  return { text: named ? missing : "", matched: false, failed: false, error: "" };
}

function speak(lines: Spoken[], kind: string, named: boolean): string {
  if (named) return lines.map((line) => line.text).filter(Boolean).join("\n");
  if (lines.length > 0 && lines.every((line) => line.failed && line.error)) {
    const errors = new Set(lines.map((line) => line.error));
    if (errors.size === 1) return [...errors][0] ?? "";
  }
  const matched = lines.filter((line) => line.matched).map((line) => line.text);
  const failed = lines.filter((line) => line.failed).map((line) => line.text);
  if (matched.length) return [...matched, ...failed].join("\n");
  if (lines.some((line) => !line.failed)) {
    return [`The inventory was read. It does not name a ${kind}.`, ...failed].filter(Boolean).join("\n");
  }
  return failed.filter(Boolean).join("\n");
}

export async function answerStockedKind(text: string): Promise<string | null> {
  if (!asksStockedKind(text)) return null;
  const kind = askedKind(withClientUnits(text));
  if (!kind) return null;
  const expanded = withClientUnits(text);
  const units: UnitSetup[] = [];
  for (const unit of await ensureUnitSetups()) {
    if (await copilotKeepsProperty({ id: unit.propertyId, name: unit.name, address: unit.address })) units.push(unit);
  }
  if (!units.length) return "No units are in the cleaner app. Nothing was guessed.";
  const named = wantsOneUnit(expanded);
  const shown = (named ? units.filter((unit) => textNamesProperty(expanded, unit.name, unit.address)) : units)
    .sort((a, b) => spokenLabel(a.name, a.address).localeCompare(spokenLabel(b.name, b.address)));
  if (named && !shown.length) return "That unit isn't one we manage. Nothing was guessed.";
  const lines: Spoken[] = [];
  for (const unit of shown) lines.push(await lineFor(unit, kind, named));
  return speak(lines, kind.label, named);
}
