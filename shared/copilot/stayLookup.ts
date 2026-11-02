/**
 * Finding a unit's reservations by the unit, not by a guess: which Hospitable property a client or unit really is, whether Copilot
 * can read it at all, what Hospitable returns for it across a wide window, and why a stay would be missing from a short look.
 * An unreadable unit is said plainly. It is never reported as "no stays".
 */

import { listHospitableReservations } from "../pm/hospitableClient.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { scopedStayProperties } from "./dayBoard.js";
import { DEAD, guestName, listStays } from "./guestInbox.js";
import { copilotHospitableToken, copilotKeepsProperty, hospitableRead } from "./hospitableConnection.js";
import type { Scope } from "./clientProperty.js";
import { addDays, torontoToday } from "./time.js";

type Readable = { id: string; name: string; address: string };

/** The Hospitable properties this unit is, among those Copilot reads. When none, the reason in plain words. */
export async function readableUnit(scope: Scope): Promise<{ properties: Readable[]; why: string }> {
  const readable = await scopedStayProperties().catch(() => [] as Readable[]);
  const matched = readable.filter((row) => scope.match.test(`${row.name} ${row.address}`));
  if (matched.length) return { properties: matched, why: "" };
  const known = (await listPmProperties().catch(() => [])).filter((row) => scope.match.test(`${row.name} ${row.address}`));
  if (!known.length) return { properties: [], why: `${scope.label} isn't a property Copilot knows from OPS, so it can't look up its stays.` };
  const unlinked = known.filter((row) => !row.hospitable_property_id);
  if (unlinked.length === known.length) return { properties: [], why: `${known[0]!.name} is in OPS but has no Hospitable link, so Copilot can't read its stays. Link it to its Hospitable property in OPS.` };
  return { properties: [], why: `${known[0]!.name} is linked to Hospitable but isn't one of the properties Copilot reads. Turn it on under Settings, Connectors, Hospitable, then try again.` };
}

export type NextStay = { reservationId: string; guest: string; checkIn: string; checkOut: string; nights: number; platform: string; status: string };

/**
 * The current guest and the next stays for one unit, looking a year ahead: by check-in for what is coming, by checkout for
 * whoever is in the house now. Says which property ids and dates it asked Hospitable about.
 */
export async function nextStays(scope: Scope, count = 3, now: Date = new Date()): Promise<{
  property: string;
  propertyIds: string[];
  read: { from: string; to: string; filters: string[] };
  current: NextStay[];
  next: NextStay[];
  moreAfter: boolean;
  note: string;
}> {
  const found = await readableUnit(scope);
  if (!found.properties.length) throw new Error(found.why);
  const pat = await copilotHospitableToken();
  if (!pat) throw new Error("Hospitable is not connected, so nothing was read.");
  const today = torontoToday(now);
  const to = addDays(today, 365);
  const propertyIds = found.properties.map((row) => row.id);
  const [coming, inHouse] = await Promise.all([
    listHospitableReservations({ pat, propertyIds, startDate: today, endDate: to, include: ["guest"], dateQuery: "checkin" }),
    listHospitableReservations({ pat, propertyIds, startDate: today, endDate: to, include: ["guest"], dateQuery: "checkout" }),
  ]);
  const byId = new Map<string, (typeof coming)[number]>();
  for (const row of [...coming, ...inHouse]) if (!DEAD.test(row.status) && row.check_in && row.check_out) byId.set(row.id, row);
  const shape = (row: (typeof coming)[number]): NextStay => ({ reservationId: row.id, guest: guestName(row.raw), checkIn: row.check_in ?? "", checkOut: row.check_out ?? "", nights: row.nights, platform: row.platform, status: row.status });
  const all = [...byId.values()].sort((a, b) => (a.check_in ?? "").localeCompare(b.check_in ?? ""));
  const current = all.filter((row) => (row.check_in ?? "") <= today && (row.check_out ?? "") > today).map(shape);
  const upcoming = all.filter((row) => (row.check_in ?? "") > today).map(shape);
  const next = upcoming.slice(0, Math.max(1, Math.min(count, 10)));
  return {
    property: scope.label,
    propertyIds,
    read: { from: today, to, filters: ["check-in", "checkout"] },
    current,
    next,
    moreAfter: upcoming.length > next.length,
    note: next.length ? "" : `No stays are booked at ${scope.label} between ${today} and ${to}.`,
  };
}

type StayLine = Record<string, string | number | boolean | string[]>;
let stayLogger: ((line: StayLine) => void) | null = null;

/** Tests read the log. Null restores the server log. */
export function setStayLogger(next: ((line: StayLine) => void) | null): void {
  stayLogger = next;
}

/** What a day lookup asked for and got back before any filtering: dates and statuses only, never a guest. */
function stayLog(line: StayLine): void {
  if (stayLogger) return stayLogger(line);
  if (process.env.COPILOT_PARITY === "1" && !process.env.VERCEL && process.env.NODE_ENV !== "production") return;
  console.log(`[stays] ${JSON.stringify(line)}`);
}

