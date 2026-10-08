/**
 * Golden answers for the questions partners actually ask.
 * Each case pins the facts and the shape: answer first, those values present, no hedge.
 */

import { renderAnswer } from "./answerMarkup.js";
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
import { answerInboxToday } from "./mailInbox.js";
import { questionRoute, skipsWeb } from "./route.js";
import { installResearch, resetResearch } from "./skillResearch.js";
import { answerStay } from "./stayAnswer.js";
import { answerOutsideRentals } from "./topicScope.js";

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

const marked = renderAnswer("**Two** open items:\n- Keys are with the desk\n- Windows were checked");
if (/\*\*/.test(marked) || marked.includes("*")) fail("markup", marked);
if (!marked.includes("<strong>Two</strong>")) fail("markup", marked);
if (!marked.includes("<ul>") || !marked.includes("<li>Keys are with the desk</li>") || !marked.includes("<li>Windows were checked</li>")) {
  fail("markup", marked);
}
const summary = renderAnswer("Read **23** of 23 stays.");
if (/\*\*/.test(summary) || !summary.includes("<strong>23</strong>")) fail("markup summary", summary);

const routes: Array<[string, string]> = [
  ["Any new emails come in today from Gmail?", "mail"],
  ["How many check ins are today?", "stay"],
  ["How many reservations do we have this month?", "reservation"],
  ["What does the cleaner app show for turnovers?", "cleaner"],
  ["Where is the SOP for guest arrival?", "sop"],
  ["How many clients do we have?", "client"],
  ["What was the host revenue in August?", "revenue"],
  ["What have we remembered about parking?", "memory"],
  ["What are the Rogers Centre box office hours?", "web"],
  ["search amazon for a muskoka chair thats red", "web"],
];
for (const [question, route] of routes) {
  if (questionRoute(question) !== route) fail("route", `${question} → ${questionRoute(question)}`);
  if (route === "web") {
    if (skipsWeb(question)) fail("route", `${question} was kept off the web`);
  } else if (!skipsWeb(question) || questionRoute(question) === "web") {
    fail("route", `${question} can reach web search`);
  }
}

const DECOY = "Unrelated Google results for new emails today.";
installResearch([{
  title: "Any new emails come in today from Gmail?",
  url: "https://www.google.com/search?q=new+emails+today",
  text: DECOY,
}]);

const checkinsToday = await answerStay("How many check ins are today?");
if (!checkinsToday) fail("check-ins spaced", "no answer");
shape("check-ins spaced", checkinsToday, /^0 accepted check-ins on 2026-10-07\./, [
  "8 Charlotte 606",
  "Roseglor",
  "20 Blue Jays Way",
  "1065 Shaw Street",
]);
if (checkinsToday.includes(DECOY) || /google\.com|search results/i.test(checkinsToday)) fail("check-ins spaced", checkinsToday);
const webCheckins = await answerOutsideRentals("How many check ins are today?");
if (webCheckins) fail("check-ins spaced", webCheckins.body);

installWorld(worldAt("2026-10-07T11:00:00-04:00", false, [
  {
    id: "today-manik",
    mailbox: "gmail",
    folder: "inbox",
    from: "Manik",
    email: "manik@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-07T08:15:00-04:00",
    subject: "Dishwasher at 8 Charlotte 606",
    snippet: "SNIPPET-DUMP",
    body: "BODY-DUMP the raw message",
    airbnb: false,
  },
  {
    id: "yesterday-note",
    mailbox: "gmail",
    folder: "inbox",
    from: "Accounts",
    email: "accounts@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-06T18:00:00-04:00",
    subject: "Yesterday invoice",
    snippet: "old",
    body: "This arrived yesterday.",
    airbnb: false,
  },
  {
    id: "sent-today",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: "manik@example.com",
    date: "2026-10-07T09:00:00-04:00",
    subject: "Sent this morning",
    snippet: "sent",
    body: "Sent from us.",
    airbnb: false,
  },
  {
    id: "airbnb-today",
    mailbox: "gmail",
    folder: "inbox",
    from: "Airbnb",
    email: "automated@airbnb.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-07T07:00:00-04:00",
    subject: "Ryan sent a pre-approval",
    snippet: "airbnb",
    body: "Pre-approval notice.",
    airbnb: true,
  },
]));
const gmailQuestion = "Any new emails come in today from Gmail?";
const gmailWeb = await answerOutsideRentals(gmailQuestion);
if (gmailWeb) fail("gmail", gmailWeb.body);
const gmail = await answerInboxToday(gmailQuestion);
if (!gmail) fail("gmail", "no answer");
shape("gmail", gmail, /^1 new email came in today in Gmail\./, ["Manik", "Dishwasher at 8 Charlotte 606"]);
if (/BODY-DUMP|SNIPPET-DUMP|Yesterday invoice|Sent this morning|Ryan sent a pre-approval|google\.com|search results/i.test(gmail)) {
  fail("gmail", gmail);
}

resetResearch();
const VENUE = "What are the Rogers Centre box office hours?";
installResearch([{
  title: "Rogers Centre box office",
  url: "https://www.rogerscentre.com/box-office",
  text: [
    "Rogers Centre box office hours are 10:00 a.m. to 6:00 p.m.",
    "Buy tickets",
    "See the map",
    "Google search results for box office.",
  ].join("\n"),
}]);
const venue = await answerOutsideRentals(VENUE);
if (!venue || venue.kind !== "lookup") fail("venue", venue?.body ?? "the venue question was not looked up");
if (venue.body.includes("\n")) fail("venue", venue.body);
if (!/Rogers Centre box office hours are 10:00 a\.m\. to 6:00 p\.m\./.test(venue.body)) fail("venue", venue.body);
if (!/that is from Rogers Centre box office/i.test(venue.body) || !venue.body.includes("https://www.rogerscentre.com/box-office")) {
  fail("venue", venue.body);
}
if (/Buy tickets|See the map|Google search results|Page:/.test(venue.body)) fail("venue", venue.body);
if (venue.body.trim() === "Rogers Centre box office hours are 10:00 a.m. to 6:00 p.m.") fail("venue", venue.body);

console.log("golden answers: 8 passed");
