/**
 * Reservation answers that must name the right listing.
 * Hospitable titles are marketing names. "8 Charlotte 606" is "Unit #606".
 * "Roseglor" is only in the address. A reservation code is one stay, not the newest thread on the account.
 */

import { asksBuildingRegistration } from "./buildingRegistration.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { copilotKeepsProperty, hospitableRead } from "./hospitableConnection.js";
import { isManagedUnit } from "./managedUnits.js";
import { addDays, torontoToday } from "./time.js";
import type { StayCard } from "./types.js";
export type { StayCard };

const CODE = /\b(HM[A-Z0-9]{8,12})\b/i;
const STAY = /\b(reservations?|check[\s-]?ins?|check[\s-]?outs?|checking[\s-]?in|checking[\s-]?out|next guest|guest messages?|booking history)\b/i;
const CHECK = /\b(check[\s-]?ins?|check[\s-]?outs?|checking[\s-]?in|checking[\s-]?out)\b/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Listing = { id: string; name: string; address: string; label: string; publicName: string };
type Stay = {
  id: string;
  code: string;
  propertyId: string;
  status: string;
  checkIn: string;
  checkOut: string;
  checkInAt: string;
  checkOutAt: string;
  guest: string;
  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;
  airbnbThread: string;
};

const STOP = new Set(["what", "was", "the", "last", "guest", "message", "messages", "on", "reservation", "stay", "for", "at", "and", "from", "who", "sent", "about"]);

/** A check-in or check-out count for today, tomorrow, or a named day. The split is the whole answer. */
export function asksDayCount(text: string): boolean {
  const asked = text.trim();
  if (!asked || asksBuildingRegistration(asked) || /\bmessage\b/i.test(asked)) return false;
  return Boolean(askedDay(asked)) && CHECK.test(asked);
}

/** Today, tomorrow, an ISO date, "October 9", or a weekday, as YYYY-MM-DD. */
export function askedDay(question: string, today = torontoToday()): string | null {
  const asked = question.trim();
  if (/\btoday\b/i.test(asked)) return today;
  if (/\btomorrow\b/i.test(asked)) return addDays(today, 1);
  const iso = asked.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const monthDay = asked.toLowerCase().match(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`));
  if (monthDay?.[1] && monthDay[2]) {
    const month = MONTHS.indexOf(monthDay[1]) + 1;
    const date = Number(monthDay[2]);
    const year = monthDay[3] ? Number(monthDay[3]) : Number(today.slice(0, 4));
    if (month > 0 && date >= 1 && date <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    }
  }
  const weekday = asked.toLowerCase().match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`));
  if (weekday?.[1]) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    return addDays(today, (target - current + 7) % 7);
  }
  return null;
}