export type DayMove = { guest: string; unit: string; propertyId: string; checkIn: string; checkOut: string; status: string; reservationId: string };

/**
 * Who checks in and who checks out on one date, across every property Copilot reads, in one go: one read per date filter for
 * all the properties together, never one per unit. The date defaults to today in Toronto.
 */
export async function dayMovements(input: { date?: string; units?: string[] } = {}, now?: Date): Promise<{ date: string; properties: number; checkOuts: DayMove[]; checkIns: DayMove[]; note: string }> {
  const pat = await copilotHospitableToken();
  if (!pat) throw new Error("Hospitable is not connected, so nothing was read.");
  const all = await scopedStayProperties().catch(() => [] as Readable[]);
  const properties = input.units?.length ? all.filter((row) => input.units!.includes(row.id)) : all;
  if (!properties.length) throw new Error("No properties are readable from Hospitable, so nothing was read.");
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : torontoToday(now);
  const ids = properties.map((row) => row.id);
  const unit = new Map(properties.map((row) => [row.id, row.name]));
  const [outs, ins] = await Promise.all((["checkout", "checkin"] as const).map((dateQuery) => listHospitableReservations({ pat, propertyIds: ids, startDate: date, endDate: addDays(date, 1), include: ["guest"], dateQuery })));
  const raw = (rows: typeof outs) => rows.map((row) => `${row.status} ${row.check_in ?? "?"} > ${row.check_out ?? "?"}`);
  stayLog({ stays: "day", sentDate: date, startDate: date, endDate: addDays(date, 1), nowUtc: (now ?? new Date()).toISOString(), properties: properties.length, checkoutQueryReturned: raw(outs), checkinQueryReturned: raw(ins) });
  const move = (row: (typeof outs)[number]): DayMove => ({ guest: guestName(row.raw), unit: unit.get(row.property_id) ?? row.property_id, propertyId: row.property_id, checkIn: row.check_in ?? "", checkOut: row.check_out ?? "", status: row.status, reservationId: row.id });
  const live = (row: (typeof outs)[number]) => !DEAD.test(row.status);
  const onDate = (value: string | null) => (value ?? "").slice(0, 10) === date;
  const checkOuts = outs.filter((row) => live(row) && onDate(row.check_out)).map(move);
  const checkIns = ins.filter((row) => live(row) && onDate(row.check_in)).map(move);
  return { date, properties: properties.length, checkOuts, checkIns, note: `Read ${properties.length} properties together for ${date}: ${checkOuts.length} check-out${checkOuts.length === 1 ? "" : "s"}, ${checkIns.length} check-in${checkIns.length === 1 ? "" : "s"}.` };
}

export type FoundStay = { reservationId: string; guest: string; unit: string; propertyId: string; checkIn: string; checkOut: string; status: string; platform: string };

/**
 * A guest's reservations by name, across every property Copilot reads: which unit they are at comes from the reservation, never
 * from a guess. Looks a month back to a year ahead by check-in and by checkout.
 */
export async function findStays(input: { guest: string; checkIn?: string; propertyIds?: string[] }, now: Date = new Date()): Promise<{ matches: FoundStay[]; searched: { properties: number; from: string; to: string }; note: string }> {
  const name = input.guest.trim().toLowerCase();
  if (name.length < 2) throw new Error("Say which guest to look for.");
  const properties = await scopedStayProperties().catch(() => [] as Readable[]);
  const pat = await copilotHospitableToken();
  if (!pat) throw new Error("Hospitable is not connected, so nothing was read.");
  if (!properties.length) throw new Error("No properties are readable from Hospitable, so nothing was read.");
  const today = torontoToday(now);
  const from = addDays(today, -30);
  const to = addDays(today, 365);
  const ids = properties.map((row) => row.id);
  const lists = await Promise.all((["checkin", "checkout"] as const).map((dateQuery) => listHospitableReservations({ pat, propertyIds: ids, startDate: from, endDate: to, include: ["guest"], dateQuery })));
  const unit = new Map(properties.map((row) => [row.id, row.name]));
  const seen = new Set<string>();
  const matches: FoundStay[] = [];
  for (const row of lists.flat()) {
    if (seen.has(row.id) || DEAD.test(row.status) || !row.check_in || !row.check_out) continue;
    seen.add(row.id);
    const guest = guestName(row.raw);
    const full = [String((row.raw.guest as Record<string, unknown> | undefined)?.first_name ?? ""), String((row.raw.guest as Record<string, unknown> | undefined)?.last_name ?? "")].join(" ").trim() || guest;
    if (!`${guest} ${full}`.toLowerCase().split(/\s+/).some((word) => word === name) && !full.toLowerCase().includes(name)) continue;
    if (input.checkIn && row.check_in !== input.checkIn) continue;
    if (input.propertyIds?.length && !input.propertyIds.includes(row.property_id)) continue;
    matches.push({ reservationId: row.id, guest: full, unit: unit.get(row.property_id) ?? row.property_id, propertyId: row.property_id, checkIn: row.check_in, checkOut: row.check_out, status: row.status, platform: row.platform });
  }
  matches.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return { matches, searched: { properties: properties.length, from, to }, note: matches.length ? "" : `No reservation for "${input.guest}" at any of the ${properties.length} properties Copilot reads, between ${from} and ${to}.` };
}

