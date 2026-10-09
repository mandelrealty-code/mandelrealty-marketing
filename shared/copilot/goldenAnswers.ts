/**
 * Golden answers for the questions partners actually ask.
 * Each case pins the facts and the shape: answer first, those values present, no hedge.
 */

import { renderAnswer } from "./answerMarkup.js";
import { ANSWER_STYLE, firstSentence, HEDGE, hasAnswerStyle } from "./answerStyle.js";
import { claudeChatSystem } from "./claudeAnswer.js";
import { promptFor } from "./cursorThink.js";
import { instructions } from "./hospitableAgent.js";
import { briefFromChecksMessages, readSavedBrief, waitingDraftCard } from "./brief.js";
import { isDemoted, noteSignal, rankOverview, signalKey, type OverviewInput, type RankSignals } from "./overviewRank.js";
import { answerOps } from "./ops.js";
import { linesInPdf } from "./contractPdf.js";
import { answerPdfReport } from "./revenueReport.js";
import { ID, reservations, worldAt } from "./parity/catalog.js";
import { failNextOpsPropertyRead, installOpsClients, installOpsReservations } from "./parity/opsState.js";
import { installWorld } from "./parity/world.js";
import { GENERAL_ANSWER_SYSTEM } from "./plainAnswer.js";
import { takeMemoryTurn } from "./memoryFiles.js";
import { answerPropertyFact } from "./propertyFact.js";
import { pinnedCompanyAnswer } from "./pinnedAnswer.js";
import { answerMailChain } from "./mailChain.js";
import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { INTERNAL_TERMS, hasInternalContent } from "./marketingCopy.js";
import { answerInboxToday } from "./mailInbox.js";
import { asksMailBreakdown } from "./mailChain.js";
import { questionRoute, skipsWeb } from "./route.js";
import { installResearch, researchWebCalls, resetResearch } from "./skillResearch.js";
import { answerRecords, asksUnitRoster, missingSourceAnswer } from "./recordsAnswer.js";
import { answerOwnStore, CLIENT_STORE_EMPTY } from "./storeQuestions.js";
import { createProposal } from "../pm/proposalStore.js";
import { listPmClients } from "../pm/clientStore.js";
import { upsertSop } from "../pm/sopStore.js";
import { answerStay, asksDayCount } from "./stayAnswer.js";
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
  {
    id: "sep-blue",
    property_id: ID.blue,
    hospitable_reservation_id: "sep-blue",
    platform: "airbnb",
    platform_id: "sep-blue",
    status: "accepted",
    check_in: "2026-09-04",
    check_out: "2026-09-08",
    nights: 4,
    currency: "CAD",
    gross_cents: 110000,
    host_payout_cents: 100000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 100000, formatted: "$1,000.00" } } },
    synced_at: "2026-09-08T00:00:00.000Z",
  },
  {
    id: "sep-shaw",
    property_id: ID.shaw,
    hospitable_reservation_id: "sep-shaw",
    platform: "airbnb",
    platform_id: "sep-shaw",
    status: "accepted",
    check_in: "2026-09-12",
    check_out: "2026-09-16",
    nights: 4,
    currency: "CAD",
    gross_cents: 280000,
    host_payout_cents: 250000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 250000, formatted: "$2,500.00" } } },
    synced_at: "2026-09-16T00:00:00.000Z",
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

