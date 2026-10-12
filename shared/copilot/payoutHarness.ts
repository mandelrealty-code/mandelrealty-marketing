/**
 * A unit split is computed from that property's saved OPS terms and the
 * reservation financials. The production chat handler answers it, the names
 * follow-up stays on those same stays, and neither turn searches the web.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { asksFetchLookup } from "./browserTier.js";
import { hostMoney } from "./ops.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installOpsReservations } from "./parity/opsState.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { asksPayoutSplit, skipsWeb } from "./route.js";
import { researchWebCalls, resetResearch } from "./skillResearch.js";
import { buildMonthStatement } from "../pm/statementMath.js";
import type { PmReservationRow } from "../pm/reservationStore.js";

const HARBOUR = "00000000-0000-4000-8000-00000000ab01";
const SPLIT = "How much will we make, and how much will the host make, for Harbour Loft in November?";
const NAMES = "what are the guest names for that reservation?";
const UNSET = "How much will we make, and how much will the host make, for Shaw Street in November?";

function fail(message: string): never {
  throw new Error(message);
}

function moneyItem(cents: number, label: string) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return { amount: cents, formatted: `${sign}$${(abs / 100).toFixed(2)}`, label };
}

function financials(room: number, fee: number, cleaning: number, guestPaid: number): Record<string, unknown> {
  const hostRevenue = room + cleaning - fee;
  return {
    currency: "CAD",
    host: {
      accommodation: moneyItem(room, "Accommodation"),
      hostFees: [moneyItem(-fee, "Host service fee")],
      guestFees: cleaning ? [moneyItem(cleaning, "Cleaning fee")] : [],
      revenue: moneyItem(hostRevenue, "Host revenue"),
    },
    guest: { totalPrice: moneyItem(guestPaid, "Total") },
  };
}

function opsStay(input: {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  room: number;
  fee: number;
  cleaning: number;
  guestPaid: number;
}): PmReservationRow {
  const host = input.room + input.cleaning - input.fee;
  return {
    id: `ops-${input.id}`,
    property_id: HARBOUR,
    hospitable_reservation_id: input.id,
    platform: "airbnb",
    platform_id: input.code,
    status: input.status,
    check_in: input.checkIn,
    check_out: input.checkOut,
    nights: input.nights,
    currency: "CAD",
    gross_cents: input.guestPaid,
    host_payout_cents: host,
    financials_json: financials(input.room, input.fee, input.cleaning, input.guestPaid),
    synced_at: "2026-10-09T00:00:00.000Z",
  };
}

function stay(input: {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: string;
}): ParityReservation {
  return {
    id: input.id,
    code: input.code,
    propertyId: HARBOUR,
    status: input.status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guest: input.guest,
    adults: 2,
    children: 0,
    messages: [],
  };
}

const ada = {
  id: "res-ada",
  code: "HMNOVADA01",
  status: "accepted",
  checkIn: "2026-11-03",
  checkOut: "2026-11-07",
  nights: 4,
  room: 100000,
  fee: 3000,
  cleaning: 8000,
  guestPaid: 120000,
  guest: "Ada Chen",
};
const ben = {
  id: "res-ben",
  code: "HMNOVBEN01",
  status: "accepted",
  checkIn: "2026-11-12",
  checkOut: "2026-11-16",
  nights: 4,
  room: 50000,
  fee: 1500,
  cleaning: 6000,
  guestPaid: 65000,
  guest: "Ben Ortiz",
};
const casey = {
  id: "res-casey",
  code: "HMNOVCAS01",
  status: "cancelled",
  checkIn: "2026-11-20",
  checkOut: "2026-11-22",
  nights: 2,
  room: 999900,
  fee: 0,
  cleaning: 0,
  guestPaid: 999900,
  guest: "Casey Ng",
};
const dee = {
  id: "res-dee",
  code: "HMNOVDEE01",
  status: "declined",
  checkIn: "2026-11-24",
  checkOut: "2026-11-26",
  nights: 2,
  room: 888800,
  fee: 0,
  cleaning: 0,
  guestPaid: 888800,
  guest: "Dee Park",
};

const world = worldAt("2026-10-09T12:00:00-04:00");
world.properties.push({
  id: HARBOUR,
  name: "Harbour Loft",
  address: "88 Harbour Street, Toronto",
  managed: true,
  billing: {
    rateBps: 2000,
    commissionBaseMode: "nightly_minus_host_fee",
    cleaningFeeKeeper: "mrg",
    hstMode: "cohost",
    hstBps: 300,
  },
});
for (const row of [ada, ben, casey, dee]) {
  world.reservations.push(stay(row));
}
installWorld(world);
installOpsReservations([ada, ben, casey, dee].map((row) => opsStay(row)));

const statement = await buildMonthStatement(HARBOUR, "2026-11");
if (statement.reservation_count !== 2) fail(`statement counted ${statement.reservation_count}`);
if (statement.mrg_take_cents <= 0 || statement.net_to_host_cents <= 0) fail("statement totals were empty");

const previousPassword = process.env.ADMIN_PASSWORD;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

type ChatMessage = { role: string; body: string; property?: { label: string; opsId: string; hospitableId: string; cleanerId: string; month?: string } | null };

async function chatTurn(chatId: string, text: string): Promise<ChatMessage> {
  let status = 0;
  let payload: { messages?: ChatMessage[]; error?: string } = {};
  await handleCopilot(
    {
      method: "POST",
      headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` },
      body: { op: "send", text, chatId, kind: "chat", webSearch: true },
      query: {},
    } as never,
    {
      status(code: number) { status = code; return this; },
      json(body: typeof payload) { payload = body; return this; },
    } as never,
  );
  if (status !== 200) fail(payload.error || String(status));
  return [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant") ?? { role: "assistant", body: "" };
}

async function chat(chatId: string, text: string): Promise<string> {
  return (await chatTurn(chatId, text)).body;
}

if (!asksPayoutSplit(SPLIT) || !skipsWeb(SPLIT) || asksFetchLookup(SPLIT)) fail("the split was still a web lookup");
resetResearch();
const split = await chat("parity-payout", SPLIT);
const names = await chat("parity-payout", NAMES);
const unset = await chat("parity-payout-unset", UNSET);
if (researchWebCalls() !== 0) fail(`web calls: ${researchWebCalls()}`);

const mrg = hostMoney(statement.mrg_take_cents);
const host = hostMoney(statement.net_to_host_cents);
if (!split.includes(mrg) || !split.includes(host)) fail(`totals ${mrg} / ${host}\n${split}`);
if (!/booked business/i.test(split) || !/not money received/i.test(split)) fail(split);
if (!split.includes("Ada Chen") || !split.includes("Ben Ortiz")) fail(split);
if (!split.includes("HMNOVADA01") || !split.includes("HMNOVBEN01")) fail(split);
for (const stayRow of statement.stays) {
  const take = stayRow.mrg_cents + (statement.hst_mode === "cohost" ? stayRow.hst_cents : 0);
  if (!split.includes(hostMoney(take)) || !split.includes(hostMoney(stayRow.net_cents))) {
    fail(`stay ${hostMoney(take)} / ${hostMoney(stayRow.net_cents)}\n${split}`);
  }
}
if (/Casey|Dee|9,999|8,888/.test(split)) fail(split);
if (!/guest paid/i.test(split) || !/host revenue/i.test(split) || !/MRG take/i.test(split) || !/host net/i.test(split)) fail(split);

if (!names.includes("Ada Chen") || !names.includes("Ben Ortiz")) fail(names);
if (!names.includes("HMNOVADA01") || !names.includes("HMNOVBEN01")) fail(names);
if (!names.includes("Nov 3, 2026") || !names.includes("Nov 12, 2026")) fail(names);
if (/Casey|Dee|HMNOVCAS01|HMNOVDEE01/.test(names)) fail(names);

if (!/not set/i.test(unset) || !/Shaw/.test(unset) || /\$/.test(unset)) fail(unset);
if (researchWebCalls() !== 0) fail(`web calls after unset: ${researchWebCalls()}`);

const roseWorld = worldAt("2026-10-09T12:00:00-04:00");
const rose = roseWorld.properties.find((row) => row.id === ID.rose);
if (!rose) fail("Roseglor is missing from the fixture");
rose.billing = {
  rateBps: 2000,
  commissionBaseMode: "nightly_minus_host_fee",
  cleaningFeeKeeper: "mrg",
  hstMode: "cohost",
  hstBps: 300,
};
const ruzaina = {
  id: "res-ruzaina",
  code: "HMNOVRUZ01",
  status: "accepted",
  guest: "Ruzaina Sathar",
  checkIn: "2026-11-11",
  checkOut: "2026-11-16",
  nights: 5,
  room: 100000,
  fee: 3000,
  cleaning: 8000,
  guestPaid: 120000,
};
const bethanie = {
  id: "res-bethanie",
  code: "HMNOVBET01",
  status: "accepted",
  guest: "Bethanie Fils",
  checkIn: "2026-11-20",
  checkOut: "2026-11-24",
  nights: 4,
  room: 50000,
  fee: 1500,
  cleaning: 6000,
  guestPaid: 65000,
};
for (const row of [ruzaina, bethanie]) {
  roseWorld.reservations.push({
    id: row.id,
    code: row.code,
    propertyId: ID.rose,
    status: "accepted",
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    guest: row.guest,
    adults: 2,
    children: 0,
    messages: [],
  });
}
installWorld(roseWorld);
installOpsReservations([ruzaina, bethanie].map((row) => ({
  ...opsStay(row),
  property_id: ID.rose,
})));
const roseStatement = await buildMonthStatement(ID.rose, "2026-11");
if (roseStatement.reservation_count !== 2) fail(`Roseglor statement counted ${roseStatement.reservation_count}`);
resetResearch();
const COUNT = "for 41 roseglor, how many reservations does it have in november?";
const NAMES_FOLLOW = "what are the guest names for that reservation?";
const MONEY = "How much will we make, and how much will the host make in November?";
const counted = await chatTurn("parity-rose", COUNT);
const namedGuests = await chatTurn("parity-rose", NAMES_FOLLOW);
const splitFollow = await chatTurn("parity-rose", MONEY);
const roseProperty = counted.property;
if (!roseProperty || roseProperty.opsId !== ID.rose || roseProperty.hospitableId !== ID.rose || roseProperty.cleanerId !== ID.rose || roseProperty.month !== "2026-11") {
  fail(`property ${JSON.stringify(roseProperty)}`);
}
if (namedGuests.property?.opsId !== ID.rose || splitFollow.property?.opsId !== ID.rose) fail("the follow-ups left the resolved property");
if (!/2 accepted stays/.test(counted.body)) fail(counted.body);
if (!namedGuests.body.includes("Ruzaina Sathar") || !namedGuests.body.includes("Bethanie Fils")) fail(namedGuests.body);
if (/couldn't match|didn't find that property/i.test(namedGuests.body)) fail(namedGuests.body);
const roseMrg = hostMoney(roseStatement.mrg_take_cents);
const roseHost = hostMoney(roseStatement.net_to_host_cents);
if (!splitFollow.body.includes(roseMrg) || !splitFollow.body.includes(roseHost) || !/MRG/.test(splitFollow.body) || !/host/.test(splitFollow.body)) {
  fail(`${roseMrg} / ${roseHost}\n${splitFollow.body}`);
}
if (/didn't find that property in OPS/i.test(splitFollow.body)) fail(splitFollow.body);
if (researchWebCalls() !== 0) fail(`web calls on the Roseglor sequence: ${researchWebCalls()}`);

// One question, three parts: how many, who, and what the host makes. Every part is answered.
for (const [index, question] of [
  "For 41 Roseglor in November: how many reservations, what are the guest names, and how much will we and the host make?",
  "How many reservations does 41 Roseglor have in November, who are the guests, and what does the host make?",
].entries()) {
  const combined = await chatTurn(`parity-rose-combined-${index}`, question);
  if (!/41 Roseglor[^\n]* has 2 accepted stays with a night in November 2026/.test(combined.body)) fail(`count part missing\n${combined.body}`);
  if (!combined.body.includes("Ruzaina Sathar") || !combined.body.includes("Bethanie Fils")) fail(`guest names part missing\n${combined.body}`);
  if ((combined.body.match(/host revenue \$[\d,]+\.\d{2}/g) ?? []).length < 3) fail(`host revenue part missing per stay and in total\n${combined.body}`);
  if (!combined.body.includes(roseMrg) || !combined.body.includes(roseHost)) fail(`split totals ${roseMrg} / ${roseHost}\n${combined.body}`);
}
if (researchWebCalls() !== 0) fail(`web calls on the combined Roseglor question: ${researchWebCalls()}`);

// Hospitable has Ruzaina, OPS hasn't synced her yet. Every answer still uses the same two stays and figures.
{
  const liveWorld = worldAt("2026-10-09T12:00:00-04:00");
  const liveRose = liveWorld.properties.find((row) => row.id === ID.rose);
  if (!liveRose) fail("Roseglor is missing from the fixture");
  liveRose.billing = { rateBps: 2000, commissionBaseMode: "nightly_minus_host_fee", cleaningFeeKeeper: "mrg", hstMode: "cohost", hstBps: 300 };
  const ruz = { id: "res-ruz-live", code: "HMNOVRUZ02", status: "accepted", guest: "Ruzaina Sathar", checkIn: "2026-11-11", checkOut: "2026-11-16", nights: 5, room: 85000, fee: 4613, cleaning: 8000, guestPaid: 101000 };
  const bet = { id: "res-bet-live", code: "HMNOVBET02", status: "accepted", guest: "Bethanie Fils", checkIn: "2026-11-20", checkOut: "2026-11-24", nights: 4, room: 58000, fee: 2405, cleaning: 6000, guestPaid: 70000 };
  for (const row of [ruz, bet]) {
    liveWorld.reservations.push({
      id: row.id, code: row.code, propertyId: ID.rose, status: "accepted", checkIn: row.checkIn, checkOut: row.checkOut, guest: row.guest, adults: 2, children: 0, messages: [],
      financials: financials(row.room, row.fee, row.cleaning, row.guestPaid),
    });
  }
  installWorld(liveWorld);
  installOpsReservations([{ ...opsStay(bet), property_id: ID.rose }]);
  const countOnly = await chatTurn("parity-rose-live-count", "for 41 roseglor, how many reservations does it have in november?");
  const moneyOnly = await chatTurn("parity-rose-live-money", "How much will we make, and how much will the host make in November at 41 Roseglor?");
  const combined = await chatTurn("parity-rose-live-combined", "How many reservations does 41 Roseglor have in November, who are the guests, and what does the host make?");
  if (!/2 accepted stays/.test(countOnly.body)) fail(`count-only\n${countOnly.body}`);
  if (!/41 Roseglor[^\n]* has 2 accepted stays with a night in November 2026: Ruzaina Sathar and Bethanie Fils\./.test(combined.body)) fail(`combined count and names\n${combined.body}`);
  for (const [label, body] of [["money-only", moneyOnly.body], ["combined", combined.body]] as const) {
    for (const figure of ["$883.87", "$615.95", "$1,499.82"]) {
      if (!body.includes(`host revenue ${figure}`)) fail(`${label} is missing host revenue ${figure}\n${body}`);
    }
    if (!body.includes("Ruzaina Sathar") || !body.includes("Bethanie Fils")) fail(`${label} dropped a stay\n${body}`);
    const cents = (value: string) => Math.round(Number(value.replace(/[$,]/g, "")) * 100);
    const sums = [...body.matchAll(/host revenue (\$[\d,]+\.\d{2}) = host net (\$[\d,]+\.\d{2}) \+ MRG take (\$[\d,]+\.\d{2})(?: \+ cleaning fees? MRG keeps (\$[\d,]+\.\d{2}))?/g)];
    if (sums.length !== 3) fail(`${label} should show the add-back for 2 stays and the total\n${body}`);
    for (const sum of sums) {
      if (cents(sum[1] ?? "") !== cents(sum[2] ?? "") + cents(sum[3] ?? "") + cents(sum[4] ?? "$0.00")) fail(`${label} split does not add back: ${sum[0]}`);
    }
  }
  // Terms that don't add back to host revenue never print a host net.
  liveRose.billing = { ...liveRose.billing, commissionBaseMode: "nightly" };
  installWorld(liveWorld);
  installOpsReservations([{ ...opsStay(bet), property_id: ID.rose }]);
  const gap = await chatTurn("parity-rose-live-gap", "How much will we make, and how much will the host make in November at 41 Roseglor?");
  if (/host net \$/.test(gap.body) || !/Host net isn't shown/.test(gap.body)) fail(`a split that doesn't add back printed host net\n${gap.body}`);
}

if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;

console.log("payout harness passed");