export async function answerStay(question: string, prior = "", carried: StayCard[] = []): Promise<string | null> {
  const sheet = await openDaySheet(question, prior, carried);
  if (sheet) return sheet.body;
  const asked = question.trim();
  if (!asked || asksBuildingRegistration(asked)) return null;
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
  const day = askedDay(asked);
  const inventory = asksInventory(asked) || Boolean(day && CHECK.test(asked));
  if (!STAY.test(asked) && !inventory) return null;
  const aboutThis = /\b(this|that) (unit|reservation|stay|property)\b/i.test(asked);
  if (!code && !aboutThis && !hasPlace(asked) && !inventory) return null;
  try {
    if (code && /\bmessage\b/i.test(asked)) return await messageFor(code);
    if (code && !/\bhow many\b/i.test(asked)) return await messageFor(code, false);
    const managed = await managedListings();
    if (/\bpropert(?:y|ies)\b/i.test(asked) && !/\b(check|reservation|stay|guest)\b/i.test(asked)) {
      return propertyRoster(managed);
    }
    const named = Boolean(code || aboutThis || hasPlace(asked));
    const picked = named ? pickListings(aboutThis ? `${asked}\n${prior}` : asked, managed) : managed;
    if (named && !picked.length) {
      return "I couldn't match that to a managed property. I didn't guess a count.";
    }
    const listings = picked.length ? picked : managed;
    if (/\b(next guest|who is (the )?next|next check-?in)\b/i.test(asked)) return await nextGuest(listings);
    if (/\blast check-?in\b/i.test(asked)) return await lastCheckIn(listings);
    const month = monthWindow(asked, torontoToday());
    const checkins = /\bcheck[\s-]?ins?\b|\bchecking in\b/i.test(asked);
    return await monthCount(listings, month, checkins);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (inventory && /isn't connected|not connected|MCP token/i.test(message)) {
      return "This read is incomplete. The managed properties failed read.";
    }
    if (/isn't connected|not connected|MCP token/i.test(message)) {
      return "Hospitable is not connected, so I can't see that reservation. I didn't guess.";
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

function asksInventory(text: string): boolean {
  if (/\bmessage\b/i.test(text)) return false;
  const topic = /\b(reservations?|check[\s-]?ins?|check[\s-]?outs?|checking in|checking out|propert(?:y|ies))\b/i.test(text);
  return topic && /\b(how many|count of|number of|today|tomorrow)\b/i.test(text);
}

/** The stay-check join: managed units, then each Hospitable id. Not the account property list. */
async function managedListings(): Promise<Listing[]> {
  const rows = [];
  for (const row of await listPmProperties().catch(() => [])) {
    if (await copilotKeepsProperty({ id: row.hospitable_property_id || "", name: row.name, address: row.address })) rows.push(row);
  }
  return rows.map((row) => {
    const address = row.address;
    const name = row.name;
    return {
      id: (row.hospitable_property_id || row.id).trim(),
      name,
      address,
      label: labelFor(name, address),
      publicName: name,
    };
  });
}

function propertyRoster(listings: Listing[]): string {
  if (!listings.length) return "This read is incomplete. The managed properties failed read.";
  const noun = listings.length === 1 ? "property" : "properties";
  return `${listings.length} managed ${noun}.\n${listings.map((row) => row.label).join("\n")}`;
}

function isDaySheet(body: string): boolean {
  return /accepted check-in|accepted check-out|No check-ins at|No check-outs/.test(body);
}

/** A follow-up about names or links stays on the answer it follows. A new day count does not. */
export function asksSameStays(question: string, prior: string): boolean {
  if (!isDaySheet(prior) || asksDayCount(question) || /\bHM[A-Z0-9]{8,}\b/i.test(question)) return false;
  return /\b(names?|links?|airbnb|who are|who is|which guest|their reservation|the reservation|thread)\b/i.test(question);
}

/** The day sheet, or the same sheet again when the question follows it. */
export async function openDaySheet(question: string, prior = "", carried: StayCard[] = []): Promise<{ body: string; stays: StayCard[] } | null> {
  const asked = question.trim();
  if (asksSameStays(asked, prior)) return { body: prior, stays: carried };
  if (!asksDayCount(asked)) return null;
  const day = askedDay(asked);
  if (!day) return null;
  const wantsIn = /\b(check[\s-]?ins?|checking[\s-]?in)\b/i.test(asked);
  const wantsOut = /\b(check[\s-]?outs?|checking[\s-]?out)\b/i.test(asked) || (wantsIn && /\band out\b/i.test(asked));
  const sides: ("check-in" | "check-out")[] = [
    ...(wantsIn || !wantsOut ? ["check-in" as const] : []),
    ...(wantsOut ? ["check-out" as const] : []),
  ];
  const listings = (await managedListings()).filter((row) => isManagedUnit(row.label, row.address, row.name));
  if (!listings.length) return { body: "This read is incomplete. The managed properties failed read.", stays: [] };
  const blocks: string[] = [];
  const stays: StayCard[] = [];
  const missed: string[] = [];
  for (const side of sides) {
    const built = await oneSide(listings, day, side, torontoToday());
    blocks.push(built.body);
    stays.push(...built.stays);
    missed.push(...built.missed);
  }
  const body = blocks.filter(Boolean).join("\n");
  if (!missed.length) return { body, stays };
  return { body: `${body}\nThis read is incomplete. ${[...new Set(missed)].join(", ")} failed read.`.trim(), stays };
}

async function oneSide(
  listings: Listing[],
  day: string,
  kind: "check-in" | "check-out",
  today: string,
): Promise<{ body: string; stays: StayCard[]; missed: string[] }> {
  const noun = kind === "check-in" ? "check-in" : "check-out";
  const cards: StayCard[] = [];
  const empty: string[] = [];
  const missed: string[] = [];
  for (const listing of listings) {
    if (!listing.id) {
      missed.push(listing.label);
      continue;
    }
    try {
      const loaded = await loadStays([listing.id], addDays(day, -1), addDays(day, 1), kind === "check-in" ? "checkin" : "checkout", true);
      const accepted = loaded.filter((stay) => {
        if (stay.propertyId && listing.id && stay.propertyId !== listing.id) return false;
        if (!isManagedUnit(listing.label, listing.address, listing.name)) return false;
        return stay.status === "accepted" && (kind === "check-in" ? stay.checkIn === day : stay.checkOut === day);
      });
      if (!accepted.length) {
        empty.push(listing.label);
        continue;
      }
      for (const stay of accepted) {
        if (!stay.airbnbThread) stay.airbnbThread = await threadOnStay(stay.id);
        cards.push(cardFor(stay, listing, kind));
      }
    } catch {
      missed.push(listing.label);
    }
  }
  const when = day === today ? "today" : `on ${day}`;
  const lines = cards.map(stayLine);
  if (!cards.length) {
    const where = empty.length ? ` at ${englishList(empty)}` : "";
    return { body: `No ${noun}s${where} ${when}.`, stays: [], missed };
  }
  const head = `${cards.length} accepted ${noun}${cards.length === 1 ? "" : "s"} on ${day}.`;
  const quiet = empty.length ? `No ${noun}s at ${englishList(empty)} ${when}.` : "";
  return { body: [head, ...lines, quiet].filter(Boolean).join("\n"), stays: cards, missed };
}

function cardFor(stay: Stay, listing: Listing, kind: "check-in" | "check-out"): StayCard {
  const guest = stay.guest || "The guest name wasn't on the reservation";
  const clock = clockOf(kind === "check-in" ? stay.checkInAt : stay.checkOutAt);
  const when = clock ? `${kind === "check-in" ? "Arrives" : "Departs"} ${clock}` : `${kind === "check-in" ? "Arrives" : "Departs"} ${kind === "check-in" ? stay.checkIn : stay.checkOut}`;
  const thread = stay.airbnbThread;
  const label = thread ? `airbnb.ca/hosting/messages/${thread}` : "";
  return {
    id: stay.id,
    guest,
    first: guest.split(/\s+/)[0] || guest,
    initials: initialsOf(guest),
    property: listing.label,
    propertyId: listing.id,
    kind,
    when,
    party: partyOf(stay),
    dates: shortDate(kind === "check-in" ? stay.checkIn : stay.checkOut),
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    airbnbUrl: thread ? `https://www.airbnb.ca/hosting/messages/${thread}` : "",
    airbnbLabel: label,
    airbnbNote: thread ? "" : "No Airbnb thread on this stay.",
  };
}

function stayLine(card: StayCard): string {
  const move = card.when.replace(/^Arrives/, "arrives").replace(/^Departs/, "departs");
  const link = card.airbnbLabel || card.airbnbNote;
  return `${card.guest} · ${card.property} · ${move} · ${card.party} · ${link}`;
}

function partyOf(stay: Stay): string {
  const parts: string[] = [];
  if (stay.adults != null) parts.push(`${stay.adults} ${stay.adults === 1 ? "adult" : "adults"}`);
  if (stay.children != null && stay.children > 0) parts.push(`${stay.children} ${stay.children === 1 ? "child" : "children"}`);
  if (stay.infants != null && stay.infants > 0) parts.push(`${stay.infants} ${stay.infants === 1 ? "infant" : "infants"}`);
  if (stay.pets != null && stay.pets > 0) parts.push(`${stay.pets} ${stay.pets === 1 ? "pet" : "pets"}`);
  return parts.length ? parts.join(", ") : "The party wasn't on the reservation";
}

function englishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return (parts[0]?.slice(0, 1) || "?").toUpperCase();
}

function shortDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function clockOf(value: string): string {
  if (!/T\d{2}:\d{2}/.test(value)) return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone: "America/Toronto",
  }).format(at).replace(/[\u202f\u00a0]/g, " ");
}

