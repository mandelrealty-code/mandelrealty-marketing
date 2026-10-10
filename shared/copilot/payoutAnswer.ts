/**
 * Unit money splits come from that property's saved OPS billing terms
 * and the Hospitable financials on its reservations. Nothing is estimated,
 * and nothing is looked up on the web.
 */

import { isExcludedReservationStatus } from "../pm/financialBreakdown.js";
import { getPmPropertyDetail, listPmProperties } from "../pm/propertyStore.js";
import { listReservationsForPropertyMonth } from "../pm/reservationStore.js";
import { rateOnDate, splitStayForTerms, type StayTermSplit } from "../pm/statementMath.js";
import type { PmPropertyDetail, PmPropertyListItem } from "../pm/types.js";
import { hospitableRead } from "./hospitableConnection.js";
import { hostMoney } from "./ops.js";
import { identityOf, textNamesProperty, type PropertyIdentity } from "./propertyIdentity.js";
import { asksPayoutSplit } from "./route.js";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const STOP = new Set(["toronto", "street", "unit", "floor", "with", "and", "the", "home", "house", "suite"]);

type Property = Pick<PmPropertyListItem, "id" | "name" | "address">;

export async function answerPayout(
  question: string,
  prior = "",
  now = new Date(),
  carried: PropertyIdentity | null = null,
): Promise<{ body: string; step: string; property: PropertyIdentity | null } | null> {
  if (asksGuestNames(question) && isPayoutAnswer(prior)) {
    return { body: await namesFor(prior), step: "Read the reservation records", property: carried };
  }
  if (!asksPayoutSplit(question)) return null;
  const split = await splitFor(question, now, carried);
  return { body: split.body, step: "Read the payout terms", property: split.property };
}

function asksGuestNames(question: string): boolean {
  return /\bguest names?\b/i.test(question) || /\bnames? of (?:the |those )?guests?\b/i.test(question);
}

function isPayoutAnswer(prior: string): boolean {
  return (/MRG take/.test(prior) && /host net/.test(prior)) || /Payout terms are not set/.test(prior);
}

async function namesFor(prior: string): Promise<string> {
  if (/Payout terms are not set/.test(prior)) {
    return "That split had no stays, because payout terms are not set for that property.";
  }
  const codes = [...prior.matchAll(/\bstay ([A-Z0-9]{6,})\b/g)].map((match) => match[1] ?? "").filter(Boolean);
  if (!codes.length) return "That split had no stays to name.";
  const lines: string[] = [];
  for (const code of codes) {
    const record = await reservationRecord(code);
    const guest = record ? guestName(record) : "";
    const dates = record ? stayDates(dateOf(record, ["arrival_date", "check_in"]), dateOf(record, ["departure_date", "check_out"])) : "";
    const who = guest || "The guest name wasn't on the reservation";
    lines.push(dates ? `${who}, stay ${code}, ${dates}.` : `${who}, stay ${code}.`);
  }
  return `Guest names for those stays:\n${lines.join("\n")}`;
}

async function splitFor(question: string, now: Date, carried: PropertyIdentity | null): Promise<{ body: string; property: PropertyIdentity | null }> {
  const properties = await listPmProperties();
  const named = properties.filter((property) => mentions(question, property));
  const carriedRow = carried ? properties.find((property) => property.id === carried.opsId) ?? null : null;
  if (named.length > 1) {
    return { body: `Which property should I use? I found ${named.map((property) => property.name).join(" and ")}.`, property: null };
  }
  const property = named[0] ?? carriedRow;
  if (!property) return { body: "I didn't find that property in OPS.", property: null };
  const month = monthOf(question, now) ?? carried?.month ?? null;
  const identity = identityOf(property, month ?? undefined);
  if (!month) return { body: "Which month should I use?", property: identity };
  const detail = await getPmPropertyDetail(property.id);
  if (!detail || (detail.current_term == null && detail.terms.length === 0)) {
    return { body: `Payout terms are not set for ${placeOf(property)}.`, property: identity };
  }
  const reservations = await listReservationsForPropertyMonth(property.id, month);
  const includeExcluded = /\b(cancell?ed|declin\w*)\b/i.test(question);
  const stays = reservations
    .filter((stay) => includeExcluded || !isExcludedReservationStatus(stay.status || ""))
    .sort((a, b) => (a.check_in || "").localeCompare(b.check_in || ""));
  const label = monthLabel(month);
  const place = placeOf(property);
  if (!stays.length) {
    return { body: `${termsLine(detail)} No accepted stays at ${place} have a night in ${label}.`, property: identity };
  }
  let lastRate = detail.current_term?.rate_bps ?? null;
  let guestPaid = 0;
  let hostRevenue = 0;
  let mrgTake = 0;
  let hostNet = 0;
  const lines: string[] = [];
  for (const stay of stays) {
    const on = stay.check_out || stay.check_in || `${month}-01`;
    const rate = rateOnDate(detail.terms, on) ?? lastRate ?? 0;
    lastRate = rate;
    const split = splitStayForTerms(
      stay.financials_json && typeof stay.financials_json === "object" ? stay.financials_json : {},
      {
        host_payout_cents: Number(stay.host_payout_cents) || 0,
        gross_cents: Number(stay.gross_cents) || 0,
        currency: stay.currency,
      },
      {
        commission_base_mode: detail.commission_base_mode,
        rate_bps: rate,
        hst_mode: detail.hst_mode,
        hst_bps: detail.hst_bps,
        cleaning_fee_keeper: detail.cleaning_fee_keeper,
      },
    );
    guestPaid += split.guestPaid;
    hostRevenue += split.airbnbPayout;
    mrgTake += split.mrgTake;
    hostNet += split.net;
    const code = (stay.platform_id || stay.hospitable_reservation_id || "").trim();
    const record = code ? await reservationRecord(code) : null;
    const guest = record ? guestName(record) : "";
    lines.push(stayLine(guest, stay.check_in, stay.check_out, code, split));
  }
  const future = month > yearMonthNow(now);
  const lead = future
    ? `${label} booked business for ${place} is ${hostMoney(mrgTake)} MRG and ${hostMoney(hostNet)} to the host. This is booked business, not money received.`
    : `${label} for ${place} is ${hostMoney(mrgTake)} MRG and ${hostMoney(hostNet)} to the host.`;
  const totals = `${label} totals: guest paid ${hostMoney(guestPaid)}, host revenue ${hostMoney(hostRevenue)}, MRG take ${hostMoney(mrgTake)}, host net ${hostMoney(hostNet)}.`;
  return { body: [lead, termsLine(detail), ...lines, totals].join("\n"), property: identity };
}

