/**
 * Today's plan, the week's cleans, and Overview turnovers share this list.
 * A cancelled reservation is never an arrival, a departure, or a turnover.
 * A turnover is one property on one date.
 */

import { readCleanerUnit } from "./cleanerRead.js";
import { copilotKeepsProperty, hospitableRead } from "./hospitableConnection.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { addDays, torontoToday } from "./time.js";
import { torontoWeekday } from "./skillSchedule.js";

const DEAD = /cancel|declin|denied|expired|not_possible|withdrawn|inquiry/i;

const WEEK_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export type StayMove = { guest: string; property: string; propertyId: string; date: string };

export type TurnoverRow = {
  propertyId: string;
  property: string;
  date: string;
  when: string;
  guest: string;
  assigned: boolean;
};

export type PeriodBoard = {
  arrivals: StayMove[];
  departures: StayMove[];
  turnovers: TurnoverRow[];
};

type Loaded = { ok: true; board: PeriodBoard } | { ok: false; error: string };

type RawStay = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: string;
  propertyId: string;
};

function weekIndex(now: Date): number {
  return WEEK_INDEX[torontoWeekday(now)] ?? 1;
}

/** Monday through Sunday, Toronto, for the week that contains `now`. */
export function weekContaining(now: Date): { start: string; end: string } {
  const today = torontoToday(now);
  const [year, month, day] = today.split("-").map(Number);
  const index = weekIndex(now);
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - (index === 0 ? 6 : index - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function longDate(iso: string): string {
  const [year, month, dayNum] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !dayNum) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, dayNum)));
}

