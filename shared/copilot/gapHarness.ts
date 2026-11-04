/**
 * Cross-source gap detection in the watch loop: what a guest thread implies that no record shows done, and what someone
 * said would happen that has no outcome. Items land in Decisions with the draft ready and the quoted line; nothing is sent.
 * No real API is called.
 */

import { resetBusinessFacts } from "./businessFacts.js";
import { setBrainModel } from "./brain.js";
import { threadActions } from "./gapDetect.js";
import { extractCommitments, outcomeFound } from "./commitmentGaps.js";
import { setParityClock } from "./parity/clock.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld, type ParityMail, type ParityReservation } from "./parity/world.js";
import { addMessage, createChat } from "./store.js";
import { actOnWatchItem, resetWatch, runWatch, setWatchSource, watchDecisions } from "./watch.js";

function fail(label: string): never {
  throw new Error(`Gap harness failed: ${label}`);
}

setBrainModel(null);
setWatchSource(null);
resetWatch();
resetBusinessFacts();

// ---------- The thread readers, on their own ----------
const t = (at: string, role: "guest" | "host", body: string) => ({ at, role, name: role === "guest" ? "Guest" : "Shane", body });
const car = threadActions({ guest: "Michelle", address: "20 Blue Jays Way Unit 318", messages: [t("2026-10-30T18:00:00Z", "guest", "Make: Kia. Model: Soul. Plate: BXYZ456. One car.")] });
if (car.map((a) => a.kind).join() !== "building_email" || !/BXYZ456/.test(car[0]!.quote.text)) fail(`car details: ${JSON.stringify(car)}`);
if (threadActions({ guest: "Leo", address: "1065 Shaw Street", messages: [t("2026-10-30T18:00:00Z", "guest", "Make: Kia. Plate: BXYZ456.")] }).length) fail("a car at a building with no registration process");
const early = threadActions({ guest: "Leo", address: "x", messages: [t("2026-10-30T18:00:00Z", "guest", "Could we check in early?"), t("2026-10-30T19:00:00Z", "host", "Yes, early check-in at 1 PM works for us.")] });
if (early.map((a) => a.kind).join() !== "confirm_early_checkin" || early[0]!.detail !== "13:00|1:00 PM") fail(`early check-in: ${JSON.stringify(early)}`);
if (threadActions({ guest: "Leo", address: "x", messages: [t("2026-10-30T19:00:00Z", "host", "Let me check if early check-in at 1 PM works.")] }).length) fail("a tentative reply counted as an agreement");
if (threadActions({ guest: "Leo", address: "x", messages: [t("2026-10-30T19:00:00Z", "host", "Yes, early check-in at 1 PM works."), t("2026-10-30T20:00:00Z", "host", "Confirmed for 1 PM then!")] }).length) fail("a confirmed early check-in still counted");
const rules = threadActions({ guest: "Omar", address: "x", messages: [t("2026-10-30T19:00:00Z", "host", "Welcome! Please read our house rules: https://x.example/rules")] });
if (rules.map((a) => a.kind).join() !== "house_rules_confirmation") fail("house rules");
if (threadActions({ guest: "Omar", address: "x", messages: [t("2026-10-30T19:00:00Z", "host", "Please read our house rules."), t("2026-10-30T20:00:00Z", "guest", "I agree to the house rules.")] }).length) fail("an agreed house rules still counted");
const said = (who: string, text: string, where = "Re: plans") => ({ who, at: "2026-11-01T14:00:00Z", text, where, source: "email" as const });
const found = extractCommitments([
  said("Shane", "Thanks Ryan. I'll create the plan for Manik's place once you send them over."),
  said("Ryan", "Hi, I got the measurements for Manik's place today, all rooms done.", "Manik's place"),
  said("Ryan", "Sounds good, see you Thursday."),
]);
if (found.length !== 2 || found[0]!.verb !== "create" || found[0]!.object !== "plan" || found[0]!.subject !== "Manik" || found[1]!.kind !== "input-arrived" || found[1]!.subject !== "Manik") fail(`commitments: ${JSON.stringify(found)}`);
if (outcomeFound(found[0]!, { chats: [{ at: "2026-11-02T10:00:00Z", text: "The furnishing plan for Shaw Street is attached." }], doneTasks: [], sent: [] })) fail("another unit's plan counted for Manik's");
if (!outcomeFound(found[0]!, { chats: [{ at: "2026-11-02T10:00:00Z", text: "The furnishing plan for Manik's place is attached." }], doneTasks: [], sent: [] })) fail("Manik's plan wasn't found");
if (outcomeFound(found[0]!, { chats: [{ at: "2026-10-20T10:00:00Z", text: "The furnishing plan for Manik's place is attached." }], doneTasks: [], sent: [] })) fail("a plan from before the commitment counted");

