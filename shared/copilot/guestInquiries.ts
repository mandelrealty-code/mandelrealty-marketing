/**
 * Booking requests and open inquiries, as Inquiry follow-ups.
 * Hospitable's tools can read a request. None accept or decline one.
 * Approve and decline open the Airbnb request and wait for the read-back.
 */

import type { GuestFollowUp } from "./guestTypes.js";

export type InquiryTurn = { at: string; role: string; name: string; body: string };

export type InquiryRecord = {
  id: string;
  code: string;
  status: string;
  guest: string;
  guestPhoto: string;
  /** Null when the record does not say how many reviews the guest has. */
  reviews: number | null;
  guestSince: string;
  property: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  total: string;
  pendingAt: string;
  airbnbThread: string;
};

export type InquiryPhase = "" | "verifying-approve" | "verifying-decline";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function isOpenRequest(status: string): boolean {
  return requestKind(status) === "open";
}

export function requestKind(status: string): "open" | "accepted" | "declined" | "withdrawn" | "expired" | "cancelled" | "other" {
  const value = status.trim().toLowerCase();
  if (!value) return "other";
  if (/withdraw/.test(value)) return "withdrawn";
  if (/expir/.test(value)) return "expired";
  if (/not_accepted|declin|denied/.test(value)) return "declined";
  if (/cancel/.test(value)) return "cancelled";
  if (value === "accepted" || /accepted/.test(value)) return "accepted";
  if (value === "request" || value === "pending" || value === "inquiry" || value === "open") return "open";
  return "other";
}

/** Platform window is pending plus 24 hours. A deadline written in the thread wins only when it is earlier. */
export function responseDeadline(pendingAt: string, turns: InquiryTurn[]): Date | null {
  const pending = new Date(pendingAt);
  if (Number.isNaN(pending.getTime())) return null;
  const platform = new Date(pending.getTime() + WINDOW_MS);
  const stated = threadDeadline(turns, pending);
  if (!stated) return platform;
  return stated.getTime() + 2 * 60 * 1000 < platform.getTime() ? stated : platform;
}

export function bookingRequestFollowUp(record: InquiryRecord, turns: InquiryTurn[], now: Date, phase: InquiryPhase = ""): GuestFollowUp | null {
  if (requestKind(record.status) !== "open") return null;
  const deadline = responseDeadline(record.pendingAt, turns);
  if (!deadline || deadline.getTime() <= now.getTime()) return null;
  const guest = record.guest.trim() || "Guest";
  const first = guest.split(/\s+/)[0] || "Guest";
  const nights = nightCount(record.checkIn, record.checkOut);
  const guests = record.adults + record.children;
  const fresh = isNewAccount(record, now);
  const rules = fresh ? rulesConfirmation(turns) : { confirmed: true, quote: "", when: "" };
  const stated = threadDeadline(turns, new Date(record.pendingAt));
  const platform = new Date(new Date(record.pendingAt).getTime() + WINDOW_MS);
  const left = deadline.getTime() - now.getTime();
  const notes: string[] = [];
  if (fresh) notes.push("New account: the record has no reviews yet.");
  if (fresh && !rules.confirmed) notes.push("House rules not confirmed yet.");
  if (stated && stated.getTime() + 2 * 60 * 1000 < platform.getTime()) notes.push("The thread states an earlier deadline than Airbnb's 24-hour window. Using the earlier one.");
  if (left <= FOUR_HOURS) notes.push("Unanswered. 4 hours left before Airbnb expires this request.");
  else if (left <= WINDOW_MS) notes.push("Unanswered. 24 hours to respond.");
  const dates = `${shortDate(record.checkIn)} → ${shortDate(record.checkOut)}`;
  const total = record.total || "the total is not on the record";
  const suggested = fresh && !rules.confirmed ? "rules" : "approve";
  return {
    id: `inquiry:${record.id}`,
    kind: "inquiry",
    reservationId: record.id,
    guest,
    first,
    initials: "",
    guestPhoto: record.guestPhoto,
    property: record.property,
    propertyId: record.propertyId,
    propertyPhoto: "",
    dates,
    stay: `${dates} · ${nights} ${nights === 1 ? "night" : "nights"} · ${guests || "the guest count is not on the record"} guests`,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    line: `Booking request · ${dates} · ${total}`,
    tag: "INQUIRY",
    sourceLine: `From the thread with ${guest}, booking request ${weekdayTime(record.pendingAt)}`,
    sourceAt: requestSourceAt(turns, record.pendingAt),
    due: "",
    dueLabel: "",
    dueSub: "",
    dueText: `Respond by ${respondBy(deadline)}`,
    dueNow: false,
    when: clock(deadline),
    whenSub: "request expires",
    dueFrom: "thread",
    onOrAfter: false,
    topic: "booking request",
    promised: "",
    promisedBy: "",
    promisedAt: "",
    promisedWhen: "",
    agreed: rules.quote,
    agreedBy: rules.quote ? first : "",
    agreedAt: "",
    agreedWhen: rules.when,
    agreedAs: rules.confirmed ? "agreed" : "",
    what: "",
    sentBy: "",
    sentWhen: "",
    since: "",
    resolvesWhen: "Airbnb shows the request accepted, declined, withdrawn, or expired.",
    expiresAt: deadline.toISOString(),
    draft: suggested === "rules"
      ? `Hi ${first}, before we can accept, please reply that you’ve read the house rules and agree to them.`
      : "",
    notes,
    newToAirbnb: fresh,
    joined: joinedLine(record, now),
    nights: String(nights),
    guestCount: guests ? String(guests) : "",
    price: record.total,
    rulesConfirmed: !fresh || rules.confirmed,
    rulesQuote: rules.quote,
    rulesWhen: rules.when,
    airbnbUrl: airbnbRequestUrl(record),
    phase,
    suggested,
    declineDraft: `Hi ${first}, thanks for your interest in ${record.property}. Unfortunately we can’t host this stay.`,
  };
}

