/**
 * Comp pricing for one of our units ("comps for Raj's unit for those dates").
 *
 * The unit comes from the records: a named client resolves through the client list and OPS, never
 * by asking the partner which property their own client owns. Copilot does the work with the tools
 * it has: it states its defaults (same building and neighbourhood, nightly rates) and pulls AirROI
 * comps. It does not ask permission or hand the lookup back. A failed read is retried, then the web
 * is searched, and the answer says what was found and what could not be confirmed.
 */

import { comparableRates, estimateByAddress, type ComparableRate } from "../airroi.js";
import { spokenProperty } from "./dayBoard.js";
import { hospitableRead } from "./hospitableConnection.js";
import { parityEnabled } from "./parity/flag.js";
import { REPORT_CLIENTS, clientNamed } from "./reportClients.js";
import { managedReportProperties, mentionsProperty } from "./reportFigures.js";
import { answerWebQuestion } from "./webAnswer.js";

const COMPS = /\b(comps?|comparables?|comparable (?:units?|listings?)|comp pricing|market rates?|what (?:are )?(?:similar|other|nearby) (?:units?|listings?|places?) (?:charg\w*|go(?:ing)? for|getting|renting for)|nightly rates? for (?:units?|places?) like)\b/i;

export function asksComps(text: string): boolean {
  // A proposal for a prospective client has its own comps; this is for our own units.
  return COMPS.test(text) && !/\bproposals?\b/i.test(text);
}

export type CompsTurn = { role: string; body: string };
export type CompsAnswer = { body: string; step: string; thought: string; choices?: string[] };

/** The unit's own specs and location, from Hospitable's property record. */
export type Size = { bedrooms: number; bathrooms: number; guests: number; known: boolean; latitude: number | null; longitude: number | null };

type Comparables = (input: { latitude: number; longitude: number; bedrooms: number; baths: number; guests: number }) => Promise<ComparableRate[]>;

let source: Comparables | null = null;

/** Test seam: the parity suite supplies AirROI's comparables, or makes the pull fail. */
export function setCompsSource(next: Comparables | null): void {
  source = next;
}

/** The comps request this message belongs to: a new one, or an answer to a comps follow-up. */
function compsTurns(text: string, history: CompsTurn[]): string[] | null {
  if (asksComps(text)) return [text];
  if (text.length > 120 || /\?$/.test(text.trim())) return null;
  const users = history.filter((turn) => turn.role === "user").slice(-3);
  const start = users.map((turn) => turn.body).findLastIndex((body) => asksComps(body));
  if (start < 0) return null;
  return [...users.slice(start).map((turn) => turn.body), text];
}

/** "Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027" from the conversation, when dates were named. */
function datesFrom(history: CompsTurn[]): string {
  const pattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}(?!\d)(?:(?:,\s*|,?\s+and\s+)\d{1,2}(?!\d))*)(?:,?\s+(20\d{2}))?/g;
  let best = "";
  for (const turn of [...history].reverse()) {
    for (const match of turn.body.matchAll(pattern)) {
      const found = `${match[1]} ${match[2]!.replace(/,?\s+and\s+/, " and ")}${match[3] ? `, ${match[3]}` : ""}`;
      if (found.length > best.length) best = found;
    }
    if (best.split(",").length > 2) break;
  }
  return best;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Bedrooms, bathrooms, guests and coordinates from Hospitable's property record. */
export async function sizeOf(hospitableId: string): Promise<Size> {
  try {
    const raw = await hospitableRead("get-properties", {});
    const rows = Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: Record<string, unknown>[] }).data : [];
    const row = rows.find((item) => String(item.id ?? "") === hospitableId) ?? null;
    const capacity = record(row?.capacity ?? row?.details ?? row);
    const address = record(row?.address);
    const coordinates = record(address.coordinates ?? row?.coordinates);
    const latitude = num(coordinates.latitude ?? coordinates.lat ?? address.latitude ?? row?.latitude);
    const longitude = num(coordinates.longitude ?? coordinates.lng ?? address.longitude ?? row?.longitude);
    const bedrooms = num(capacity.bedrooms ?? row?.bedrooms);
    const bathrooms = num(capacity.bathrooms ?? row?.bathrooms);
    const guests = num(capacity.max ?? capacity.max_guests ?? row?.max_guests ?? capacity.guests);
    if (bedrooms) return { bedrooms, bathrooms: bathrooms ?? 1, guests: guests ?? bedrooms * 2, known: true, latitude, longitude };
    return { bedrooms: 2, bathrooms: 1, guests: 4, known: false, latitude, longitude };
  } catch {
    return { bedrooms: 2, bathrooms: 1, guests: 4, known: false, latitude: null, longitude: null };
  }
}

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
}

/** What comparable units get: the 12-month median and middle range, the 90-day median, top earners. */
export type CompSet = {
  count: number;
  currency: string;
  median: number;
  low: number;
  high: number;
  recent: number | null;
  topLow: number;
  topHigh: number;
  specs: string;
};

/**
 * The comparables pull for the unit's own specs at its own location, in local currency. One retry;
 * null when AirROI does not answer. The unit's location comes from Hospitable, else AirROI geocodes
 * the address.
 */