async function threadOnStay(id: string): Promise<string> {
  try {
    const messages = await callTool("get-reservation-messages", { uuid: id });
    return threadFromMessages(messages);
  } catch {
    return "";
  }
}

function threadFromMessages(raw: unknown): string {
  for (const row of rowsOf(raw)) {
    const found = airbnbThread(row);
    if (found) return found;
  }
  return "";
}

function airbnbThread(row: Record<string, unknown>): string {
  const conversation = isRow(row.conversation) ? row.conversation : {};
  const values = [
    row.platform_thread_id,
    row.thread_id,
    row.external_thread_id,
    conversation.platform_id,
    conversation.external_id,
    conversation.thread_id,
    row.platform_id,
  ];
  for (const value of values) {
    const id = text(value);
    if (/^\d{5,}$/.test(id)) return id;
  }
  return "";
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
  const where = listing ? `${listing.label}${listedAs(listing)}` : "The property wasn't on the reservation.";
  if (!thread) return reservationSummary(row, stay, where);
  const messages = await callTool("get-reservation-messages", { uuid: stay.id });
  const latest = toMessages(messages).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest) return `${stay.code} at ${where} has no messages in the thread Hospitable returned.`;
  const who = latest.role === "guest" ? stay.guest || "The guest" : latest.name || (latest.role === "host" ? "The host" : "An automated message");
  return `On ${stay.code} at ${where}, the last message was from ${who} on ${latest.at.slice(0, 16).replace("T", " ")}: “${clip(latest.body, 180)}”`;
}

