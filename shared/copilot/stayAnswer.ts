/**
 * Reservation answers that must name the right listing.
 * Hospitable titles are marketing names. "8 Charlotte 606" is "Unit #606".
 * "Roseglor" is only in the address. A reservation code is one stay, not the newest thread on the account.
 */

import { getHospitablePat } from "../pm/clientStore.js";
import { hospitableFetch, listAllHospitableProperties } from "../pm/hospitableClient.js";
import { callHospitableMcp, hospitableMcpConfigured } from "./hospitableMcp.js";
import { isManagedUnit } from "./managedUnits.js";
import { addDays, torontoToday } from "./time.js";

const CODE = /\b(HM[A-Z0-9]{8,12})\b/i;
const STAY = /\b(reservations?|check-?ins?|checking in|next guest|guest messages?|booking history)\b/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

type Listing = { id: string; name: string; address: string; label: string; publicName: string };
type Stay = { id: string; code: string; status: string; checkIn: string; checkOut: string; guest: string };

const STOP = new Set(["what", "was", "the", "last", "guest", "message", "messages", "on", "reservation", "stay", "for", "at", "and", "from", "who", "sent", "about"]);

export async function answerStay(question: string, prior = ""): Promise<string | null> {
  const asked = question.trim();
  if (!asked) return null;
  const code = asked.match(CODE)?.[1]?.toUpperCase() ?? "";
  if (/\bmessage\b/i.test(asked)) {
    try {
      if (code) return await messageFor(code);
      const pinned = await findPinnedStay(asked);
      if (pinned) return await messageFor(pinned);
    } catch {
      return "Hospitable didn't return that reservation. I didn't guess.";
    }
  }
  if (!STAY.test(asked)) return null;
  const aboutThis = /\b(this|that) (unit|reservation|stay|property)\b/i.test(asked);
  if (!code && !aboutThis && !hasPlace(asked)) return null;
  try {
    if (code && /\bmessage\b/i.test(asked)) return await messageFor(code);
    if (code && !/\bhow many\b/i.test(asked)) return await messageFor(code, false);
    const listings = await loadProperties();
    if (!listings.length) {
      return "Hospitable isn't connected, so I can't see that reservation. Add the MCP token in Connectors. I didn't guess.";
    }
    const picked = pickListings(aboutThis ? `${asked}\n${prior}` : asked, listings);
    if (!picked.length) {
      return "I couldn't match that to a Hospitable listing. I didn't guess a count.";
    }
    if (/\b(next guest|who is (the )?next|next check-?in)\b/i.test(asked)) return await nextGuest(picked);
    if (/\blast check-?in\b/i.test(asked)) return await lastCheckIn(picked);
    const month = monthWindow(asked, torontoToday());
    const checkins = /\bcheck-?ins?\b|\bchecking in\b/i.test(asked);
    return await monthCount(picked, month, checkins);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/isn't connected|not connected|MCP token/i.test(message)) {
      return "Hospitable isn't connected, so I can't see that reservation. Add the MCP token in Connectors. I didn't guess.";
    }
    return "Hospitable didn't return that reservation. I didn't guess.";
  }
}

/** Spoken name, Hospitable title, and id. The model uses this when a question is not a plain count. */
export async function propertyLines(): Promise<string> {
  const rows = await loadProperties();
  if (!rows.length) return "";
  return ["Hospitable listings, spoken name first:", ...rows.map((row) => `${row.label} is listed as "${row.name}" at ${row.address}. id ${row.id}.`)].join("\n");
}

function hasPlace(text: string): boolean {
  return /charlotte|roseglor|blue jays|shaw|markham|\b(606|1103|1104|2104)\b/i.test(text);
}

