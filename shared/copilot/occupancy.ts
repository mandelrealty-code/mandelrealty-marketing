/**
 * Which nights each property is booked. One read for every surface that asks.
 *
 * A stay occupies every night from its arrival date up to, not including, its departure date.
 * Hospitable filters get-reservations on one date (check-in by default), so a window read alone
 * misses a stay that arrived before the window and is still in it. This reads by check-in from
 * far enough back to catch any stay that overlaps the window, then keeps the ones that overlap.
 */

import { hospitableRead } from "./hospitableConnection.js";
import { addDays } from "./time.js";

/** Longest stay this read can see from its arrival. A year covers monthly and seasonal rentals. */
export const LOOKBACK_DAYS = 365;

export type OccupyingStay = {
  id: string;
  propertyId: string;
  guest: string;
  status: string;
  checkIn: string;
  checkOut: string;
};

const DEAD = /cancel|declin|denied|expired|not_possible|withdrawn|inquiry|request|pending/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data ?? raw;
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
}

function lastPage(raw: unknown): number {
  const meta = raw && typeof raw === "object" ? (raw as { meta?: { last_page?: unknown } }).meta : undefined;
  const last = Number(meta?.last_page);
  return Number.isFinite(last) && last > 0 ? last : 1;
}

function statusOf(row: Record<string, unknown>): string {
  const status = row.reservation_status && typeof row.reservation_status === "object"
    ? (row.reservation_status as Record<string, unknown>)
    : {};
  return (text(row.status) || text(status.current) || text(status.status)).toLowerCase();
}

function guestOf(row: Record<string, unknown>): string {
  const guest = row.guest && typeof row.guest === "object" ? (row.guest as Record<string, unknown>) : {};
  return text(guest.first_name) || text(guest.full_name).split(/\s+/)[0] || "";
}

function propertyOf(row: Record<string, unknown>, fallback: string): string {
  const listed = Array.isArray(row.properties) ? (row.properties[0] as Record<string, unknown> | undefined) : undefined;
  return text(row.property_id) || text(listed?.id) || fallback;
}

/** A booked stay overlaps [from, to) when it arrives before `to` and leaves after `from`. */
export function overlaps(stay: { checkIn: string; checkOut: string }, from: string, to: string): boolean {
  return Boolean(stay.checkIn && stay.checkOut) && stay.checkIn < to && stay.checkOut > from;
}

/** True when the stay occupies the night of `day`: arrival on or before it, departure after it. */
export function occupiesNight(stay: { checkIn: string; checkOut: string }, day: string): boolean {
  return stay.checkIn <= day && day < stay.checkOut;
}

/**
 * Booked stays at one property that overlap the nights [from, to).
 * Throws when Hospitable does not answer, so a caller never reads a failed read as empty nights.
 */
export async function overlappingStays(propertyId: string, from: string, to: string): Promise<OccupyingStay[]> {
  const found = new Map<string, OccupyingStay>();
  for (let page = 1; page <= 10; page += 1) {
    const raw = await hospitableRead("get-reservations", {
      properties: [propertyId],
      start_date: addDays(from, -LOOKBACK_DAYS),
      end_date: addDays(to, -1),
      date_query: "checkin",
      per_page: 100,
      page,
      include: "guest",
    });
    for (const row of rowsOf(raw)) {
      const stay: OccupyingStay = {
        id: text(row.id),
        propertyId: propertyOf(row, propertyId),
        guest: guestOf(row),
        status: statusOf(row),
        checkIn: (text(row.arrival_date) || text(row.check_in)).slice(0, 10),
        checkOut: (text(row.departure_date) || text(row.check_out)).slice(0, 10),
      };
      if (!stay.id || DEAD.test(stay.status)) continue;
      if (stay.propertyId !== propertyId) continue;
      if (overlaps(stay, from, to)) found.set(stay.id, stay);
    }
    if (page >= lastPage(raw)) break;
  }
  return [...found.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

/** True when a guest is in the unit for any part of `day`: from the arrival day through the departure morning. */
export function occupiesDay(stay: { checkIn: string; checkOut: string }, day: string): boolean {
  return stay.checkIn <= day && day <= stay.checkOut;
}

/** Every night from `from` up to, not including, `to`. */
export function nightsBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day < to && days.length < 800; day = addDays(day, 1)) days.push(day);
  return days;
}
