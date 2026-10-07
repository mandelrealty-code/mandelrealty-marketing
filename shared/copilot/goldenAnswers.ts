/**
 * Golden answers for the questions partners actually ask.
 * Each case pins the facts and the shape: answer first, those values present, no hedge.
 */

import { ANSWER_STYLE, firstSentence, HEDGE, hasAnswerStyle } from "./answerStyle.js";
import { claudeChatSystem } from "./claudeAnswer.js";
import { promptFor } from "./cursorThink.js";
import { instructions } from "./hospitableAgent.js";
import { answerOps } from "./ops.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installOpsClients, installOpsReservations } from "./parity/opsState.js";
import { installWorld } from "./parity/world.js";
import { GENERAL_ANSWER_SYSTEM } from "./plainAnswer.js";
import { answerPropertyFact } from "./propertyFact.js";
import { answerStay } from "./stayAnswer.js";

function fail(name: string, message: string): never {
  throw new Error(`${name}: ${message}`);
}

function shape(name: string, answer: string, lead: RegExp, values: string[]): void {
  if (!answer.trim()) fail(name, "empty answer");
  const leadLine = firstSentence(answer);
  if (!lead.test(leadLine)) fail(name, `first sentence was: ${leadLine}`);
  for (const value of values) {
    if (!answer.includes(value)) fail(name, `missing ${value}\n${answer}`);
  }
  const hedge = HEDGE.exec(answer);
  if (hedge) fail(name, `hedge "${hedge[0]}"\n${answer}`);
}

installWorld(worldAt("2026-10-07T11:00:00-04:00"));
installOpsClients([
  { name: "Elizabeth Hart", email: "elizabeth@mandelrealtygroup.com" },
  { name: "Mara Singh", email: "mara@mandelrealtygroup.com" },
  { name: "Noah Patel", email: "noah@mandelrealtygroup.com" },
]);
installOpsReservations([
  {
    id: "aug-606",
    property_id: ID.charlotte,
    hospitable_reservation_id: "aug-606",
    platform: "airbnb",
    platform_id: "aug-606",
    status: "accepted",
    check_in: "2026-08-10",
    check_out: "2026-08-14",
    nights: 4,
    currency: "CAD",
    gross_cents: 90000,
    host_payout_cents: 80000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 80000, formatted: "$800.00" } } },
    synced_at: "2026-08-14T00:00:00.000Z",
  },
  {
    id: "aug-shaw",
    property_id: ID.shaw,
    hospitable_reservation_id: "aug-shaw",
    platform: "airbnb",
    platform_id: "aug-shaw",
    status: "accepted",
    check_in: "2026-08-02",
    check_out: "2026-08-06",
    nights: 4,
    currency: "CAD",
    gross_cents: 50000,
    host_payout_cents: 45000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 45000, formatted: "$450.00" } } },
    synced_at: "2026-08-06T00:00:00.000Z",
  },
]);

const checkins = await answerStay("How many check-ins are today?");
if (!checkins) fail("check-ins", "no answer");
shape("check-ins", checkins, /^0 accepted check-ins on 2026-10-07\./, [
  "8 Charlotte 606",
  "Roseglor",
  "20 Blue Jays Way",
  "1065 Shaw Street",
]);
const afterCount = checkins.slice(checkins.indexOf("\n") + 1);
for (const label of ["8 Charlotte 606", "Roseglor", "20 Blue Jays Way", "1065 Shaw Street"]) {
  if (!afterCount.includes(label)) fail("check-ins", `${label} is not in the breakdown`);
}
if (/1104|Partner Loft|Wes|Ned|incomplete|failed read/i.test(checkins)) fail("check-ins", checkins);

const reservation = await answerStay("Tell me about reservation HMESPTA3TJ");
if (!reservation) fail("reservation", "no answer");
shape("reservation", reservation, /HMESPTA3TJ/, [
  "Diane",
  "4 adults",
  "4 children",
  "20 Blue Jays Way",
  "October 9, 2026 at 4:00 PM",
  "October 12, 2026 at 11:00 AM",
]);
if (!/Diane/.test(firstSentence(reservation))) fail("reservation", firstSentence(reservation));
if (/\bpets?\b/i.test(reservation)) fail("reservation", reservation);

const revenue = await answerOps("What was the host revenue in August?");
if (!revenue) fail("revenue", "no answer");
shape("revenue", revenue, /\$1,250\.00 CAD/, ["August", "host revenue", "Unit #606", "Chic 2BR with Yard and Parking"]);
if (!firstSentence(revenue).startsWith("August host revenue was $1,250.00 CAD.")) fail("revenue", firstSentence(revenue));

const clients = await answerOps("How many clients do we have?");
if (clients !== "We currently have 3 clients.") fail("clients", String(clients));
shape("clients", clients, /^We currently have 3 clients\.$/, ["3"]);

const fact = await answerPropertyFact("Where are the garbage bags at the Scarborough house?");
if (!fact) fail("property fact", "no answer");
shape("property fact", fact, /gift basket/, ["Garbage bags", "kitchen counter", "Roseglor", "Knowledge Hub"]);
if (/no information|don't have|do not have|nothing on file/i.test(fact)) fail("property fact", fact);

const prompts = [
  promptFor("facts", "", false, false, false),
  promptFor("facts", "", false, false, true),
  instructions(true, true, "facts"),
  claudeChatSystem(false, "2026-10-07"),
  GENERAL_ANSWER_SYSTEM,
];
for (const prompt of prompts) {
  if (!prompt.includes(ANSWER_STYLE) || !hasAnswerStyle(prompt)) fail("style", "a chat prompt dropped the answer style");
}

console.log("golden answers: 5 passed");
