/**
 * Early check-in and late checkout.
 * Copilot reads the thread, judges the calendar, and leaves one price card.
 * Nothing is sent until a partner approves or edits that price.
 * After payment, the reservation time and the cleaner-app turnover both have to read back
 * as the new time before the update is complete.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commitHospitable } from "./hospitableAgent.js";
import { callHospitableMcp } from "./hospitableMcp.js";
import { readCleanerUnit } from "./cleanerRead.js";
import { captureDraft, captureReport } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import { paritySaveChecksMessage } from "./parity/storeStub.js";
import { registerUpsellReset, writeParityTurnoverClock } from "./parity/world.js";
import { addMessage, createChat, draftsRecorded, listChats, recordDrafts, recordReport, reportRecorded } from "./store.js";
import { addDays } from "./time.js";
import type { CopilotDraft, CopilotMessage, UpsellOffer } from "./types.js";

const STANDARD_IN = 16 * 60;
const STANDARD_OUT = 11 * 60;
const EARLY_FROM = 11 * 60;
const CLEAN_MINUTES = 180;
const EARLY_FLAT_CENTS = 9900;

const COMPLAINT = /\b(dirty|filthy|disgusting|broken|does not work|doesn't work|smell|smelled|refund|compensation|compensate|reimburse|damage claim|damage|unsafe|locked out|complaint|maintenance|mold|bugs?|roach|not clean|wasn't clean|was not clean)\b/i;
const UNHAPPY = /\b(unhappy|upset|furious|dispute|disputed|this is ridiculous|terrible stay|worst stay)\b/i;
const RULE = /\b(extra guests?|additional guests?|bringing (?:a |our )?(?:pet|dog|cat)|pets? allowed|our dog|a dog|our cat|a cat|throw(?:ing)? a party|having a party|host(?:ing)? an event)\b/i;
const DISCOUNT_ASK = /\b(discount|lower (?:the )?price|anything you can do on the price|best price|too expensive)\b/i;

export type UpsellSchedule = {
  propertyId: string;
  earlyFrom: string;
  earlyFlatCents: number;
  cleanMinutes: number;
  standardCheckIn: string;
  standardCheckOut: string;
  lateTiers: { until: string; cents: number }[];
};

type Watch = {
  reservationId: string;
  propertyId: string;
  property: string;
  guest: string;
  kind: "early" | "late";
  label: string;
  minutes: number;
  checkIn: string;
  checkOut: string;
  amountCents: number;
  turnoverOn: string;
  cleanOn: string;
  nightBefore: boolean;
  phase: "watching" | "complete" | "sync-failed" | "escalated" | "released";
};

type Clock = { minutes: number; label: string };

type Neighbor = {
  id: string;
  checkIn: string;
  checkOut: string;
  checkInMinutes: number;
  checkOutMinutes: number;
  status: string;
};

const watches = new Map<string, Watch>();
const schedules = new Map<string, UpsellSchedule>();
const FILE = path.join(process.cwd(), "data", "upsell-flow.json");

const DEFAULT_LATE = [
  { until: "13:00", cents: 4900 },
  { until: "14:00", cents: 7900 },
  { until: "16:00", cents: 12900 },
];

function resetUpsellFlow(): void {
  watches.clear();
  schedules.clear();
}

registerUpsellReset(resetUpsellFlow);

function loadPersisted(): void {
  if (parityEnabled() || watches.size || schedules.size) return;
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as { watches?: Watch[]; schedules?: UpsellSchedule[] };
    for (const row of data.watches ?? []) watches.set(row.reservationId, row);
    for (const row of data.schedules ?? []) schedules.set(row.propertyId, row);
  } catch {
    /* A missing file starts from the seeded schedule. */
  }
}

function savePersisted(): void {
  if (parityEnabled()) return;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({
    watches: [...watches.values()],
    schedules: [...schedules.values()],
  }, null, 2));
}

export function readUpsellSchedule(propertyId: string): UpsellSchedule {
  loadPersisted();
  const found = schedules.get(propertyId);
  if (found) return { ...found, lateTiers: found.lateTiers.map((row) => ({ ...row })) };
  return {
    propertyId,
    earlyFrom: "11:00",
    earlyFlatCents: EARLY_FLAT_CENTS,
    cleanMinutes: CLEAN_MINUTES,
    standardCheckIn: "16:00",
    standardCheckOut: "11:00",
    lateTiers: DEFAULT_LATE.map((row) => ({ ...row })),
  };
}

