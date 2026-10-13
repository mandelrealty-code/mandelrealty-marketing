/**
 * "Is there any day all four units are empty?" and "When is Roseglor free next month?"
 * Nights come from overlappingStays, so a stay that began before the window still blocks its nights.
 * A day before today is never offered. A failed read is never read as empty nights.
 */

import { scopedStayProperties, spokenProperty } from "./dayBoard.js";
import { nightsBetween, occupiesDay, occupiesNight, overlappingStays, type OccupyingStay } from "./occupancy.js";
import { addDays, torontoToday } from "./time.js";
import { normalizeMonths } from "./monthWords.js";

const DEFAULT_DAYS = 60;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function asksAvailability(question: string): boolean {
  const text = question.toLowerCase();
  if (/\b(cleaner|cleaners|parking|wifi|wi-fi|elevator|gym|pool)\b/.test(text)) return false;
  const empty = /\b(not booked|unbooked|isn'?t booked|aren'?t booked|no bookings?|nothing booked|empty|vacant|vacanc\w*|available|availability|free|open|unoccupied|unbooked)\b/.test(text);
  const when = /\b(day|days|night|nights|date|dates|when|week|weeks|weekend|weekends|gap|gaps|month)\b/.test(text);
  const place = /\b(unit|units|propert(?:y|ies)|place|places|listing|listings|charlotte|roseglor|blue jays|shaw|all four|all 4|portfolio|calendar)\b/.test(text);
  if (empty && when && place) return true;
  // "If I wanted to visit all four units in one day, when could I?" asks when they're all empty at once.
  const visit = /\b(visit|see|inspect|walk ?through|tour|check on|go (?:to|see)|stop by|drop by)\b/.test(text);
  const together = /\b(all (?:four|4|the units|units|properties|of them)|every unit|each unit|same day|one day|all in one)\b/.test(text);
  return visit && together && /\b(when|which day|what day|could i|can i|able to|possible)\b/.test(text);
}