export function inquiryCloseText(status: string, expiresAt: string, now: Date): string {
  const kind = requestKind(status);
  const when = clock(now);
  if (kind === "accepted") return `Confirmed at ${when}. Airbnb shows the booking accepted.`;
  if (kind === "declined") return `Airbnb declined the request. Read back at ${when}.`;
  if (kind === "withdrawn") return `The guest withdrew the request. Read back at ${when}.`;
  if (kind === "cancelled") return `The request was cancelled. Read back at ${when}.`;
  if (kind === "expired") return `The request expired. Read back at ${when}.`;
  const deadline = new Date(expiresAt);
  if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()) return `The request expired ${clock(deadline)}.`;
  return `The request is no longer pending. Read back at ${when}.`;
}

export function recordFromRow(row: Record<string, unknown>, property: string, propertyId: string): InquiryRecord | null {
  const id = text(row.id);
  if (!id) return null;
  const guest = isRow(row.guest) ? row.guest : {};
  const guests = isRow(row.guests) ? row.guests : {};
  const name = [text(guest.first_name), text(guest.last_name)].filter(Boolean).join(" ") || text(row.guest_name);
  const reviews = countOrNull(guest.reviews_count ?? guest.review_count ?? guest.reviews);
  return {
    id,
    code: text(row.code) || text(row.platform_id),
    status: text(row.status).toLowerCase(),
    guest: name,
    guestPhoto: photoOf(guest) || photoOf(row),
    reviews,
    guestSince: text(guest.created_at) || text(guest.joined_at),
    property,
    propertyId: text(row.property_id) || propertyId,
    checkIn: day(text(row.arrival_date) || text(row.check_in) || text(row.checkin_date)),
    checkOut: day(text(row.departure_date) || text(row.check_out) || text(row.checkout_date)),
    adults: countOf(guests.adult_count ?? guests.adults ?? row.adults),
    children: countOf(guests.child_count ?? guests.children ?? row.children),
    total: requestTotal(isRow(row.financials) ? row.financials : {}),
    pendingAt: text(row.booked_at) || text(row.created_at) || text(row.pending_at),
    airbnbThread: threadId(row),
  };
}

export function airbnbRequestUrl(record: Pick<InquiryRecord, "airbnbThread">): string {
  return record.airbnbThread ? `https://www.airbnb.ca/hosting/messages/${record.airbnbThread}` : "";
}

function rulesConfirmation(turns: InquiryTurn[]): { confirmed: boolean; quote: string; when: string } {
  const rulesSent = turns.some((turn) => turn.role !== "guest" && /house rules/i.test(turn.body));
  const guest = [...turns].reverse().find((turn) => turn.role === "guest" && confirmsRules(turn.body) && (rulesSent || /house rules/i.test(turn.body)));
  if (!guest) return { confirmed: false, quote: "", when: "" };
  return { confirmed: true, quote: guest.body.trim(), when: weekdayTime(guest.at) };
}

