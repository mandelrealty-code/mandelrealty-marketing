/**
 * Early check-in and late checkout are a notification now.
 * A guest's ask becomes one Guest Messaging follow-up. The partners answer and price it in Hospitable.
 * Copilot proposes no price, shows no approval card, sends nothing, and changes no reservation.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { setParityClock } from "./parity/clock.js";
import { parityChecksMessages } from "./parity/storeStub.js";
import { installWorld, type ParityReservation, type ParityWorld } from "./parity/world.js";
import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import { loadGuestQueue, resetGuestMessaging } from "./guestMessaging.js";
import { runUnattendedChecks } from "./stayCheck.js";
import type { GuestFollowUp } from "./guestTypes.js";

const TOKEN = "copilot-upsell-harness-token-not-a-secret";
const ROSE = { id: "prop-rose", name: "41 Roseglor Cres", address: "41 Roseglor Crescent, Toronto", managed: true };
const SHAW = { id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true };
const ASK = "Our flight lands at 6 AM on the 11th. Any chance we could get in at 7:30 AM?";

function fail(label: string): never {
  throw new Error(`Upsell harness failed: ${label}`);
}

function guestTurn(id: string, at: string, name: string, body: string) {
  return { id, at, role: "guest" as const, name, body };
}

function hostTurn(id: string, at: string, body: string) {
  return { id, at, role: "host" as const, name: "Sam", body };
}

function stay(id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, messages: ParityReservation["messages"]): ParityReservation {
  return { id, code: id.toUpperCase(), propertyId, status: "accepted", checkIn, checkOut, guest, adults: 2, children: 0, messages };
}

function world(now: string, reservations: ParityReservation[]): ParityWorld {
  return {
    now: new Date(now),
    properties: [ROSE, SHAW],
    reservations,
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
    cleaner: { turnovers: [] },
    calendar: [],
    payments: [],
  };
}

async function asks(now: Date, reservations: ParityReservation[]): Promise<GuestFollowUp[]> {
  resetGuestMessaging();
  installWorld(world(now.toISOString(), reservations));
  setParityClock(now);
  const queue = await loadGuestQueue(now);
  return (queue.followUps ?? []).filter((row) => row.kind === "ask");
}

function inventedNameFound(): string[] {
  const invented = ["send", "airbnb", "payment", "request"].join("-");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|json|md|sql|html)$/.test(name) && readFileSync(full, "utf8").includes(invented)) hits.push(full);
    }
  };
  for (const dir of ["shared", "src", "api", "scripts", "docs", "supabase"]) walk(path.join(process.cwd(), dir));
  return hits;
}

const invented = inventedNameFound();
if (invented.length) fail(`invented payment tool still named in ${invented.join(", ")}`);

resetHospitableConnection();
setHospitableProbe(async (token) => {
  if (token !== TOKEN) throw new Error("rejected");
  return { data: [{ id: ROSE.id, name: ROSE.name }, { id: SHAW.id, name: SHAW.name }] };
});
await saveHospitableToken(TOKEN);
setHospitableProbe(null);

const now = new Date("2026-11-02T19:00:00Z");
const book = guestTurn("book", "2026-10-26T20:12:00Z", "Ruzaina", "Hi! Just booked Nov 11-16. We're coming in for a family wedding.");
const ask = guestTurn("ask", "2026-11-02T15:15:00Z", "Ruzaina", ASK);
const towels = stay("stay-lee", SHAW.id, "Lee", "2026-11-05", "2026-11-08", [
  guestTurn("towels", "2026-11-02T16:00:00Z", "Lee", "Could you leave a few extra towels? Thanks!"),
]);

resetCaptures();
const open = await asks(now, [stay("stay-ruzaina", ROSE.id, "Ruzaina", "2026-11-11", "2026-11-16", [book, ask]), towels]);
if (open.length !== 1) fail(`expected one ask follow-up, got ${open.length}: ${open.map((row) => row.line).join(" | ")}`);
const row = open[0] as GuestFollowUp;
if (row.line !== "Ruzaina asked for early check-in at 7:30 AM") fail(`line ${row.line}`);
if (row.tag) fail(`ask follow-up is labelled ${row.tag}`);
if (!row.agreed.includes("Any chance we could get in at 7:30 AM?")) fail(`quote ${row.agreed}`);
if (row.property !== ROSE.name || row.guest !== "Ruzaina") fail(`who ${row.guest} · ${row.property}`);
if (row.checkIn !== "2026-11-11" || row.checkOut !== "2026-11-16" || !row.dates) fail(`dates ${row.checkIn} ${row.checkOut} ${row.dates}`);
if (row.draft) fail(`ask follow-up carries a draft: ${row.draft}`);
if (capturedCommits().length) fail(`queue load committed ${capturedCommits().map((item) => item.detail).join(" ")}`);

resetCaptures();
await runUnattendedChecks(now);
if (parityChecksMessages().some((item) => item.draft?.upsell)) fail("the checks pass still made an upsell card");
if (capturedCommits().length) fail(`checks pass committed ${capturedCommits().map((item) => item.detail).join(" ")}`);

const priced = hostTurn("price", "2026-11-02T16:30:00Z", "Hi Ruzaina! Early check-in at 7:30 AM is $99. Let me know and I'll set it up.");
const answered = await asks(now, [stay("stay-ruzaina", ROSE.id, "Ruzaina", "2026-11-11", "2026-11-16", [book, ask, priced]), towels]);
if (answered.length) fail(`a priced ask stayed open: ${answered.map((item) => item.line).join(" | ")}`);

const soft = hostTurn("soft", "2026-11-02T16:30:00Z", "Let me check with the cleaner and get back to you!");
const pending = await asks(now, [stay("stay-ruzaina", ROSE.id, "Ruzaina", "2026-11-11", "2026-11-16", [book, ask, soft])]);
if (pending.length !== 1) fail("a reply that does not answer the ask closed it");

const none = await asks(now, [towels, stay("stay-mia", ROSE.id, "Mia", "2026-11-20", "2026-11-22", [
  guestTurn("q", "2026-11-02T15:00:00Z", "Mia", "What time is check-in? And is there parking?"),
])]);
if (none.length) fail(`a thread with no time ask made ${none.map((item) => item.line).join(" | ")}`);

const late = await asks(now, [stay("stay-eloise", SHAW.id, "Eloise", "2026-11-01", "2026-11-04", [
  guestTurn("late", "2026-11-02T14:00:00Z", "Eloise", "Could we stay until 2 on our last day?"),
])]);
if (late.length !== 1 || late[0]?.line !== "Eloise asked for late checkout until 2 PM") fail(`late ${late.map((item) => item.line).join(" | ")}`);

const dropped = await asks(now, [stay("stay-ruzaina", ROSE.id, "Ruzaina", "2026-11-11", "2026-11-16", [
  book,
  ask,
  guestTurn("drop", "2026-11-02T17:00:00Z", "Ruzaina", "Never mind, standard check-in is fine."),
])]);
if (dropped.length) fail("a dropped ask stayed open");

const started = new Date("2026-11-11T18:00:00Z");
const arrived = await asks(started, [stay("stay-ruzaina", ROSE.id, "Ruzaina", "2026-11-11", "2026-11-16", [book, ask])]);
if (arrived.length) fail("an early check-in ask stayed open after the stay started");

resetHospitableConnection();
console.log("upsell harness passed");