// ---------- The loop, over a world with the two gaps from the partner's own words ----------
const NOW = new Date("2026-11-03T15:00:00Z"); // 10 AM Toronto
const NIGHT = new Date("2026-11-04T04:30:00Z"); // 11:30 PM Toronto
setParityClock(NOW);
const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
const registration = (id: string, date: string, subject: string, body: string): ParityMail => ({ id, mailbox: "gmail", folder: "sent", from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date, subject, snippet: "20 Blue Jays Way Unit 318", body, airbnb: false });
const stay = (id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, status: string, messages: ParityReservation["messages"], checkInTime?: string): ParityReservation => ({ id, code: id.toUpperCase(), propertyId, status, checkIn, checkOut, guest, adults: 2, children: 0, messages, ...(checkInTime ? { checkInTime } : {}) });
const msg = (id: string, at: string, role: "guest" | "host", body: string) => ({ id, at, role, name: role === "guest" ? "Guest" : "Shane", body });
const mail: ParityMail[] = [
  registration("reg-dana", "2026-11-02T15:00:00-05:00", "AirBNB Rental for Unit 318 from November 10, 2026 - November 13, 2026",
    "Hello,\n\nPlease see below the details for our AirBNB guest Dana Cole, November 10, 2026 to November 13, 2026.\n\nMake: Honda\nModel: Civic\nPlate: DANA123\nColour: Blue\n\nThank you,\n\nShane, Co-Host 647-822-0448"),
  { id: "ryan-1", mailbox: "gmail", folder: "inbox", from: "Ryan", email: "ryan@contractor.example", to: "info@mandelrealtygroup.com", date: "2026-11-01T14:00:00Z", subject: "Manik's place", snippet: "measurements", body: "Hi, I got the measurements for Manik's place today, all rooms done.\n\nRyan", airbnb: false },
  { id: "shane-1", mailbox: "gmail", folder: "sent", from: "Shane", email: "mandelrealtyteam@gmail.com", to: "ryan@contractor.example", date: "2026-10-31T14:00:00Z", subject: "Re: Raj proposal", snippet: "proposal", body: "Sounds good. I'll create the proposal for Raj next week.\n\nShane", airbnb: false },
];
const world = worldAt("2026-11-03T10:00:00-05:00", false, mail);
world.reservations = [
  stay("r-michelle", ID.blue, "Michelle Sanders", "2026-11-04", "2026-11-08", "accepted", [msg("m1", "2026-10-29T14:00:00Z", "host", "Please send your car make, model and plate for the building."), msg("m2", "2026-10-30T18:00:00Z", "guest", "Make: Kia. Model: Soul. Plate: BXYZ456. One car.")]),
  stay("r-dana", ID.blue, "Dana Cole", "2026-11-10", "2026-11-13", "accepted", [msg("d1", "2026-10-29T14:00:00Z", "host", "Please send your car details for the building."), msg("d2", "2026-10-30T18:00:00Z", "guest", "Make: Honda. Model: Civic. Plate: DANA123. One car.")]),
  stay("r-leo", ID.shaw, "Leo Park", "2026-11-05", "2026-11-08", "accepted", [msg("l1", "2026-10-30T18:00:00Z", "guest", "Could we check in early?"), msg("l2", "2026-10-30T19:00:00Z", "host", "Yes, early check-in at 1 PM works for us.")]),
  stay("r-mia", ID.rose, "Mia Ross", "2026-11-06", "2026-11-09", "accepted", [msg("a1", "2026-10-30T19:00:00Z", "host", "Yes, early check-in at 1 PM works for us.")], "13:00"),
  stay("r-omar", ID.charlotte, "Omar Aziz", "2026-11-12", "2026-11-15", "request", [msg("o1", "2026-10-30T19:00:00Z", "host", "Welcome! Please read our house rules before I accept: https://x.example/rules")]),
  stay("r-pia", ID.charlotte, "Pia Lund", "2026-11-20", "2026-11-23", "request", [msg("p1", "2026-10-30T19:00:00Z", "host", "Please read our house rules."), msg("p2", "2026-10-30T21:00:00Z", "guest", "I agree to the house rules, thank you!")]),
  stay("r-noor", ID.shaw, "Noor Haddad", "2026-11-14", "2026-11-17", "accepted", [msg("n1", "2026-10-30T19:00:00Z", "host", "Please read our house rules.")]),
];
installWorld(world);
resetCaptures();