function reservationSummary(row: Record<string, unknown>, stay: Stay, where: string): string {
  const guest = guestName(row) || "The guest name wasn't on the reservation";
  const checkIn = clockLabel(text(row.check_in) || text(row.arrival_date) || stay.checkIn, "check-in");
  const checkOut = clockLabel(text(row.check_out) || text(row.departure_date) || stay.checkOut, "check-out");
  const party = partyLabel(row) || "The party wasn't on the reservation.";
  const place = where.endsWith(".") ? where : `${where}.`;
  const partySentence = party.endsWith(".") ? party : `${party}.`;
  return `${stay.code} is an ${stay.status} reservation for ${guest} at ${place} Check-in ${checkIn}. Check-out ${checkOut}. ${partySentence}`;
}

function guestName(row: Record<string, unknown>): string {
  const guest = row.guest && typeof row.guest === "object" ? (row.guest as Record<string, unknown>) : {};
  const named = [text(guest.first_name), text(guest.last_name)].filter(Boolean).join(" ");
  return named || text(guest.name) || text(row.guest_name);
}

function partyLabel(row: Record<string, unknown>): string {
  const guests = row.guests && typeof row.guests === "object" && !Array.isArray(row.guests) ? (row.guests as Record<string, unknown>) : {};
  const adults = countOf(guests.adult_count ?? guests.adults ?? row.adults);
  const children = countOf(guests.child_count ?? guests.children ?? row.children);
  const pets = countOf(guests.pet_count ?? guests.pets ?? row.pets);
  const parts: string[] = [];
  if (adults != null) parts.push(`${adults} ${adults === 1 ? "adult" : "adults"}`);
  if (children != null) parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  if (pets != null && pets > 0) parts.push(`${pets} ${pets === 1 ? "pet" : "pets"}`);
  return parts.join(", ");
}

function countOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function clockLabel(value: string, which: string): string {
  const raw = value.trim();
  if (!raw) return "wasn't on the reservation";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const dt = new Date(dateOnly ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(dt.getTime())) return raw;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(dt);
  if (dateOnly || !/T\d{2}:\d{2}/.test(raw)) return `${date}. The ${which} time wasn't on the reservation`;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone: "America/Toronto",
  }).format(dt).replace(/\u202f/g, " ");
  return `${date} at ${time}`;
}

function listedAs(listing: Listing): string {
  return listing.name.toLowerCase() === listing.label.toLowerCase() ? "" : ` Hospitable lists it as ${listing.name}.`;
}

function guestTokens(question: string): string[] {
  return question.split(/\s+/).map((word) => word.replace(/[^A-Za-z]/g, "")).filter((word) => word.length > 2 && !STOP.has(word.toLowerCase()));
}

/** One stay named by a code, a unit, a public title, or a guest. Does not list the whole account. */
export async function findPinnedStay(question: string): Promise<string | null> {
  const listings = [];
  for (const row of await loadProperties()) {
    if (await copilotKeepsProperty({ id: row.id, name: row.name, address: row.address, extra: `${row.label} ${row.publicName}` })) listings.push(row);
  }
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
  const raw = await hospitableRead("get-properties", { per_page: 100 });
  return rowsOf(raw).map(toListing).filter((row) => row.id);
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
  return hospitableRead(name, args);
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
  const guests = row.guests && typeof row.guests === "object" && !Array.isArray(row.guests) ? (row.guests as Record<string, unknown>) : {};
  const first = text(guest.first_name);
  const platform = text(row.platform_id);
  return {
    id: text(row.id),
    code: text(row.code) || (/^HM/i.test(platform) ? platform : ""),
    propertyId: text(row.property_id) || text(row.propertyId) || listingFrom(row)?.id || "",
    status: statusOf(row),
    checkIn: day(text(row.arrival_date) || text(row.check_in)),
    checkOut: day(text(row.departure_date) || text(row.check_out)),
    checkInAt: text(row.check_in),
    checkOutAt: text(row.check_out),
    guest: first,
    adults: countOf(guests.adult_count ?? guests.adults ?? row.adults),
    children: countOf(guests.child_count ?? guests.children ?? row.children),
    infants: countOf(guests.infant_count ?? guests.infants ?? row.infants),
    pets: countOf(guests.pet_count ?? guests.pets ?? row.pets),
    airbnbThread: airbnbThread(row),
  };
}

function statusOf(row: Record<string, unknown>): string {
  const direct = text(row.status).toLowerCase();
  if (direct && direct !== "unknown") return direct;
  const bag = isRow(row.reservation_status) ? row.reservation_status : {};
  const current = isRow(bag.current) ? bag.current : {};
  return text(current.category).toLowerCase() || direct || "unknown";
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
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return torontoToday(parsed);
  }
  return trimmed.slice(0, 10);
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
