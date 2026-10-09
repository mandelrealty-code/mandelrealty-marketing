/**
 * A question about one guest's stay is answered from that reservation.
 * Money, dates, party size, status, and fees come from Hospitable.
 * A pronoun uses the guest already named in the conversation.
 * Web search is not a source for this.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { copilotKeepsProperty, hospitableRead } from "./hospitableConnection.js";
import { hostMoney } from "./ops.js";
import { asksPayoutSplit } from "./route.js";
import { addDays, torontoToday } from "./time.js";

const RETAIL = /\b(amazon|walmart|ikea|canadian tire|home depot|marketplace|box office)\b/i;
const PERSON = /\b(she|her|hers|he|him|his|they|them|their)\b/i;
const STAY = /\b(reservations?|bookings?|stays?)\b/i;
const MONEY = /\b(how much|paid|pay|payment|payments|fee|fees)\b/i;
const DATES = /\b(when|check[\s-]?ins?|check[\s-]?outs?|arriv(?:e|es|ed|ing|al)?|depart(?:s|ed|ure)?|leaving)\b/i;
const PARTY = /\b(party|how many (?:people|guests|adults|kids|children)|adults|children|kids)\b/i;
const STATUS = /\b(status|confirmed|cancelled|canceled)\b/i;
const NAME_STOP = new Set([
  "how", "much", "many", "did", "does", "she", "her", "hers", "his", "him", "they", "them", "their",
  "pay", "paid", "payment", "payments", "fee", "fees", "for", "the", "reservation", "reservations",
  "stay", "stays", "booking", "bookings", "what", "when", "where", "who", "check", "status", "party",
  "size", "adults", "children", "kids", "people", "guests", "guest", "total", "host", "and", "was",
  "were", "about", "from", "with", "this", "that", "please", "right", "now", "are", "is", "can",
  "you", "tell", "me", "our", "her", "his", "their",
]);

const PAYMENT_UNREAD = "I can see her reservation but not its payment figures";

type GuestStay = {
  id: string;
  code: string;
  guest: string;
  status: string;
  checkIn: string;
  checkOut: string;
  checkInAt: string;
  checkOutAt: string;
  adults: number | null;
  children: number | null;
  place: string;
  financials: Record<string, unknown>;
};

export function asksGuestStay(text: string): boolean {
  const asked = text.trim();
  if (!asked || RETAIL.test(asked) || asksPayoutSplit(asked)) return false;
  if (/\bhow many\b/i.test(asked) && /\b(check[\s-]?ins?|check[\s-]?outs?|reservations?|bookings?|guests?)\b/i.test(asked) && !PERSON.test(asked)) return false;
  if (/\brevenue\b/i.test(asked) && !PERSON.test(asked)) return false;
  const fact = MONEY.test(asked) || DATES.test(asked) || PARTY.test(asked) || STATUS.test(asked);
  if (!fact) return false;
  return PERSON.test(asked) || STAY.test(asked) || hasGuestName(asked);
}

/** The reservation record for this guest, or null when the question is not about one stay. */
export async function answerGuestStay(question: string, prior = ""): Promise<string | null> {
  const asked = question.trim();
  if (!asksGuestStay(asked)) return null;
  let loaded: { stays: GuestStay[]; disconnected: boolean; failed: boolean };
  try {
    loaded = await loadStays();
  } catch {
    return "Hospitable didn't return that reservation. I didn't guess.";
  }
  if (!loaded.stays.length && loaded.disconnected) {
    return "Hospitable is not connected, so I can't see that reservation. I didn't guess.";
  }
  if (!loaded.stays.length && loaded.failed) {
    return "Hospitable didn't return that reservation. I didn't guess.";
  }
  const names = [...new Set(loaded.stays.map((stay) => stay.guest).filter(Boolean))];
  const resolved = latestGuest(asked, names) || (PERSON.test(asked) ? latestGuest(prior, names) : "");
  if (!resolved) {
    if (PERSON.test(asked)) return "I didn't find which guest that is. I didn't guess.";
    return null;
  }
  const named = loaded.stays.filter((stay) => stay.guest.toLowerCase() === resolved.toLowerCase());
  const live = named.filter((stay) => !/cancel|declin/i.test(stay.status));
  const stay = pick(live.length ? live : named, torontoToday());
  if (!stay) return `I didn't find ${resolved} on a reservation. I didn't guess.`;
  return speak(asked, stay);
}

function speak(question: string, stay: GuestStay): string {
  const parts: string[] = [];
  if (MONEY.test(question)) parts.push(moneyAnswer(question, stay));
  else if (/\bfees?\b/i.test(question)) parts.push(moneyAnswer(question, stay));
  if (DATES.test(question)) parts.push(dateAnswer(stay));
  if (PARTY.test(question)) parts.push(partyAnswer(stay));
  if (STATUS.test(question) && !MONEY.test(question)) parts.push(statusAnswer(stay));
  return parts.filter(Boolean).join(" ");
}