// ---------- Why a stay is missing: the whole chain, laid out ----------

export type StayProbe = {
  scope: { label: string; client: string };
  pmProperties: { name: string; address: string; hospitableId: string; matchesUnit: boolean }[];
  chosen: { name: string; hospitableId: string; inSavedSelection: boolean; existsInHospitable: boolean; hospitableName: string }[];
  asked: { from: string; to: string; propertyIds: string[]; filters: string[] };
  reservations: { id: string; guest: string; checkIn: string; checkOut: string; status: string; platform: string; inListStays: boolean; dropped: string }[];
  highlighted: string[];
  notes: string[];
};

/**
 * Temporary: the unit's reservations from Hospitable across a wide window, next to what the 14-day look shows, so a stay the
 * Hospitable calendar has and Copilot doesn't is pinned to the step that dropped it. Shown to the signed-in partner only.
 */
export async function diagnoseStays(scope: Scope, guestHint = "", now: Date = new Date()): Promise<StayProbe> {
  const notes: string[] = [];
  const pm = await listPmProperties().catch(() => []);
  const pmProperties = pm.map((row) => ({ name: row.name, address: row.address, hospitableId: row.hospitable_property_id ?? "", matchesUnit: scope.match.test(`${row.name} ${row.address}`) })).filter((row) => row.matchesUnit);
  if (!pmProperties.length) notes.push(`No OPS property matches ${scope.label}.`);
  const chosen: StayProbe["chosen"] = [];
  const hospitableRows = await hospitableRead("get-properties", {}).then((raw) => ((raw as { data?: Record<string, unknown>[] })?.data ?? [])).catch(() => [] as Record<string, unknown>[]);
  for (const row of pmProperties) {
    const hospitable = hospitableRows.find((item) => String(item.id ?? "") === row.hospitableId);
    chosen.push({
      name: row.name,
      hospitableId: row.hospitableId,
      inSavedSelection: row.hospitableId ? await copilotKeepsProperty({ id: row.hospitableId, name: row.name, address: row.address }) : false,
      existsInHospitable: Boolean(hospitable),
      hospitableName: String(hospitable?.name ?? hospitable?.public_name ?? ""),
    });
    if (!row.hospitableId) notes.push(`${row.name} has no Hospitable id in OPS.`);
    else if (!hospitable) notes.push(`${row.name}'s Hospitable id ${row.hospitableId} is not among the properties Hospitable lists for this token.`);
  }
  const today = torontoToday(now);
  const from = addDays(today, -30);
  const to = addDays(today, 400);
  const ids = chosen.filter((row) => row.hospitableId).map((row) => row.hospitableId);
  const pat = await copilotHospitableToken();
  const shown = new Set((await listStays(14, now).catch(() => [])).map((row) => row.reservationId));
  const reservations: StayProbe["reservations"] = [];
  if (pat && ids.length) {
    const lists = await Promise.all((["checkin", "checkout"] as const).map((dateQuery) => listHospitableReservations({ pat, propertyIds: ids, startDate: from, endDate: to, include: ["guest"], dateQuery })));
    const seen = new Set<string>();
    for (const row of lists.flat()) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const dead = DEAD.test(row.status);
      const horizon = addDays(today, 14);
      const dropped = shown.has(row.id) ? "" : dead ? `status "${row.status}" is filtered out` : (row.check_in ?? "") > horizon ? "checks in after the 14-day look" : row.check_out && row.check_out < today ? "already checked out" : "not in the 14-day look";
      reservations.push({ id: row.id, guest: guestName(row.raw), checkIn: row.check_in ?? "", checkOut: row.check_out ?? "", status: row.status, platform: row.platform, inListStays: shown.has(row.id), dropped });
    }
    reservations.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  } else notes.push(!pat ? "Hospitable is not connected." : "No Hospitable property id to ask about.");
  const hint = guestHint.trim().toLowerCase();
  const highlighted = hint ? reservations.filter((row) => row.guest.toLowerCase().includes(hint)).map((row) => `${row.guest} ${row.checkIn} to ${row.checkOut} (${row.status})${row.dropped ? `: ${row.dropped}` : ""}`) : [];
  if (hint && !highlighted.length) notes.push(`Hospitable's API returned no reservation for a guest named "${guestHint}" at these property ids between ${from} and ${to}.`);
  return { scope: { label: scope.label, client: scope.client?.full ?? "" }, pmProperties, chosen, asked: { from, to, propertyIds: ids, filters: ["checkin", "checkout"] }, reservations, highlighted, notes };
}
