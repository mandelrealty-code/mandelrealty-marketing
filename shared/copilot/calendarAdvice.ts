/**
 * "Should we open Raj's calendar for February? Are there dates worth opening for in that area?"
 *
 * Answered the way an Airbnb specialist would, in three parts:
 * what I found (the unit's own calendar and minimum stay, any strategy on record, AirROI comps for
 * its specs in CAD), what is happening in the area (events with dates), and what you should do
 * (one recommendation with its reasoning and trade-off). "Open" dates under a long minimum stay are
 * not open for event nights. The decision stays with the partners; nothing on the calendar changes.
 */

import { callHospitableMcp } from "./hospitableMcp.js";
import { compLines, compSet, money, sizeOf } from "./compsAnswer.js";
import { spokenProperty } from "./dayBoard.js";
import { memoryBodies } from "./memoryFiles.js";
import { monthIn, MONTH_NAMES } from "./monthWords.js";
import { nightsBetween, occupiesNight, overlappingStays, type OccupyingStay } from "./occupancy.js";
import { REPORT_CLIENTS, clientNamed } from "./reportClients.js";
import { managedReportProperties, mentionsProperty } from "./reportFigures.js";
import { addDays, torontoToday } from "./time.js";
import { answerWebQuestion } from "./webAnswer.js";