function spokenProperty(name: string, address: string): string {
  const place = `${name} ${address}`;
  if (/blue jays/i.test(place)) return "20 Blue Jays Way";
  if (/roseglor|spacious/i.test(place)) return "41 Roseglor Cres";
  if (/charlotte/i.test(place) && /\b606\b/.test(place)) return "8 Charlotte 606";
  if (/\bshaw\b/i.test(place)) return "1065 Shaw Street";
  return name;
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data ?? raw;
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toStay(row: Record<string, unknown>, propertyId: string): RawStay | null {
  const guest = row.guest && typeof row.guest === "object" ? (row.guest as Record<string, unknown>) : {};
  const id = text(row.id);
  const checkIn = (text(row.arrival_date) || text(row.check_in)).slice(0, 10);
  const checkOut = (text(row.departure_date) || text(row.check_out)).slice(0, 10);
  if (!id || !checkIn || !checkOut) return null;
  const first = text(guest.first_name).trim();
  return {
    id,
    status: text(row.status).toLowerCase(),
    checkIn,
    checkOut,
    guest: first || "A guest",
    propertyId: text(row.property_id) || propertyId,
  };
}

async function staysFor(propertyId: string, from: string, to: string): Promise<RawStay[]> {
  const found = new Map<string, RawStay>();
  for (const dateQuery of ["checkin", "checkout"] as const) {
    const raw = await hospitableRead("get-reservations", {
      properties: [propertyId],
      start_date: from,
      end_date: to,
      date_query: dateQuery,
      per_page: 100,
      page: 1,
      include: "guest",
    });
    for (const row of rowsOf(raw)) {
      const stay = toStay(row, propertyId);
      if (stay) found.set(stay.id, stay);
    }
  }
  return [...found.values()];
}

/** Reservations overlapping the period, then one turnover per property and date. */
export async function loadPeriod(from: string, to: string, assignments = false): Promise<Loaded> {
  let properties;
  try {
    properties = await listPmProperties();
  } catch {
    return { ok: false, error: "OPS didn't return the properties." };
  }
  const arrivals: StayMove[] = [];
  const departures: StayMove[] = [];
  const checkoutGuests = new Map<string, { propertyId: string; property: string; date: string; guests: string[] }>();
  for (const property of properties) {
    const propertyId = property.hospitable_property_id || property.id;
    if (!propertyId) continue;
    if (!(await copilotKeepsProperty({ id: propertyId, name: property.name, address: property.address }))) continue;
    const propertyName = spokenProperty(property.name, property.address);
    let stays: RawStay[];
    try {
      stays = await staysFor(propertyId, from, to);
    } catch {
      return { ok: false, error: `The reservation read for ${propertyName} failed.` };
    }
    for (const stay of stays) {
      if (DEAD.test(stay.status)) continue;
      if (stay.checkIn >= from && stay.checkIn <= to) {
        arrivals.push({ guest: stay.guest, property: propertyName, propertyId, date: stay.checkIn });
      }
      if (stay.checkOut >= from && stay.checkOut <= to) {
        departures.push({ guest: stay.guest, property: propertyName, propertyId, date: stay.checkOut });
        const key = `${propertyId}:${stay.checkOut}`;
        const row = checkoutGuests.get(key) ?? { propertyId, property: propertyName, date: stay.checkOut, guests: [] };
        if (!row.guests.includes(stay.guest)) row.guests.push(stay.guest);
        checkoutGuests.set(key, row);
      }
    }
  }
  const turnovers: TurnoverRow[] = [];
  for (const row of checkoutGuests.values()) {
    let assigned = false;
    if (assignments) {
      const picture = await readCleanerUnit({ propertyId: row.propertyId, from, to });
      if (!picture.ok) return { ok: false, error: `The cleaner read for ${row.property} failed.` };
      assigned = picture.turnovers.some((item) => item.scheduledOn === row.date && (item.assigned || item.done));
    }
    turnovers.push({
      propertyId: row.propertyId,
      property: row.property,
      date: row.date,
      when: longDate(row.date),
      guest: row.guests.join(" and "),
      assigned,
    });
  }
  const byName = (a: StayMove, b: StayMove) => a.date.localeCompare(b.date) || a.property.localeCompare(b.property) || a.guest.localeCompare(b.guest);
  arrivals.sort(byName);
  departures.sort(byName);
  turnovers.sort((a, b) => a.date.localeCompare(b.date) || a.property.localeCompare(b.property));
  return { ok: true, board: { arrivals, departures, turnovers } };
}

/** Arrivals the daily plan would list, from a week back through two weeks ahead. */
export async function planArrivals(now = new Date()): Promise<{ ok: true; today: string; arrivals: StayMove[] } | { ok: false; error: string }> {
  const today = torontoToday(now);
  const loaded = await loadPeriod(addDays(today, -7), addDays(today, 14), false);
  if (!loaded.ok) return loaded;
  return { ok: true, today, arrivals: loaded.board.arrivals };
}

/** A guest on those arrivals. A miss is only real after that list comes back. */
export async function findPlanArrival(name: string, now = new Date()): Promise<StayMove | "unread" | null> {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const loaded = await planArrivals(now);
  if (!loaded.ok) return "unread";
  const hits = loaded.arrivals.filter((row) => {
    const guest = row.guest.trim().toLowerCase();
    return guest === needle || guest.startsWith(`${needle} `);
  });
  const today = hits.find((row) => row.date === loaded.today);
  if (today) return today;
  const upcoming = hits.filter((row) => row.date > loaded.today).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming[0]) return upcoming[0];
  return [...hits].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function asksDayPlan(text: string): boolean {
  return /\bplan\b/i.test(text) && /\btoday\b/i.test(text);
}

export function asksWeekCleans(text: string): boolean {
  if (!/\b(cleans?|turnovers?)\b/i.test(text)) return false;
  if (!/\b(assigned|unassigned|cleaner)\b/i.test(text)) return false;
  const namesAPlace = /\b(blue jays|shaw|charlotte|roseglor|scarborough|606|318)\b/i.test(text);
  if (namesAPlace && !/\b(all|week|every|any)\b/i.test(text)) return false;
  return /\b(week|all|every|any)\b/i.test(text);
}

export function turnoverLine(row: TurnoverRow): string {
  return `${row.property} on ${row.when}`;
}

export async function answerDayPlan(question: string, now = new Date()): Promise<string | null> {
  if (!asksDayPlan(question)) return null;
  const today = torontoToday(now);
  const loaded = await loadPeriod(today, today, false);
  if (!loaded.ok) return `I can't read today's plan. ${loaded.error}`;
  const lines = [
    ...loaded.board.arrivals.map((row) => `${row.guest} checks in at ${row.property}.`),
    ...loaded.board.departures.map((row) => `${row.guest} checks out at ${row.property}.`),
  ];
  if (!lines.length) return `Nothing arrives or leaves today, ${longDate(today)}.`;
  return [`${longDate(today)}.`, ...lines].join("\n");
}

export async function answerWeekCleans(question: string, now = new Date()): Promise<string | null> {
  if (!asksWeekCleans(question)) return null;
  const week = weekContaining(now);
  const loaded = await loadPeriod(week.start, week.end, true);
  if (!loaded.ok) return `I can't read this week's cleans. ${loaded.error}`;
  const open = loaded.board.turnovers.filter((row) => !row.assigned);
  if (!open.length) return "Yes. Every clean this week has a cleaner assigned.";
  const noun = open.length === 1 ? "turnover" : "turnovers";
  return [`No. ${open.length} unassigned ${noun}.`, ...open.map(turnoverLine)].join("\n");
}

export async function weekTurnovers(now = new Date()): Promise<TurnoverRow[] | null> {
  const week = weekContaining(now);
  const loaded = await loadPeriod(week.start, week.end, true);
  if (!loaded.ok) return null;
  return loaded.board.turnovers.filter((row) => !row.assigned);
}
