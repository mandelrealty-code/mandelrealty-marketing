/**
 * Unit money splits come from that property's saved OPS billing terms
 * and the Hospitable financials on its reservations. Nothing is estimated,
 * and nothing is looked up on the web.
 */

import { isExcludedReservationStatus } from "../pm/financialBreakdown.js";
import { getPmPropertyDetail, listPmProperties } from "../pm/propertyStore.js";
import { listReservationsOverlappingRange, monthBounds, type PmReservationRow } from "../pm/reservationStore.js";
import { listHospitableReservations } from "../pm/hospitableClient.js";
import { acceptedStaysWithNight, type MonthStay } from "./stayAnswer.js";
import { addDays } from "./time.js";
import { rateOnDate, splitStayForTerms, type StayTermSplit } from "../pm/statementMath.js";
import type { PmPropertyDetail, PmPropertyListItem } from "../pm/types.js";
import { copilotHospitableToken, hospitableRead, limitToSavedSelection } from "./hospitableConnection.js";
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
  if (!asksPayoutSplit(question) && !asksStayMoneyParts(question)) return null;
  const split = await splitFor(question, now, carried);
  return { body: split.body, step: "Read the payout terms", property: split.property };
}

const MONTH_WORD = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|this month|next month|last month)\b/i;

function asksCount(question: string): boolean {
  return /\bhow many\b/i.test(question) && /\b(reservations?|stays?|bookings?|guests?)\b/i.test(question);
}

function asksHostMoney(question: string): boolean {
  return /\bhost revenue\b|\bhost (?:net|payout)\b/i.test(question)
    || (/\b(host|owner)\b/i.test(question) && /\b(make|makes|making|earn|earns|net|revenue|payout|get|gets)\b/i.test(question))
    || (/\bhow much\b/i.test(question) && /\b(we|mrg)\b/i.test(question) && /\b(make|take|earn)\b/i.test(question));
}

/**
 * One question with several parts about a property's month: how many stays, who the guests are,
 * and what the host makes. Every part is answered, not only the first one the router recognises.
 */
