/**
 * Facts about a unit (check-in and check-out times, parking, house rules, amenities) come from one place: the Hospitable
 * Knowledge Hub, read live through the Hospitable connection. Saved memories may hold the same facts, but Hospitable wins: when
 * they disagree it is said plainly and Hospitable is used. Nothing is ever read from a local file or note.
 */

import { listFacts, relevantFacts, type BusinessFact } from "./businessFacts.js";
import type { Scope } from "./clientProperty.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { readableUnit } from "./stayLookup.js";

const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;

/** The clock time written next to "check-in" or "check-out" in some text, as minutes after midnight and as written. */
export function timeAfter(text: string, label: "check-?in" | "check-?out"): { minutes: number; written: string } | null {
  const near = new RegExp(`${label}[^.\\n]{0,40}?(\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?m\\.?)`, "i").exec(text);
  const clock = near ? CLOCK.exec(near[1]!) : null;
  if (!clock) return null;
  const hour = (Number(clock[1]) % 12) + (clock[3]!.toLowerCase() === "p" ? 12 : 0);
  return { minutes: hour * 60 + Number(clock[2] ?? 0), written: near![1]!.replace(/\s+/g, " ").toUpperCase().replace(/\./g, "") };
}

export type UnitConflict = { topic: string; memory: string; hospitable: string; saying: string };

/** Where a saved memory about this unit disagrees with what Hospitable says. Only what can be compared exactly: the two clock times. */
export function conflictsWith(hub: string, facts: BusinessFact[]): UnitConflict[] {
  const out: UnitConflict[] = [];
  for (const [label, topic] of [["check-?in", "check-in time"], ["check-?out", "check-out time"]] as const) {
    const live = timeAfter(hub, label);
    if (!live) continue;
    for (const fact of facts) {
      const saved = timeAfter(`${fact.subject}. ${fact.fact}`, label);
      if (saved && saved.minutes !== live.minutes) {
        out.push({ topic, memory: saved.written, hospitable: live.written, saying: `A saved memory ("${fact.subject}") says the ${topic} is ${saved.written}, but Hospitable says ${live.written}. Going with Hospitable.` });
      }
    }
  }
  return out;
}

export type UnitFacts = {
  property: string;
  propertyIds: string[];
  source: string;
  text: string;
  /** What memory says about this unit, shown beside Hospitable, never in place of it. */
  memory: { subject: string; fact: string }[];
  conflicts: UnitConflict[];
};

export async function unitFacts(scope: Scope): Promise<UnitFacts> {
  const found = await readableUnit(scope);
  if (!found.properties.length) throw new Error(found.why);
  const texts: string[] = [];
  for (const property of found.properties) {
    const hub = await readPropertyHub(property.id);
    // No fallback: a Knowledge Hub that doesn't answer is said, and memory does not stand in for it.
    if (!hub.ok) throw new Error(`Hospitable's Knowledge Hub didn't return for ${property.name || scope.label}, so I can't give its facts. Nothing was taken from memory or any note.`);
    texts.push(hub.text);
  }
  const text = texts.join("\n\n");
  const saved = relevantFacts(await listFacts().catch(() => []), `${scope.label} ${scope.client?.full ?? ""} check-in check-out parking rules`, 12).filter((fact) => scope.match.test(`${fact.subject} ${fact.fact}`));
  return {
    property: scope.label,
    propertyIds: found.properties.map((row) => row.id),
    source: "Hospitable Knowledge Hub, read live just now",
    text,
    memory: saved.map((fact) => ({ subject: fact.subject, fact: fact.fact })),
    conflicts: conflictsWith(text, saved),
  };
}
