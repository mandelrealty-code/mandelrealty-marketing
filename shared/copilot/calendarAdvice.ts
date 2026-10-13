/**
 * "Should we open Raj's calendar for February? Are there dates worth opening for in that area?"
 *
 * Answered as the decision it is: the month's nights at that unit (booked, open, closed on the
 * calendar), what is on near the building those nights (web search), what comparable units get
 * (AirROI), and which closed nights are worth opening. Nothing on the calendar is changed.
 */

import { callHospitableMcp } from "./hospitableMcp.js";
import { airroi, median, money, sizeOf } from "./compsAnswer.js";
import { spokenProperty } from "./dayBoard.js";
import { monthIn, MONTH_NAMES } from "./monthWords.js";
import { nightsBetween, occupiesNight, overlappingStays, type OccupyingStay } from "./occupancy.js";
import { REPORT_CLIENTS, clientNamed } from "./reportClients.js";
import { managedReportProperties, mentionsProperty } from "./reportFigures.js";
import { addDays, torontoToday } from "./time.js";
import { answerWebQuestion } from "./webAnswer.js";

const OPEN_CALENDAR = /\b(open (?:up )?(?:[a-z]+'?s? )?calendar|open (?:up )?(?:the |those |these )?(?:dates|nights)|unblock|worth (?:it )?(?:to )?open|should (?:we|i) open|open (?:it|them) (?:up )?for)\b/i;

export function asksOpenCalendar(text: string): boolean {
  return OPEN_CALENDAR.test(text);
}

export type CalendarAdvice = { body: string; step: string; thought: string; choices?: string[] };

function short(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** "Feb 12–14, Feb 19–21" from sorted nights. */
function ranges(days: string[]): string {
  const parts: string[] = [];
  let start = "";
  let prev = "";
  const flush = () => {
    if (!start) return;
    parts.push(start === prev ? short(start) : `${short(start)}–${Number(prev.slice(8))}`);
  };
  for (const day of [...days].sort()) {
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

/** The nights of the asked month in the web answer: "Feb 12, 13, 14, 19…" or "February 12–14". */
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

type Night = { date: string; available: boolean };

async function calendarNights(propertyId: string, from: string, to: string): Promise<Night[] | null> {
  try {
    const raw = await callHospitableMcp("get-property-calendar", { uuid: propertyId, start_date: from, end_date: addDays(to, -1) });
    const data = (raw as { data?: unknown })?.data;
    const rows = Array.isArray((data as { days?: unknown })?.days) ? (data as { days: Record<string, unknown>[] }).days : Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    if (!rows.length) return null;
    return rows.map((row) => {
      const status = String(row.status ?? "").toLowerCase();
      const status2 = row.status && typeof row.status === "object" ? String((row.status as Record<string, unknown>).available ?? "") : "";
      return { date: String(row.date ?? "").slice(0, 10), available: row.available !== false && status !== "unavailable" && status !== "booked" && status !== "blocked" && status2 !== "false" };
    }).filter((row) => row.date >= from && row.date < to);
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
    return {
      body: "Which unit's calendar?",
      choices: properties.map((row) => spokenProperty(row.name, row.address)),
      step: "Asked which unit",
      thought: "No unit or client was named. Nothing was changed.",
    };
  }
  const spoken = spokenProperty(unit.name, unit.address);
  const unitNo = /^(\d{2,4}),/.exec(unit.address.trim())?.[1] ?? "";
  const name = unitNo && !spoken.includes(unitNo) ? `${spoken} Unit ${unitNo}` : spoken;
  const owner = found.client ?? REPORT_CLIENTS.find((client) => client.match.test(`${unit.name} ${unit.address}`)) ?? null;
  const hospitableId = unit.hospitable_property_id || unit.id;

  // The asked month (the next one that hasn't passed), or the next 60 days.
  const today = torontoToday(now);
  const [year, current] = today.split("-").map(Number) as [number, number];
  const month = monthIn(text);
  const monthYear = month ? (month < current ? year + 1 : year) : 0;
  const from = month ? `${monthYear}-${String(month).padStart(2, "0")}-01` : today;
  const to = month ? (month === 12 ? `${monthYear + 1}-01-01` : `${monthYear}-${String(month + 1).padStart(2, "0")}-01`) : addDays(today, 60);
  const label = month ? `${MONTH_NAMES[month - 1]![0]!.toUpperCase()}${MONTH_NAMES[month - 1]!.slice(1)} ${monthYear}` : `The next 60 days`;
  const nights = nightsBetween(from < today ? today : from, to);

  let stays: OccupyingStay[] | null = null;
  try {
    stays = await overlappingStays(hospitableId, from, to);
  } catch {
    stays = null;
  }
  const calendar = await calendarNights(hospitableId, from, to);
  const booked = stays ? nights.filter((day) => stays!.some((stay) => occupiesNight(stay, day))) : [];
  const calendarOpen = new Set((calendar ?? []).filter((night) => night.available).map((night) => night.date));
  const closed = calendar ? nights.filter((day) => !booked.includes(day) && !calendarOpen.has(day)) : [];
  const open = calendar ? nights.filter((day) => calendarOpen.has(day) && !booked.includes(day)) : [];

  const lines: string[] = [];
  const whose = owner ? ` (${owner.short})` : "";
  if (!calendar) {
    lines.push(`${label} at ${name}${whose}: I couldn't read the calendar from Hospitable, so I can't say which nights are closed.${stays ? ` ${booked.length} of ${nights.length} nights are booked.` : ""}`);
  } else {
    const parts = [`${closed.length} of ${nights.length} nights are closed on the calendar`, `${booked.length} booked`, `${open.length} open`];
    lines.push(`${label} at ${name}${whose}: ${parts.join(", ")}.`);
  }

  // What is on near the building those nights.
  const area = /blue jays|rogers centre/i.test(`${unit.name} ${unit.address}`) ? "Rogers Centre, Scotiabank Arena and the Metro Toronto Convention Centre" : `the area around ${unit.address || name}`;
  const events = await answerWebQuestion(`Concerts, sports, conventions and major events at ${area} in Toronto in ${label}, with exact dates`, now);
  const eventFound = !/couldn't confirm/i.test(events.body);
  const demand = eventFound && month ? eventNights(events.body, monthYear, month) : [];
  if (eventFound) lines.push(`What's on nearby: ${events.body}`);
  else lines.push(`What's on nearby: web search couldn't confirm events near ${name} for ${label}.`);

  // What comparable units get.
  const size = await sizeOf(hospitableId);
  const market = await airroi({ address: unit.address || name, bedrooms: size.bedrooms, bathrooms: size.bathrooms, guests: size.guests });
  const rates = market ? market.comps.map((comp) => comp.adr).filter((value): value is number => value != null) : [];
  const typical = market?.adr ?? (rates.length ? median(rates) : null);
  const top = market ? [...market.comps].filter((comp) => comp.adr != null).sort((a, b) => (b.annualRevenue ?? 0) - (a.annualRevenue ?? 0)).slice(0, 3).map((comp) => comp.adr!).sort((a, b) => a - b) : [];
  if (typical != null) lines.push(`Comps: about ${money(typical)} a night typical${top.length ? `, ${money(top[0]!)} to ${money(top[top.length - 1]!)} for the top performers` : ""} (AirROI, trailing 12 months, US$).`);
  else lines.push("Comps: AirROI didn't return figures for this unit (tried twice).");

  // The decision.
  const worth = demand.filter((day) => closed.includes(day));
  if (calendar && !closed.length) {
    lines.push(`Recommendation: the calendar is already open for ${label}; nothing to unblock.`);
  } else if (worth.length) {
    const rest = closed.filter((day) => !worth.includes(day));
    lines.push(`Recommendation: open ${ranges(worth)}, the event nights, priced${top.length ? ` toward ${money(top[0]!)}–${money(top[top.length - 1]!)}` : " at the top of the market"}.${rest.length ? ` The other ${rest.length} closed nights have no event I could find; open them only if you want regular bookings${typical != null ? ` at about ${money(typical)}` : ""}.` : ""}`);
  } else if (calendar && closed.length) {
    lines.push(`Recommendation: I found no event that makes the closed nights worth opening at a premium.${typical != null ? ` Opening them would compete at about ${money(typical)} a night.` : ""}`);
  }
  lines.push("Nothing on the calendar was changed.");
  return { body: lines.join("\n"), step: "Read the calendar, nearby events and comps", thought: "Read from Hospitable, web search, and AirROI. Nothing was changed." };
}