const OPEN_CALENDAR = /\b(open (?:up )?(?:[a-z]+'?s? )?(?:\([^)]*\) )?calendar|open (?:up )?(?:the |those |these )?(?:dates|nights)|unblock|worth (?:it )?(?:to )?open|should (?:we|i) open|open (?:it|them) (?:up )?for)\b/i;

/** Toronto: an entire-home short-term rental may be rented under 28 nights for at most 180 nights a year. */
const CAP_NIGHTS = 180;
const MONTHLY = 28;

export function asksOpenCalendar(text: string): boolean {
  return OPEN_CALENDAR.test(text);
}

export type CalendarAdvice = { body: string; step: string; thought: string; choices?: string[] };

function short(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** "Feb 12–14, Feb 19–21 and Feb 26–28" from nights. */
function ranges(days: string[]): string {
  const parts: string[] = [];
  let start = "";
  let prev = "";
  const flush = () => {
    if (start) parts.push(start === prev ? short(start) : `${short(start)}–${Number(prev.slice(8))}`);
  };
  for (const day of [...new Set(days)].sort()) {
    if (prev && addDays(prev, 1) === day && day.slice(0, 7) === prev.slice(0, 7)) {
      prev = day;
      continue;
    }
    flush();
    start = day;
    prev = day;
  }
  flush();
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The nights of the asked month named in the events answer: "Feb 12, 13, 14…" or "February 12–21". */
function eventNights(text: string, year: number, month: number): string[] {
  const name = MONTH_NAMES[month - 1]!;
  const days = new Set<number>();
  const pattern = new RegExp(`\\b${name.slice(0, 3)}[a-z]*\\.?\\s+((?:\\d{1,2}(?!\\d)(?:\\s*[–-]\\s*\\d{1,2}(?!\\d))?(?:,\\s*|,?\\s+and\\s+|\\s+&\\s+)?)+)`, "gi");
  for (const match of text.matchAll(pattern)) {
    for (const part of match[1]!.split(/,|\band\b|&/)) {
      const span = /(\d{1,2})\s*[–-]\s*(\d{1,2})/.exec(part);
      if (span) for (let day = Number(span[1]); day <= Number(span[2]); day += 1) days.add(day);
      else if (/\d/.test(part)) days.add(Number(part.trim()));
    }
  }
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [...days].filter((day) => day >= 1 && day <= last).map((day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

export type Night = { date: string; available: boolean; minStay: number; priceCents: number | null };

/** Each night from Hospitable's calendar: open or not, its minimum stay, and its listed price. */
export async function calendarNights(propertyId: string, from: string, to: string): Promise<Night[] | null> {
  try {
    const raw = await callHospitableMcp("get-property-calendar", { uuid: propertyId, start_date: from, end_date: addDays(to, -1) });
    const data = (raw as { data?: unknown })?.data;
    const rows = Array.isArray((data as { days?: unknown })?.days) ? (data as { days: Record<string, unknown>[] }).days : Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    if (!rows.length) return null;
    return rows.map((row) => {
      const status = row.status && typeof row.status === "object" ? (row.status as Record<string, unknown>) : { reason: row.status };
      const reason = String(status.reason ?? "").toLowerCase();
      const flag = status.available ?? row.available;
      const available = flag !== false && String(flag) !== "false" && !/unavailable|booked|blocked|reserved/.test(reason);
      const minStay = Number(row.min_stay ?? row.min_nights ?? row.minimum_stay ?? 1);
      const price = row.price && typeof row.price === "object" ? Number((row.price as Record<string, unknown>).amount) : Number(row.price);
      return { date: String(row.date ?? "").slice(0, 10), available, minStay: Number.isFinite(minStay) && minStay > 0 ? minStay : 1, priceCents: Number.isFinite(price) && price > 0 ? price : null };
    }).filter((row) => row.date >= from && row.date < to);
  } catch {
    return null;
  }
}

/** A standing note on record for this unit about its minimum stay or pricing strategy. */
async function strategyNote(words: string[]): Promise<string> {
  try {
    for (const file of await memoryBodies()) {
      for (const line of file.body.split(/\n+/)) {
        const lower = line.toLowerCase();
        if (!words.some((word) => lower.includes(word))) continue;
        if (/\b(minimum|min(?:imum)? stay|night minimum|monthly|28[- ]night|strategy|pricing)\b/i.test(line)) return line.replace(/^[-*\s]+/, "").trim();
      }
    }
  } catch {
    /* No note is not a failure. */
  }
  return "";
}

/** Nights in stays under 28 nights this unit already has in the calendar year. They count toward the cap. */
async function shortStayNights(propertyId: string, year: number): Promise<number | null> {
  try {
    const stays = await overlappingStays(propertyId, `${year}-01-01`, `${year + 1}-01-01`);
    let nights = 0;
    for (const stay of stays) {
      const all = nightsBetween(stay.checkIn, stay.checkOut);
      if (all.length >= MONTHLY) continue;
      nights += all.filter((day) => day.startsWith(String(year))).length;
    }
    return nights;
  } catch {
    return null;
  }
}

export async function answerOpenCalendar(text: string, history: { role: string; body: string }[], now = new Date()): Promise<CalendarAdvice | null> {
  if (!asksOpenCalendar(text)) return null;
  let properties: Awaited<ReturnType<typeof managedReportProperties>>;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "OPS didn't return the properties, so I couldn't tell which calendar you mean. Nothing was changed.", step: "OPS didn't answer", thought: "Nothing was changed." };
  }
  const resolve = (blob: string) => {
    const client = clientNamed(blob);
    const named = properties.filter((row) => mentionsProperty(blob, row));
    const owned = client ? properties.filter((row) => client.match.test(`${row.name} ${row.address}`)) : [];
    return { client, unit: named[0] ?? owned[0] ?? null };
  };
  let found = resolve(text);
  if (!found.unit) found = resolve(history.slice(-6).map((turn) => turn.body).join(" "));
  const unit = found.unit;
  if (!unit) {
    return { body: "Which unit's calendar?", choices: properties.map((row) => spokenProperty(row.name, row.address)), step: "Asked which unit", thought: "No unit or client was named. Nothing was changed." };
  }
  const spoken = spokenProperty(unit.name, unit.address);
  const unitNo = /^(\d{2,4}),/.exec(unit.address.trim())?.[1] ?? "";
  const name = unitNo && !spoken.includes(unitNo) ? `${spoken} Unit ${unitNo}` : spoken;
  const owner = found.client ?? REPORT_CLIENTS.find((client) => client.match.test(`${unit.name} ${unit.address}`)) ?? null;
  const whose = owner ? `${owner.short}'s` : "The";
  const hospitableId = unit.hospitable_property_id || unit.id;

  // The asked month (the next one that hasn't passed), or the next 60 days.
  const today = torontoToday(now);
  const [year, current] = today.split("-").map(Number) as [number, number];
  const month = monthIn(text);
  const monthYear = month ? (month < current ? year + 1 : year) : year;
  const from = month ? `${monthYear}-${String(month).padStart(2, "0")}-01` : today;
  const to = month ? (month === 12 ? `${monthYear + 1}-01-01` : `${monthYear}-${String(month + 1).padStart(2, "0")}-01`) : addDays(today, 60);
  const monthName = month ? `${MONTH_NAMES[month - 1]![0]!.toUpperCase()}${MONTH_NAMES[month - 1]!.slice(1)}` : "";
  const label = month ? `${monthName} ${monthYear}` : "the next 60 days";
  const nights = nightsBetween(from < today ? today : from, to);

  let stays: OccupyingStay[] | null = null;
  try {
    stays = await overlappingStays(hospitableId, from, to);
  } catch {
    stays = null;
  }
  const calendar = await calendarNights(hospitableId, from, to);
  const booked = stays ? nights.filter((day) => stays!.some((stay) => occupiesNight(stay, day))) : [];
  const byDate = new Map((calendar ?? []).map((night) => [night.date, night]));
  const closed = calendar ? nights.filter((day) => !booked.includes(day) && !byDate.get(day)?.available) : [];
  const open = calendar ? nights.filter((day) => byDate.get(day)?.available && !booked.includes(day)) : [];
  const words = [spoken.toLowerCase(), ...(owner ? [owner.short.toLowerCase()] : []), ...(unit.address.toLowerCase().match(/blue jays|charlotte|shaw|roseglor/) ?? [])];
  const note = await strategyNote(words);

  // What is happening around the building that month.
  const area = /blue jays|rogers centre/i.test(`${unit.name} ${unit.address}`) ? "Rogers Centre, Scotiabank Arena and the Metro Toronto Convention Centre" : `the area around ${unit.address || name}`;
  const events = await answerWebQuestion(`Concerts, sports, conventions and major events at ${area} in Toronto in ${label}. One short line per event with its exact dates, then the sources.`, now);
  const eventFound = !/couldn't confirm/i.test(events.body);
  const demand = eventFound && month ? [...new Set(eventNights(events.body, monthYear, month))].filter((day) => nights.includes(day)).sort() : [];
  const demandStay = demand.length ? Math.max(...demand.map((day) => byDate.get(day)?.minStay ?? 1)) : Math.max(1, ...[...byDate.values()].map((night) => night.minStay));

  // What comparable units get.
  const size = await sizeOf(hospitableId);
  const comps = await compSet(unit.address || name, size);

  // 1. What I found.
  const found1: string[] = [];
  if (comps) found1.push(`AirROI comps for units like ${whose === "The" ? "this one" : `${owner!.short}'s`} (${comps.specs}, same building and neighbourhood): ${compLines(comps).join(" ")}`);
  else if (!size.known) found1.push(`I couldn't confirm how many guests ${name} sleeps from its Airbnb listing or Hospitable, so I didn't pull comps for a guessed size.`);
  else found1.push(`AirROI didn't return comps for ${name} (tried twice), so the pricing below isn't benchmarked.`);
  if (calendar) {
    const minNote = demandStay > 1 ? `, with a ${demandStay}-night minimum stay${demand.length ? " on the event nights" : ""}` : "";
    found1.push(`${whose} ${label} at ${name}: ${open.length} of ${nights.length} nights open, ${booked.length} booked, ${closed.length} closed${minNote}.`);
  } else {
    found1.push(`I couldn't read ${whose.toLowerCase() === "the" ? "the" : `${owner!.short}'s`} calendar from Hospitable, so open nights and the minimum stay aren't confirmed.`);
  }
  if (note) found1.push(`Your note for this unit: “${note}”`);

  // 2. What is happening in the area.
  const area2 = eventFound ? events.body : `Web search couldn't confirm events near ${name} for ${label}.`;

  // 3. What you should do.
  const conflict = Boolean(calendar) && demand.length > 0 && demandStay >= 7;
  const premium = comps ? `${money(comps.topLow)} to ${money(comps.topHigh)} ${comps.currency}` : "the top of the market";
  const window = demand.length ? `${short(demand[0]!)} to ${short(addDays(demand[demand.length - 1]!, 1))}` : "";
  const capUsed = conflict || (demand.length && demandStay < MONTHLY) ? await shortStayNights(hospitableId, monthYear) : null;
  const capLine = `stays under 28 nights count toward Toronto's ${CAP_NIGHTS}-night cap for this unit and 28+ night stays don't${capUsed != null ? `, and ${owner ? `${owner.short}'s unit` : "it"} already has ${capUsed} short-stay nights booked in ${monthYear}` : ""}, so decide how much of the ${monthYear} cap to spend here`;
  const eventValue = comps && demand.length ? ` ${demand.length} event nights at ${money(comps.topLow)} is about ${money(demand.length * comps.topLow)} ${comps.currency} on their own.` : "";
  let advice = "";
  if (!calendar) {
    advice = demand.length
      ? `The event nights (${ranges(demand)}) are the ones worth selling, at ${premium}. Check the calendar and minimum stay for ${window} first; I couldn't read them.`
      : "Without the calendar I can't say what to open. Nothing nearby stood out for a premium.";
  } else if (conflict) {
    advice = [
      `Open ${window} for short stays: lower the minimum from ${demandStay} nights to 2 or 3 for those dates and price the event nights (${ranges(demand)}) at ${premium}, the top-earner range.`,
      `Why: with a ${demandStay}-night minimum, ${open.length ? "the calendar being open" : "opening the calendar"} only lets one monthly booking land, so none of those event nights can sell on their own.${eventValue}`,
      `Keep the ${demandStay}-night minimum for the rest of ${monthName || "the period"}${note ? ", as your note says" : ""}.`,
      `Trade-off: ${capLine}.`,
    ].join(" ");
  } else if (demand.length) {
    const closedDemand = demand.filter((day) => closed.includes(day));
    advice = closedDemand.length
      ? `Open ${ranges(closedDemand)} and price the event nights at ${premium}; the ${demandStay}-night minimum already lets them sell one by one.`
      : `Keep it open and price the event nights (${ranges(demand)}) at ${premium}; the ${demandStay}-night minimum already lets them sell one by one.`;
  } else {
    advice = closed.length
      ? `Nothing nearby justifies a premium. Open the ${closed.length} closed nights only if you want regular bookings${comps ? ` at about ${money(comps.median)} ${comps.currency}` : ""}.`
      : `It's already open and nothing nearby justifies a premium; keep pricing near ${comps ? `${money(comps.median)} ${comps.currency}` : "the market median"}.`;
  }
  const decision = owner ? `Your call and ${owner.short}'s. Nothing on the calendar was changed.` : "Your call. Nothing on the calendar was changed.";
  const body = [
    "What I found:",
    ...found1,
    "",
    "What's happening in the area:",
    area2,
    "",
    "What you should do:",
    advice,
    decision,
  ].join("\n");
  return { body, step: "Read the calendar, comps and nearby events", thought: "Read from Hospitable, AirROI and web search. Nothing was changed." };
}
