/**
 * Guest messaging inbox filters: status, property, stay and search.
 * "Needs reply" is the waiting bucket: the guest wrote last and the thread needs an answer.
 * It is the same set the sidebar counts. Airbnb's own read/unread is not read from Hospitable.
 */

import { guestQueueRows } from "./guestQueueRows.js";
import type { GuestFollowUp, GuestQueue, GuestRow } from "./guestTypes.js";

export type GuestStatusFilter = "all" | "needs" | "fu" | "inq";
export type GuestStayFilter = "all" | "upcoming" | "now" | "past";

export type GuestFilters = { status: GuestStatusFilter; property: string; stay: GuestStayFilter; q: string };

export const NO_GUEST_FILTERS: GuestFilters = { status: "all", property: "all", stay: "all", q: "" };

export const STAY_LABELS: Record<GuestStayFilter, string> = { all: "All stays", upcoming: "Upcoming", now: "Staying now", past: "Past" };

/** Upcoming before check-in day, staying now through the night before checkout, past from checkout day. */
export function stayPhase(checkIn: string, checkOut: string, today: string): Exclude<GuestStayFilter, "all"> {
  if (checkIn && today < checkIn) return "upcoming";
  if (checkOut && today >= checkOut) return "past";
  if (!checkIn && !checkOut) return "upcoming";
  return "now";
}

type Item = { propertyId: string; checkIn: string; checkOut: string; text: string };

function itemOfRow(row: GuestRow): Item {
  return { propertyId: row.propertyId, checkIn: row.checkIn, checkOut: row.checkOut, text: `${row.guest} ${row.preview || row.asked}` };
}

function itemOfFollowUp(row: GuestFollowUp): Item {
  return { propertyId: row.propertyId, checkIn: row.checkIn, checkOut: row.checkOut, text: `${row.guest} ${row.line}` };
}

export type FilteredInbox = {
  rows: GuestRow[];
  followUps: GuestFollowUp[];
  needs: Set<string>;
  counts: Record<GuestStatusFilter, number>;
  propertyCounts: Map<string, number>;
  stayCounts: Record<GuestStayFilter, number>;
  /** Unfiltered total for the active status, for the empty line. */
  statusTotal: number;
  properties: { id: string; label: string }[];
};

export function filterInbox(queue: GuestQueue, filters: GuestFilters, today: string): FilteredInbox {
  const all = guestQueueRows(queue);
  const followUps = queue.followUps ?? [];
  const needs = new Set(queue.waiting.map((row) => row.id));
  const followed = new Set(followUps.map((row) => row.reservationId));
  const q = filters.q.trim().toLowerCase();

  const matchBase = (item: Item, skip: "property" | "stay" | null) =>
    (skip === "property" || filters.property === "all" || item.propertyId === filters.property)
    && (skip === "stay" || filters.stay === "all" || stayPhase(item.checkIn, item.checkOut, today) === filters.stay)
    && (!q || item.text.toLowerCase().includes(q));
  const statusOk = (row: GuestRow, status: GuestStatusFilter) =>
    status === "all" || (status === "needs" && needs.has(row.id)) || (status === "inq" && Boolean(row.inquiry)) || (status === "fu" && followed.has(row.id));

  const rowsFor = (status: GuestStatusFilter, skip: "property" | "stay" | null = null) => all.filter((row) => statusOk(row, status) && matchBase(itemOfRow(row), skip));
  const followUpsFor = (skip: "property" | "stay" | null = null) => followUps.filter((row) => matchBase(itemOfFollowUp(row), skip));
  // Property and stay counts follow the status chip; the chip counts follow property, stay and search.
  const facet = (skip: "property" | "stay") => filters.status === "fu"
    ? followUpsFor(skip).map(itemOfFollowUp)
    : rowsFor(filters.status, skip).map(itemOfRow);

  const propertyItems = facet("property");
  const propertyCounts = new Map<string, number>([["all", propertyItems.length]]);
  for (const item of propertyItems) propertyCounts.set(item.propertyId, (propertyCounts.get(item.propertyId) ?? 0) + 1);
  const stayItems = facet("stay");
  const stayCounts: Record<GuestStayFilter, number> = { all: stayItems.length, upcoming: 0, now: 0, past: 0 };
  for (const item of stayItems) stayCounts[stayPhase(item.checkIn, item.checkOut, today)] += 1;

  const seen = new Map<string, string>();
  for (const chip of queue.properties ?? []) if (chip.id && chip.label) seen.set(chip.id, chip.label);
  for (const row of [...all, ...followUps]) if (row.propertyId && !seen.has(row.propertyId)) seen.set(row.propertyId, row.property);
  const properties = [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));

  const showFollowUps = filters.status === "all" || filters.status === "fu";
  return {
    rows: filters.status === "fu" ? [] : rowsFor(filters.status),
    followUps: showFollowUps ? followUpsFor() : [],
    needs,
    counts: { all: rowsFor("all").length, needs: rowsFor("needs").length, fu: followUpsFor().length, inq: rowsFor("inq").length },
    propertyCounts,
    stayCounts,
    statusTotal: filters.status === "fu" ? followUps.length : all.filter((row) => statusOk(row, filters.status)).length,
    properties,
  };
}

/** "No conversations need a reply at 1065 Shaw Street." */
export function emptyInboxLine(filters: GuestFilters, propertyLabel: string): string {
  const q = filters.q.trim();
  const subject = { all: "No conversations", needs: q ? "No conversations waiting on a reply" : "No conversations need a reply", fu: "No follow-ups", inq: "No inquiries" }[filters.status];
  const at = filters.property !== "all" && propertyLabel ? ` at ${propertyLabel}` : "";
  const stay = { all: "", upcoming: " with an upcoming stay", now: " from guests staying now", past: " from past stays" }[filters.stay];
  return `${subject}${at}${stay}${q ? ` match “${q}”` : ""}.`;
}

export function emptyInboxSub(filters: GuestFilters, total: number): string {
  const noun = { all: "conversations", needs: "need a reply", fu: "follow-ups", inq: total === 1 ? "inquiry" : "inquiries" }[filters.status];
  return `${total} ${noun} across all properties.`;
}

/** "9m", "3h", "1d" since the guest's last message. */
export function waitedFor(iso: string | undefined, now: number): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(1, Math.floor((now - at) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