export function pickListings(text: string, listings: Listing[]): Listing[] {
  const scored = listings
    .map((row) => ({ row, score: scoreText(text, row) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  if (!top) return [];
  return scored.filter((row) => row.score === top).map((row) => row.row);
}

function scoreText(text: string, row: Listing): number {
  const q = text.toLowerCase();
  const label = row.label.toLowerCase();
  const pub = row.publicName.toLowerCase();
  const head = pub.split("|")[0]?.trim() ?? "";
  let score = 0;
  if (label && q.includes(label)) score += 10;
  if (head.length > 6 && q.includes(head)) score += 12;
  const unit = label.match(/\b(\d{3,4})\b/);
  if (unit && new RegExp(`\\b${unit[1]}\\b`).test(q)) score += 8;
  if (/roseglor/.test(label) && /roseglor/.test(q)) score += 10;
  if (/blue jays/.test(label) && /blue jays/.test(q)) score += 10;
  if (/shaw/.test(label) && /\bshaw\b/.test(q)) score += 10;
  if (/markham/.test(label) && /markham/.test(q)) score += 3;
  if (/charlotte/.test(label) && /charlotte/.test(q)) score += 3;
  if (/charlotte/.test(q) && !/\b(606|1103|1104|2104)\b/.test(q) && /charlotte/.test(label)) score += 5;
  return score;
}

function monthWindow(question: string, today: string): { start: string; end: string; label: string } {
  const [yearText, monthText] = today.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  const named = question.toLowerCase().match(new RegExp(`\\b(${MONTHS.join("|")})\\b(?:\\s+(\\d{4}))?`));
  if (named) {
    month = MONTHS.indexOf(named[1]) + 1;
    if (named[2]) year = Number(named[2]);
  } else if (/next month/i.test(question)) {
    if (month === 12) {
      month = 1;
      year += 1;
    } else {
      month += 1;
    }
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const name = `${MONTHS[month - 1].slice(0, 1).toUpperCase()}${MONTHS[month - 1].slice(1)}`;
  return { start, end, label: `${name} ${year}` };
}

async function monthCount(listings: Listing[], month: { start: string; end: string; label: string }, checkins: boolean): Promise<string> {
  const lines: string[] = [];
  for (const listing of listings) {
    const stays = await loadStays([listing.id], addDays(month.start, -120), month.end, "checkin");
    const accepted = stays.filter((stay) => stay.status === "accepted" && stay.checkIn.length === 10);
    const checkingIn = accepted.filter((stay) => stay.checkIn >= month.start && stay.checkIn <= month.end);
    const nights = accepted.filter((stay) => stay.checkIn <= month.end && stay.checkOut > month.start);
    const counted = checkins ? checkingIn : nights;
    const other = stays.filter((stay) => stay.status !== "accepted" && stay.checkIn >= month.start && stay.checkIn <= month.end).length;
    const noun = checkins
      ? `${counted.length} accepted check-in${counted.length === 1 ? "" : "s"}`
      : `${counted.length} accepted stay${counted.length === 1 ? "" : "s"} with a night`;
    const earlier = checkins && nights.length > checkingIn.length
      ? ` ${nights.length} accepted ${nights.length === 1 ? "stay has a night" : "stays have a night"} in ${month.label}, including ${nights.length - checkingIn.length} that checked in earlier.`
      : "";
    const extra = other ? ` ${other} other ${other === 1 ? "record is" : "records are"} cancelled or declined in that window, so ${other === 1 ? "it is" : "they are"} not in the count.` : "";
    lines.push(`${listing.label} has ${noun} in ${month.label}.${listedAs(listing)}${earlier}${extra}`);
  }
  const scope = checkins ? "Counted accepted check-ins in that month." : "Counted accepted stays with a night in that month.";
  return `${lines.join("\n")}\n${scope}`;
}

async function lastCheckIn(listings: Listing[]): Promise<string> {
  const today = torontoToday();
  const lines: string[] = [];
  for (const listing of listings) {
    const stays = await loadStays([listing.id], addDays(today, -900), today, "checkin");
    const accepted = stays.filter((stay) => stay.status === "accepted" && stay.checkIn.length === 10 && stay.checkIn <= today).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    const latest = accepted[0];
    if (!latest) {
      const any = stays.length ? " Other records exist on that listing, so this is not an empty history." : "";
      lines.push(`I don't see an accepted check-in at ${listing.label} between ${addDays(today, -900)} and today.${listedAs(listing)}${any}`);
      continue;
    }
    lines.push(`The latest accepted check-in at ${listing.label} on or before today is ${latest.checkIn}, reservation ${latest.code}.${listedAs(listing)}`);
  }
  return lines.join("\n");
}

async function nextGuest(listings: Listing[]): Promise<string> {
  const today = torontoToday();
  const end = addDays(today, 180);
  const lines: string[] = [];
  for (const listing of listings) {
    const stays = await loadStays([listing.id], addDays(today, -90), end, "checkin", true);
    const accepted = stays.filter((stay) => stay.status === "accepted" && stay.checkIn.length === 10);
    const inHouse = accepted
      .filter((stay) => stay.checkIn < today && stay.checkOut > today)
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0];
    const next = accepted
      .filter((stay) => stay.checkIn >= today)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    const here = inHouse
      ? `${inHouse.guest || "A guest"} checked in ${inHouse.checkIn} and checks out ${inHouse.checkOut}, reservation ${inHouse.code}.`
      : "";
    if (!next) {
      lines.push(`There is no accepted check-in at ${listing.label} from today through ${end}.${listedAs(listing)} ${here}`.trim());
      continue;
    }
    const who = next.guest || "The guest name wasn't on the reservation";
    lines.push(`The next accepted check-in at ${listing.label} is ${next.checkIn}, reservation ${next.code}. ${who}.${listedAs(listing)} ${here}`.trim());
  }
  return lines.join("\n");
}

async function messageFor(code: string, thread = true): Promise<string> {
  const raw = await callTool("get-reservation", { identifier: code, include: "properties,guest" });
  const row = one(raw);
  if (!row) return `Hospitable didn't return reservation ${code}. I didn't guess.`;
  const stay = toStay(row);
  const listing = listingFrom(row);
  const where = listing ? `${listing.label}${listedAs(listing)}` : "that listing";
  if (!thread) {
    return `${stay.code} is an ${stay.status} reservation at ${where}, ${stay.checkIn} to ${stay.checkOut}.`;
  }
  const messages = await callTool("get-reservation-messages", { uuid: stay.id });
  const latest = toMessages(messages).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest) return `${stay.code} at ${where} has no messages in the thread Hospitable returned.`;
  const who = latest.role === "guest" ? stay.guest || "The guest" : latest.name || (latest.role === "host" ? "The host" : "An automated message");
  return `On ${stay.code} at ${where}, the last message was from ${who} on ${latest.at.slice(0, 16).replace("T", " ")}: “${clip(latest.body, 180)}”`;
}

function listedAs(listing: Listing): string {
  return listing.name.toLowerCase() === listing.label.toLowerCase() ? "" : ` Hospitable lists it as ${listing.name}.`;
}

function guestTokens(question: string): string[] {
  return question.split(/\s+/).map((word) => word.replace(/[^A-Za-z]/g, "")).filter((word) => word.length > 2 && !STOP.has(word.toLowerCase()));
}

/** One stay named by a code, a unit, a public title, or a guest. Does not list the whole account. */
export async function findPinnedStay(question: string): Promise<string | null> {
  const listings = (await loadProperties()).filter((row) => isManagedUnit(row.name, row.address, `${row.label} ${row.publicName}`));
  if (!listings.length) return null;
  const picked = pickListings(question, listings);
  const names = guestTokens(question);
  const windowStart = addDays(torontoToday(), -60);
  const windowEnd = addDays(torontoToday(), 120);
  if (picked.length === 1) {
    const stays = await loadStays([picked[0].id], windowStart, windowEnd, "checkin", true);
    const live = stays.filter((stay) => stay.code && !/cancel|declin/i.test(stay.status));
    const named = names.length ? live.filter((stay) => names.some((name) => stay.guest.toLowerCase() === name.toLowerCase())) : [];
    if (named.length === 1) return named[0].code;
    if (live.length === 1) return live[0].code;
    return null;
  }
  if (picked.length > 1 || !names.length) return null;
  const hits: Stay[] = [];
  for (const listing of listings) {
    const stays = await loadStays([listing.id], windowStart, windowEnd, "checkin", true);
    for (const stay of stays) {
      if (!stay.code || /cancel|declin/i.test(stay.status)) continue;
      if (names.some((name) => stay.guest.toLowerCase() === name.toLowerCase())) hits.push(stay);
    }
  }
  return hits.length === 1 ? hits[0].code : null;
}

async function loadProperties(): Promise<Listing[]> {
  if (await hospitableMcpConfigured()) {
    const raw = await callHospitableMcp("get-properties", { per_page: 100 });
    return rowsOf(raw).map(toListing).filter((row) => row.id);
  }
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) return [];
  const rows = await listAllHospitableProperties(pat);
  return rows.map((row) => toListing({ id: row.id, name: row.name, address: { display: row.address } }));
}

async function loadStays(ids: string[], start: string, end: string, dateQuery: "checkin" | "checkout", guests = false): Promise<Stay[]> {
  const out: Stay[] = [];
  for (let page = 1; page <= 8; page += 1) {
    const args: Record<string, unknown> = {
      properties: ids,
      start_date: start,
      end_date: end,
      date_query: dateQuery,
      per_page: 100,
      page,
    };
    if (guests) args.include = "guest";
    const raw = await callTool("get-reservations", args);
    out.push(...rowsOf(raw).map(toStay).filter((stay) => stay.id));
    const last = lastPage(raw);
    if (page >= last) break;
  }
  return out;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (await hospitableMcpConfigured()) return callHospitableMcp(name, args);
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) throw new Error("Hospitable isn't connected.");
  if (name === "get-properties") return hospitableFetch(pat, "/properties", { per_page: "100" });
  if (name === "get-reservation") {
    return hospitableFetch(pat, `/reservations/${encodeURIComponent(String(args.identifier ?? ""))}`, {
      include: String(args.include ?? ""),
    });
  }
  if (name === "get-reservation-messages") {
    return hospitableFetch(pat, `/reservations/${encodeURIComponent(String(args.uuid ?? ""))}/messages`);
  }
  return hospitableFetch(pat, "/reservations", {
    properties: Array.isArray(args.properties) ? args.properties.map(String) : [],
    start_date: String(args.start_date ?? ""),
    end_date: String(args.end_date ?? ""),
    date_query: String(args.date_query ?? "checkin"),
    per_page: "100",
    page: String(args.page ?? 1),
    include: String(args.include ?? ""),
  });
}