export function asksStayMoneyParts(question: string): boolean {
  if (!MONTH_WORD.test(question) || !asksHostMoney(question)) return false;
  return asksCount(question) || asksGuestNames(question) || /\bwho (?:are|were|is) (?:the )?guests?\b|\bwho(?:'s| is) staying\b/i.test(question);
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
  const properties = await limitToSavedSelection(await listPmProperties());
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
  const { start, end } = monthBounds(month);
  const label = monthLabel(month);
  const place = placeOf(property);
  const hospitableId = (property.hospitable_property_id || property.id).trim();
  // The same stays the count answer uses: accepted, with a night in the month, read live from Hospitable.
  let stays: MonthStay[] = [];
  let note = "";
  const stored = await listReservationsOverlappingRange([property.id], start, end).catch(() => [] as PmReservationRow[]);
  try {
    stays = await acceptedStaysWithNight(hospitableId, start, end);
  } catch {
    note = "Hospitable didn't answer, so these stays come from the OPS copy, which can miss a recent booking.";
    stays = stored
      .filter((row) => !isExcludedReservationStatus(row.status || "") && Boolean(row.check_in && row.check_out) && (row.check_in as string) <= end && (row.check_out as string) > start)
      .map((row) => ({ id: row.hospitable_reservation_id || row.id, code: row.platform_id || "", guest: "", checkIn: row.check_in || "", checkOut: row.check_out || "" }));
  }
  if (!stays.length) {
    return { body: [`${termsLine(detail)} No accepted stays at ${place} have a night in ${label}.`, note].filter(Boolean).join(" "), property: identity };
  }
  const live = await liveMoney(hospitableId, start, end);
  let lastRate = detail.current_term?.rate_bps ?? null;
  let guestPaid = 0;
  let hostRevenue = 0;
  let mrgTake = 0;
  let hostNet = 0;
  let mrgKept = 0;
  let allAddUp = true;
  const lines: string[] = [];
  const guests: string[] = [];
  for (const stay of stays) {
    const on = stay.checkOut || stay.checkIn || `${month}-01`;
    const rate = rateOnDate(detail.terms, on) ?? lastRate ?? 0;
    lastRate = rate;
    const opsRow = stored.find((row) => row.hospitable_reservation_id === stay.id || (stay.code && row.platform_id === stay.code));
    const money = live.get(stay.id) ?? (opsRow
      ? {
          financials: opsRow.financials_json && typeof opsRow.financials_json === "object" ? opsRow.financials_json : {},
          host_payout_cents: Number(opsRow.host_payout_cents) || 0,
          gross_cents: Number(opsRow.gross_cents) || 0,
          currency: opsRow.currency || "CAD",
        }
      : null);
    const code = stay.code || opsRow?.platform_id || "";
    const record = !stay.guest && code ? await reservationRecord(code) : null;
    const guest = stay.guest || (record ? guestName(record) : "");
    guests.push(guest);
    if (!money) {
      allAddUp = false;
      lines.push(`${guest || "The guest name wasn't on the reservation"}, ${stayDates(stay.checkIn, stay.checkOut)}${code ? `, stay ${code}` : ""}: the money isn't on the reservation record, so it is not in the totals.`);
      continue;
    }
    const split = splitStayForTerms(money.financials, money, {
      commission_base_mode: detail.commission_base_mode,
      rate_bps: rate,
      hst_mode: detail.hst_mode,
      hst_bps: detail.hst_bps,
      cleaning_fee_keeper: detail.cleaning_fee_keeper,
    });
    const kept = detail.cleaning_fee_keeper === "host" ? 0 : split.cleaning;
    const addsUp = Math.abs(split.net + split.mrgTake + kept - split.airbnbPayout) <= 1;
    if (!addsUp) allAddUp = false;
    guestPaid += split.guestPaid;
    hostRevenue += split.airbnbPayout;
    mrgTake += split.mrgTake;
    hostNet += split.net;
    mrgKept += kept;
    lines.push(stayLine(guest, stay.checkIn, stay.checkOut, code, split, kept, addsUp));
  }
  const future = month > yearMonthNow(now);
  const lead = allAddUp
    ? future
      ? `${label} booked business for ${place} is ${hostMoney(mrgTake)} MRG and ${hostMoney(hostNet)} to the host. This is booked business, not money received.`
      : `${label} for ${place} is ${hostMoney(mrgTake)} MRG and ${hostMoney(hostNet)} to the host.`
    : `${label} for ${place}: host revenue ${hostMoney(hostRevenue)}, MRG take ${hostMoney(mrgTake)}. Host net isn't shown because the split doesn't add back to host revenue on every stay.${future ? " This is booked business, not money received." : ""}`;
  const keptText = mrgKept ? `, MRG keeps ${hostMoney(mrgKept)} in cleaning fees` : "";
  const totals = allAddUp
    ? `${label} totals: guest paid ${hostMoney(guestPaid)}, host revenue ${hostMoney(hostRevenue)} = host net ${hostMoney(hostNet)} + MRG take ${hostMoney(mrgTake)}${mrgKept ? ` + cleaning fees MRG keeps ${hostMoney(mrgKept)}` : ""}.`
    : `${label} totals: guest paid ${hostMoney(guestPaid)}, host revenue ${hostMoney(hostRevenue)}, MRG take ${hostMoney(mrgTake)}${keptText}.`;
  const opening: string[] = [];
  if (asksCount(question) || asksGuestNames(question) || /\bwho (?:are|were|is) (?:the )?guests?\b|\bwho(?:'s| is) staying\b/i.test(question)) {
    const names = guests.filter(Boolean);
    const count = `${place} has ${stays.length} accepted ${stays.length === 1 ? "stay" : "stays"} with a night in ${label}`;
    opening.push(names.length === stays.length ? `${count}: ${joinNames(names)}.` : `${count}. ${names.length ? `Named on the reservations: ${joinNames(names)}.` : "The guest names weren't on the reservations."}`);
  }
  return { body: [...opening, lead, termsLine(detail), ...lines, totals, note].filter(Boolean).join("\n"), property: identity };
}

/** Each stay's money as Hospitable reports it now: financials, host payout, and guest total. */
async function liveMoney(propertyId: string, start: string, end: string): Promise<Map<string, { financials: Record<string, unknown>; host_payout_cents: number; gross_cents: number; currency: string }>> {
  const found = new Map<string, { financials: Record<string, unknown>; host_payout_cents: number; gross_cents: number; currency: string }>();
  const pat = await copilotHospitableToken().catch(() => "");
  if (!pat) return found;
  try {
    const rows = await listHospitableReservations({ pat, propertyIds: [propertyId], startDate: addDays(start, -365), endDate: end, dateQuery: "checkin" });
    for (const row of rows) {
      const financials = row.financials && typeof row.financials === "object" ? row.financials as Record<string, unknown> : {};
      if (!Object.keys(financials).length && !row.host_payout_cents) continue;
      found.set(row.id, { financials, host_payout_cents: row.host_payout_cents, gross_cents: row.gross_cents, currency: row.currency || "CAD" });
    }
  } catch {
    /* The OPS record is used for a stay Hospitable did not price. */
  }
  return found;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Host net is printed only when host net + MRG take + what MRG keeps adds back to host revenue. */
function stayLine(guest: string, checkIn: string | null, checkOut: string | null, code: string, split: StayTermSplit, kept = 0, addsUp = true): string {
  const who = guest || "The guest name wasn't on the reservation";
  const marker = code ? `, stay ${code}` : "";
  const keptText = kept ? `, cleaning fee MRG keeps ${hostMoney(kept)}` : "";
  if (!addsUp) {
    const gap = split.airbnbPayout - split.mrgTake - kept;
    return `${who}, ${stayDates(checkIn, checkOut)}${marker}: guest paid ${hostMoney(split.guestPaid)}, host revenue ${hostMoney(split.airbnbPayout)}, MRG take ${hostMoney(split.mrgTake)}${keptText}. Host net isn't shown: the split leaves ${hostMoney(gap)} that the saved terms don't account for.`;
  }
  return `${who}, ${stayDates(checkIn, checkOut)}${marker}: guest paid ${hostMoney(split.guestPaid)}, host revenue ${hostMoney(split.airbnbPayout)} = host net ${hostMoney(split.net)} + MRG take ${hostMoney(split.mrgTake)}${kept ? ` + cleaning fee MRG keeps ${hostMoney(kept)}` : ""}.`;
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