export async function compSet(address: string, size: Size): Promise<CompSet | null> {
  if (!source && parityEnabled()) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let latitude = size.latitude;
      let longitude = size.longitude;
      if ((latitude == null || longitude == null) && !source) {
        const placed = await estimateByAddress({ address, bedrooms: size.bedrooms, bathrooms: size.bathrooms, guests: size.guests });
        latitude = placed.latitude;
        longitude = placed.longitude;
      }
      const run: Comparables = source ?? comparableRates;
      const rows = await run({ latitude: latitude ?? 0, longitude: longitude ?? 0, bedrooms: size.bedrooms, baths: size.bathrooms, guests: size.guests });
      const rates = rows.map((row) => row.ttmRate).filter((value): value is number => value != null && value > 0);
      if (rates.length < 3) continue;
      const recent = rows.map((row) => row.l90Rate).filter((value): value is number => value != null && value > 0);
      const top = [...rows].filter((row) => row.ttmRate != null).sort((a, b) => (b.ttmRevenue ?? 0) - (a.ttmRevenue ?? 0)).slice(0, 5).map((row) => row.ttmRate!);
      return {
        count: rates.length,
        currency: rows.find((row) => row.currency)?.currency || "CAD",
        median: median(rates),
        low: quantile(rates, 0.25),
        high: quantile(rates, 0.75),
        recent: recent.length >= 3 ? median(recent) : null,
        topLow: Math.min(...top),
        topHigh: Math.max(...top),
        specs: `${size.bedrooms} bed, ${size.bathrooms} bath, sleeps ${size.guests}`,
      };
    } catch {
      /* Try again once. */
    }
  }
  return null;
}

/** "Median about $608 CAD a night over the last 12 months ($540 to $690 for the middle half)…" */
export function compLines(set: CompSet): string[] {
  const cur = set.currency;
  return [
    `Median about ${money(set.median)} ${cur} a night over the last 12 months (${money(set.low)} to ${money(set.high)} for the middle half of ${set.count} comparable listings)${set.recent != null ? `, about ${money(set.recent)} ${cur} over the last 90 days` : ""}.`,
    `The top earners average ${money(set.topLow)} to ${money(set.topHigh)} ${cur} a night.`,
  ];
}

export async function answerComps(text: string, history: CompsTurn[], now = new Date()): Promise<CompsAnswer | null> {
  const turns = compsTurns(text, history);
  if (!turns) return null;
  const asked = turns.join(" ");
  let properties: Awaited<ReturnType<typeof managedReportProperties>>;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "OPS didn't return the properties, so I couldn't tell which unit to price. Nothing else was read.", step: "OPS didn't answer", thought: "Nothing was sent." };
  }
  // The unit comes from the records: a named client, a named property, or one named earlier in the chat.
  const fromText = (blob: string) => {
    const client = clientNamed(blob);
    const owned = client ? properties.filter((row) => client.match.test(`${row.name} ${row.address}`)) : [];
    const named = properties.filter((row) => mentionsProperty(blob, row));
    return { client, unit: named[0] ?? owned[0] ?? null };
  };
  let found = fromText(asked);
  if (!found.unit) found = fromText(history.slice(-6).map((turn) => turn.body).join(" "));
  const unit = found.unit;
  if (!unit) {
    return {
      body: "Which unit should I pull comps for?",
      choices: properties.map((row) => {
        const name = spokenProperty(row.name, row.address);
        const owner = REPORT_CLIENTS.find((client) => client.match.test(`${row.name} ${row.address}`));
        return owner ? `${name} (${owner.short})` : name;
      }),
      step: "Asked which unit",
      thought: "No unit or client was named. Nothing was sent.",
    };
  }
  // "20 Blue Jays Way Unit 318": the unit number from the address when the spoken name lacks it.
  const spoken = spokenProperty(unit.name, unit.address);
  const unitNo = /^(\d{2,4}),/.exec(unit.address.trim())?.[1] ?? "";
  const name = unitNo && !spoken.includes(unitNo) ? `${spoken} Unit ${unitNo}` : spoken;
  const whose = found.client ? `${found.client.short}'s unit, ` : "";
  const size = await sizeOf(unit.hospitable_property_id || unit.id);
  const sizeWords = `${size.bedrooms} bed, ${size.bathrooms} bath, sleeps ${size.guests}${size.known ? "" : " (size assumed; Hospitable didn't return it)"}`;
  const nightly = /\b(week|weekly|total|whole stay|monthly)\b/i.test(asked) ? "" : "nightly rates";
  const scope = /\bacross toronto|city[- ]wide|whole city\b/i.test(asked) ? "across Toronto" : "same building and neighbourhood";
  const dates = datesFrom([...history, { role: "user", body: text }]);
  const lead = `Comps for ${whose}${name} (${sizeWords}): ${scope}${nightly ? `, ${nightly}` : ""}.`;
  const caveat = dates ? `These are trailing market figures, not quotes for ${dates}; price those nights from the top of the range.` : "";

  const market = await compSet(unit.address || name, size);
  if (market) {
    const lines = [
      lead,
      ...compLines(market),
      caveat,
      `Source: AirROI comparables for ${market.specs} near the unit, pulled ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" }).format(now)}.`,
    ];
    return { body: lines.filter(Boolean).join("\n"), step: "Pulled AirROI comps", thought: "Read from AirROI for the unit in the records. Nothing was sent." };
  }

  // AirROI failed twice: search the web, and say plainly what could not be confirmed.
  const web = await answerWebQuestion(`Nightly rates for ${size.bedrooms}-bedroom short-term rentals at ${unit.address || name} and nearby${dates ? ` for ${dates}` : ""}`, now);
  const confirmed = !/couldn't confirm/i.test(web.body);
  const lines = [
    lead,
    confirmed
      ? `AirROI didn't return comps (tried twice), so this is from web search: ${web.body}`
      : `AirROI didn't return comps (tried twice), and web search couldn't confirm nightly rates for ${name} or the buildings around it.`,
    confirmed ? "Not confirmed: AirROI's comp set and trailing figures for this unit size." : "Not confirmed: market nightly rates for this unit size. Ask again shortly and I'll retry AirROI.",
    caveat,
  ];
  return { body: lines.filter(Boolean).join("\n"), step: "AirROI failed; searched the web", thought: "Nothing was sent." };
}