const septemberWhen = new Date("2026-10-07T15:00:00Z");
const septemberTotal = await answerOps("What was the revenue in September?", septemberWhen);
if (!septemberTotal) fail("september revenue", "no total");
shape("september revenue", septemberTotal, /\$3,500\.00 CAD/, ["September", "host revenue"]);
if (septemberTotal.includes("$1,000.00") || septemberTotal.includes("$2,500.00")) {
  fail("september revenue", septemberTotal);
}
const blueOnly = await answerOps("And for Blue Jays Way only?", septemberWhen, septemberTotal);
if (!blueOnly) fail("blue jays revenue", "no answer");
shape("blue jays revenue", blueOnly, /\$1,000\.00 CAD/, ["September", "20 Blue Jays Way", "host revenue"]);
if (blueOnly.includes("$3,500.00") || blueOnly.includes("$2,500.00") || /started reading|didn't finish/i.test(blueOnly)) {
  fail("blue jays revenue", blueOnly);
}
if (blueOnly === septemberTotal) fail("blue jays revenue", "same figure as the total");
const pdfReport = await answerPdfReport("Make me a PDF report of September revenue by property", septemberWhen);
if (!pdfReport?.file) fail("september pdf", pdfReport?.body || "no pdf");
if (!pdfReport.body.includes("$3,500.00 CAD") || !/by property/i.test(pdfReport.body)) fail("september pdf", pdfReport.body);
const pdfText = linesInPdf(Buffer.from(pdfReport.file.data, "base64")).join("\n");
const propertyFigures = ["8 Charlotte 606: $0.00 CAD", "41 Roseglor Cres: $0.00 CAD", "20 Blue Jays Way: $1,000.00 CAD", "1065 Shaw Street: $2,500.00 CAD"];
for (const figure of propertyFigures) {
  if (!pdfReport.body.includes(figure) || !pdfText.includes(figure)) fail("september pdf", `missing ${figure}\n${pdfText}`);
}
const summed = propertyFigures.reduce((sum, figure) => sum + Number(figure.replace(/.*\$/, "").replace(/ CAD/, "").replace(/,/g, "")) * 100, 0);
if (summed !== 350000) fail("september pdf", `figures summed to ${summed}`);
if (!pdfText.includes("Total: $3,500.00 CAD") || !pdfText.includes("Generated October 7, 2026")) fail("september pdf", pdfText);
if (!pdfReport.body.includes("Total: $3,500.00 CAD") || !pdfReport.body.includes("Generated October 7, 2026")) fail("september pdf", pdfReport.body);
const quarterly = await answerPdfReport("Make me a PDF of the quarterly report", septemberWhen);
if (!quarterly || quarterly.file || /\$3,500|\$1,000|\$2,500/.test(quarterly.body) || !/can't make a quarterly report as a PDF/.test(quarterly.body)) {
  fail("quarterly pdf", quarterly?.body || "no refusal");
}
failNextOpsPropertyRead(ID.blue);
try {
  const failedRead = await answerOps("And for Blue Jays Way only?", septemberWhen, septemberTotal);
  if (!failedRead || !/The OPS revenue read for 20 Blue Jays Way failed\./.test(failedRead)) {
    fail("blue jays revenue read", String(failedRead));
  }
  if (/started reading|didn't finish|\$\d/i.test(failedRead)) fail("blue jays revenue read", failedRead);
} finally {
  failNextOpsPropertyRead(null);
}

const clients = await answerOps("How many clients do we have?");
if (clients !== "We currently have 3 clients.") fail("clients", String(clients));
shape("clients", clients, /^We currently have 3 clients\.$/, ["3"]);

const fact = await answerPropertyFact("Where are the garbage bags at the Scarborough house?");
if (!fact) fail("property fact", "no answer");
shape("property fact", fact, /gift basket/, ["Garbage bags", "kitchen counter", "Roseglor", "Knowledge Hub"]);
if (/no information|don't have|do not have|nothing on file/i.test(fact)) fail("property fact", fact);

const shawWorld = worldAt("2026-10-07T11:00:00-04:00");
const shawCaptionHub = shawWorld.hub?.find((row) => row.propertyId === ID.shaw);
if (!shawCaptionHub) fail("shaw caption", "Shaw hub missing");
shawCaptionHub.body = [
  shawCaptionHub.body,
  "Return the garage remote to the lock box.",
  "The keys stay in the lock box.",
  "Shoes go in the entry closet.",
  "Spare linens are stored in the hall closet.",
  "Cleaning supplies stay in storage.",
  "Check-out instructions are in the house manual.",
].join("\n");
const shawListing = shawWorld.properties.find((row) => row.id === ID.shaw);
if (!shawListing) fail("shaw caption", "Shaw listing missing");
shawListing.description = `${shawListing.description ?? ""} Spare linens are stored in the hall closet.`;
shawListing.amenities = [...(shawListing.amenities ?? []), "Lock box for the garage remote", "Cleaning supplies in the closet"];
installWorld(shawWorld);
const captionAsk = "Draft an Instagram caption to market the Shaw Street house for a fall weekend";
const captionPinned = await pinnedCompanyAnswer(captionAsk);
const caption = captionPinned?.body ?? "";
if (!captionPinned || captionPinned.step !== "Drafted the copy") fail("shaw caption", caption || "no draft");
shape("shaw caption", caption, /^A fall weekend on Shaw Street\.$/, ["Nothing was posted", "free parking", "Shaw Street"]);
if (hasInternalContent(caption)) fail("shaw caption", caption);
for (const term of INTERNAL_TERMS) {
  if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(caption)) fail("shaw caption", caption);
}
const captionLines = caption.split("\n").map((line) => line.trim()).filter(Boolean);
if (captionLines.some((line) => /^[-•*]/.test(line))) fail("shaw caption", caption);
const captionParagraph = captionLines.find((line) => line !== "A fall weekend on Shaw Street." && !line.startsWith("#") && line !== "Nothing was posted.");
const captionSentences = (captionParagraph ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
if (captionSentences.length < 2 || captionSentences.length > 4) fail("shaw caption", caption);
if (/quiet hours|netflix|garbage bags|hall closet|house manual|check-out instructions/i.test(caption)) fail("shaw caption", caption);
installWorld(worldAt("2026-10-07T11:00:00-04:00"));

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
  ["How many check ins are tomorrow?", "stay"],
  ["How many check ins are on Friday, October 9?", "stay"],
  ["Break down the email chain with Manik in 2-3 paragraphs", "mail"],
  ["How many reservations do we have this month?", "reservation"],
  ["What does the cleaner app show for turnovers?", "cleaner"],
  ["Where is the SOP for guest arrival?", "sop"],
  ["How many clients do we have?", "client"],
  ["List our clients", "client"],
  ["What proposals do we have saved?", "proposal"],
  ["List the SOPs", "sop"],
  ["Is a cleaner assigned for the Blue Jays Way clean on Friday October 9?", "cleaner"],
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

installWorld(worldAt("2026-10-07T11:00:00-04:00"));
const SAVED = "remember the Shaw Street house gate code is kept in the kitchen junk drawer";
const ASK = "Where is the Shaw Street house gate code kept?";
async function keepFact(chatId: string, messageId: string): Promise<void> {
  const offered = await takeMemoryTurn({ text: SAVED, messageId, chatId });
  if (!offered) fail("memory recall", "the fact was not saved");
  const kept = offered.choices
    ? await takeMemoryTurn({
      text: "Yes",
      messageId: `${messageId}-yes`,
      chatId,
      priorAssistant: offered.body,
      priorUser: SAVED,
    })
    : offered;
  if (!kept || !/saved|added/i.test(kept.body)) fail("memory recall", kept?.body ?? "the fact was not saved");
}
await keepFact("chat-save", "gate-save");
const recalled = await answerPropertyFact(ASK);
if (!recalled) fail("memory recall", "a fresh conversation did not answer");
if (!/kitchen junk drawer/i.test(recalled) || !/from saved memory/i.test(recalled)) fail("memory recall", recalled);
if (/parking|netflix|network|shaw profile|Knowledge Hub/i.test(recalled)) fail("memory recall", recalled);

const conflictWorld = worldAt("2026-10-07T11:00:00-04:00");
const shawHub = conflictWorld.hub?.find((row) => row.propertyId === ID.shaw);
if (!shawHub) fail("memory recall", "Shaw has no Hub");
shawHub.body += "\nThe gate code is kept in the lockbox by the front door.";
installWorld(conflictWorld);
await keepFact("chat-fresh", "gate-conflict");
const differed = await answerPropertyFact(ASK);
if (!differed) fail("memory recall", "the conflicting fact was not answered");
if (!/lockbox by the front door/i.test(firstSentence(differed)) || !/Knowledge Hub/.test(differed)) fail("memory recall", differed);
if (!/saved memory differs/i.test(differed) || !/kitchen junk drawer/i.test(differed)) fail("memory recall", differed);
if (/parking|netflix|network|shaw profile/i.test(differed)) fail("memory recall", differed);

const assign = waitingDraftCard({
  messageId: "draft-blue",
  chatId: "checks",
  createdAt: "2026-10-07T12:00:00.000Z",
  channel: "hospitable",
  subject: "Assign a cleaner",
  body: "318, 20 Blue Jays Way, Toronto, turnover 2026-10-09. Assign Maria. Nothing is written until you press Submit.",
  to: "",
  skillName: "",
  purchaseLine: "",
  purchaseProperty: "",
  cleanerName: "Maria",
  cleanerUnit: "318, 20 Blue Jays Way, Toronto",
  cleanerOn: "2026-10-09",
});
if (!assign?.headline || !assign.detail) fail("cleaner card", "missing headline");
if (assign.headline !== "Assign Maria to the Blue Jays Way clean on Fri Oct 9") fail("cleaner card", assign.headline);
if (!/Approving writes Maria onto that turnover in the cleaner app\./.test(assign.detail) || !/Nothing has been written yet\./.test(assign.detail)) {
  fail("cleaner card", assign.detail);
}
if (assign.action !== "Review" || assign.chatId !== "checks" || assign.messageId !== "draft-blue") fail("cleaner card", "Review does not open the draft");
const vague = waitingDraftCard({
  messageId: "draft-vague",
  chatId: "",
  createdAt: "2026-10-07T12:00:00.000Z",
  channel: "hospitable",
  subject: "Assign a cleaner",
  body: "Assign a cleaner is ready. Nothing was changed.",
  to: "",
  skillName: "",
  purchaseLine: "",
  purchaseProperty: "",
  cleanerName: "",
  cleanerUnit: "",
  cleanerOn: "",
});
if (vague) fail("cleaner card", vague.text);
const started = performance.now();
const savedOverview = await readSavedBrief(new Date("2026-10-07T15:00:00Z"));
const overviewMs = performance.now() - started;
if (!savedOverview.hello) fail("overview load", "no saved overview");
if (overviewMs > 200) fail("overview load", `${overviewMs.toFixed(1)}ms`);

const morningAt = new Date("2026-10-08T12:40:00Z");
const morning: OverviewInput[] = [
  {
    id: "reg",
    kind: "registration",
    property: "Charlotte 606",
    title: "Lena Park arrives today and Charlotte 606 still has no registration",
    why: "The building form is filled in and unsent.",
    lead: "Lena Park arrives today and Charlotte 606 still has no registration.",
    when: "Due today",
    deadline: "2026-10-08T20:00:00Z",
    action: "Review",
  },
  {
    id: "clean",
    kind: "cleaner",
    property: "Blue Jays Way",
    title: "No cleaner on tomorrow's turnover at Blue Jays Way",
    why: "The guest arrives tomorrow and the turnover has no cleaner.",
    lead: "Blue Jays Way has no cleaner for tomorrow's arrival.",
    when: "Tomorrow",
    deadline: "2026-10-09T15:00:00Z",
    action: "Review",
  },
  {
    id: "expire",
    kind: "expiring",
    property: "Shaw Street",
    title: "Shaw Street parking notice takes effect tomorrow",
    why: "The notice date is inside 48 hours.",
    lead: "Shaw Street's notice takes effect tomorrow.",
    when: "Tomorrow",
    deadline: "2026-10-09T22:00:00Z",
    action: "Review",
    actions: ["Already upgraded", "Still pending"],
  },
  {
    id: "stock",
    kind: "stock",
    property: "Roseglor",
    title: "Paper towels at Roseglor are down to 1",
    why: "A stay arrives inside 7 days.",
    lead: "Roseglor needs paper towels before the next stay.",
    when: "This week",
    deadline: "2026-10-12T12:00:00Z",
    action: "Review",
  },
  {
    id: "failed",
    kind: "failed",
    property: "VRBO",
    title: "Couldn't read VRBO messages",
    why: "Couldn't read VRBO messages. Airbnb was read.",
    lead: "VRBO could not be read.",
    when: "Last pass",
    deadline: "2026-10-08T12:00:00Z",
    action: "Open",
  },
];
const rankedMorning = rankOverview(morning, {}, morningAt);
const morningIds = rankedMorning.today.map((row) => row.id);
if (morningIds.join(",") !== "reg,clean,expire,stock,failed") fail("overview rank", morningIds.join(",") || "empty");
if (!rankedMorning.summary.startsWith("Four things need you today.")) fail("overview rank", rankedMorning.summary);
if (!rankedMorning.summary.includes("Lena Park arrives today and Charlotte 606 still has no registration.")) {
  fail("overview rank", rankedMorning.summary);
}
if (rankedMorning.today.find((row) => row.id === "failed")?.rank !== 0) fail("overview rank", "the failed read was counted");
if (rankedMorning.today.find((row) => row.id === "expire")?.actions?.join(",") !== "Already upgraded,Still pending") {
  fail("overview rank", "the expiring item lost its choices");
}
const other: OverviewInput = {
  id: "other",
  kind: "other",
  property: "Roseglor",
  title: "A reminder for Roseglor sits in the file",
  why: "No deadline inside the higher tiers.",
  lead: "A Roseglor reminder is still open.",
  when: "Today",
  deadline: "2026-10-08T23:00:00Z",
  action: "Review",
};
const stockAgain: OverviewInput = { ...morning[3], id: "stock-later", title: "Paper towels at Roseglor are down to 2" };
let signals: RankSignals = {};
signals = noteSignal(signals, "dismiss", "stock", "Roseglor");
if (isDemoted(signals, "stock", "Roseglor", 5)) fail("overview rank", "one dismissal demoted the stock");
signals = noteSignal(signals, "dismiss", "stock", "Roseglor");
if (!isDemoted(signals, "stock", "Roseglor", 5) || isDemoted(signals, "registration", "Charlotte 606", 1)) {
  fail("overview rank", "the demotion rule missed");
}
const demoted = rankOverview([morning[0], other, stockAgain, morning[4]], signals, morningAt);
const demotedIds = demoted.today.map((row) => row.id);
if (demotedIds.join(",") !== "reg,other,stock-later,failed") fail("overview rank", demotedIds.join(",") || "empty");
if (!demoted.summary.includes("Lena Park")) fail("overview rank", demoted.summary);
if (signalKey("stock", "Roseglor") !== "stock|roseglor") fail("overview rank", "signal key");
if (signals["stock|roseglor"]?.dismissals !== 2 || signals["stock|roseglor"]?.passed !== 0) {
  fail("overview rank", JSON.stringify(signals));
}

const maintenanceQ = "What maintenance is due or overdue at our units?";
const channelQ = "Which of our units are listed on Booking.com and VRBO?";
const maintenance = await answerRecords(maintenanceQ);
const channels = await answerRecords(channelQ);
if (maintenance !== "Maintenance tracking is not connected to Copilot yet.") fail("missing source", maintenance ?? "no answer");
if (channels !== "I cannot see Booking.com or VRBO listings.") fail("missing source", channels ?? "no answer");
if (missingSourceAnswer(maintenanceQ) !== maintenance || missingSourceAnswer(channelQ) !== channels) {
  fail("missing source", "the chat sentence and the record sentence differ");
}
for (const answer of [maintenance, channels]) {
  if (!answer || answer.includes("\n") || /we manage/i.test(answer)) fail("missing source", answer ?? "empty");
}
if (asksUnitRoster(maintenanceQ) || asksUnitRoster(channelQ)) fail("missing source", "the question was treated as a unit roster");
if (!asksUnitRoster("How many units do we manage?") || missingSourceAnswer("How many units do we manage?")) {
  fail("missing source", "a roster question was treated as a missing source");
}

const checksNow = new Date("2026-10-08T12:40:00Z");
const checksBrief = briefFromChecksMessages([
  {
    id: "draft-sam",
    chat_id: "checks",
    created_at: "2026-10-08T12:00:00.000Z",
    role: "assistant",
    body: "Here is the guest reply. Nothing was sent.",
    draft: {
      subject: "",
      body: "Hi Sam,\n\nThank you for staying with us.",
      to: "Sam",
      status: "waiting",
      channel: "hospitable",
    },
  },
  {
    id: "turn-diane",
    chat_id: "checks",
    created_at: "2026-10-08T12:05:00.000Z",
    role: "assistant",
    body: "Diane arrives tomorrow at Blue Jays Way. no cleaner assigned, turnover in 1 day.",
    draft: null,
  },
], [], [], checksNow);
const checksOverview = checksBrief.overview;
if (!checksOverview || checksOverview.count !== 2) fail("checks overview", String(checksOverview?.count ?? "none"));
if (!checksOverview.summary.startsWith("Two things need you today.")) fail("checks overview", checksOverview.summary);
if (!checksOverview.summary.includes("Diane")) fail("checks overview", checksOverview.summary);
if (!checksOverview.today[0]?.id.startsWith("turnover:")) fail("checks overview", checksOverview.today.map((row) => row.id).join(",") || "empty");
if (!/Diane/.test(checksOverview.today[0]?.title ?? "") || !/cleaner/i.test(checksOverview.today[0]?.title ?? "")) {
  fail("checks overview", checksOverview.today[0]?.title ?? "no first row");
}
if (!checksOverview.today.some((row) => row.id === "draft:draft-sam")) fail("checks overview", "the waiting draft was left out");
const emptyChecks = briefFromChecksMessages([], [], [], checksNow);
if (!emptyChecks.overview?.empty || emptyChecks.overview.count !== 0 || !emptyChecks.overview.summary.startsWith("Nothing needs you today")) {
  fail("checks overview", emptyChecks.overview?.summary ?? "no empty overview");
}

const clientQ = "List our clients";
const fixtureClients = [
  { name: "Elizabeth Hart", email: "elizabeth@mandelrealtygroup.com" },
  { name: "Mara Singh", email: "mara@mandelrealtygroup.com" },
  { name: "Noah Patel", email: "noah@mandelrealtygroup.com" },
];
const fixtureList = fixtureClients.map((row) => row.name).join("\n");
installOpsClients(fixtureClients);
if (await answerRecords(clientQ) || await answerStay(clientQ)) fail("clients list", "another source answered the client list");

async function clientChat(chatId: string): Promise<string> {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "parity-admin";
  process.env.ADMIN_SESSION_SECRET = "parity-secret";
  const token = createAdminSessionToken();
  let status = 0;
  let payload: { messages?: { role: string; body: string }[]; error?: string } = {};
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text: clientQ, chatId, kind: "chat" }, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
  );
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
  if (status !== 200) fail("clients list", payload.error || String(status));
  return [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
}

const storedList = (await answerOwnStore(clientQ))?.body ?? "";
const firstList = await clientChat("parity-clients-1");
const secondList = await clientChat("parity-clients-2");
if (storedList !== fixtureList || firstList !== fixtureList || secondList !== fixtureList) {
  fail("clients list", `${storedList}\n---\n${firstList}\n---\n${secondList}`);
}
if (/hospitable|unit #606|charlotte|roseglor|shaw street|we manage/i.test(firstList)) fail("clients list", firstList);
installOpsClients([]);
const emptyList = await clientChat("parity-clients-empty");
if (emptyList !== CLIENT_STORE_EMPTY) fail("clients list", emptyList);
installOpsClients(fixtureClients);

const proposalQ = "What proposals do we have saved?";
const elizabeth = (await listPmClients()).find((row) => row.name === "Elizabeth Hart");
if (!elizabeth) fail("proposals", "Elizabeth Hart is not in the client list");
await createProposal({
  client_id: elizabeth.id,
  address: "12 King Street",
  version: 1,
  sourced_on: "2026-10-07",
  total_cents: 10000,
  currency: "CAD",
  estimate: "A short estimate.",
  images_note: "",
  ready: "",
  rooms: [],
  pdf: Buffer.from("%PDF-1.1"),
});
if (await answerInboxToday(proposalQ) || (await pinnedCompanyAnswer(proposalQ)) || await answerOutsideRentals(proposalQ)) {
  fail("proposals", "mail or the web answered the proposal question");
}
const proposalList = await answerOwnStore(proposalQ);
if (!proposalList) fail("proposals", "no answer");
shape("proposals", proposalList.body, /^1 saved proposal\./, ["12 King Street", "version 1", "draft"]);
if (/gmail|inbox|e-?mail|search/i.test(proposalList.body)) fail("proposals", proposalList.body);

const sopQ = "List the SOPs";
await upsertSop({
  title: "Guest arrival SOP",
  target_role: "va",
  summary: "Read the new message",
  steps: [{ id: "step-1", step_number: 1, title: "Read the new message", description: "Read the new message" }],
});
const sopList = await answerOwnStore(sopQ);
if (!sopList) fail("sops", "no answer");
shape("sops", sopList.body, /^1 SOP\./, ["Guest arrival SOP"]);
if (/don't have a tool|do not have a tool|no tool/i.test(sopList.body)) fail("sops", sopList.body);

const cleanerQ = "Is a cleaner assigned for the Blue Jays Way clean on Friday October 9?";
if (await answerStay(cleanerQ) || await answerRecords(cleanerQ)) fail("cleaner", "Hospitable answered the cleaner question");
const cleanerWorld = worldAt("2026-10-07T11:00:00-04:00");
cleanerWorld.cleaner = {
  turnovers: [{
    propertyId: ID.blue,
    scheduledOn: "2026-10-09",
    status: "scheduled",
    assigned: false,
    done: false,
    issue: "",
  }],
};
installWorld(cleanerWorld);
const unassigned = await answerOwnStore(cleanerQ);
if (!unassigned) fail("cleaner", "no answer");
shape("cleaner", unassigned.body, /^No\./, ["20 Blue Jays Way", "Friday, October 9, 2026"]);
if (/does not appear|didn't appear|couldn't match|hospitable/i.test(unassigned.body)) fail("cleaner", unassigned.body);
const assignedTurnover = cleanerWorld.cleaner?.turnovers?.[0];
if (!assignedTurnover) fail("cleaner", "the turnover fixture was missing");
assignedTurnover.assigned = true;
installWorld(cleanerWorld);
const assigned = await answerOwnStore(cleanerQ);
if (!assigned) fail("cleaner", "no assigned answer");
shape("cleaner assigned", assigned.body, /^Yes\./, ["20 Blue Jays Way", "Friday, October 9, 2026"]);
if (/does not appear|didn't appear|couldn't match|hospitable/i.test(assigned.body)) fail("cleaner assigned", assigned.body);

const tomorrowWorld = worldAt("2026-10-07T11:00:00-04:00");
tomorrowWorld.reservations.push(
  { id: "tmrw-charlotte", code: "HMTMRW606", propertyId: ID.charlotte, status: "accepted", checkIn: "2026-10-08", checkOut: "2026-10-10", guest: "Ava", adults: 2, children: 0, messages: [] },
  { id: "tmrw-rose", code: "HMTMRW041", propertyId: ID.rose, status: "accepted", checkIn: "2026-10-08", checkOut: "2026-10-11", guest: "Ben", adults: 2, children: 0, messages: [] },
  { id: "tmrw-shaw", code: "HMTMRW065", propertyId: ID.shaw, status: "accepted", checkIn: "2026-10-08", checkOut: "2026-10-09", guest: "Cara", adults: 1, children: 0, messages: [] },
);
installWorld(tomorrowWorld);
const tomorrowQ = "How many check ins are tomorrow?";
if (!asksDayCount(tomorrowQ) || await answerOutsideRentals(tomorrowQ)) fail("tomorrow check-ins", "the day count was not pinned");
const tomorrowSplit = [
  "3 accepted check-ins on 2026-10-08.",
  "8 Charlotte 606: 1 accepted check-in",
  "Roseglor: 1 accepted check-in",
  "20 Blue Jays Way: 0 accepted check-ins",
  "1065 Shaw Street: 1 accepted check-in",
].join("\n");
const tomorrowA = await answerStay(tomorrowQ);
const tomorrowB = await answerStay(tomorrowQ);
if (tomorrowA !== tomorrowSplit || tomorrowB !== tomorrowA) fail("tomorrow check-ins", tomorrowA ?? "no answer");
if (/doesn.?t show which units|couldn.?t match|failed read|1104|Partner Loft|Wes|Ned/i.test(tomorrowA)) fail("tomorrow check-ins", tomorrowA);

const fridayQ = "How many check ins are on Friday, October 9?";
if (!asksDayCount(fridayQ)) fail("friday check-ins", "a named day was not a day count");
const fridaySplit = [
  "1 accepted check-in on 2026-10-09.",
  "8 Charlotte 606: 0 accepted check-ins",
  "Roseglor: 0 accepted check-ins",
  "20 Blue Jays Way: 1 accepted check-in",
  "1065 Shaw Street: 0 accepted check-ins",
].join("\n");
const fridayA = await answerStay(fridayQ);
const fridayB = await answerStay("How many check ins are on Friday?");
if (fridayA !== fridaySplit || fridayB !== fridayA) fail("friday check-ins", `${fridayA ?? "no answer"}\n${fridayB ?? "no second answer"}`);
if (/doesn.?t show which units|couldn.?t match/i.test(fridayA)) fail("friday check-ins", fridayA);

const manikQ = "Break down the email chain with Manik in 2-3 paragraphs";
installWorld(worldAt("2026-10-07T11:00:00-04:00", false, [
  {
    id: "manik-1",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "inbox",
    from: "Manik",
    email: "manik@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-01T09:00:00-04:00",
    subject: "Dishwasher at 8 Charlotte 606",
    snippet: "The dishwasher is leaking.",
    body: "The dishwasher at 8 Charlotte 606 is leaking. Can you send a plumber?",
    airbnb: false,
  },
  {
    id: "manik-2",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: "manik@example.com",
    date: "2026-10-02T10:00:00-04:00",
    subject: "Re: Dishwasher at 8 Charlotte 606",
    snippet: "Thursday morning.",
    body: "I can send a plumber Thursday morning.",
    airbnb: false,
  },
  {
    id: "manik-3",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "inbox",
    from: "Manik",
    email: "manik@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-03T11:00:00-04:00",
    subject: "Re: Dishwasher at 8 Charlotte 606",
    snippet: "Please confirm.",
    body: "Thursday works. Please confirm once the plumber is booked.",
    airbnb: false,
  },
]));
if (!asksMailBreakdown(manikQ) || await answerOutsideRentals(manikQ)) fail("manik chain", "the breakdown was not pinned");
const previousPassword = process.env.ADMIN_PASSWORD;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();
let manikStatus = 0;
let manikPayload: { messages?: { role: string; body: string }[]; error?: string } = {};
await handleCopilot(
  { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text: manikQ, chatId: "parity-manik", kind: "chat" }, query: {} } as never,
  { status(code: number) { manikStatus = code; return this; }, json(body: typeof manikPayload) { manikPayload = body; return this; } } as never,
);
if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;
const manikA = [...(manikPayload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
const shared = (await answerMailChain(manikQ)) ?? "";
if (manikStatus !== 200 || !manikA || manikA !== shared) fail("manik chain", manikA || manikPayload.error || "no answer");
const manikParagraphs = manikA.split(/\n\n/).filter(Boolean);
if (manikParagraphs.length < 2 || manikParagraphs.length > 3) fail("manik chain", manikA);
if (!manikA.includes("Manik") || !manikA.includes("Thursday morning") || !manikA.includes("plumber is booked") || !/outstanding/i.test(manikA)) {
  fail("manik chain", manikA);
}
for (const body of [
  "The dishwasher at 8 Charlotte 606 is leaking. Can you send a plumber?",
  "I can send a plumber Thursday morning.",
  "Thursday works. Please confirm once the plumber is booked.",
]) {
  if (manikA.includes(body)) fail("manik chain", `pasted a message body\n${manikA}`);
}


function moneyFigures(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(moneyFigures);
  if (!value || typeof value !== "object") return [];
  const row = value as { formatted?: unknown };
  const own = typeof row.formatted === "string" && row.formatted.trim() ? [row.formatted.trim()] : [];
  return [...own, ...Object.values(value as Record<string, unknown>).flatMap(moneyFigures)];
}

async function sendChat(chatId: string, text: string, webSearch = false): Promise<string> {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "parity-admin";
  process.env.ADMIN_SESSION_SECRET = "parity-secret";
  const token = createAdminSessionToken();
  let status = 0;
  let payload: { messages?: { role: string; body: string }[]; error?: string } = {};
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text, chatId, kind: "chat", webSearch }, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
  );
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
  if (status !== 200) fail("guest payment", payload.error || String(status));
  return [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
}

installWorld(worldAt("2026-10-07T11:00:00-04:00"));
const dianePay = reservations().find((row) => row.guest === "Diane");
const figures = [...new Set(moneyFigures(dianePay?.financials))];
if (!figures.includes("$1,847.35") || !figures.includes("$1,620.00")) fail("guest payment", figures.join(", ") || "no fixture figures");
await sendChat("parity-diane-pay", "did diane respond to shane?");
resetResearch();
installResearch([{
  title: "Google search results for reservation fees",
  url: "https://www.google.com/search?q=reservation+fees",
  text: "Restaurant reservation fees often run $25 to $50 a person.",
}]);
const webBefore = researchWebCalls();
const paid = await sendChat("parity-diane-pay", "how much did she pay for her reservation?", true);
if (researchWebCalls() !== webBefore) fail("guest payment", `web calls ${researchWebCalls() - webBefore}`);
for (const figure of figures) {
  if (!paid.includes(figure)) fail("guest payment", `missing ${figure}\n${paid}`);
}
if (!/in total/i.test(paid) || !/host revenue/i.test(paid)) fail("guest payment", paid);
if (/google|search results|restaurant reservation fee|not its payment figures/i.test(paid)) fail("guest payment", paid);
const eloisePay = await sendChat("parity-eloise-pay", "how much did Eloise pay for her reservation?", true);
if (eloisePay !== "I can see her reservation but not its payment figures") fail("guest payment", eloisePay);
if (researchWebCalls() !== webBefore) fail("guest payment", `web calls after eloise ${researchWebCalls() - webBefore}`);

console.log("golden answers passed");