function toListing(row: Record<string, unknown>): Listing {
  const address = addressOf(row.address);
  const name = text(row.name) || text(row.public_name) || "Untitled property";
  const publicName = text(row.public_name);
  return { id: text(row.id), name, address, label: labelFor(name, address), publicName };
}

function labelFor(name: string, address: string): string {
  const blob = `${name} ${address}`.toLowerCase();
  const charlotte = blob.match(/\b(606|1103|1104|2104)\b/);
  if (/charlotte/.test(blob) && charlotte) return `8 Charlotte ${charlotte[1]}`;
  if (/roseglor/.test(blob)) return "Roseglor";
  if (/blue jays/.test(blob)) return "20 Blue Jays Way";
  if (/\bshaw\b/.test(blob)) return "1065 Shaw Street";
  if (/markham/.test(blob)) {
    const unit = name.match(/#\s*(\d+)\b/) || name.match(/\b(\d+)\s*$/) || address.match(/^(\d+)\s*,/);
    if (unit) return `19 Markham ${unit[1].replace(/^0+/, "") || unit[1]}`;
  }
  return name;
}

function toStay(row: Record<string, unknown>): Stay {
  const guest = row.guest && typeof row.guest === "object" ? (row.guest as Record<string, unknown>) : {};
  const first = text(guest.first_name);
  return {
    id: text(row.id),
    code: text(row.code) || text(row.platform_id),
    status: text(row.status).toLowerCase() || "unknown",
    checkIn: day(text(row.arrival_date) || text(row.check_in)),
    checkOut: day(text(row.departure_date) || text(row.check_out)),
    guest: first,
  };
}

function listingFrom(row: Record<string, unknown>): Listing | null {
  const props = Array.isArray(row.properties) ? row.properties : [];
  const first = props.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  if (!first) return null;
  return toListing(first);
}

function toMessages(raw: unknown): { at: string; role: string; name: string; body: string }[] {
  return rowsOf(raw).map((row) => {
    const author = row.author && typeof row.author === "object" ? (row.author as Record<string, unknown>) : {};
    const sender = row.sender && typeof row.sender === "object" ? (row.sender as Record<string, unknown>) : {};
    const roleRaw = `${text(row.sender_role)} ${text(row.sender_type)} ${text(sender.type)} ${text(sender.role)}`.toLowerCase();
    const role = roleRaw.includes("guest") ? "guest" : roleRaw.includes("host") ? "host" : roleRaw.includes("system") ? "system" : "unknown";
    return {
      at: text(row.created_at) || text(row.sent_at) || text(row.timestamp),
      role,
      name: text(author.name) || text(sender.name),
      body: text(row.body) || text(row.message) || text(row.content) || text(row.text),
    };
  }).filter((row) => row.body || row.at);
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRow);
  if (!isRow(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data.filter(isRow);
  return [];
}

function one(raw: unknown): Record<string, unknown> | null {
  if (!isRow(raw)) return null;
  if (isRow(raw.data) && !Array.isArray(raw.data)) return raw.data;
  if (text(raw.id) || text(raw.code)) return raw;
  return null;
}

function lastPage(raw: unknown): number {
  if (!isRow(raw)) return 1;
  const meta = isRow(raw.meta) ? raw.meta : {};
  return Number(meta.last_page) || 1;
}

function addressOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!isRow(value)) return "";
  return text(value.display) || [text(value.number), text(value.street), text(value.city)].filter(Boolean).join(", ");
}

function day(value: string): string {
  return value.slice(0, 10);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function clip(value: string, max: number): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