export function saveUpsellSchedule(propertyId: string, patch: Partial<Omit<UpsellSchedule, "propertyId">>): UpsellSchedule {
  const current = readUpsellSchedule(propertyId);
  const next: UpsellSchedule = {
    ...current,
    ...patch,
    propertyId,
    lateTiers: (patch.lateTiers ?? current.lateTiers).map((row) => ({ ...row })),
  };
  schedules.set(propertyId, next);
  savePersisted();
  return readUpsellSchedule(propertyId);
}

function dollars(cents: number): string {
  const amount = cents / 100;
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function labelFromMinutes(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function minutesOfClock(value: string, fallback: number): number {
  const iso = /T(\d{2}):(\d{2})/.exec(value);
  if (iso) return Number(iso[1]) * 60 + Number(iso[2]);
  const plain = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (plain) return Number(plain[1]) * 60 + Number(plain[2]);
  return fallback;
}

function clockTo24(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function longDate(iso: string): string {
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

function stamp(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

function clocksIn(text: string): (Clock & { index: number })[] {
  const found: (Clock & { index: number })[] = [];
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)|\b(\d{3,4})\s*(a\.?m\.?|p\.?m\.?)/gi;
  for (const match of text.matchAll(re)) {
    let hour = 0;
    let minute = 0;
    let suffix = "";
    if (match[1]) {
      hour = Number(match[1]);
      minute = Number(match[2] ?? "0");
      suffix = match[3].toLowerCase();
    } else if (match[4]) {
      const digits = match[4];
      if (digits.length <= 2) continue;
      hour = digits.length === 3 ? Number(digits[0]) : Number(digits.slice(0, 2));
      minute = digits.length === 3 ? Number(digits.slice(1)) : Number(digits.slice(2));
      suffix = (match[5] ?? "").toLowerCase();
    }
    if (!suffix || hour > 12 || minute > 59) continue;
    const pm = suffix.startsWith("p");
    if (hour === 12) hour = 0;
    const minutes = (pm ? hour + 12 : hour) * 60 + minute;
    found.push({ minutes, label: labelFromMinutes(minutes), index: match.index ?? 0 });
  }
  return found;
}

function pickClock(text: string, times: (Clock & { index: number })[], anchor: RegExp): Clock | null {
  const near = times.filter((clock) => anchor.test(text.slice(Math.max(0, clock.index - 48), clock.index)));
  return near.at(-1) ?? times.at(-1) ?? null;
}

function hostAgreed(messages: { at: string; role: string; body: string }[], at: string): boolean {
  return messages.some((row) => row.role === "host" && row.at > at && /\b(yes|works|confirmed|that's fine|that is fine|no problem|sounds good)\b/i.test(row.body));
}

type FoundRequest = {
  kind: "early" | "late";
  minutes: number;
  label: string;
  at: string;
  unverified?: boolean;
};

function detectRequest(messages: { at: string; role: string; body: string }[]): FoundRequest | null {
  let found: FoundRequest | null = null;
  for (const row of messages) {
    if (row.role !== "guest" || !row.body.trim()) continue;
    const times = clocksIn(row.body);
    const lateWord = /\b(check[\s-]*out|checkout)\b/i.test(row.body);
    const earlyWord = /\b(early|earlier|sooner|get in|check[\s-]*in|arriv\w*)\b/i.test(row.body);
    const lateTime = pickClock(row.body, times.filter((clock) => clock.minutes > STANDARD_OUT), /\b(check[\s-]*out|checkout|leave|depart)\b/i);
    const earlyTime = pickClock(row.body, times.filter((clock) => clock.minutes < STANDARD_IN), /\b(get in|check[\s-]*in|arriv\w*|early)\b/i);
    if (lateWord && lateTime && /\b(late|later|until|at|by)\b/i.test(row.body)) {
      if (hostAgreed(messages, row.at)) continue;
      found = { kind: "late", minutes: lateTime.minutes, label: lateTime.label, at: row.at };
      continue;
    }
    if (earlyWord && earlyTime && earlyTime.minutes < STANDARD_IN) {
      if (hostAgreed(messages, row.at)) continue;
      found = { kind: "early", minutes: earlyTime.minutes, label: earlyTime.label, at: row.at };
      continue;
    }
    if ((/\bearly\b/i.test(row.body) && /\bcheck[\s-]*in|get in|arriv/i.test(row.body)) || (/\blate\b/i.test(row.body) && lateWord)) {
      if (hostAgreed(messages, row.at) || times.length) continue;
      found = { kind: lateWord ? "late" : "early", minutes: -1, label: "", at: row.at, unverified: true };
    }
  }
  return found;
}

function boundaryReason(text: string): string {
  if (COMPLAINT.test(text) || UNHAPPY.test(text)) return "This thread also has a complaint. I flagged it and did not send an upsell.";
  if (RULE.test(text)) return "This thread asks for a rule exception. I flagged it and did not send an upsell.";
  if (/\b(refund|compensation|damage claim)\b/i.test(text)) return "This thread asks for money beyond an upsell. I flagged it and did not send an upsell.";
  return "";
}

export function quoteUpsell(input: {
  propertyId: string;
  kind: "early" | "late";
  minutes: number;
  nightCents: number | null;
  thread: string;
}): { cents: number; reason: string } | null {
  const schedule = readUpsellSchedule(input.propertyId);
  let cents = 0;
  let reason = "";
  if (input.kind === "early") {
    if (input.minutes >= EARLY_FROM) {
      cents = schedule.earlyFlatCents;
      reason = `Early arrival from ${labelFromMinutes(EARLY_FROM)} is ${dollars(schedule.earlyFlatCents)}.`;
    } else if (input.nightCents == null || input.nightCents <= 0) {
      return null;
    } else {
      cents = input.nightCents;
      reason = "Early arrival before 11:00 AM is the previous night's rate.";
    }
  } else {
    const tiers = [...schedule.lateTiers].sort((a, b) => minutesOfClock(a.until, 0) - minutesOfClock(b.until, 0));
    const tier = tiers.find((row) => input.minutes <= minutesOfClock(row.until, 0));
    if (!tier) return null;
    cents = tier.cents;
    reason = `Late checkout until ${labelFromMinutes(minutesOfClock(tier.until, 0))} is ${dollars(tier.cents)} on this property.`;
  }
  if (DISCOUNT_ASK.test(input.thread) && cents > 100) {
    const next = Math.max(100, Math.round((cents * 0.85) / 100) * 100);
    if (next < cents) {
      return { cents: next, reason: `${reason} They asked for a lower price, so I reduced it to ${dollars(next)} to close the booking.` };
    }
  }
  return { cents, reason };
}

function judge(input: {
  kind: "early" | "late";
  minutes: number;
  checkIn: string;
  checkOut: string;
  selfId: string;
  cleanMinutes: number;
  neighbors: Neighbor[];
  nightListedEmpty: boolean;
}): { verdict: "feasible" | "different" | "not"; minutes: number; reason: string; nightBefore: boolean } {
  const open = input.neighbors.filter((row) => row.id !== input.selfId && !/cancel/.test(row.status));
  if (input.kind === "early") {
    const departing = open.filter((row) => row.checkOut === input.checkIn);
    const night = addDays(input.checkIn, -1);
    const nightOccupied = !input.nightListedEmpty || open.some((row) => row.checkIn <= night && row.checkOut > night);
    if (!departing.length && !nightOccupied) {
      const earlyMorning = input.minutes < EARLY_FROM;
      return {
        verdict: "feasible",
        minutes: input.minutes,
        nightBefore: earlyMorning,
        reason: "The night before is empty, so there is no departure that morning.",
      };
    }
    if (!departing.length) {
      return {
        verdict: "not",
        minutes: input.minutes,
        nightBefore: false,
        reason: "The night before is occupied, and I can't see a departure time to judge the clean.",
      };
    }
    const earliest = departing.length
      ? Math.max(...departing.map((row) => row.checkOutMinutes + input.cleanMinutes))
      : input.minutes;
    const who = departing[0];
    const left = who ? labelFromMinutes(who.checkOutMinutes) : "that morning";
    if (earliest >= STANDARD_IN) {
      return {
        verdict: "not",
        minutes: input.minutes,
        nightBefore: false,
        reason: `A guest departs at ${left} and the clean takes ${input.cleanMinutes / 60} hours, so there is no early arrival that day.`,
      };
    }
    if (input.minutes >= earliest) {
      return {
        verdict: "feasible",
        minutes: input.minutes,
        nightBefore: false,
        reason: `The departure at ${left} plus the ${input.cleanMinutes / 60} hour clean is done before ${labelFromMinutes(input.minutes)}.`,
      };
    }
    return {
      verdict: "different",
      minutes: earliest,
      nightBefore: false,
      reason: `A guest departs at ${left} and the clean takes ${input.cleanMinutes / 60} hours. The closest time is ${labelFromMinutes(earliest)}.`,
    };
  }
  const arriving = open.filter((row) => row.checkIn === input.checkOut);
  if (!arriving.length) {
    return {
      verdict: "feasible",
      minutes: input.minutes,
      nightBefore: false,
      reason: "No guest arrives on the checkout day.",
    };
  }
  const latest = Math.min(...arriving.map((row) => row.checkInMinutes - input.cleanMinutes));
  const arrival = labelFromMinutes(arriving[0]?.checkInMinutes ?? STANDARD_IN);
  if (latest <= STANDARD_OUT) {
    return {
      verdict: "not",
      minutes: STANDARD_OUT,
      nightBefore: false,
      reason: `The next guest arrives at ${arrival} and the clean takes ${input.cleanMinutes / 60} hours, so a late checkout does not fit.`,
    };
  }
  if (input.minutes <= latest) {
    return {
      verdict: "feasible",
      minutes: input.minutes,
      nightBefore: false,
      reason: `The next guest arrives at ${arrival}, and ${labelFromMinutes(input.minutes)} still leaves the ${input.cleanMinutes / 60} hour clean.`,
    };
  }
  return {
    verdict: "not",
    minutes: latest,
    nightBefore: false,
    reason: `The next guest arrives at ${arrival} and the clean takes ${input.cleanMinutes / 60} hours, so ${labelFromMinutes(input.minutes)} does not fit. The closest time is ${labelFromMinutes(latest)}.`,
  };
}

function offerMessage(guest: string, kind: "early" | "late", time: string, when: string, price: string, decline: boolean, requested: string): string {
  if (decline) {
    const noun = kind === "early" ? "arrival" : "checkout";
    return `Hi ${guest}, ${requested} isn't available for your ${noun} on ${when}. I can offer ${time} for ${price}. If that works for you, I'll send a payment request for ${price} through Airbnb.`;
  }
  if (requested !== time) {
    const noun = kind === "early" ? "arrival" : "checkout";
    return `Hi ${guest}, ${requested} isn't open for your ${noun}. The closest I can do is ${time} on ${when}, for ${price}. I'll send a payment request for ${price} through Airbnb. Once it's paid, you're confirmed for ${time}.`;
  }
  if (kind === "early") {
    return `Hi ${guest}, ${time} works for your arrival on ${when}. The early check-in is ${price}. I'll send a payment request for ${price} through Airbnb. Once it's paid, you're confirmed for ${time}.`;
  }
  return `Hi ${guest}, ${time} works for your checkout on ${when}. The late checkout is ${price}. I'll send a payment request for ${price} through Airbnb. Once it's paid, you're confirmed for ${time}.`;
}

function cardText(offer: UpsellOffer): string {
  return [
    `Guest: ${offer.guest}`,
    `Property: ${offer.property}`,
    `Requested: ${offer.kind === "early" ? "early arrival" : "late checkout"} at ${offer.requestedLabel}`,
    `Feasibility: ${offer.verdict}. ${offer.reason}`,
    `Proposed price: ${dollars(offer.priceCents)}`,
    `Payment request: ${dollars(offer.priceCents)}`,
    "Guest message:",
    offer.message,
    "",
    "Nothing is sent until you approve or edit the price.",
  ].join("\n");
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data ?? raw;
  if (Array.isArray(data)) return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (data && typeof data === "object") {
    const days = (data as { days?: unknown }).days;
    if (Array.isArray(days)) return days.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  return [];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function checksChat(): Promise<string> {
  const chats = await listChats().catch(() => []);
  const existing = chats.find((chat) => chat.title === "Checks");
  if (existing) return existing.id;
  const chat = await createChat("Checks");
  return chat.id;
}

async function saveCheck(input: { body: string; draft?: CopilotDraft | null; headline: string; needsYou: boolean }): Promise<void> {
  captureReport({
    headline: input.headline,
    text: input.body,
    needs_you: input.needsYou,
    title: input.headline,
    summary: input.body.slice(0, 180),
  });
  if (input.draft) {
    captureDraft({
      channel: input.draft.channel,
      to: input.draft.to,
      subject: input.draft.subject,
      body: input.draft.body,
      warnings: [],
      needs_you: input.needsYou,
    });
  }
  const message: CopilotMessage = {
    id: randomUUID(),
    chat_id: "checks",
    created_at: new Date().toISOString(),
    role: "assistant",
    body: input.body,
    draft: input.draft ?? null,
  };
  if (parityEnabled()) {
    paritySaveChecksMessage(message);
    return;
  }
  const chatId = await checksChat();
  await addMessage({ chatId, role: "assistant", body: input.body, draft: input.draft ?? null });
}

async function flag(key: string, headline: string, text: string): Promise<void> {
  if (await reportRecorded(key)) return;
  await recordReport(key);
  await saveCheck({ body: text, headline, needsYou: true });
}

async function readNeighbors(propertyId: string, checkIn: string, checkOut: string): Promise<Neighbor[]> {
  const raw = await callHospitableMcp("get-reservations", {
    properties: [propertyId],
    start_date: addDays(checkIn, -2),
    end_date: addDays(checkOut, 2),
    date_query: "checkin",
    per_page: 100,
    include: "guest",
  });
  return rowsOf(raw).map((row) => {
    const checkInDay = (textOf(row.arrival_date) || textOf(row.check_in)).slice(0, 10);
    const checkOutDay = (textOf(row.departure_date) || textOf(row.check_out)).slice(0, 10);
    return {
      id: textOf(row.id),
      checkIn: checkInDay,
      checkOut: checkOutDay,
      checkInMinutes: minutesOfClock(textOf(row.checkin_time) || textOf(row.check_in), STANDARD_IN),
      checkOutMinutes: minutesOfClock(textOf(row.checkout_time) || textOf(row.check_out), STANDARD_OUT),
      status: textOf(row.status),
    };
  }).filter((row) => row.id && row.checkIn && row.checkOut);
}

async function readNight(propertyId: string, checkIn: string): Promise<{ empty: boolean; priceCents: number | null; read: boolean }> {
  const start = addDays(checkIn, -1);
  const raw = await callHospitableMcp("get-property-calendar", {
    uuid: propertyId,
    start_date: start,
    end_date: checkIn,
  });
  const days = rowsOf(raw);
  if (!days.length) return { empty: false, priceCents: null, read: false };
  const night = days.find((row) => textOf(row.date).slice(0, 10) === start);
  if (!night) return { empty: false, priceCents: null, read: false };
  const status = textOf(night.status).toLowerCase();
  const available = night.available !== false && status !== "unavailable" && status !== "booked";
  const price = night.price;
  const amount = price && typeof price === "object" ? Number((price as { amount?: unknown }).amount) : Number(price);
  return { empty: available, priceCents: Number.isFinite(amount) ? amount : null, read: true };
}

export async function reviewStayUpsell(input: {
  reservationId: string;
  code: string;
  guest: string;
  propertyId: string;
  propertyName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  status: string;
  messages: { at: string; role: string; body: string }[];
  now: Date;
}): Promise<void> {
  if (!input.reservationId || /cancel/.test(input.status)) return;
  const request = detectRequest(input.messages);
  if (!request) return;
  const property = input.propertyName || input.address;
  const thread = input.messages.map((row) => row.body).join("\n");
  const blocked = boundaryReason(thread);
  if (blocked) {
    await flag(`upsell-boundary:${input.reservationId}`, `${input.guest} needs a partner`, `${input.guest} at ${property}. ${blocked}`);
    return;
  }
  if (request.unverified) {
    await flag(
      `upsell-time:${input.reservationId}`,
      `${input.guest} needs a time`,
      `${input.guest} at ${property} asked for ${request.kind === "early" ? "an early arrival" : "a late checkout"}, and I could not verify the time from the thread. Nothing was sent.`,
    );
    return;
  }
  const cardKey = `upsell:${input.reservationId}:${request.kind}:${request.minutes}`;
  if (await draftsRecorded(cardKey) || watches.has(input.reservationId)) return;
  let neighbors: Neighbor[] = [];
  let night = { empty: false, priceCents: null as number | null, read: false };
  try {
    neighbors = await readNeighbors(input.propertyId, input.checkIn, input.checkOut);
    night = await readNight(input.propertyId, input.checkIn);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The calendar didn't return.";
    await flag(`upsell-read:${input.reservationId}`, `${input.guest} needs a partner`, `${input.guest} at ${property}. I can't verify feasibility from the records. ${message} Nothing was sent.`);
    return;
  }
  if (!night.read) {
    await flag(`upsell-read:${input.reservationId}`, `${input.guest} needs a partner`, `${input.guest} at ${property}. I can't verify the night before from the property calendar. Nothing was sent.`);
    return;
  }
  const schedule = readUpsellSchedule(input.propertyId);
  const judged = judge({
    kind: request.kind,
    minutes: request.minutes,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    selfId: input.reservationId,
    cleanMinutes: schedule.cleanMinutes,
    neighbors,
    nightListedEmpty: night.empty,
  });
  const offeredMinutes = judged.minutes;
  const price = quoteUpsell({
    propertyId: input.propertyId,
    kind: request.kind,
    minutes: offeredMinutes,
    nightCents: night.priceCents,
    thread,
  });
  if (!price) {
    await flag(`upsell-price:${input.reservationId}`, `${input.guest} needs a price`, `${input.guest} at ${property}. I can't verify the upsell price from the schedule or the previous night's rate. Nothing was sent.`);
    return;
  }
  const alternative = judged.verdict !== "feasible";
  const decline = judged.verdict === "not";
  if (decline && !/closest time/.test(judged.reason)) {
    await flag(`upsell-conflict:${input.reservationId}`, `${input.guest} needs a partner`, `${input.guest} at ${property}. ${judged.reason} Nothing was sent.`);
    return;
  }
  const when = longDate(request.kind === "early" ? input.checkIn : input.checkOut);
  const offeredLabel = labelFromMinutes(offeredMinutes);
  const message = offerMessage(input.guest, request.kind, offeredLabel, when, dollars(price.cents), decline, request.label);
  const verdict = judged.verdict === "feasible"
    ? "feasible"
    : judged.verdict === "different"
      ? "feasible at a different time"
      : "not feasible";
  const offer: UpsellOffer = {
    phase: decline ? "decline" : "verify",
    reservationId: input.reservationId,
    propertyId: input.propertyId,
    property,
    guest: input.guest,
    kind: request.kind,
    requestedLabel: request.label,
    requestedMinutes: request.minutes,
    offeredLabel,
    offeredMinutes,
    verdict,
    reason: judged.reason,
    priceCents: price.cents,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    message,
    nightBefore: judged.nightBefore && !alternative,
  };
  const body = [cardText(offer), price.reason].join("\n");
  const draft: CopilotDraft = {
    subject: `${input.guest} at ${property}, ${offer.offeredLabel} ${request.kind === "early" ? "early arrival" : "late checkout"}, ${dollars(price.cents)}`,
    body,
    to: input.guest,
    status: "waiting",
    channel: "note",
    upsell: offer,
  };
  await recordDrafts(cardKey);
  await saveCheck({
    body,
    draft,
    headline: draft.subject,
    needsYou: true,
  });
}

function pricedMessage(offer: UpsellOffer, cents: number): string {
  if (cents === offer.priceCents) return offer.message;
  return offer.message.split(dollars(offer.priceCents)).join(dollars(cents));
}

async function noteReservation(reservationId: string, line: string): Promise<void> {
  await commitHospitable("update-reservation", { uuid: reservationId, notes: line });
}

export async function approveUpsell(offer: UpsellOffer, priceCents: number, now = new Date()): Promise<string> {
  const cents = Number.isFinite(priceCents) && priceCents > 0 ? Math.round(priceCents) : offer.priceCents;
  if (offer.phase === "remind") {
    await commitHospitable("send-reservation-message", { uuid: offer.reservationId, body: offer.message });
    const line = `${stamp(now)}. Sent ${offer.guest} the unpaid ${dollars(offer.priceCents)} reminder.`;
    await noteReservation(offer.reservationId, line);
    await saveCheck({ body: line, headline: `${offer.guest} reminder sent`, needsYou: false });
    return `Sent ${offer.guest} the reminder. The time stays on hold until it's paid or you release it.`;
  }
  const message = pricedMessage(offer, cents);
  const reason = offer.kind === "early" ? `Early check-in ${offer.offeredLabel}` : `Late checkout ${offer.offeredLabel}`;
  await commitHospitable("send-airbnb-payment-request", {
    uuid: offer.reservationId,
    amount: cents,
    currency: "CAD",
    reason,
  });
  await commitHospitable("send-reservation-message", { uuid: offer.reservationId, body: message });
  const line = `${stamp(now)}. Sent ${offer.guest} the ${offer.kind === "early" ? "early check-in" : "late checkout"} message and a ${dollars(cents)} Airbnb payment request. Waiting on payment.`;
  await noteReservation(offer.reservationId, line);
  const picture = await readCleanerUnit({
    propertyId: offer.propertyId,
    from: addDays(offer.checkIn, -1),
    to: offer.checkOut,
  });
  const turnoverOn = offer.kind === "late" ? offer.checkOut : offer.checkIn;
  const found = picture.ok ? picture.turnovers.find((row) => row.scheduledOn === turnoverOn) : undefined;
  const watch: Watch = {
    reservationId: offer.reservationId,
    propertyId: offer.propertyId,
    property: offer.property,
    guest: offer.guest,
    kind: offer.kind,
    label: offer.offeredLabel,
    minutes: offer.offeredMinutes,
    checkIn: offer.checkIn,
    checkOut: offer.checkOut,
    amountCents: cents,
    turnoverOn: found?.scheduledOn || turnoverOn,
    cleanOn: offer.nightBefore ? addDays(offer.checkIn, -1) : turnoverOn,
    nightBefore: offer.nightBefore,
    phase: "watching",
  };
  watches.set(offer.reservationId, watch);
  savePersisted();
  await saveCheck({ body: line, headline: `${offer.guest} is waiting on payment`, needsYou: false });
  return line;
}

export async function releaseUpsell(offer: UpsellOffer, now = new Date()): Promise<string> {
  const watch = watches.get(offer.reservationId);
  if (watch) watch.phase = "released";
  savePersisted();
  const line = `${stamp(now)}. Released the ${offer.offeredLabel} ${offer.kind === "early" ? "early arrival" : "late checkout"} for ${offer.guest} at ${offer.property}. Nothing else was sent.`;
  await noteReservation(offer.reservationId, line).catch(() => undefined);
  await saveCheck({ body: line, headline: `${offer.guest} time released`, needsYou: false });
  return line;
}

function paidAmount(raw: unknown, reservationId: string): number | null {
  for (const row of rowsOf(raw)) {
    const id = textOf(row.reservation_id) || textOf(row.reservation_uuid) || textOf(row.reservationId);
    if (id !== reservationId) continue;
    const status = textOf(row.status).toLowerCase();
    if (status && status !== "paid" && status !== "succeeded" && status !== "complete") continue;
    const price = row.price ?? row.total_price ?? row.amount;
    const amount = price && typeof price === "object" ? Number((price as { amount?: unknown }).amount) : Number(price);
    if (Number.isFinite(amount)) return amount;
  }
  return null;
}

function clockMatches(value: string | undefined, minutes: number): boolean {
  if (!value) return false;
  const spoken = clocksIn(value)[0];
  if (spoken) return spoken.minutes === minutes;
  return minutesOfClock(value, -1) === minutes;
}

async function writeCleanerClock(watch: Watch): Promise<void> {
  const arrival = watch.kind === "early" ? watch.label : "4:00 PM";
  const departure = watch.kind === "late" ? watch.label : "11:00 AM";
  if (parityEnabled()) {
    writeParityTurnoverClock({
      propertyId: watch.propertyId,
      scheduledOn: watch.turnoverOn,
      nextOn: watch.cleanOn,
      arrivalTime: arrival,
      departureTime: departure,
      arrivalOn: watch.checkIn,
    });
    return;
  }
  const key = (process.env.CLEANER_HUB_SYNC_KEY || "").trim();
  if (!key) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": key };
  const anon = (process.env.CLEANER_HUB_ANON_KEY || process.env.CLEANER_HUB_SUPABASE_ANON_KEY || "").trim();
  if (anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
  }
  const explicit = (process.env.CLEANER_HUB_SYNC_URL || "").trim();
  const base = (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const url = explicit || (base ? `${base}/functions/v1/ops-hub-sync` : "https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync");
  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "update_times",
      hospitable_property_id: watch.propertyId,
      scheduled_date: watch.turnoverOn,
      next_date: watch.cleanOn,
      arrival_time: arrival,
      departure_time: departure,
      arrival_on: watch.checkIn,
    }),
  }).catch(() => undefined);
}

function pastDeadline(checkIn: string, now: Date): boolean {
  const deadline = addDays(checkIn, -2);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (today > deadline) return true;
  if (today < deadline) return false;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= 16;
}

async function settleOne(watch: Watch, now: Date): Promise<void> {
  if (watch.phase !== "watching" && watch.phase !== "escalated") return;
  const paidRaw = await callHospitableMcp("get-purchased-upsells", { page: 1, per_page: 100 });
  const paid = paidAmount(paidRaw, watch.reservationId);
  if (paid == null) {
    if (watch.phase === "watching" && pastDeadline(watch.checkIn, now)) await escalate(watch, now);
    return;
  }
  if (paid !== watch.amountCents) {
    watch.phase = "sync-failed";
    savePersisted();
    await flag(
      `upsell-amount:${watch.reservationId}`,
      `${watch.guest} payment doesn't match`,
      `${watch.guest} at ${watch.property} paid ${dollars(paid)}. The approved upsell was ${dollars(watch.amountCents)}. I did not change the reservation time.`,
    );
    return;
  }
  const timeArgs = watch.kind === "early"
    ? { uuid: watch.reservationId, checkin_time: clockTo24(watch.minutes) }
    : { uuid: watch.reservationId, checkout_time: clockTo24(watch.minutes) };
  await commitHospitable("update-reservation", timeArgs);
  const readBack = await callHospitableMcp("get-reservation", { identifier: watch.reservationId });
  const row = readBack && typeof readBack === "object" && "data" in (readBack as object)
    ? (readBack as { data?: Record<string, unknown> }).data ?? {}
    : (readBack as Record<string, unknown>);
  const hospitableClock = watch.kind === "early"
    ? textOf(row?.checkin_time) || textOf(row?.check_in)
    : textOf(row?.checkout_time) || textOf(row?.check_out);
  const hospitableOk = clockMatches(hospitableClock, watch.minutes);
  await writeCleanerClock(watch);
  const picture = await readCleanerUnit({
    propertyId: watch.propertyId,
    from: addDays(watch.checkIn, -2),
    to: addDays(watch.checkOut, 1),
  });
  const turnover = picture.ok
    ? picture.turnovers.find((item) => item.arrivalOn === watch.checkIn || item.scheduledOn === watch.cleanOn || item.scheduledOn === watch.turnoverOn)
    : undefined;
  const cleanerClock = watch.kind === "early" ? turnover?.arrival : turnover?.departure;
  const cleanerOk = clockMatches(cleanerClock, watch.minutes) && (!watch.nightBefore || turnover?.scheduledOn === watch.cleanOn);
  if (!hospitableOk || !cleanerOk || !picture.ok) {
    watch.phase = "sync-failed";
    savePersisted();
    const shown = cleanerClock || "the old time";
    const wanted = watch.label;
    const when = turnover?.scheduledOn || watch.turnoverOn;
    await flag(
      `upsell-sync:${watch.reservationId}`,
      `${watch.property} cleaner time`,
      `${watch.property}, turnover ${when}: Hospitable shows ${hospitableOk ? wanted : hospitableClock || "an unverified time"} and the cleaner app shows ${shown}. The time update is not complete.`,
    );
    return;
  }
  const confirmation = `Hi ${watch.guest}, you're confirmed for ${watch.label}.`;
  await commitHospitable("send-reservation-message", { uuid: watch.reservationId, body: confirmation });
  const line = `${stamp(now)}. ${watch.guest} paid ${dollars(watch.amountCents)}. ${watch.property} now shows ${watch.label} in Hospitable and on the cleaner app turnover.`;
  await noteReservation(watch.reservationId, line);
  await saveCheck({ body: line, headline: `${watch.guest} ${watch.label} confirmed`, needsYou: false });
  if (watch.kind === "early" && watch.nightBefore) {
    await saveCheck({
      body: `${watch.guest} at ${watch.property} arrives ${longDate(watch.checkIn)} at ${watch.label}. That morning's clean must finish the night before.`,
      headline: `${watch.property} clean moves to the night before`,
      needsYou: true,
    });
  }
  watch.phase = "complete";
  savePersisted();
}

async function escalate(watch: Watch, now: Date): Promise<void> {
  const key = `upsell-unpaid:${watch.reservationId}`;
  if (await draftsRecorded(key)) return;
  await recordDrafts(key);
  watch.phase = "escalated";
  savePersisted();
  const deadline = longDate(addDays(watch.checkIn, -2));
  const message = `Hi ${watch.guest}, a reminder that the ${dollars(watch.amountCents)} ${watch.kind === "early" ? "early check-in" : "late checkout"} request is still waiting in Airbnb. It needs to be paid by ${deadline} or the ${watch.label} time will be released.`;
  const offer: UpsellOffer = {
    phase: "remind",
    reservationId: watch.reservationId,
    propertyId: watch.propertyId,
    property: watch.property,
    guest: watch.guest,
    kind: watch.kind,
    requestedLabel: watch.label,
    requestedMinutes: watch.minutes,
    offeredLabel: watch.label,
    offeredMinutes: watch.minutes,
    verdict: "unpaid",
    reason: "The fee is still unpaid 48 hours before arrival.",
    priceCents: watch.amountCents,
    checkIn: watch.checkIn,
    checkOut: watch.checkOut,
    message,
    nightBefore: watch.nightBefore,
  };
  const body = [
    `${watch.guest} at ${watch.property} has not paid the ${dollars(watch.amountCents)} ${watch.kind === "early" ? "early arrival" : "late checkout"} fee.`,
    `The deadline is 48 hours before arrival (${deadline}).`,
    "Guest message:",
    message,
    "",
    "Nothing is sent until you approve the reminder. You can also release the time.",
  ].join("\n");
  const draft: CopilotDraft = {
    subject: `${watch.guest} unpaid ${dollars(watch.amountCents)} at ${watch.property}`,
    body,
    to: watch.guest,
    status: "waiting",
    channel: "note",
    upsell: offer,
  };
  await saveCheck({ body, draft, headline: draft.subject, needsYou: true });
  await noteReservation(watch.reservationId, `${stamp(now)}. ${watch.guest} has not paid ${dollars(watch.amountCents)} at the 48 hour deadline. Flagged for a reminder or a release.`).catch(() => undefined);
}

export async function settleUpsellWatches(now = new Date()): Promise<void> {
  loadPersisted();
  for (const watch of [...watches.values()]) {
    if (watch.phase === "complete" || watch.phase === "released" || watch.phase === "sync-failed") continue;
    try {
      await settleOne(watch, now);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The payment check failed.";
      await flag(`upsell-watch:${watch.reservationId}`, `${watch.guest} needs a partner`, `${watch.guest} at ${watch.property}. I could not verify the payment. ${message}`);
    }
  }
}

export function upsellWatch(reservationId: string): Watch | null {
  const row = watches.get(reservationId);
  return row ? { ...row } : null;
}