function moneyAnswer(question: string, stay: GuestStay): string {
  const financials = stay.financials;
  const guest = asRecord(financials.guest);
  const host = asRecord(financials.host);
  const guestTotal = explicitMoney(guest.total_price) || explicitMoney(guest.totalPrice) || explicitMoney(guest.total) || explicitMoney(financials.guest_total);
  const hostRevenue = explicitMoney(host.revenue) || explicitMoney(host.host_revenue) || explicitMoney(financials.host_revenue);
  if (!guestTotal && !hostRevenue) return unreadPayment(question);
  const currency = text(financials.currency) || "CAD";
  const whose = PERSON.test(question) ? guestWord(question) : `${stay.guest}'s`;
  const place = stay.place ? ` at ${stay.place}` : "";
  const sentences: string[] = [];
  if (guestTotal) sentences.push(`${stay.guest} paid ${withCurrency(guestTotal, currency)} in total for ${whose} reservation${place}.`);
  else sentences.push(`The guest total isn't on ${stay.guest}'s reservation.`);
  if (hostRevenue) sentences.push(`Host revenue was ${withCurrency(hostRevenue, currency)}.`);
  else sentences.push(`Host revenue isn't on ${stay.guest}'s reservation.`);
  const lines = breakdownLines(financials, new Set([guestTotal, hostRevenue].filter(Boolean)));
  if (lines.length) sentences.push(`The record lists ${joinList(lines)}.`);
  return sentences.join(" ");
}

function unreadPayment(question: string): string {
  if (/\b(he|him|his)\b/i.test(question) && !/\b(she|her|hers)\b/i.test(question)) {
    return "I can see his reservation but not its payment figures";
  }
  if (/\b(they|them|their)\b/i.test(question) && !/\b(she|her|hers|he|him|his)\b/i.test(question)) {
    return "I can see their reservation but not its payment figures";
  }
  return PAYMENT_UNREAD;
}

function dateAnswer(stay: GuestStay): string {
  const checkIn = spokenWhen(stay.checkInAt) || stay.checkIn || "a check-in that isn't on the reservation";
  const checkOut = spokenWhen(stay.checkOutAt) || stay.checkOut || "a check-out that isn't on the reservation";
  return `${stay.guest} checks in ${checkIn} and checks out ${checkOut}.`;
}

function partyAnswer(stay: GuestStay): string {
  const parts: string[] = [];
  if (stay.adults != null) parts.push(`${stay.adults} ${stay.adults === 1 ? "adult" : "adults"}`);
  if (stay.children != null) parts.push(`${stay.children} ${stay.children === 1 ? "child" : "children"}`);
  if (!parts.length) return `The party size isn't on ${stay.guest}'s reservation.`;
  return `${stay.guest}'s party is ${joinList(parts)}.`;
}

function statusAnswer(stay: GuestStay): string {
  const code = stay.code ? ` ${stay.code}` : "";
  return `${stay.guest}'s reservation${code} is ${stay.status || "missing a status"}.`;
}

function guestWord(question: string): "her" | "his" | "their" {
  if (/\b(she|her|hers)\b/i.test(question)) return "her";
  if (/\b(he|him|his)\b/i.test(question)) return "his";
  return "their";
}

function withCurrency(formatted: string, currency: string): string {
  if (!currency || formatted.toUpperCase().includes(currency.toUpperCase())) return formatted;
  return `${formatted} ${currency}`;
}

function breakdownLines(financials: Record<string, unknown>, skip: Set<string>): string[] {
  const host = asRecord(financials.host);
  const guest = asRecord(financials.guest);
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (label: string, item: unknown) => {
    const formatted = explicitMoney(item);
    const name = label.trim();
    if (!name || !formatted || skip.has(formatted)) return;
    const key = `${name.toLowerCase()} ${formatted}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${name} ${formatted}`);
  };
  push("Accommodation", host.accommodation ?? guest.accommodation);
  const fees = [...list(host.guestFees), ...list(host.guest_fees), ...list(guest.fees), ...list(host.hostFees), ...list(host.host_fees)];
  for (const fee of fees) {
    const row = asRecord(fee);
    push(text(row.label) || text(row.category) || "Fee", fee);
  }
  return lines;
}

function explicitMoney(item: unknown): string {
  if (typeof item === "string" && item.trim()) return item.trim();
  if (typeof item === "number" && Number.isFinite(item) && item !== 0) return hostMoney(Math.round(item));
  if (!item || typeof item !== "object") return "";
  const row = item as { formatted?: unknown; amount?: unknown };
  if (typeof row.formatted === "string" && row.formatted.trim()) return row.formatted.trim();
  if (typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount !== 0) return hostMoney(Math.round(row.amount));
  return "";
}

