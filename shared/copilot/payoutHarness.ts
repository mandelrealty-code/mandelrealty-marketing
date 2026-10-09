/**
 * A unit split is computed from that property's saved OPS terms and the
 * reservation financials. The production chat handler answers it, the names
 * follow-up stays on those same stays, and neither turn searches the web.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { asksFetchLookup } from "./browserTier.js";
import { hostMoney } from "./ops.js";
import { worldAt } from "./parity/catalog.js";
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

async function chat(chatId: string, text: string): Promise<string> {
  let status = 0;
  let payload: { messages?: { role: string; body: string }[]; error?: string } = {};
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
  return [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
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

if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;

console.log("payout harness passed");