// Another unit's plan exists; Raj's proposal has been made. Manik's plan has not.
const planChat = await createChat("Plans", "chat");
await addMessage({ chatId: planChat.id, role: "assistant", body: "The furnishing plan for Shaw Street is attached.", file: { filename: "MRG-FP-20261102-AAAA.pdf", mime: "application/pdf", data: "JVBERi0=" } });
await addMessage({ chatId: planChat.id, role: "assistant", body: "The proposal for Raj is attached.", file: { filename: "Proposal-Raj.pdf", mime: "application/pdf", data: "JVBERi0=" } });

// Overnight, none of it surfaces: only a guest waiting on a reply does.
setParityClock(NIGHT);
const night = await runWatch(NIGHT);
if (night.delivered !== 0 || (await watchDecisions()).length) fail(`a gap surfaced overnight: ${JSON.stringify(night.ranked.map((r) => r.key))}`);
setParityClock(NOW);
const first = await runWatch(NOW);
const decisions = await watchDecisions();
const byKind = (kind: string) => decisions.filter((row) => row.kind === kind);
const gaps = decisions.filter((row) => row.kind === "thread_gap" || row.kind === "commitment_gap");
if (first.failed.length) fail(`a source failed: ${first.failed.join()}`);
const keys = gaps.map((row) => row.key.replace(/:[0-9T:.\-Z+]+$/, "")).sort().join("|");
if (keys !== "gap:building_email:r-michelle|gap:commit:" + gaps.find((row) => row.kind === "commitment_gap")!.key.slice(11) + "|gap:confirm_early_checkin:r-leo|gap:house_rules_confirmation:r-omar") fail(`the gaps found: ${gaps.map((row) => `${row.key} ${row.title}`).join(" // ")}`);