function confirmsRules(body: string): boolean {
  return /\b(i(?:'ve| have) read|i agree|agree to (?:them|the)|i confirm|confirmed)\b/i.test(body) && /rule|quiet|part/i.test(body);
}

function isNewAccount(record: InquiryRecord, now: Date): boolean {
  if (record.reviews === 0) return true;
  if (record.reviews != null && record.reviews > 0) return false;
  const since = new Date(record.guestSince);
  if (Number.isNaN(since.getTime())) return false;
  return now.getTime() - since.getTime() < 90 * 24 * 60 * 60 * 1000;
}

function joinedLine(record: InquiryRecord, now: Date): string {
  const since = new Date(record.guestSince);
  if (Number.isNaN(since.getTime())) return record.reviews === 0 ? "No reviews on the record" : "";
  const sameMonth = torontoMonth(since) === torontoMonth(now);
  const reviews = record.reviews === 0 ? "no reviews yet" : record.reviews == null ? "" : `${record.reviews} reviews`;
  const joined = sameMonth ? "Joined Airbnb this month" : `On Airbnb since ${monthYear(since)}`;
  return [joined, reviews].filter(Boolean).join(" · ");
}

function threadDeadline(turns: InquiryTurn[], pending: Date): Date | null {
  const blob = turns.map((turn) => turn.body).join("\n");
  if (!/respond by|expires|deadline|respond before/i.test(blob)) return null;
  let found: Date | null = null;
  for (const turn of turns) {
    if (!/respond by|expires|deadline|respond before/i.test(turn.body)) continue;
    const next = statedInstant(turn.body, pending);
    if (next && (!found || next.getTime() < found.getTime())) found = next;
  }
  return found;
}

function statedInstant(text: string, pending: Date): Date | null {
  const month = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  const clock = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!month || !clock) return null;
  const monthIndex = monthIndexOf(month[1]);
  const day = Number(month[2]);
  if (monthIndex < 0 || day < 1 || day > 31) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2] || "0");
  const pm = /^p/i.test(clock[3]);
  if (pm && hour < 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  const year = pendingYear(pending, monthIndex);
  return zoned(year, monthIndex + 1, day, hour, minute);
}

function pendingYear(pending: Date, monthIndex: number): number {
  const parts = torontoParts(pending);
  if (monthIndex + 1 < parts.month - 1) return parts.year + 1;
  return parts.year;
}

function monthIndexOf(name: string): number {
  const value = name.toLowerCase();
  const full = MONTHS.findIndex((month) => month.startsWith(value.slice(0, 3)));
  return full;
}

function zoned(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const shown = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"));
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

function requestSourceAt(turns: InquiryTurn[], pendingAt: string): string {
  const notice = turns.find((turn) => /booking request|respond by/i.test(turn.body));
  return notice?.at || pendingAt;
}

function requestTotal(financials: Record<string, unknown>): string {
  const guest = isRow(financials.guest) ? financials.guest : {};
  const raw = guest.total_price ?? guest.total ?? financials.guest_total ?? financials.total;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (isRow(raw)) {
    const formatted = text(raw.formatted) || text(raw.label);
    if (formatted) return formatted;
  }
  return "";
}

function nightCount(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

function threadId(row: Record<string, unknown>): string {
  const conversation = isRow(row.conversation) ? row.conversation : {};
  for (const value of [row.platform_thread_id, row.thread_id, conversation.platform_id, conversation.external_id, conversation.thread_id]) {
    const id = text(value);
    if (/^\d{5,}$/.test(id)) return id;
  }
  return "";
}

function photoOf(row: Record<string, unknown>): string {
  const picture = isRow(row.picture) ? row.picture : {};
  for (const value of [row.picture, row.picture_url, row.photo, row.thumbnail, picture.url, picture.original]) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return "";
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day))).replace(",", "");
}

function respondBy(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clock(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function weekdayTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short" }).format(date);
  return `${weekday} ${clock(date)}`;
}

function torontoMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(date);
}

function monthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", month: "long", year: "numeric" }).format(date);
}

function torontoParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function countOf(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function countOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function day(value: string): string {
  return value.slice(0, 10);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