function stayLine(guest: string, checkIn: string | null, checkOut: string | null, code: string, split: StayTermSplit): string {
  const who = guest || "The guest name wasn't on the reservation";
  const marker = code ? `, stay ${code}` : "";
  return `${who}, ${stayDates(checkIn, checkOut)}${marker}: guest paid ${hostMoney(split.guestPaid)}, host revenue ${hostMoney(split.airbnbPayout)}, MRG take ${hostMoney(split.mrgTake)}, host net ${hostMoney(split.net)}.`;
}

function termsLine(detail: PmPropertyDetail): string {
  const rate = detail.current_term?.rate_bps ?? detail.terms[0]?.rate_bps ?? 0;
  const base = detail.commission_base_mode === "nightly" ? "the nightly room fee" : "nightly minus the Airbnb host fee";
  const cleaning = detail.cleaning_fee_keeper === "host" ? "the host keeps the cleaning fee" : "MRG keeps the cleaning fee";
  const hst = formatPercent(detail.hst_bps);
  const hstText = detail.hst_mode === "invoice"
    ? `HST ${hst} is invoiced on the MRG fee`
    : `HST ${hst} is built into the cohost take`;
  return `Saved terms: ${formatPercent(rate)} of ${base}, ${cleaning}, ${hstText}.`;
}

function formatPercent(bps: number): string {
  return `${bps / 100}%`;
}

function placeOf(property: Property): string {
  const address = property.address.trim();
  return address ? `${property.name}, ${address}` : property.name;
}

function mentions(question: string, property: Property): boolean {
  if (textNamesProperty(question, property.name, property.address)) return true;
  const asked = question.toLowerCase();
  const name = property.name.trim().toLowerCase();
  const address = property.address.toLowerCase();
  const blob = `${name} ${address}`;
  if (name.length >= 4 && asked.includes(name)) return true;
  const tokens = blob.split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !STOP.has(word));
  return tokens.some((word) => new RegExp(`\\b${word}\\b`).test(asked));
}

function monthOf(question: string, now: Date): string | null {
  const named = MONTHS.findIndex((name) => question.toLowerCase().includes(name));
  if (named < 0) return null;
  const year = /\b(20\d{2})\b/.exec(question)?.[1]
    || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(now);
  return `${year}-${String(named + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const name = new Date(`${month}-02T12:00:00Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${name} ${month.slice(0, 4)}`;
}

function yearMonthNow(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function stayDates(checkIn: string | null, checkOut: string | null): string {
  return `${formatDay(checkIn)}–${formatDay(checkOut)}`;
}

function formatDay(iso: string | null): string {
  if (!iso) return "?";
  const [year, month, day] = iso.slice(0, 10).split("-");
  const name = SHORT[Number(month) - 1];
  if (!name || !day || !year) return iso.slice(0, 10);
  return `${name} ${Number(day)}, ${year}`;
}

async function reservationRecord(code: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await hospitableRead("get-reservation", { identifier: code, include: "guest" });
    return unwrap(raw);
  } catch {
    return null;
  }
}

function unwrap(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const data = (raw as { data?: unknown }).data;
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

function guestName(row: Record<string, unknown>): string {
  const guest = row.guest && typeof row.guest === "object" ? (row.guest as Record<string, unknown>) : {};
  const first = text(guest.first_name);
  const last = text(guest.last_name);
  return [first, last].filter(Boolean).join(" ") || text(guest.name) || text(row.guest_name);
}

function dateOf(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value.slice(0, 10);
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