function wantsAll(question: string): boolean {
  return /\b(all|every|each|both|none of|whole portfolio|four|4)\b/i.test(question) && /\b(unit|units|propert(?:y|ies)|places|listings|portfolio)\b/i.test(question);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthEnd(year: number, month: number): string {
  return iso(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);
}

function monthOf(token: string): number {
  return MONTHS.indexOf(token.slice(0, 3).toLowerCase()) + 1;
}

/** A month named without a year is the next one that hasn't fully passed. */
function yearFor(month: number, today: string): number {
  const [year, current] = today.split("-").map(Number) as [number, number];
  return month < current ? year + 1 : year;
}

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** The nights asked about, as [from, to) with `to` the morning after the last night. */
export function askedWindow(question: string, today: string): { from: string; to: string } {
  // "feburary" is February.
  const text = normalizeMonths(question).toLowerCase();
  const span = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|to|until|through|thru|and)\\s*(?:${MONTH_RE}\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i").exec(text);
  if (span) {
    const m1 = monthOf(span[1] ?? "");
    const m2 = span[3] ? monthOf(span[3]) : m1;
    const y1 = yearFor(m1, today);
    const y2 = m2 < m1 ? y1 + 1 : y1;
    return { from: iso(y1, m1, Number(span[2])), to: addDays(iso(y2, m2, Number(span[4])), 1) };
  }
  const named = [...text.matchAll(new RegExp(`\\b${MONTH_RE}\\b`, "gi"))].map((match) => monthOf(match[1] ?? "")).filter((month) => month > 0);
  if (named.length) {
    const first = named[0] as number;
    const last = named[named.length - 1] as number;
    const y1 = yearFor(first, today);
    const y2 = last < first ? y1 + 1 : y1;
    return { from: iso(y1, first, 1), to: monthEnd(y2, last) };
  }
  const [year, month] = today.split("-").map(Number) as [number, number];
  if (/\bthis month\b/.test(text)) return { from: iso(year, month, 1), to: monthEnd(year, month) };
  if (/\bnext month\b/.test(text)) {
    const next = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return { from: iso(nextYear, next, 1), to: monthEnd(nextYear, next) };
  }
  const ahead = /\bnext (\d{1,3}) (day|days|week|weeks)\b/.exec(text);
  if (ahead) return { from: today, to: addDays(today, Number(ahead[1]) * (ahead[2]?.startsWith("week") ? 7 : 1)) };
  if (/\bnext week\b/.test(text)) return { from: addDays(today, 1), to: addDays(today, 8) };
  if (/\bthis week\b/.test(text)) return { from: today, to: addDays(today, 7) };
  return { from: today, to: addDays(today, DEFAULT_DAYS) };
}

function short(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

function long(day: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** "Nov 8–10, Nov 14" from a sorted list of nights. */
export function nightRanges(days: string[]): string {
  const parts: string[] = [];
  let start = "";
  let prev = "";
  const flush = () => {
    if (!start) return;
    if (start === prev) parts.push(short(start));
    else if (start.slice(0, 7) === prev.slice(0, 7)) parts.push(`${short(start)}–${Number(prev.slice(8))}`);
    else parts.push(`${short(start)}–${short(prev)}`);
  };
  for (const day of days) {
    if (prev && addDays(prev, 1) === day) {
      prev = day;
      continue;
    }
    flush();
    start = day;
    prev = day;
  }
  flush();
  return parts.join(", ");
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export async function answerAvailability(question: string, now = new Date()): Promise<string | null> {
  if (!asksAvailability(question)) return null;
  const today = torontoToday(now);
  const asked = askedWindow(question, today);
  if (asked.to <= today) return `${long(asked.from)} to ${long(addDays(asked.to, -1))} has already passed, so there are no nights left to offer in it.`;
  const from = asked.from < today ? today : asked.from;
  const startsToday = asked.from < today
    ? `The nights before today have passed, so this starts today, ${long(today)}.`
    : "";

  let properties: { id: string; name: string; address: string }[];
  try {
    properties = await scopedStayProperties();
  } catch {
    return "I couldn't read which properties are selected, so I didn't guess which nights are empty.";
  }
  if (!properties.length) return "No properties are selected in the Hospitable connection, so there are no nights to check.";

  const text = question.toLowerCase();
  const named = properties.filter((row) => {
    const label = spokenProperty(row.name, row.address).toLowerCase();
    return label.split(/\s+/).some((word) => word.length >= 4 && !/^(street|way|cres)$/.test(word) && text.includes(word));
  });
  const all = wantsAll(question) || !named.length;
  const scope = all ? properties : named;

  const booked = new Map<string, OccupyingStay[]>();
  const failed: string[] = [];
  for (const row of scope) {
    try {
      booked.set(row.id, await overlappingStays(row.id, from, asked.to));
    } catch {
      failed.push(spokenProperty(row.name, row.address));
    }
  }
  const nights = nightsBetween(from, asked.to);
  // "Any day all four are empty" means no guest at all that day, so arrival and departure days are booked.
  // Nights, or no unit named, means bookable nights: arrival night up to, not including, the departure day.
  const byDay = /\bdays?\b/.test(text) && !/\bnights?\b/.test(text);
  const busy = (stays: OccupyingStay[], day: string) => stays.some((stay) => (byDay ? occupiesDay(stay, day) : occupiesNight(stay, day)));
  const span = byDay ? "days" : "nights";
  const window = `${long(from)} to ${long(addDays(asked.to, -1))}`;
  const lines: string[] = [];
  if (startsToday) lines.push(startsToday);

  if (all && wantsAll(question)) {
    if (failed.length) {
      lines.push(`I couldn't read ${listNames(failed)}, so I can't say which nights all ${scope.length} units are empty.`);
      return lines.join("\n");
    }
    const empty = nights.filter((day) => scope.every((row) => !busy(booked.get(row.id) ?? [], day)));
    const who = scope.length === 4 ? "all four units" : `all ${scope.length} units`;
    lines.push(empty.length
      ? byDay
        ? `From ${window}, ${who} have no guest at all on ${nightRanges(empty)}.`
        : `From ${window}, ${who} are empty on the nights of ${nightRanges(empty)}.`
      : `From ${window}, there is no ${byDay ? "day" : "night"} when ${who} are empty.`);
    lines.push(byDay
      ? `Checked ${listNames(scope.map((row) => spokenProperty(row.name, row.address)))}. A unit counts as booked from a guest's arrival day through their departure day.`
      : `Checked ${listNames(scope.map((row) => spokenProperty(row.name, row.address)))}, counting each stay from its arrival night up to its departure day.`);
    return lines.join("\n");
  }

  for (const row of scope) {
    const label = spokenProperty(row.name, row.address);
    if (failed.includes(label)) {
      lines.push(`${label}: I couldn't read its reservations, so I didn't guess.`);
      continue;
    }
    const free = nights.filter((day) => !busy(booked.get(row.id) ?? [], day));
    lines.push(free.length
      ? byDay ? `${label} has no guest on ${nightRanges(free)}.` : `${label} is open the nights of ${nightRanges(free)}.`
      : `${label} has no open ${byDay ? "day" : "night"} from ${window}.`);
  }
  if (!startsToday) lines.unshift(`Open ${span} from ${window}:`);
  return lines.join("\n");
}