function hasGuestName(text: string): boolean {
  const words = text.match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) ?? [];
  return words.some((word) => !NAME_STOP.has(word.toLowerCase()));
}

function latestGuest(text: string, names: string[]): string {
  const hay = text.toLowerCase();
  let best = "";
  let at = -1;
  for (const name of names) {
    const found = mentionAt(hay, name);
    if (found > at) {
      at = found;
      best = name;
    }
  }
  return best;
}

function mentionAt(hay: string, guest: string): number {
  const full = guest.trim().toLowerCase();
  if (!full) return -1;
  let last = indexOfWord(hay, full);
  for (const part of full.split(/\s+/)) {
    if (part.length < 3 || NAME_STOP.has(part)) continue;
    last = Math.max(last, indexOfWord(hay, part));
  }
  return last;
}

function indexOfWord(hay: string, word: string): number {
  const match = hay.match(new RegExp(`\\b${escapeRegExp(word)}\\b`, "g"));
  if (!match) return -1;
  return hay.lastIndexOf(match[match.length - 1] ?? word);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pick(stays: GuestStay[], today: string): GuestStay | null {
  if (!stays.length) return null;
  if (stays.length === 1) return stays[0] ?? null;
  const current = stays.filter((stay) => stay.checkIn <= today && stay.checkOut > today);
  if (current.length) return [...current].sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0] ?? null;
  const upcoming = stays.filter((stay) => stay.checkIn >= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  if (upcoming.length) return upcoming[0] ?? null;
  return [...stays].sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0] ?? null;
}

async function loadStays(): Promise<{ stays: GuestStay[]; disconnected: boolean; failed: boolean }> {
  const today = torontoToday();
  const start = addDays(today, -120);
  const end = addDays(today, 180);
  const properties = [];
  for (const row of await listPmProperties().catch(() => [])) {
    if (await copilotKeepsProperty({ id: row.hospitable_property_id || "", name: row.name, address: row.address })) properties.push(row);
  }
  const stays: GuestStay[] = [];
  let disconnected = false;
  let failed = false;
  for (const property of properties) {
    const id = property.hospitable_property_id || property.id;
    if (!id) {
      failed = true;
      continue;
    }
    try {
      const raw = await hospitableRead("get-reservations", {
        properties: [id],
        start_date: start,
        end_date: end,
        date_query: "checkin",
        per_page: 100,
        page: 1,
        include: "guest,financials,properties",
      });
      for (const row of rowsOf(raw)) {
        const stay = toStay(row, property.name, property.address);
        if (!stay.id || !stay.guest) continue;
        if (stay.checkOut < start || stay.checkIn > end) continue;
        stays.push(stay);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/not connected/i.test(message)) disconnected = true;
      else failed = true;
    }
  }
  return { stays, disconnected, failed };
}

function toStay(row: Record<string, unknown>, propertyName: string, propertyAddress: string): GuestStay {
  const guest = asRecord(row.guest);
  const guests = asRecord(row.guests);
  const named = [text(guest.first_name), text(guest.last_name)].filter(Boolean).join(" ") || text(guest.name);
  const listed = Array.isArray(row.properties) ? asRecord(row.properties[0]) : {};
  const address = listed.address && typeof listed.address === "object" ? text(asRecord(listed.address).display) : text(listed.address);
  const name = text(listed.name) || propertyName;
  const checkInAt = text(row.check_in) || text(row.arrival_date);
  const checkOutAt = text(row.check_out) || text(row.departure_date);
  return {
    id: text(row.id),
    code: text(row.code) || text(row.platform_id),
    guest: named,
    status: text(row.status).toLowerCase(),
    checkIn: checkInAt.slice(0, 10),
    checkOut: checkOutAt.slice(0, 10),
    checkInAt,
    checkOutAt,
    adults: countOf(guests.adult_count ?? guests.adults),
    children: countOf(guests.child_count ?? guests.children),
    place: placeOf(name, address || propertyAddress),
    financials: asRecord(row.financials),
  };
}

function placeOf(name: string, address: string): string {
  const blob = `${name} ${address}`.toLowerCase();
  if (/blue jays/.test(blob)) return "20 Blue Jays Way";
  if (/roseglor/.test(blob)) return "Roseglor";
  if (/charlotte/.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  if (/\bshaw\b/.test(blob)) return "1065 Shaw Street";
  return address || name;
}

function spokenWhen(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const dt = new Date(dateOnly ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(dt.getTime())) return raw;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(dt);
  if (dateOnly || !/T\d{2}:\d{2}/.test(raw)) return date;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone: "America/Toronto",
  }).format(dt).replace(/\u202f/g, " ");
  return `${date} at ${time}`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRow);
  if (!isRow(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data.filter(isRow);
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRow(value) ? value : {};
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function countOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
