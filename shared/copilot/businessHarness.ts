/**
 * The Oct 13 live test, replayed through the chat path against its ground truths:
 * money questions from the money figures, "what's waiting on me" across the whole business, guest
 * lookups from the records, availability in any wording, drafts shown in the chat, the money move,
 * and the follow-ups from the same day (specs from the Airbnb listing, search narration stripped,
 * bullets from the previous answer, purchasing from current listings).
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { setCompsSource, setListingSource } from "./compsAnswer.js";
import { clearHandledFollowUps, resetGuestMessaging } from "./guestMessaging.js";
import { capturedCommits, capturedDrafts, resetCaptures } from "./parity/capture.js";
import { correctWeekdays } from "./weekdays.js";
import { ID, worldAt } from "./parity/catalog.js";
import { setParityClock } from "./parity/clock.js";
import { installOpsReservations } from "./parity/opsState.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { ensureUnitSetups, resetUnitSetups } from "./unitSetup.js";
import { setWebAnswerer } from "./webAnswer.js";
import type { PmReservationRow } from "../pm/reservationStore.js";
import { answerBuildingRegistrationItem, asksBuildingRegistration } from "./buildingRegistration.js";
import { emailCardLabel } from "./checksLabel.js";
import { torontoWhen } from "./mailSearch.js";
import { parityChecksMessages, paritySaveChecksMessage, resetParityChecksMessages } from "./parity/storeStub.js";
import { BLUE_JAYS_PROCESS } from "./processFacts.js";
import { buildingMail } from "./stayCheck.js";

function fail(message: string): never {
  throw new Error(`Business harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

type Reply = { body: string; draft?: { body: string; channel: string; hospitable?: { args: Record<string, unknown> } } | null; steps?: { text: string }[] | null };

async function send(chatId: string, text: string): Promise<Reply> {
  let payload: { messages?: (Reply & { role: string })[]; error?: string } = {};
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text, chatId, kind: "chat" }, query: {} } as never,
    { status() { return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
  );
  const reply = [...(payload.messages ?? [])].reverse().find((row) => row.role === "assistant");
  if (!reply) fail(`no answer to "${text}": ${payload.error ?? ""}`);
  return reply;
}

const terms = { commissionBaseMode: "nightly" as const, cleaningFeeKeeper: "host" as const, hstMode: "cohost" as const, hstBps: 0, rateBps: 2000 };

function money(cents: number, label: string) {
  return { amount: cents, formatted: `$${(cents / 100).toFixed(2)}`, label };
}

/** An OPS reservation whose host revenue is exactly `revenue` cents. */
function ops(id: string, propertyId: string, checkIn: string, checkOut: string, nights: number, revenue: number): PmReservationRow {
  return {
    id: `ops-${id}`, property_id: propertyId, hospitable_reservation_id: id, platform: "airbnb", platform_id: id.toUpperCase(), status: "accepted",
    check_in: checkIn, check_out: checkOut, nights, currency: "CAD", gross_cents: revenue, host_payout_cents: revenue,
    financials_json: { currency: "CAD", host: { accommodation: money(revenue, "Accommodation"), hostFees: [], guestFees: [], revenue: money(revenue, "Host revenue") }, guest: { totalPrice: money(revenue, "Total") } },
    synced_at: "2026-10-13T00:00:00.000Z",
  };
}

function stay(id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, messages: ParityReservation["messages"] = []): ParityReservation {
  return { id, code: id.toUpperCase(), propertyId, status: "accepted", checkIn, checkOut, guest, adults: 2, children: 0, messages };
}

