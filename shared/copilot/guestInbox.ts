import { copilotHospitableToken } from "./hospitableConnection.js";
import {
  listHospitableReservations,
  listReservationMessages,
  type HospitableMessageNormalized,
} from "../pm/hospitableClient.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { addDays, torontoToday } from "./time.js";
import { needsGuestReply } from "./guestTranslate.js";
import type { GuestInboxResult, InboxGuest } from "./types.js";

/** Reads Hospitable guest threads. Plain code, no Cursor. It never writes to Hospitable. */

export const DEFAULT_CHECKLIST = ["arrival time", "licence plate", "number of guests"];

const LOOKAHEAD_DAYS = 14;
const TIME_BUDGET_MS = 40_000;
const PARALLEL = 4;

const DEAD = /cancel|declin|denied|expired|not_possible|withdrawn|inquiry/i;

const NUM = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";

/** Each check returns the matching line, or null. Matches mean "may have sent", never "sent". */
const CHECKS: Record<string, (text: string) => string | null> = {
  "arrival time": (text) => {
    const time = /\b(\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}|noon|midnight)\b/i;
    const arrive = /\b(arriv\w*|eta|get (there|in)|be there|land\w*|check(ing)?[- ]?in)\b/i;
    return lineWhere(text, (line) => time.test(line) && arrive.test(line));
  },
  "licence plate": (text) =>
    lineWhere(text, (line) => /\b(licen[cs]e|plates?)\b/i.test(line) || (/\b(car|vehicle|parking)\b/i.test(line) && /\b[A-Z]{2,4}[\s-]?\d{2,4}[A-Z]?\b/.test(line))),
  "number of guests": (text) =>
    lineWhere(
      text,
      (line) =>
        new RegExp(`\\b${NUM}\\s+(guests|people|adults|persons|of us|kids|children|in (our|the) (group|party))\\b`, "i").test(line) ||
        new RegExp(`\\b(we are|we're|there (are|will be))\\s+${NUM}\\b`, "i").test(line) ||
        new RegExp(`\\bparty of\\s+${NUM}\\b`, "i").test(line),
    ),
  id: (text) => lineWhere(text, (line) => /\b(passport|driver'?s licen[cs]e|government id|photo id|\bid\b)/i.test(line)),
};

function lineWhere(text: string, test: (line: string) => boolean): string | null {
  for (const line of text.split(/\n+|(?<=[.!?])\s+/)) {
    const clean = line.trim();
    if (clean && test(clean)) return clip(clean, 120);
  }
  return null;
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}

function checkFor(item: string): ((text: string) => string | null) | null {
  const key = item.trim().toLowerCase();
  if (CHECKS[key]) return CHECKS[key];
  if (/arriv|eta/.test(key)) return CHECKS["arrival time"];
  if (/plate|licen/.test(key)) return CHECKS["licence plate"];
  if (/guest|people|party|headcount/.test(key)) return CHECKS["number of guests"];
  if (/\bid\b|passport/.test(key)) return CHECKS.id;
  return null;
}

function guestName(raw: Record<string, unknown>): string {
  const guest = (raw.guest && typeof raw.guest === "object" ? raw.guest : {}) as Record<string, unknown>;
  const first = String(guest.first_name ?? guest.firstName ?? "").trim();
  if (first) return first;
  const full = String(guest.full_name ?? guest.name ?? "").trim();
  return full.split(/\s+/)[0] || "A guest";
}

async function inParallel<T>(items: T[], deadline: number, work: (item: T) => Promise<void>): Promise<number> {
  let next = 0;
  let done = 0;
  async function lane() {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      await work(item);
      done += 1;
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, lane));
  return done;
}

export type UpcomingStay = {
  reservationId: string;
  guest: string;
  unit: string;
  platform: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
};

