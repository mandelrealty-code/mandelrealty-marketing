/**
 * Revenue, earnings and take-home questions ("How much did we make last weekend across all four
 * units?", "What did Charlotte make in September, and what did Nance actually take home?").
 *
 * Answered from the same figures as the reports: Hospitable reservation financials and the billing
 * terms in OPS, reconciled. Never from the Knowledge Hub, and never "the figures don't exist".
 * A failed read is retried once; when one unit still fails, the others are answered and the gap named.
 */

import { spokenProperty } from "./dayBoard.js";
import { hostMoney } from "./ops.js";
import { normalizeMonths } from "./monthWords.js";
import { clientNamed, REPORT_CLIENTS } from "./reportClients.js";
import { buildPortfolio, managedReportProperties, mentionsProperty, type PropertyFigures } from "./reportFigures.js";
import { asksPropertyReport, periodOf, type ReportBlocks, type ReportPeriod } from "./reportParse.js";
import { addDays, torontoToday } from "./time.js";
import { asksPayoutSplit } from "./route.js";

const EARN = /\b(make|made|making|earn|earned|earning|bring in|brought in|gross|grossed|take home|took home|take-home|net|netted|clear|cleared|payout|paid out|revenue|income|earnings)\b/i;
const ASK = /\b(how much|what|what's|whats|did|show me|tell me)\b/i;

export function asksMoney(text: string): boolean {
  if (!EARN.test(text) || !ASK.test(text)) return false;
  // Reports, comps, stay payouts and the money-move question have their own answers.
  if (asksPropertyReport(text) || /\b(comps?|nightly rates?|market rates?|pricing)\b/i.test(text)) return false;
  if (/\b(stays?|reservations?|bookings?|guests?|how many|HM[A-Z0-9]{6,})\b/i.test(text)) return false;
  if (/\bmore money\b|\bone thing\b|\bwhat should (?:we|i) do\b/i.test(text)) return false;
  // Forward-looking money ("how much will we make…") and the owner/MRG split are the payout answer's.
  if (asksPayoutSplit(text) || /\b(will|going to|projected|expect(?:ed)?|forecast)\b/i.test(text)) return false;
  return true;
}

function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function words(day: string, withWeekday = false): string {
  return new Intl.DateTimeFormat("en-US", { ...(withWeekday ? { weekday: "short" } : {}), month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(",", "");
}

/** The asked period. "Last weekend" is the most recent Friday to Sunday before today. */
export function moneyPeriod(text: string, now: Date): ReportPeriod & { said: string } {
  const today = torontoToday(now);
  const asked = text.toLowerCase();
  const span = (start: string, end: string, label: string, said: string) => ({ start, end, label, kind: "range" as const, said });
  if (/\blast weekend\b/.test(asked)) {
    let sunday = addDays(today, -1);
    while (weekday(sunday) !== 0) sunday = addDays(sunday, -1);
    const friday = addDays(sunday, -2);
    return span(friday, sunday, "last weekend", `last weekend (${words(friday, true)} to ${words(sunday, true)})`);
  }
  if (/\bthis weekend\b/.test(asked)) {
    let friday = today;
    while (weekday(friday) !== 5) friday = addDays(friday, weekday(friday) === 6 || weekday(friday) === 0 ? -1 : 1);
    return span(friday, addDays(friday, 2), "this weekend", `this weekend (${words(friday, true)} to ${words(addDays(friday, 2), true)})`);
  }
  if (/\byesterday\b/.test(asked)) return span(addDays(today, -1), addDays(today, -1), "yesterday", `yesterday (${words(addDays(today, -1), true)})`);
  if (/\btoday\b/.test(asked)) return span(today, today, "today", `today (${words(today, true)})`);
  if (/\blast week\b/.test(asked)) {
    let monday = addDays(today, -7);
    while (weekday(monday) !== 1) monday = addDays(monday, -1);
    return span(monday, addDays(monday, 6), "last week", `last week (${words(monday, true)} to ${words(addDays(monday, 6), true)})`);
  }
  if (/\bthis week\b/.test(asked)) {
    let monday = today;
    while (weekday(monday) !== 1) monday = addDays(monday, -1);
    return span(monday, today, "this week", `this week so far (${words(monday, true)} to ${words(today, true)})`);
  }
  const parsed = periodOf(normalizeMonths(text), now);
  if (parsed) {
    const label = parsed.kind === "month" ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${parsed.start}T12:00:00Z`)) : parsed.label;
    return { ...parsed, said: parsed.kind === "month" ? `in ${label}` : `${label} (${words(parsed.start)} to ${words(parsed.end)})` };
  }
  const first = `${today.slice(0, 8)}01`;
  return span(first, today, "this month", `this month so far (${words(first)} to ${words(today)}), since no period was named`);
}

const BLOCKS: ReportBlocks = { headline: true, byProperty: false, detail: false, mrg: false, issues: false, reviews: false, recommendations: false };

type Figures = { name: string; gross: number; mrg: number | null; owner: number | null; nights: number; stays: number; gap: string };

async function figuresFor(properties: Awaited<ReturnType<typeof managedReportProperties>>, period: ReportPeriod, text: string, now: Date): Promise<{ rows: Figures[]; failed: string[]; mismatch: string }> {
  const toRow = (row: PropertyFigures): Figures => ({ name: spokenProperty(row.name, row.address), gross: row.gross, mrg: row.mrg, owner: row.owner, nights: row.nights, stays: row.stays, gap: row.gap || "" });
  // Once for all of them, then once more; after that, unit by unit so one bad read doesn't sink the rest.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { portfolio, failures } = await buildPortfolio({ properties, period, audience: "internal", blocks: BLOCKS, request: text, now });
      return { rows: portfolio.properties.map(toRow), failed: [], mismatch: failures.length ? failures.map((failure) => failure.figure).join(", ") : "" };
    } catch {
      /* Try again, then unit by unit. */
    }
  }
  const rows: Figures[] = [];
  const failed: string[] = [];
  for (const property of properties) {
    try {
      const { portfolio } = await buildPortfolio({ properties: [property], period, audience: "internal", blocks: BLOCKS, request: text, now });
      rows.push(...portfolio.properties.map(toRow));
    } catch {
      failed.push(spokenProperty(property.name, property.address));
    }
  }
  return { rows, failed, mismatch: "" };
}

function sum(values: (number | null)[]): number | null {
  return values.some((value) => value == null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export async function answerMoney(text: string, now = new Date()): Promise<{ body: string; step: string; thought: string } | null> {
  if (!asksMoney(text)) return null;
  let properties: Awaited<ReturnType<typeof managedReportProperties>>;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "OPS didn't return the properties, so I couldn't add up revenue. Ask again and I'll retry.", step: "OPS didn't answer", thought: "Nothing was sent." };
  }
  const client = clientNamed(text);
  const named = properties.filter((row) => mentionsProperty(text, row));
  const owned = client ? properties.filter((row) => client.match.test(`${row.name} ${row.address}`)) : [];
  const all = /\b(all (?:four|4|the units|units|properties)|across|portfolio|every unit|total)\b/i.test(text);
  const scope = all || (!named.length && !owned.length) ? properties : [...new Map([...named, ...owned].map((row) => [row.id, row])).values()];
  const period = moneyPeriod(text, now);
  const { rows, failed, mismatch } = await figuresFor(scope, period, text, now);
  if (!rows.length) {
    return { body: `I couldn't read the reservation financials for ${failed.join(", ") || "those units"} ${period.said}, after two tries. Nothing was estimated; ask again and I'll retry.`, step: "The financials didn't return", thought: "Nothing was sent." };
  }
  const takeHome = /\b(take home|took home|take-home|owner|net to|actually (?:get|got|make|made))\b/i.test(text);
  const lines: string[] = [];
  const totalGross = rows.reduce((total, row) => total + row.gross, 0);
  const totalMrg = sum(rows.map((row) => row.mrg));
  const totalOwner = sum(rows.map((row) => row.owner));
  const nights = rows.reduce((total, row) => total + row.nights, 0);
  if (rows.length === 1) {
    const row = rows[0]!;
    const owner = REPORT_CLIENTS.find((item) => item.property === row.name) ?? client;
    lines.push(`${row.name} ${period.said}: host revenue ${hostMoney(row.gross)} from ${row.stays} stay${row.stays === 1 ? "" : "s"} (${row.nights} nights).`);
    if (row.owner != null && row.mrg != null) {
      lines.push(takeHome
        ? `${owner ? `${owner.short}'s take-home` : "The owner's take-home"} (owner share) is ${hostMoney(row.owner)}; MRG's share is ${hostMoney(row.mrg)}.`
        : `MRG's share is ${hostMoney(row.mrg)}; the owner's share is ${hostMoney(row.owner)}.`);
    } else lines.push(row.gap || `Billing terms aren't saved for ${row.name} in OPS, so the owner and MRG shares aren't shown.`);
  } else {
    const head = totalMrg != null
      ? `${period.said[0]!.toUpperCase()}${period.said.slice(1)}, across ${rows.length === properties.length ? `all ${rows.length} units` : `${rows.length} units`}: MRG made ${hostMoney(totalMrg)} on ${hostMoney(totalGross)} of host revenue${totalOwner != null ? `, and the owners' share was ${hostMoney(totalOwner)}` : ""} (${nights} nights).`
      : `${period.said[0]!.toUpperCase()}${period.said.slice(1)}, across ${rows.length} units: host revenue ${hostMoney(totalGross)} (${nights} nights). MRG's share isn't totalled because billing terms are missing for ${rows.filter((row) => row.mrg == null).map((row) => row.name).join(", ")}.`;
    lines.push(head);
    lines.push(`By unit: ${rows.map((row) => `${row.name} ${hostMoney(row.gross)}${row.mrg != null ? ` (MRG ${hostMoney(row.mrg)})` : ""}`).join("; ")}.`);
  }
  if (failed.length) lines.push(`Not included: ${failed.join(", ")}, whose financials didn't return after two tries.`);
  if (mismatch) lines.push(`Check before relying on this: ${mismatch} didn't reconcile across the units.`);
  lines.push("From Hospitable reservation financials and the billing terms in OPS; a stay crossing the period counts by its nights inside it.");
  return { body: lines.join("\n"), step: "Added up the reservation financials", thought: "Computed from Hospitable financials and OPS terms. Nothing was sent." };
}