const WINDOWS = "Yes we can send someone to clean the windows. If it's on or after October 14th, someone from my team can take care of it.";
const now = new Date("2026-10-13T16:00:00Z");
const world = worldAt("2026-10-13T12:00:00-04:00");
world.properties = world.properties.map((row) => {
  if (!row.managed) return row;
  const base = { ...row, billing: terms };
  if (row.id === ID.blue) return { ...base, owner: "Khamraj Shewnarain", capacity: { bedrooms: 2, bathrooms: 2, max: 0 }, airbnbListingId: "985318000", coordinates: { latitude: 43.6416, longitude: -79.3917 } };
  if (row.id === ID.charlotte) return { ...base, owner: "Nance Ta", capacity: { bedrooms: 1, bathrooms: 1, max: 4 } };
  if (row.id === ID.shaw) return { ...base, owner: "Roya Ardakani", capacity: { bedrooms: 2, bathrooms: 1, max: 6 } };
  return { ...base, owner: "Precilla Daniel", capacity: { bedrooms: 3, bathrooms: 2, max: 10 } };
});
world.reservations = [
  stay("res-sep-a", ID.charlotte, "Avery", "2026-09-01", "2026-09-08"),
  stay("res-sep-b", ID.charlotte, "Blake", "2026-09-10", "2026-09-20"),
  stay("res-eloise", ID.charlotte, "Eloise", "2026-10-01", "2026-11-07", [
    { id: "el-1", at: "2026-10-02T12:30:00Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
    { id: "el-2", at: "2026-10-07T17:01:00Z", role: "host", name: "Shane Mosoff", body: WINDOWS },
    { id: "el-3", at: "2026-10-10T15:24:00Z", role: "guest", name: "Eloise", body: "Thank you! On or after 14th is fine." },
    { id: "el-4", at: "2026-10-10T15:25:00Z", role: "host", name: "Shane Mosoff", body: "Okay I'll see what I can do for windows." },
  ]),
  stay("res-diane", ID.blue, "Diane", "2026-10-06", "2026-10-12", [
    { id: "di-1", at: "2026-10-06T20:54:00Z", role: "guest", name: "Diane", body: "We are bringing two cars. Are there two parking spaces?" },
    { id: "di-2", at: "2026-10-06T21:30:00Z", role: "host", name: "Shane Mosoff", body: "There is one spot, P2 #14. Street parking on Navy Wharf works for the second." },
    { id: "di-3", at: "2026-10-11T19:12:00Z", role: "guest", name: "Diane", body: "Thanks for a great stay! We'll be out by 11 tomorrow." },
    { id: "di-4", at: "2026-10-12T14:05:00Z", role: "host", name: "Shane Mosoff", body: "Thanks Diane, safe travels!" },
  ]),
  stay("res-husson", ID.blue, "Husson", "2026-10-15", "2026-10-19", [
    { id: "hu-1", at: "2026-10-10T18:00:00Z", role: "guest", name: "Husson", body: "Looking forward to it!" },
  ]),
  stay("res-shaw-wknd", ID.shaw, "Mila", "2026-10-09", "2026-10-11"),
  stay("res-blue-nov", ID.blue, "Noor", "2026-11-01", "2026-11-03"),
  stay("res-shaw-nov", ID.shaw, "Ola", "2026-11-08", "2026-11-16"),
  stay("res-rose-nov", ID.rose, "Pia", "2026-11-20", "2026-11-23"),
];
world.gmail = [{
  id: "bj-outage", mailbox: "gmail", folder: "inbox", from: "20 Blue Jays Way Management", email: "management@bluejaysway.example", to: "info@mandelrealtygroup.com",
  date: "2026-10-13T13:10:00Z", subject: "Hot water and heating outage today", snippet: "Hot water and heating are out at 20 Blue Jays Way today. No restoration time yet.",
  body: "Hot water and heating are out at 20 Blue Jays Way today due to a boiler failure. No restoration time yet.", airbnb: false,
}];
world.cleaner = {
  turnovers: [
    { propertyId: ID.blue, scheduledOn: "2026-10-12", status: "scheduled", assigned: false, done: false, issue: "" },
    { propertyId: ID.shaw, scheduledOn: "2026-10-11", status: "scheduled", assigned: true, done: true, issue: "", cleanerName: "Ana" },
  ],
};
// The next 30 days: Shaw's open nights listed at $150, the others near their comps.
const days = Array.from({ length: 31 }, (_, index) => new Date(Date.UTC(2026, 9, 13 + index)).toISOString().slice(0, 10));
world.calendar = [ID.charlotte, ID.rose, ID.blue, ID.shaw].flatMap((propertyId) => days.map((date) => ({
  propertyId, date, available: true, priceCents: propertyId === ID.shaw ? 15000 : 30000, minStay: 2,
})));
installWorld(world);
installOpsReservations([
  ops("res-sep-a", ID.charlotte, "2026-09-01", "2026-09-08", 7, 400000),
  ops("res-sep-b", ID.charlotte, "2026-09-10", "2026-09-20", 10, 552754),
  ops("res-diane", ID.blue, "2026-10-06", "2026-10-12", 6, 169459),
  ops("res-shaw-wknd", ID.shaw, "2026-10-09", "2026-10-11", 2, 60000),
]);
setParityClock(now);
resetGuestMessaging();
await clearHandledFollowUps();
resetCaptures();
const comparables = [200, 220, 240, 260, 280, 290, 300, 310, 320, 340, 360, 380, 420].map((rate, index) => ({ listingId: `c${index}`, ttmRate: rate, l90Rate: rate + 50, ttmRevenue: 30000 + rate * 10, currency: "CAD" }));
setCompsSource(async () => comparables);
setListingSource(async (listingId) => (listingId === "985318000" ? { bedrooms: 2, bathrooms: 2, guests: 8, latitude: 43.6416, longitude: -79.3917 } : null));

// 1. Money questions use the money figures.
const weekend = await send("biz-money-1", "How much did we make last weekend across all four units?");
if (!/^Last weekend \(Fri Oct 9 to Sun Oct 11\), across all 4 units: MRG made \$/.test(weekend.body)) fail(`last weekend: ${weekend.body}`);
if (/read failed|knowledge hub|does not return|doesn't return revenue/i.test(weekend.body)) fail(`last weekend refused: ${weekend.body}`);
const charlotte = await send("biz-money-2", "What did Charlotte make in September, and what did Nance actually take home?");
if (!/^8 Charlotte 606 in September 2026: host revenue \$9,527\.54 from 2 stays \(17 nights\)\./.test(charlotte.body)) fail(`charlotte september: ${charlotte.body}`);
if (!/Nance's take-home \(owner share\) is \$7,622\.03; MRG's share is \$1,905\.51\./.test(charlotte.body) || /knowledge hub/i.test(charlotte.body)) fail(`nance take-home: ${charlotte.body}`);

// 2. "What's waiting on me" is the whole business, with day words from today.
for (const ask of ["What's waiting on me?", "What's still open from yesterday?"]) {
  const waiting = await send(`biz-wait-${ask.length}`, ask);
  if (!/Hot water and heating are out/.test(waiting.body)) fail(`${ask} missed the outage: ${waiting.body}`);
  if (!/Eloise's window cleaning, due tomorrow/.test(waiting.body)) fail(`${ask} missed the window cleaning: ${waiting.body}`);
  if (!/Unassigned turnover after Diane's Oct 12 checkout/.test(waiting.body)) fail(`${ask} missed the turnover: ${waiting.body}`);
  if (/Husson arrives tomorrow/.test(waiting.body) || /revenue or earnings/i.test(waiting.body)) fail(`${ask} day words or claim: ${waiting.body}`);
}

// 3. Guest lookups resolve from the records.
const husson = await send("biz-husson", "Anything I should know before Husson checks in on Thursday?");
if (!/^Husson arrives Thursday, Oct 15 at 20 Blue Jays Way for 4 nights \(Oct 15–Oct 19\)\./.test(husson.body)) fail(`husson stay: ${husson.body}`);
if (!/Hot water and heating are out, notice this morning, no restoration time given\./.test(husson.body)) fail(`husson outage: ${husson.body}`);
if (!/Turnover after .*Oct 12 checkout: no cleaner is assigned yet\./.test(husson.body) || /which property/i.test(husson.body)) fail(`husson turnover: ${husson.body}`);
if (!/registration/i.test(husson.body)) fail(`husson registration: ${husson.body}`);
const diane = await send("biz-diane", "What did Diane say last?");
if (!/^Diane's last message, Oct 11, 3:12 PM \(20 Blue Jays Way.*\): "Thanks for a great stay! We'll be out by 11 tomorrow\."/.test(diane.body)) fail(`diane last: ${diane.body}`);
if (!/Shane already replied Oct 12, 10:05 AM, so no draft is owed\./.test(diane.body)) fail(`diane state: ${diane.body}`);

// 4. Availability in any wording uses the occupancy read.
const visit = await send("biz-visit", "If I wanted to visit all four units in one day next month, when could I do it?");
if (!/all four units have no guest at all on Nov 17–19, Nov 24–30\./.test(visit.body)) fail(`visit: ${visit.body}`);
if (/Nov (?:2|3|4|5)\b/.test(visit.body.split("\n")[0] ?? "")) fail(`visit offered a day Eloise is in: ${visit.body}`);

// 5. A requested draft is shown where it was asked.
const draft = await send("biz-draft", "Draft a message to Husson about the hot water");
if (!/^Here is the message to Husson at 20 Blue Jays Way/.test(draft.body) || !/hot water and heating are out today, and they haven't given a time for it to be restored yet/.test(draft.body)) fail(`husson draft: ${draft.body}`);
if (!draft.draft || draft.draft.channel !== "hospitable" || draft.draft.hospitable?.args.reservation_id !== "res-husson" || !draft.body.includes(draft.draft.body)) fail(`husson draft card: ${JSON.stringify(draft.draft)}`);
if (capturedCommits().length) fail("drafting sent something");

// 6. The money move is a revenue action with its numbers.
const move = await send("biz-move", "What's the one thing you'd do this week to make us more money?");
if (!/^The money move this week: Fill 41 Roseglor Cres's empty stretch, Oct 13 to Nov 12 \(30 nights, nothing booked\)\. At the \$300 CAD comp median that's \$9,000 on the table\. A short-stay discount or a lower minimum stay for those dates is the lever\./.test(move.body)) fail(`money move: ${move.body}`);
if (!/Next best: Fill 1065 Shaw Street's empty stretch, Oct 13 to Nov 8 \(26 nights, nothing booked\)\. At the \$300 CAD comp median that's \$7,800 on the table\. It's already listed at about \$150 a night, under the \$300 CAD comp median, and still empty/.test(move.body)) fail(`money move next: ${move.body}`);
if (!/Service, not the money move: Window cleaning/.test(move.body) || /^The money move this week: .*window/i.test(move.body)) fail(`money move service: ${move.body}`);

// Same-day follow-ups: specs from the Airbnb listing, narration stripped, bullets from the answer above.
const comps = await send("biz-comps", "comps for raj's unit");
if (!/^Comps for Raj's unit, 20 Blue Jays Way Unit 318 \(2 bed, 2 bath, sleeps 8\)/.test(comps.body)) fail(`specs: ${comps.body}`);
setWebAnswerer(async (question) => (/backstreet/i.test(question)
  ? "Now let me search for Leafs and Raptors home games in February 2027. Here is everything confirmed for February 2027, venue by venue.\n---\nROGERS CENTRE Backstreet Boys: Into The Millennium — Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027.\n---\nSCOTIABANK ARENA Maple Leafs vs. Boston Bruins — Feb 10, 2027. Don Omar — Feb 17, 2027.\nSources:\n* Live Nation, Oct 2, 2026"
  : ""));
const events = await send("biz-events", "are the backstreet boys coming into town in feb?");
if (/let me search|here is everything|^---$/im.test(events.body) || !/Backstreet Boys: Into The Millennium/.test(events.body)) fail(`narration: ${events.body}`);
const bullets = await send("biz-events", "in a nutshell, give me in bullet point form each imprtant date and their dates");
if (!/^The important dates from that answer:\n• Maple Leafs vs\. Boston Bruins — Feb 10, 2027 \(Scotiabank Arena\)\n• Backstreet Boys: Into The Millennium — Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027 \(Rogers Centre\)\n• Don Omar — Feb 17, 2027 \(Scotiabank Arena\)$/.test(bullets.body)) fail(`bullets: ${bullets.body}`);

// Purchasing questions come from current listings, with unit costs and the standard on file.
resetUnitSetups();
await ensureUnitSetups();
setWebAnswerer(async (question) => {
  if (/42\.5L garbage bags/.test(question) && /cost per bag/.test(question)) return "Costco.ca: Kirkland Signature 42.5L kitchen bags, 200 count, $27.99, $0.14 per bag.\nAmazon.ca: Glad 42.5L tall kitchen bags, 90 count, $19.97, $0.22 per bag.\nPick: Kirkland 200-count at $27.99 ÷ 200 = $0.14 per bag. Alternative: Glad ForceFlex if strength matters.\nSource: Costco.ca and Amazon.ca listings, Oct 13, 2026.";
  if (/dish soap/.test(question)) return "Costco.ca: Palmolive Ultra 4.27L, $15.99. Walmart.ca: Great Value dish soap 2.66L, $5.47, $2.06 per litre.\nPick: Great Value at $5.47 ÷ 2.66L = $2.06 per litre.\nSource: Costco.ca and Walmart.ca listings, Oct 13, 2026.";
  return "";
});
const bags = await send("biz-bags", "Whats the most economical option for Royas unit for garbage bags? We need to find a 42.5L that will last months");
if (!/^Garbage bags \(42\.5L\) for 1065 Shaw Street, Toronto \(Roya's unit\):/.test(bags.body) || !/\$27\.99 ÷ 200 = \$0\.14 per bag/.test(bags.body)) fail(`bags: ${bags.body}`);
if (!/Heads-up: the standard on file for this unit is Glad ForceFlex tall kitchen bags \(45L\); this answers the 42\.5L you asked for\./.test(bags.body)) fail(`bags standard: ${bags.body}`);
if (/no past email|don't have a tool|check suppliers/i.test(bags.body)) fail(`bags refused: ${bags.body}`);
const soap = await send("biz-soap", "what's the most economical way to restock dish soap at 8 charlotte 606?");
if (!/^Dish soap for .*8 Charlotte Street.*\(Nance's unit\):/.test(soap.body) || !/\$2\.06 per litre/.test(soap.body) || !/The cleaner app stocks Palmolive Essential Clean dish soap \(4\.27L\)/.test(soap.body)) fail(`soap: ${soap.body}`);
// Spec discipline: litres match litres, the named retailer goes first, a failed read is named last.
let searched = "";
setWebAnswerer(async (question) => {
  searched = question;
  return "Amazon.ca: no 42.5L bags are listed; the nearest labelled size is 45L. Glad ForceFlex 45L tall kitchen bags, 100 count, $24.97, $0.25 per bag.\nWalmart.ca: Hefty 45L tall kitchen bags, 80 count, $14.97, $0.19 per bag.\nPick: Hefty 45L at $14.97 ÷ 80 = $0.19 per bag, the nearest size to 42.5L.\nSource: Amazon.ca and Walmart.ca listings, Oct 13, 2026.";
});
const amazon = await send("biz-amazon", "find the cheapest 42.5L garbage bags by count number that will last us a long time on amazon.ca");
if (!/on Amazon\.ca first/.test(searched) || !/42 x 48 inch contractor bags\) is never a litre match/.test(searched) || !/name the one that failed in one line at the end/.test(searched)) fail(`amazon search rules: ${searched}`);
if (!/^Garbage bags \(42\.5L\):/.test(amazon.body) || !/\$0\.19 per bag/.test(amazon.body) || /read failed|walmart\.ca\/en\/search\?q=/i.test(amazon.body)) fail(`amazon bags: ${amazon.body}`);
if (amazon.steps?.[0]?.text !== "Searched current listings and read the unit's catalog") fail(`amazon route: ${JSON.stringify(amazon.steps)}`);
if (capturedCommits().length) fail("a purchasing answer bought something");

// How the business normally does something comes from the recorded process, never a pointer to a card.
const asked = "for the 20 blue jays way parking emails, which email addresses do we normally send to? And what email do we normally use as the draft, and subject?";
if (asksBuildingRegistration(asked)) fail("a process question started a registration draft");
const processAnswer = await send("biz-process", asked);
for (const fact of ["supervisorelement@gmail.com", "conciergetscc1851@gmail.com", "tscc1851office@gmail.com", "kshewnarain@rogers.com", "Send from: mandelrealtyteam@gmail.com", "Subject: AirBNB Rental for Unit 318 from [check-in date] - [check-out date]", "Shane, Co-Host", "P4-62"]) {
  if (!processAnswer.body.includes(fact)) fail(`process answer is missing ${fact}: ${processAnswer.body}`);
}
if (/^The building email for/.test(processAnswer.body) || processAnswer.steps?.[0]?.text !== "Read the recorded registration process") fail(`process answer deflected: ${processAnswer.body}`);
// The draft the workflow builds comes from those same facts.
const built = buildingMail({ id: "husson", code: "HMHUSSON01", status: "accepted", checkIn: "2026-10-16", checkOut: "2026-10-19", guest: "Husson" } as Parameters<typeof buildingMail>[0], BLUE_JAYS_PROCESS);
if (built.to !== "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com") fail(`draft recipients: ${built.to}`);
if (built.subject !== "AirBNB Rental for Unit 318 from Friday, October 16, 2026 - Monday, October 19, 2026" || !built.body.endsWith("Shane, Co-Host 647-822-0448") || !/P4-62/.test(built.body)) fail(`draft from the record: ${built.subject} / ${built.body}`);
const proposalAnswer = await send("biz-process-proposal", "who does the unit proposal email normally go to, and what subject do we use?");
if (!/client's email address on file in OPS/.test(proposalAnswer.body) || !/Subject: Unit proposal for \[unit address\]/.test(proposalAnswer.body) || !/info@mandelrealtygroup\.com/.test(proposalAnswer.body)) fail(`proposal process: ${proposalAnswer.body}`);

// Item identity: a Manik reply and a Husson registration, both in Sent; the newer Manik reply mentions the building.
{
  const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  const registration = { id: "reg-sent", mailbox: "gmail" as const, folder: "sent" as const, from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-10-06T15:00:00-04:00",
    subject: "AirBNB Rental for Unit 318 from Thursday, October 8, 2026 - Saturday, October 10, 2026", snippet: "20 Blue Jays Way Unit 318",
    body: "Hello,\n\nPlease register this vehicle with the building.\nGuest: Priya Shah\nThis stay is at 20 Blue Jays Way.\nMake: Honda\nModel: Civic\nPlate: ABCD123\nColour: Grey\n\nShane, Co-Host 647-822-0448", airbnb: false };
  const manik = { id: "manik-sent", mailbox: "gmail" as const, folder: "sent" as const, from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: "Manik K <mktorcan@gmail.com>", date: "2026-10-12T10:00:00-04:00",
    subject: "Re: Business Growth Discussion - Requested Information and Supporting Documentation", snippet: "Booking.com permissions for 20 Blue Jays Way",
    body: "Hi Manik,\n\nAttached are the Booking.com permissions for 20 Blue Jays Way and the other units.\n\nShane", airbnb: false };
  const world = worldAt("2026-10-13T09:00:00-04:00", false, [registration, manik]);
  world.reservations.push(stay("00000000-0000-4000-8000-0000000a5501", ID.blue, "Husson", "2026-10-16", "2026-10-19", [
    { id: "husson-car", at: "2026-10-12T18:00:00-04:00", role: "guest", name: "Husson", body: "Make: Mazda. Model: CX-5. Plate: CKTR902. One car." },
  ]));
  installWorld(world);
  resetCaptures();
  resetParityChecksMessages();
  paritySaveChecksMessage({ id: "manik-card", chat_id: "checks", created_at: "2026-10-13T08:00:00.000Z", role: "assistant", body: "Here is the building email. Nothing was sent.",
    draft: { channel: "email", status: "waiting", to: manik.to, subject: manik.subject, body: "Hi Manik, here is the Booking.com permission summary." } });
  const result = await answerBuildingRegistrationItem("read the emails I've been sending for 20 Blue Jays Way, I need to write another one for the next guest with their car info, same subject and body");
  if (!result || !/Husson/.test(result.body) || !/20 Blue Jays Way/.test(result.body) || !/vehicle registration/.test(result.body)) fail(`registration claim: ${result?.body}`);
  const opened = parityChecksMessages().find((row) => row.id === result.item?.messageId);
  if (!opened?.draft || opened.draft.to !== building || !/^AirBNB Rental for Unit 318 from Friday, October 16, 2026/.test(opened.draft.subject) || !/Make: Mazda/.test(opened.draft.body)) fail(`opened card: ${JSON.stringify(opened?.draft)}`);
  if (/Manik|Booking\.com/.test(opened.draft.body) || !/Husson/.test(emailCardLabel(opened.body, opened.draft))) fail(`registration card label: ${opened.body}`);
  const manikCard = parityChecksMessages().find((row) => row.id === "manik-card");
  const manikLabel = emailCardLabel(manikCard?.body ?? "", manikCard?.draft);
  if (/building|registration/i.test(manikLabel) || !/mktorcan@gmail\.com/.test(manikLabel) || !/Business Growth Discussion/.test(manikLabel)) fail(`Manik card label: ${manikLabel}`);
  if (capturedCommits().length) fail("an identity check sent something");
}

// Draft fidelity: the Husson registration copies the last sent one, dates in its style, unknowns kept.
{
  if (correctWeekdays("AirBNB Rental for Unit 318 from Saturday, October 15, 2026 - Wednesday, October 19, 2026") !== "AirBNB Rental for Unit 318 from Thursday, October 15, 2026 - Monday, October 19, 2026") fail("weekdays are not computed from the date");
  const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  const sentBody = [
    "Hello,",
    "",
    "Please see below the details for our AirBNB guest in Unit 318.",
    "",
    "Guest: Diane",
    "Check-in: October 9, 2026",
    "Check-out: October 12, 2026",
    "",
    "They have 1 vehicle and will be parking in P4-62.",
    "",
    "Make: Toyota",
    "Model: Corolla",
    "Colour: White",
    "Plate: BKRP441",
    "",
    "Thank you,",
    "",
    "Shane, Co-Host 647-822-0448",
  ];
  const sentRegistration = { id: "diane-reg", mailbox: "gmail" as const, folder: "sent" as const, from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-10-08T11:24:00-04:00",
    subject: "AirBNB Rental for Unit 318 from October 9, 2026 - October 12, 2026", snippet: "AirBNB Rental for Unit 318", body: sentBody.join("\n"), airbnb: false };
  const world = worldAt("2026-10-13T09:00:00-04:00", false, [sentRegistration]);
  world.reservations.push(stay("00000000-0000-4000-8000-0000000a5502", ID.blue, "Husson Ali", "2026-10-15", "2026-10-19", [
    { id: "husson-hello", at: "2026-10-12T18:00:00-04:00", role: "guest", name: "Husson", body: "Hi! Looking forward to the stay." },
  ]));
  installWorld(world);
  resetCaptures();
  resetParityChecksMessages();
  const expectedBody = sentBody.map((line) => line
    .replace("Guest: Diane", "Guest: Husson Ali")
    .replace("October 9, 2026", "October 15, 2026")
    .replace("October 12, 2026", "October 19, 2026")
    .replace("They have 1 vehicle", "They have [count] vehicle")
    .replace(/^(Make|Model|Colour|Plate): .*$/, (_line, label: string) => `${label}: [${label.toLowerCase()}]`)).join("\n");
  const check = (label: string) => {
    const draft = capturedDrafts().filter((row) => row.channel === "email").at(-1);
    if (!draft) fail(`${label}: no draft`);
    if (draft.subject !== "AirBNB Rental for Unit 318 from October 15, 2026 - October 19, 2026") fail(`${label} subject: ${draft.subject}`);
    if (draft.to !== building) fail(`${label} recipients: ${draft.to}`);
    if (draft.body !== expectedBody) fail(`${label} body is not the sent one line for line:\n${draft.body}\n--- expected ---\n${expectedBody}`);
    if (/Saturday|Wednesday|\b1 vehicle|Toyota|BKRP441|Diane/.test(`${draft.subject}\n${draft.body}`)) fail(`${label}: an invented or carried-over fact: ${draft.body}`);
  };
  const first = await send("biz-husson", "draft the parking email for Husson at 20 Blue Jays Way");
  if (!/Husson/.test(first.body) || !/is in Checks/.test(first.body) || /show me|paste|forward/i.test(first.body)) fail(`first draft: ${first.body}`);
  if (/Saturday|Wednesday/.test(first.body) || (/October 15/.test(first.body) && !/Oct 15|October 15, 2026|Thu/.test(first.body))) fail(`answer weekdays: ${first.body}`);
  check("first draft");
  const again = await send("biz-husson", "draft it exactly like the other emails, and make sure the spacing is correct");
  if (!/is in Checks/.test(again.body) || /show me|paste|forward|last email/i.test(again.body)) fail(`follow-up handed back: ${again.body}`);
  if (again.steps?.[0]?.text !== "Copied the last sent registration email" || capturedDrafts().filter((row) => row.channel === "email").length !== 2) fail(`redo did not re-read the sent email: ${JSON.stringify(again.steps)}`);
  check("redo");
  const waitingRegs = parityChecksMessages().filter((row) => row.draft?.status === "waiting" && row.draft.subject === "AirBNB Rental for Unit 318 from October 15, 2026 - October 19, 2026");
  if (waitingRegs.length !== 1) fail(`redo left ${waitingRegs.length} waiting drafts`);
  // A weekday that has to appear is the computed one.
  const leadCard = parityChecksMessages().at(-1);
  if (leadCard && /Saturday|Wednesday/.test(leadCard.body)) fail(`card label weekday: ${leadCard.body}`);
  if (capturedCommits().length) fail("drafting sent something");
}

// A sent template whose subject and body disagreed: both come out with this stay's dates and nights.
{
  const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  const odd = { id: "odd-reg", mailbox: "gmail" as const, folder: "sent" as const, from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-10-12T21:58:00-04:00",
    subject: "AirBNB Rental for Unit 318 from October 1, 2026 - October 3, 2026", snippet: "AirBNB Rental for Unit 318",
    body: "Hello,\nI have a new AirBNB tenant arriving from Thursday October 1, 2026 and staying until Monday October 5, 2026 for 4 nights. Their name is: Priya They will be residing in unit 318.\n\nThey will not be bringing any vehicles.\n\nThanks,\nShane, Cohost 6478220448", airbnb: false };
  const world = worldAt("2026-10-13T09:00:00-04:00", false, [odd]);
  world.reservations.push(stay("00000000-0000-4000-8000-0000000a5503", ID.blue, "Husson Ali", "2026-10-15", "2026-10-17"));
  installWorld(world);
  resetCaptures();
  resetParityChecksMessages();
  await send("biz-odd", "draft the parking email for Husson at 20 Blue Jays Way");
  const draft = capturedDrafts().filter((row) => row.channel === "email").at(-1);
  if (draft?.subject !== "AirBNB Rental for Unit 318 from October 15, 2026 - October 17, 2026") fail(`odd subject: ${draft?.subject}`);
  if (!/arriving from Thursday October 15, 2026 and staying until Saturday October 17, 2026 for 2 nights/.test(draft?.body ?? "")) fail(`odd body: ${draft?.body}`);
  if (/October 5|October 19|4 nights|Priya/.test(draft?.body ?? "") || !/Their name is: Husson They/.test(draft?.body ?? "")) fail(`old stay carried over: ${draft?.body}`);
}

// An inquiry opens from the inbox: its messages come from the inquiry, through the real endpoint.
{
  const world = worldAt("2026-10-13T23:15:00-04:00");
  world.inquiries = [{ id: "inq-lee", propertyId: ID.shaw, status: "open", guest: "Lee", checkIn: "2026-10-29", checkOut: "2026-10-31", adults: 2, children: 0,
    messages: [{ id: "lee-1", at: "2026-10-14T03:15:00Z", role: "guest", name: "Lee", body: "Hi Roya, this is Lee, Sophie's mom. I know you require a 2-night minimum, but I wanted to ask about one night." }],
    financials: { guest: { total_price: { formatted: "CA$320.00" } } }, airbnbThread: "4801", bookedAt: "2026-10-14T03:15:00Z", reviews: 3, guestSince: "2021-01-01T00:00:00Z" }] as never;
  installWorld(world);
  let opened: { thread?: { text: string }[]; waitingLine?: string } = {};
  let status = 200;
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "guests-open", id: "inq-lee", inquiry: true, guest: "Lee", first: "Lee", property: "1065 Shaw Street", propertyId: ID.shaw, checkIn: "2026-10-29", checkOut: "2026-10-31", activityAt: "2026-10-14T03:15:00Z" }, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(body: typeof opened) { opened = body; return this; } } as never,
  );
  if (status !== 200 || !opened.thread?.some((item) => /Sophie's mom/.test(item.text))) fail(`inquiry did not open: ${status} ${JSON.stringify(opened).slice(0, 300)}`);
}

// "Did we send…" is a Sent-mail question: the live case, answered from Sent with Toronto time, unprompted.
{
  const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  // Gmail's instant in UTC: 01:58 UTC on Oct 14 is 9:58 PM on Oct 13 in Toronto.
  const sent = { id: "husson-sent", mailbox: "gmail" as const, folder: "sent" as const, from: "MandelRealty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-10-14T01:58:00.000Z",
    subject: "AirBNB Rental for Unit 318 from October 15, 2026 - October 19, 2026", snippet: "AirBNB Rental for Unit 318",
    body: "Hello,\nI have a new AirBNB tenant arriving from Thursday October 15, 2026 and staying until Monday October 19, 2026 for 4 nights. Their name is: Husson They will be residing in unit 318.\n\nThey will not be bringing any vehicles.\n\nThanks,\nShane, Cohost 6478220448", airbnb: false };
  const world = worldAt("2026-10-14T10:00:00-04:00", false, [sent]);
  world.reservations.push(stay("00000000-0000-4000-8000-0000000a5504", ID.blue, "Husson", "2026-10-15", "2026-10-19"));
  installWorld(world);
  const asked = await send("biz-did-we-send", "Did we send out the parking email for 20 blue jays way for the next guest?");
  const lines = asked.body.split("\n");
  if (!/^Yes, it's already sent/.test(lines[0] ?? "")) fail(`not led by the verdict: ${asked.body}`);
  if (!/on October 13, 2026 at 9:58 PM/.test(asked.body)) fail(`not Toronto time: ${asked.body}`);
  for (const address of building.split(", ")) if (!asked.body.includes(address)) fail(`recipient ${address} missing: ${asked.body}`);
  if (!/mandelrealtyteam@gmail\.com/.test(asked.body) || !/arriving from Thursday October 15, 2026 and staying until Monday October 19, 2026/.test(asked.body) || !/not be bringing any vehicles/.test(asked.body)) fail(`account or facts missing: ${asked.body}`);
  if (/HM[A-Z0-9]{6,}|reservation code|Spacious|Modern 1\+Den/i.test(asked.body)) fail(`a reservation readout answered a sent question: ${asked.body}`);

  // Nothing in Sent: "not sent" first, what was searched, then the draft's state.
  const quiet = worldAt("2026-10-14T10:00:00-04:00", false, []);
  quiet.reservations.push(stay("00000000-0000-4000-8000-0000000a5505", ID.blue, "Marta", "2026-10-20", "2026-10-23"));
  installWorld(quiet);
  resetParityChecksMessages();
  const none = await send("biz-not-sent", "Did we send out the parking email for 20 blue jays way for the next guest?");
  if (!/^Not sent\. No building registration for Marta's stay/.test(none.body) || !/AirBNB Rental for Unit 318 from October 20, 2026 - October 23, 2026/.test(none.body) || !/No draft has been made for it yet\./.test(none.body)) fail(`not sent: ${none.body}`);
  paritySaveChecksMessage({ id: "marta-draft", chat_id: "checks", created_at: "2026-10-14T13:00:00.000Z", role: "assistant", body: "Here is the vehicle registration email for Marta.",
    draft: { channel: "email", status: "waiting", to: building, subject: "AirBNB Rental for Unit 318 from October 20, 2026 - October 23, 2026", body: "Hello, Marta arriving October 20, 2026 until October 23, 2026." } });
  const waiting = await send("biz-not-sent-2", "did we send the parking email for blue jays yet?");
  if (!/^Not sent\./.test(waiting.body) || !/A draft is waiting in Checks: “AirBNB Rental for Unit 318 from October 20, 2026 - October 23, 2026”/.test(waiting.body)) fail(`waiting draft state: ${waiting.body}`);
  if (capturedCommits().length) fail("a sent question sent something");
}

// Every mail time is Toronto time, whatever zone the timestamp came in.
if (torontoWhen("2026-10-14T01:58:00Z") !== "Tuesday, October 13, 2026 at 9:58 PM" || torontoWhen("Tue, 13 Oct 2026 18:58:00 -0700") !== "Tuesday, October 13, 2026 at 9:58 PM") fail(`Toronto time ${torontoWhen("2026-10-14T01:58:00Z")}`);

setWebAnswerer(null);
setCompsSource(null);
setListingSource(null);
console.log("Business harness passed.");