// 1. Thread to action: the registration that was never sent, with the exact draft, and the line that triggered it.
const building1 = byKind("thread_gap").find((row) => row.key.includes("building_email"))!;
if (!/Michelle's car details were sent, but the building hasn't been told/.test(building1.title)) fail(`building title: ${building1.title}`);
if (!/Michelle Sanders wrote on Oct 30: "Make: Kia\. Model: Soul\. Plate: BXYZ456/.test(building1.reason) || !/No registration email for Wednesday, November 4 to Sunday, November 8 is in Sent mail/.test(building1.reason)) fail(`the quoted line: ${building1.reason}`);
if (building1.draftChannel !== "email" || building1.draftTo !== building || !/November 4/.test(building1.draftSubject) || !/Kia/.test(building1.draftBody) || !/BXYZ456/.test(building1.draftBody)) fail(`the building draft: ${JSON.stringify(building1)}`);
if (/Honda|Civic|DANA123|Dana/.test(`${building1.draftSubject}\n${building1.draftBody}`)) fail("another guest's facts leaked into Michelle's draft");
// A registration that was sent is no gap; a car at the Shaw unit never was one.
if (gaps.some((row) => /dana/i.test(row.key) || /Dana/.test(row.title))) fail("Dana's registration was sent, so it is no gap");
const earlyRow = byKind("thread_gap").find((row) => row.key.includes("confirm_early_checkin"))!;
if (!/Leo's early check-in at 1:00 PM isn't confirmed/.test(earlyRow.title) || !/Yes, early check-in at 1 PM works for us/.test(earlyRow.reason) || !/still shows check-in at 16:00/.test(earlyRow.reason)) fail(`early check-in: ${JSON.stringify(earlyRow)}`);
if (!/Hi Leo, just confirming that you're all set to check in at 1:00 PM on Thursday, November 5\./.test(earlyRow.draftBody) || /[—–]/.test(earlyRow.draftBody) || earlyRow.draftChannel !== "hospitable") fail(`early check-in draft: ${earlyRow.draftBody}`);
if (gaps.some((row) => /r-mia/.test(row.key))) fail("Mia's check-in time already matches Hospitable");
const rulesRow = byKind("thread_gap").find((row) => row.key.includes("house_rules"))!;
if (!/Omar hasn't confirmed the house rules/.test(rulesRow.title) || !/Please read our house rules before I accept/.test(rulesRow.reason) || !/Hi Omar, before I can accept your request/.test(rulesRow.draftBody)) fail(`house rules: ${JSON.stringify(rulesRow)}`);
if (gaps.some((row) => /r-pia|r-noor/.test(row.key))) fail("an agreed or already-accepted house rules counted");

// 2. Commitment to outcome: Ryan's measurements are in and nobody made the plan; Shane's proposal exists.
const plan = byKind("commitment_gap");
if (plan.length !== 1) fail(`commitment gaps: ${plan.map((row) => row.title).join(" // ")}`);
if (!/Manik's measurements are in, but nobody has created the plan/.test(plan[0]!.title) || !/Ryan wrote in "Manik's place": "Hi, I got the measurements for Manik's place today/.test(plan[0]!.reason) || !/Still open: create the plan for Manik/.test(plan[0]!.reason)) fail(`the plan gap: ${JSON.stringify(plan[0])}`);
if (decisions.some((row) => /proposal/i.test(row.title))) fail("Raj's proposal exists, so it is no gap");

// Nothing was sent, and the next cycle doesn't repeat itself.
if (capturedCommits().length) fail(`the loop sent something: ${JSON.stringify(capturedCommits())}`);
const again = await runWatch(NOW);
if (again.delivered !== 0 || (await watchDecisions()).length !== decisions.length) fail("a second cycle repeated the items");

// Sending is a partner pressing the button, on exactly what the item shows.
// A blank the thread never answered (her car's colour) must be filled in by the partner first; nothing goes out with it in.
if (!/\[colour\]/.test(building1.draftBody) || !/Colour is still a blank/.test(building1.reason)) fail(`the unknown colour isn't flagged: ${building1.draftBody} / ${building1.reason}`);
const blocked = await actOnWatchItem({ key: building1.key, action: "send" }, NOW);
if (blocked.ok || !/Fill in \[colour\]/.test(blocked.note) || capturedCommits().length) fail(`a draft with a blank was sent: ${JSON.stringify(blocked)}`);
const sent = await actOnWatchItem({ key: building1.key, action: "send", text: building1.draftBody.replace("[colour]", "Grey") }, NOW);
if (!sent.ok || capturedCommits().length !== 1) fail(`the partner's Send: ${JSON.stringify(sent)} ${JSON.stringify(capturedCommits())}`);
const dismissed = await actOnWatchItem({ key: earlyRow.key, action: "snooze" }, NOW);
if (!dismissed.ok) fail("snooze");

// The outcome appears: Manik's plan lands in a chat, and the item leaves Decisions by itself.
await addMessage({ chatId: planChat.id, role: "assistant", body: "The furnishing plan for Manik's place is attached.", file: { filename: "MRG-FP-20261103-BBBB.pdf", mime: "application/pdf", data: "JVBERi0=" } });
const closed = await runWatch(NOW);
if (closed.resolved < 1 || (await watchDecisions()).some((row) => row.kind === "commitment_gap")) fail(`the plan was made but its item stayed: ${JSON.stringify(closed)}`);

setWatchSource(null);
console.log("Gap harness passed.");
