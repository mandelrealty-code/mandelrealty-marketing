/**
 * Comp pricing for one of our units ("comps for Raj's unit for those dates").
 *
 * The unit comes from the records: a named client resolves through the client list and OPS, never
 * by asking the partner which property their own client owns. Copilot does the work with the tools
 * it has: it states its defaults (same building and neighbourhood, nightly rates) and pulls AirROI
 * comps. It does not ask permission or hand the lookup back. A failed read is retried, then the web
 * is searched, and the answer says what was found and what could not be confirmed.
 */

import { estimateByAddress, type RevenueAuditEstimateResult } from "../airroi.js";
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

type Size = { bedrooms: number; bathrooms: number; guests: number; known: boolean };
type Estimate = (input: { address: string; bedrooms: number; bathrooms: number; guests: number }) => Promise<RevenueAuditEstimateResult>;

let source: Estimate | null = null;

/** Test seam: the parity suite supplies AirROI's answer, or makes it fail. */
export function setCompsSource(next: Estimate | null): void {
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Bedrooms, bathrooms and guests from Hospitable's property record. */
async function sizeOf(hospitableId: string): Promise<Size> {
  try {
    const raw = await hospitableRead("get-properties", {});
    const rows = Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: Record<string, unknown>[] }).data : [];
    const row = rows.find((item) => String(item.id ?? "") === hospitableId) ?? null;
    const capacity = (row?.capacity ?? row?.details ?? row ?? {}) as Record<string, unknown>;
    const bedrooms = num(capacity.bedrooms ?? row?.bedrooms);
    const bathrooms = num(capacity.bathrooms ?? row?.bathrooms);
    const guests = num(capacity.max ?? capacity.max_guests ?? row?.max_guests ?? capacity.guests);
    if (bedrooms) return { bedrooms, bathrooms: bathrooms ?? 1, guests: guests ?? bedrooms * 2, known: true };
  } catch {
    /* The size is stated as assumed below. */
  }
  return { bedrooms: 2, bathrooms: 1, guests: 4, known: false };
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function airroi(input: { address: string; bedrooms: number; bathrooms: number; guests: number }): Promise<RevenueAuditEstimateResult | null> {
  const run: Estimate = source ?? ((args) => estimateByAddress(args));
  if (!source && parityEnabled()) return null;
  // One retry: a single failed read is not the answer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const got = await run(input);
      if (got.adr != null || got.comps.some((comp) => comp.adr != null)) return got;
    } catch {
      /* Try again once. */
    }
  }
  return null;
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

  const market = await airroi({ address: unit.address || name, bedrooms: size.bedrooms, bathrooms: size.bathrooms, guests: size.guests });
  if (market) {
    const rates = market.comps.map((comp) => comp.adr).filter((value): value is number => value != null);
    const typical = market.adr ?? (rates.length ? median(rates) : null);
    const top = [...market.comps].filter((comp) => comp.adr != null).sort((a, b) => (b.annualRevenue ?? 0) - (a.annualRevenue ?? 0)).slice(0, 3);
    const topRates = top.map((comp) => comp.adr!).sort((a, b) => a - b);
    const topRevenue = top.map((comp) => comp.annualRevenue).filter((value): value is number => value != null);
    const lines = [
      lead,
      typical != null ? `Typical nightly rate: about ${money(typical)} (AirROI, trailing 12 months${rates.length ? `, ${rates.length} comparable listings` : ""}).` : "",
      rates.length >= 2 ? `Range across the comps: ${money(Math.min(...rates))} to ${money(Math.max(...rates))} a night.` : "",
      topRates.length ? `Top performers: ${money(topRates[0]!)} to ${money(topRates[topRates.length - 1]!)} a night${topRevenue.length ? `, about ${money(median(topRevenue))} a year in revenue` : ""}.` : "",
      market.occupancy != null ? `Occupancy around ${Math.round(market.occupancy > 1 ? market.occupancy : market.occupancy * 100)}%.` : "",
      caveat,
      `Source: AirROI market data, figures in US dollars, pulled ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" }).format(now)}.`,
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