async function upcoming(daysAhead: number, now: Date) {
  const pat = await copilotHospitableToken();
  if (!pat) throw new Error("Hospitable is not connected, so nothing was read.");

  const properties = (await listPmProperties()).filter((p) => p.hospitable_property_id);
  if (!properties.length) throw new Error("No properties are linked to Hospitable, so nothing was read.");
  const unitFor = new Map(properties.map((p) => [p.hospitable_property_id, p.name]));

  const today = torontoToday(now);
  const horizon = addDays(today, daysAhead);
  // Hospitable filters this list by checkout, so look a little past the horizon for longer stays.
  const reservations = await listHospitableReservations({
    pat,
    propertyIds: properties.map((p) => p.hospitable_property_id),
    startDate: today,
    endDate: addDays(horizon, 30),
    include: ["guest"],
  });
  const stays = reservations.filter(
    (r) => !DEAD.test(r.status) && r.check_in && r.check_in <= horizon && (!r.check_out || r.check_out >= today),
  );
  return { pat, stays, unitFor, today };
}

/** Stays checked in now or arriving within `daysAhead` days. Read only. */
export async function listStays(daysAhead = LOOKAHEAD_DAYS, now = new Date()): Promise<UpcomingStay[]> {
  const { stays, unitFor } = await upcoming(Math.min(Math.max(daysAhead, 0), 60), now);
  return stays
    .map((stay) => ({
      reservationId: stay.id,
      guest: guestName(stay.raw),
      unit: unitFor.get(stay.property_id) || "a unit",
      platform: stay.platform,
      status: stay.status,
      checkIn: stay.check_in,
      checkOut: stay.check_out,
    }))
    .sort((a, b) => String(a.checkIn ?? "").localeCompare(String(b.checkIn ?? "")));
}

/** One reservation's thread, oldest first. Read only. */
export async function readThread(reservationId: string): Promise<{ from: string; at: string | null; body: string }[]> {
  const pat = await copilotHospitableToken();
  if (!pat) throw new Error("Hospitable is not connected, so nothing was read.");
  const messages = await listReservationMessages(pat, reservationId);
  return messages
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .map((m) => ({ from: m.sender_role, at: m.created_at, body: m.body }));
}

export async function readGuestInbox(checklist: string[], now = new Date()): Promise<GuestInboxResult> {
  const started = Date.now();
  const { pat, stays, unitFor } = await upcoming(LOOKAHEAD_DAYS, now);

  const checks = checklist
    .map((item) => ({ item, test: checkFor(item) }))
    .filter((c): c is { item: string; test: (text: string) => string | null } => Boolean(c.test));

  const waiting: InboxGuest[] = [];
  const unclear: InboxGuest[] = [];
  const details: InboxGuest[] = [];
  let unreadable = 0;

  const read = await inParallel(stays, started + TIME_BUDGET_MS, async (stay) => {
    let messages: HospitableMessageNormalized[];
    try {
      messages = await listReservationMessages(pat, stay.id);
    } catch {
      unreadable += 1;
      return;
    }
    const thread = messages
      .filter((m) => m.sender_role !== "system")
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    if (!thread.length) return;

    const base = {
      reservationId: stay.id,
      guest: guestName(stay.raw),
      unit: unitFor.get(stay.property_id) || "a unit",
      checkIn: stay.check_in,
      checkOut: stay.check_out,
    };
    const last = thread[thread.length - 1];
    const lastGuest = [...thread].reverse().find((m) => m.sender_role === "guest");
    const row: InboxGuest = {
      ...base,
      lastAt: last.created_at,
      snippet: clip((lastGuest ?? last).body, 140),
      found: [],
    };
    if (last.sender_role === "guest" && needsGuestReply((lastGuest ?? last).body)) waiting.push(row);
    else if (last.sender_role === "unknown") unclear.push(row);

    const guestText = thread.filter((m) => m.sender_role === "guest").map((m) => m.body).join("\n");
    const found = checks
      .map((c) => ({ item: c.item, quote: c.test(guestText) }))
      .filter((f): f is { item: string; quote: string } => Boolean(f.quote));
    if (found.length) details.push({ ...row, found });
  });

  const oldestFirst = (a: InboxGuest, b: InboxGuest) => String(a.lastAt ?? "").localeCompare(String(b.lastAt ?? ""));
  waiting.sort(oldestFirst);
  unclear.sort(oldestFirst);
  details.sort((a, b) => String(a.checkIn ?? "").localeCompare(String(b.checkIn ?? "")));

  return {
    read: read - unreadable,
    stays: stays.length,
    unreadable,
    partial: read < stays.length,
    waiting,
    unclear,
    details,
  };
}
