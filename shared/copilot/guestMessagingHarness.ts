/**
 * A French guest is translated and the send-version is French.
 * A Hub fact marks the draft. A missing fact is written back only after it is read again.
 * Thanks does not wait and does not draft.
 */

import { hospitableRead, resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import { looksEnglish, resetTranslations, setSuggestModel, setTranslator, suggestGuestReply, translateMessages } from "./guestAi.js";
import { callHospitableMcp } from "./hospitableMcp.js";
import { installResearch, resetResearch } from "./skillResearch.js";
import { answerWaitingDrafts } from "./guestInboxAnswer.js";
import { detectFollowUps, orderFollowUps } from "./guestFollowUps.js";
import { bookingRequestFollowUp, guestPhotoUrl, responseDeadline, type InquiryRecord, type InquiryTurn } from "./guestInquiries.js";
import { capturedCommits } from "./parity/capture.js";
import {
  beginInquiryVerify,
  clearHandledFollowUps,
  clearInquiryVerifying,
  draftFromHub,
  handledReason,
  markThreadHandled,
  unmarkThreadHandled,
  isThanksOnly,
  loadGuestQueue,
  markFollowUpHandled,
  messageLanguage,
  needsGuestReply,
  openGuestAnswer,
  readSavedGuestQueue,
  replyFromAnswer,
  resetGuestMessaging,
  setGuestUploader,
  setHubWriter,
  submitGuestReply,
  suggestReply,
  toEnglish,
  forgetGuestProcessMemory,
  guestDrafts,
  guestTabText,
  improveGuestDraft,
  improveGuestMessage,
  setImproveModel,
} from "./guestMessaging.js";
import type { GuestFollowUp, GuestQueue, GuestRow } from "./guestTypes.js";
import { guestQueueRows } from "./guestQueueRows.js";
import { installWorld, parityThreadReads, pushParityMessage } from "./parity/world.js";
import { saveGuestQueueSnapshot } from "./store.js";
import { buildBrief } from "./brief.js";
import { answerFollowUpTurn } from "./followUpAnswer.js";
import { saveHubEntry } from "./hubLearning.js";
import { parityHubItems } from "./parity/world.js";
import { setParityClock } from "./parity/clock.js";
import { NO_GUEST_FILTERS, emptyInboxLine, filterInbox, stayPhase, waitedFor } from "./guestFilters.js";
import { BLANK, closeFollowUpEverywhere } from "./dueFollowUps.js";
import { runUnattendedChecks } from "./stayCheck.js";
import { parityChecksMessages, resetParityChecksMessages } from "./parity/storeStub.js";
import { resetCaptures } from "./parity/capture.js";

const GOOD = "copilot-guest-token-not-a-secret-7Kq2";
const FRENCH = "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h ? Notre vol atterrit à 11 h.";
const HUB = "Early check-in from 2 PM when no one checks out that day.";

function fail(label: string): never {
  throw new Error(`Guest messaging harness failed: ${label}`);
}

function stay(id: string, code: string, propertyId: string, guest: string, body: string, at: string) {
  return {
    id,
    code,
    propertyId,
    status: "accepted",
    checkIn: "2026-10-08",
    checkOut: "2026-10-11",
    guest,
    adults: 2,
    children: 0,
    messages: [{ id: `${id}-m`, at, role: "guest" as const, name: guest, body }],
  };
}

resetHospitableConnection();
resetGuestMessaging();
const hub = new Map<string, string>();
setHubWriter(async (propertyId, fact) => {
  const next = `${hub.get(propertyId) || ""}\n${fact}`.trim();
  hub.set(propertyId, next);
  return next;
});
setHospitableProbe(async (token, name, args) => {
  if (token !== GOOD) throw new Error("rejected");
  if (name === "get-properties") {
    return {
      data: [
        { id: "prop-charlotte", name: "Charlotte 606" },
        { id: "prop-shaw", name: "1065 Shaw Street" },
        { id: "prop-extra", name: "Partner Loft" },
      ],
    };
  }
  if (name === "get-reservations" && String((args.properties as string[] | undefined)?.[0]) === "prop-charlotte") {
    return { data: [{ id: "stay-isabelle", guest: { first_name: "Isabelle Fournier" }, check_in: "2026-10-08", check_out: "2026-10-11" }] };
  }
  if (name === "get-reservations" && String((args.properties as string[] | undefined)?.[0]) === "prop-shaw") {
    return { data: [{ id: "stay-tom", guest: { first_name: "Tom Becker" } }] };
  }
  if (name === "get-reservation-messages" && args.uuid === "stay-isabelle") {
    return { data: [{ sender_role: "guest", body: FRENCH, created_at: "2026-10-08T15:24:00Z" }] };
  }
  if (name === "get-reservation-messages" && args.uuid === "stay-tom") {
    return { data: [{ sender_role: "guest", body: "Thanks so much!", created_at: "2026-10-08T15:40:00Z" }] };
  }
  if (name === "get-property-knowledge-hub") return { data: [{ content: HUB }] };
  if (name === "get-reservation") return { data: { arrival_date: "2026-10-08", departure_date: "2026-10-11", guests: 2 } };
  return { data: [] };
});

await saveHospitableToken(GOOD);
setHospitableProbe(null);
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [
    { id: "prop-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true },
    { id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true },
    { id: "prop-extra", name: "Partner Loft", address: "99 Partner Street, Toronto", managed: false },
  ],
  reservations: [
    stay("stay-isabelle", "HMISA1", "prop-charlotte", "Isabelle", FRENCH, "2026-10-08T15:24:00Z"),
    stay("stay-alyssa", "HMALY1", "prop-charlotte", "Alyssa", "Where do we leave the keys at checkout?", "2026-10-08T15:00:00Z"),
    stay("stay-tom", "HMTOM1", "prop-shaw", "Tom Becker", "Thanks so much!", "2026-10-08T15:40:00Z"),
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const queue = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
if (!queue.connected) fail("queue");
const tabText = guestTabText(queue);
if (tabText.includes("Hospitable is not connected.")) fail("healthy tab said not connected");
if (!tabText.includes("Isabelle") || !tabText.includes("Alyssa")) fail("tab list");
const names = queue.waiting.map((row) => row.guest).sort().join(",");
if (queue.waiting.length !== 2 || names !== "Alyssa,Isabelle") fail("two waiting guests");
if (queue.waiting.some((row) => !/Charlotte/.test(row.property))) fail("charlotte label");
if (queue.waiting.some((row) => row.property === "Partner Loft") || queue.thanks.some((row) => row.property === "Partner Loft")) fail("unmanaged property");
if (queue.thanks.length !== 1 || queue.thanks[0]?.guest !== "Tom Becker") fail("thanks row");
if (queue.waiting.some((row) => /thanks so much/i.test(row.asked))) fail("thanks is waiting");
const homeRows = guestQueueRows(queue);
if (!homeRows.some((row) => row.guest === "Tom Becker")) fail("a thread with no reply needed is missing from the Guest Messaging list");
if (homeRows.length !== new Set([...queue.waiting, ...queue.held, ...queue.onGuest, ...queue.thanks].map((row) => row.id)).size) fail("the Guest Messaging list dropped threads the queue read");
const started = performance.now();
const saved = await readSavedGuestQueue();
if (performance.now() - started > 200) fail("saved queue wait");
if (!saved || saved.waiting.map((row) => row.guest).sort().join(",") !== "Alyssa,Isabelle") fail("saved pass");
const isabelle = queue.waiting.find((row) => row.guest === "Isabelle");
if (!isabelle) fail("isabelle");
if (messageLanguage(FRENCH) !== "French") fail("language");
if (!/check in|1 PM|flight/i.test(isabelle.askedEn)) fail("english line");
if (!/Translated from French/.test(`Translated from ${isabelle.language}`)) fail("marker");
const covered = draftFromHub(isabelle.guest, FRENCH, HUB);
if (covered.mode !== "hub" || !/check-in from 2 PM/i.test(covered.draft) || !covered.facts) fail("hub draft");
// Replies go out exactly as written, in English: Airbnb translates host messages for the guest.
const isabelleSent = await submitGuestReply({ reservationId: isabelle.id, propertyId: isabelle.propertyId, property: isabelle.property, guest: isabelle.guest, english: covered.draft, language: "French", fact: "" });
if (isabelleSent.sentText !== covered.draft || /bonjour|vous pouvez/i.test(isabelleSent.sentText)) fail(`a reply to a French guest was rewritten: ${isabelleSent.sentText}`);
if (toEnglish(FRENCH) === FRENCH) fail("translation unchanged");

const rack = draftFromHub("Daniel Okafor", "Hey, where’s the dish drying rack? We’ve looked everywhere.", "The Wi-Fi password is on the fridge.");
if (rack.mode !== "gap" || rack.draft || !/dish drying rack/i.test(rack.gap)) fail("no answer");
const answer = replyFromAnswer("Daniel Okafor", "Folded flat in the cabinet left of the sink, behind the cutting boards.");
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [{ id: "prop-blue", name: "Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true }],
  reservations: [stay("stay-daniel", "HMDAN1", "prop-blue", "Daniel Okafor", "Hey, where’s the dish drying rack?", "2026-10-08T15:00:00Z")],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const posted = await submitGuestReply({
  reservationId: "stay-daniel",
  propertyId: "prop-blue",
  property: "Blue Jays Way",
  guest: "Daniel Okafor",
  english: answer,
  language: "",
  fact: "The dish drying rack is folded flat in the cabinet left of the sink.",
});
if (!posted.sent) fail(`submit reported not sent: ${posted.reason}`);
const thread = await callHospitableMcp("get-reservation-messages", { uuid: "stay-daniel" });
if (!JSON.stringify(thread).includes(answer)) fail("submit did not land on the thread");
if (!capturedCommits().some((row) => row.detail === "send-reservation-message")) fail("submit did not use the commit path");
let readBlocked = false;
try {
  await hospitableRead("send-reservation-message", { uuid: "stay-daniel", body: "This read must not send." });
} catch (err) {
  readBlocked = err instanceof Error && /nothing was sent/i.test(err.message);
}
if (!readBlocked) fail("the read path still accepts a send");
const afterRead = await callHospitableMcp("get-reservation-messages", { uuid: "stay-daniel" });
if (JSON.stringify(afterRead).includes("This read must not send.")) fail("the read path landed on the thread");
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [{ id: "prop-blue", name: "Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true }],
  reservations: [{ ...stay("stay-dropped", "HMDROP1", "prop-blue", "Daniel Okafor", "Still looking.", "2026-10-08T15:10:00Z"), dropOutbound: true }],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const missed = await submitGuestReply({
  reservationId: "stay-dropped",
  propertyId: "prop-blue",
  property: "Blue Jays Way",
  guest: "Daniel Okafor",
  english: "This reply must not count as sent.",
  language: "",
  fact: "This fact must not be saved.",
});
if (missed.sent) fail("forced failure reported sent");
// Hospitable acknowledged it but it never landed: not claimed sent, and not invited to be sent twice.
if (!missed.pending || !/isn't showing on the thread yet\. Don't send it again/.test(missed.reason)) fail(`forced failure reason: ${missed.reason}`);
const dropped = await callHospitableMcp("get-reservation-messages", { uuid: "stay-dropped" });
if (JSON.stringify(dropped).includes("This reply must not count as sent.")) fail("forced failure landed on the thread");
if (hub.get("prop-blue")?.includes("This fact must not be saved")) fail("hub saved after a failed send");
if (posted.savedLine !== "Saved to the Blue Jays Way Knowledge Hub") fail("hub write-back");
if (!hub.get("prop-blue")?.includes("dish drying rack")) fail("read back");
if (JSON.stringify(queue).includes(GOOD) || JSON.stringify(posted).includes(GOOD)) fail("token rendered");

if (!isThanksOnly("Thanks so much!")) fail("thanks detector");
const bare = draftFromHub("Tom Becker", "Thanks so much!", HUB);
if (!isThanksOnly("Thanks so much!") || bare.mode === "hub") fail("thanks draft");
for (const line of ["Perfect thank you so much!", "Okay perfect :)", "Perfect", "Sure I will"]) {
  if (!isThanksOnly(line) || needsGuestReply(line)) fail(`reaction ${line}`);
}
if (!needsGuestReply("Where are the garbage bags?")) fail("bags question");
const noisy = [
  "Garbage bags and laundry detergent are in the gift basket on the kitchen counter.",
  "Amenities: pool, gym, wifi, coffee maker.",
  "Notice: the building elevator is out on Tuesdays.",
  "Mississauga parking permit: https://www.mississauga.ca/services/parking-permits",
  "Dishwasher: close the door fully, press and hold start for a few seconds.",
].join("\n");
const bags = draftFromHub("Nora", "Where are the garbage bags?", noisy);
if (bags.mode !== "hub" || !/garbage bags are in the gift basket on the kitchen counter/i.test(bags.draft)) fail("bags answer");
if (/laundry detergent|dishwasher|Mississauga|amenities|elevator|coffee maker/i.test(bags.draft)) fail("bags extra");
if (!bags.draft.startsWith("Hi Nora,") || /Shane|Co-Host|647-822-0448/.test(bags.draft)) fail("bags sign-off");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [
    { id: "prop-rose", name: "Spacious 3BR", address: "41 Roseglor Crescent, Toronto", managed: true },
    { id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true },
  ],
  reservations: [
    {
      id: "stay-thanks",
      code: "HMTHANKS1",
      propertyId: "prop-shaw",
      status: "accepted",
      checkIn: "2026-10-08",
      checkOut: "2026-10-11",
      guest: "Alyssa",
      adults: 2,
      children: 0,
      messages: [
        { id: "aly-1", at: "2026-10-08T14:00:00Z", role: "guest", name: "Alyssa", body: "Where do we put the recycling?" },
        { id: "aly-2", at: "2026-10-08T14:10:00Z", role: "host", name: "Shane", body: "The blue bin is at the side of the house." },
        { id: "aly-3", at: "2026-10-08T14:12:00Z", role: "guest", name: "Alyssa", body: "Perfect thank you so much!" },
      ],
    },
    {
      id: "stay-bags",
      code: "HMBAGS001",
      propertyId: "prop-rose",
      status: "accepted",
      checkIn: "2026-10-08",
      checkOut: "2026-10-11",
      guest: "Nora",
      adults: 2,
      children: 0,
      messages: [{ id: "nora-1", at: "2026-10-08T15:00:00Z", role: "guest", name: "Nora", body: "Where are the garbage bags?" }],
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
  hub: [{ propertyId: "prop-rose", body: noisy }],
});
const again = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
if (again.waiting.some((row) => row.guest === "Alyssa")) fail("thanks thread waiting");
if (again.waiting.length !== 1 || again.waiting[0]?.guest !== "Nora") fail("bags guest waiting");
if (guestDrafts().some((row) => row.to === "Alyssa")) fail("thanks thread draft");
const nora = again.waiting[0];
if (!nora) fail("nora row");
const view = await openGuestAnswer(nora, new Date("2026-10-08T16:06:00Z"));
if (view.draft !== bags.draft) fail("tab draft");
if (/laundry detergent|dishwasher|Mississauga|amenities|elevator/i.test(view.draft)) fail("tab draft extra");
const shown = await answerWaitingDrafts("show me the drafts", new Date("2026-10-08T16:06:00Z"));
if (!shown || !shown.includes(view.draft)) fail("chat draft");
if (/Perfect thank you so much/i.test(shown)) fail("chat showed the thanks");
if (guestDrafts().find((row) => row.reservationId === nora.id)?.body !== view.draft) fail("stored draft");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [
    { id: "prop-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true },
    { id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true },
  ],
  reservations: [
    stay("stay-isabelle", "HMISA1", "prop-charlotte", "Isabelle", FRENCH, "2026-10-08T15:24:00Z"),
    {
      ...stay("stay-blocked", "HMBLOCK1", "prop-shaw", "Owen", "The heat is not working.", "2026-10-08T15:30:00Z"),
      threadError: "Hospitable is not connected.",
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const partial = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
const partialText = guestTabText(partial);
if (!partial.connected || partialText.includes("Hospitable is not connected.")) fail("one failed thread disconnected the tab");
if (!partialText.includes("Isabelle") || partial.waiting.some((row) => row.guest === "Owen")) fail("readable guest stayed listed");
if (!partialText.startsWith("The message read is incomplete for 1065 Shaw Street.")) fail("incomplete headline");
if (partialText.includes("No one is waiting") || partialText.includes("Every guest has a reply.")) fail("all-clear while Shaw failed");
if (partial.failed.filter((line) => /Shaw/.test(line)).length !== 1) fail("Shaw failure repeated");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [{ id: "prop-jays", name: "20 Blue Jays Way Unit 318", address: "318, 20 Blue Jays Way, Toronto", managed: true }],
  reservations: ["Diane", "Noah", "Mara", "Owen", "Priya"].map((guest, index) => ({
    ...stay(`stay-jays-${index}`, `HMJAY${index}`, "prop-jays", guest, "Is the wifi down?", "2026-10-08T15:00:00Z"),
    threadError: "Too Many Attempts.",
  })),
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const blocked = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
const blockedText = guestTabText(blocked);
if (!blockedText.startsWith("The message read is incomplete for 20 Blue Jays Way Unit 318.")) fail("blocked headline");
if (blocked.failed.length !== 1 || blocked.failed[0] !== "Couldn't read the latest messages for 20 Blue Jays Way Unit 318 from Hospitable, so some conversations are missing or show without their latest activity. Nothing was sent.") fail(`one failure line: ${blocked.failed.join(" | ")}`);
if (guestQueueRows(blocked).length !== 5) fail(`a failed thread read dropped conversations: ${guestQueueRows(blocked).length} of 5 listed`);
if (blockedText.includes("No one is waiting") || blockedText.includes("Every guest has a reply.")) fail("all-clear while the read failed");
if (blocked.waiting.length) fail("unread guests listed as waiting");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-09T18:50:00Z"),
  properties: [{ id: "prop-rose", name: "Bright and comfortable home for families", address: "floor 2, 41 Roseglor Crescent, Toronto", managed: true }],
  reservations: [
    {
      ...stay("stay-ruzaina", "HMRUZ1", "prop-rose", "Ruzaina", "Ok will check", "2026-10-09T18:40:00Z"),
      checkIn: "2026-10-09",
      checkOut: "2026-10-12",
      messages: [
        { id: "pay", at: "2026-10-09T18:20:00Z", role: "host" as const, name: "Shane", body: "Please send the remaining payment when you can." },
        { id: "ack", at: "2026-10-09T18:40:00Z", role: "guest" as const, name: "Ruzaina", body: "Ok will check" },
      ],
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const ack = await loadGuestQueue(new Date("2026-10-09T18:50:00Z"));
const ackText = guestTabText(ack);
if (ack.waiting.some((row) => row.guest === "Ruzaina")) fail("acknowledgement listed as waiting");
if (ack.thanks.some((row) => row.guest === "Ruzaina")) fail("will-check listed as no reply");
if (!ack.onGuest.some((row) => row.guest === "Ruzaina" && /next message/i.test(row.watch))) fail("will-check not watched");
if (guestDrafts().some((row) => row.to === "Ruzaina")) fail("will-check created a draft");
if (!ackText.includes("Ruzaina") || !ackText.includes("No one is waiting")) fail("acknowledgement hidden");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-09T18:50:00-04:00"),
  properties: [{ id: "prop-rose", name: "Bright and comfortable home for families", address: "floor 2, 41 Roseglor Crescent, Toronto", managed: true }],
  reservations: [
    {
      ...stay("stay-ruzaina-far", "HMRUZFAR1", "prop-rose", "Ruzaina Sathar", "Ok will check", "2026-10-09T18:40:00-04:00"),
      checkIn: "2026-11-11",
      checkOut: "2026-11-16",
      messages: [
        { id: "ask", at: "2026-10-09T16:00:00-04:00", role: "host" as const, name: "Shane", body: "Can you confirm the arrival time for November 11?" },
        { id: "ack", at: "2026-10-09T18:40:00-04:00", role: "guest" as const, name: "Ruzaina Sathar", body: "Ok will check" },
      ],
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const far = await loadGuestQueue(new Date("2026-10-09T18:50:00-04:00"));
const farRow = far.onGuest.find((row) => row.guest === "Ruzaina Sathar");
if (!farRow) fail("33-day acknowledgement missing from Waiting on guest");
if (far.waiting.some((row) => row.guest === "Ruzaina Sathar") || far.thanks.some((row) => row.guest === "Ruzaina Sathar")) fail("33-day acknowledgement left Waiting on guest");
if (farRow.status !== "Waiting on guest") fail(`far status ${farRow.status}`);
if (!/next message/i.test(farRow.watch)) fail(`far watch ${farRow.watch}`);
const farSearch = `${farRow.guest} ${farRow.property} ${farRow.status} ${farRow.watch} ${farRow.asked}`.toLowerCase();
if (!farSearch.includes("ruzaina") || !farSearch.includes("roseglor") || !farSearch.includes("ok will check")) fail("search missed the far thread");

resetGuestMessaging();
resetResearch();
installResearch([{
  title: "Airbnb Resolution Center",
  url: "https://www.airbnb.ca/resolutions",
  text: "Payment requests are listed in the Resolution Center when you are signed in.",
}]);
const feeNow = new Date("2026-11-07T16:10:00Z");
installWorld({
  now: feeNow,
  properties: [{ id: "prop-rose", name: "Bright and comfortable home for families", address: "floor 2, 41 Roseglor Crescent, Toronto", managed: true }],
  reservations: [
    {
      id: "stay-ruzaina-fee",
      code: "HMRUZFEE1",
      propertyId: "prop-rose",
      status: "accepted",
      checkIn: "2026-11-11",
      checkOut: "2026-11-16",
      guest: "Ruzaina",
      adults: 6,
      children: 0,
      messages: [
        { id: "book", at: "2026-10-26T20:12:00Z", role: "guest", name: "Ruzaina", body: "Hi! Just booked Nov 11-16. We’re a group of 6 coming in for a family wedding." },
        { id: "welcome", at: "2026-10-26T20:30:00Z", role: "host", name: "Sam", body: "Welcome, Ruzaina! 41 Roseglor sleeps 6 comfortably across three bedrooms. Check-in is 4 PM and check-out 11 AM." },
        { id: "drive", at: "2026-10-28T18:40:00Z", role: "host", name: "Sam", body: "It fits two, end to end. Here’s a quick walkthrough of the driveway and the side door you’ll use.", media: [{ kind: "video", url: "https://example.com/driveway.mp4", duration: "0:38", shows: "driveway and side door" }] },
        { id: "ask-time", at: "2026-11-02T15:15:00Z", role: "guest", name: "Ruzaina", body: "Our flight lands at 6 AM on the 11th. Any chance we could get in at 7:30 AM?" },
        { id: "offer-125", at: "2026-11-02T21:20:00Z", role: "host", name: "Sam", body: "Good news, we can have the home ready for 7:30 AM on Nov 11. Early check-in that early is $125." },
        { id: "price", at: "2026-11-02T21:48:00Z", role: "guest", name: "Ruzaina", body: "Is there anything you can do on the price? There are six of us splitting it, but still." },
        { id: "offer-99", at: "2026-11-02T22:30:00Z", role: "host", name: "Sam", body: "We can do $99 for the 7:30 AM arrival." },
        { id: "deal", at: "2026-11-02T22:41:00Z", role: "guest", name: "Ruzaina", body: "Deal, thank you so much!" },
        { id: "sent", at: "2026-11-02T22:52:00Z", role: "host", name: "Sam", body: "I’ve sent a $99 payment request through Airbnb. Once it’s paid, you’re confirmed for 7:30." },
        { id: "remind", at: "2026-11-04T14:10:00Z", role: "host", name: "Sam", body: "Hi Ruzaina, a reminder that the $99 early check-in request is waiting for you in Airbnb." },
        { id: "where", at: "2026-11-04T18:26:00Z", role: "guest", name: "Ruzaina", body: "I didn’t get anything. Where would it be?" },
        { id: "again", at: "2026-11-04T19:05:00Z", role: "host", name: "Sam", body: "It should show in your Airbnb messages and by email. I’ve sent it again just now." },
        { id: "still", at: "2026-11-07T13:47:00Z", role: "guest", name: "Ruzaina", body: "Still nothing. I checked my email, spam and the app." },
        { id: "photo", at: "2026-11-07T13:48:00Z", role: "guest", name: "Ruzaina", body: "This is all I see", media: [{ kind: "photo", url: "https://example.com/resolution.png", shows: "the Resolution Center with no request listed" }] },
        { id: "trouble", at: "2026-11-07T14:30:00Z", role: "host", name: "Sam", body: "Hi, thanks for checking. Could he update his Airbnb app, sign out and back in, then open Trips, tap his reservation and look under Payments? The request should be listed there." },
        { id: "tonight", at: "2026-11-07T14:58:00Z", role: "guest", name: "Ruzaina", body: "I’m out right now, will check tonight." },
        { id: "ok", at: "2026-11-07T14:59:00Z", role: "guest", name: "Ruzaina", body: "Ok will check" },
      ],
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const feeQueue = await loadGuestQueue(feeNow);
const feeRow = feeQueue.onGuest.find((row) => row.guest === "Ruzaina");
if (!feeRow) fail("fee thread not waiting on guest");
if (feeQueue.waiting.some((row) => row.guest === "Ruzaina")) fail("fee thread created a waiting item");
if (feeRow.property !== "41 Roseglor Cres") fail("fee property");
if (!/\$99/.test(feeRow.status) || !/7:30 AM/.test(feeRow.status) || !/Resolution Center with no request listed/i.test(feeRow.status)) fail(`fee status ${feeRow.status}`);
if (!/Her next message, or the fee unpaid 48 hours before arrival/.test(feeRow.watch)) fail(`fee watch ${feeRow.watch}`);
if (guestDrafts().some((row) => row.to === "Ruzaina")) fail("fee queue created a draft");
const feeView = await openGuestAnswer(feeRow, feeNow);
if (feeView.lane !== "guest" || feeView.sendable || feeView.mode !== "held") fail("fee view is sendable");
if (!/\$99/.test(feeView.status) || !/7:30 AM/.test(feeView.status) || !/Resolution Center with no request listed/i.test(feeView.status)) fail(`opened status ${feeView.status}`);
if (!/Her next message, or the fee unpaid 48 hours before arrival/.test(feeView.watch)) fail(`opened watch ${feeView.watch}`);
if (!/airbnb\.ca\/resolutions/.test(feeView.draft)) fail(`held draft link ${feeView.draft}`);
if (/sign out|update his|open Trips|look under Payments/i.test(feeView.draft)) fail(`held draft repeats steps ${feeView.draft}`);
if (/he\/his|clean must finish/i.test(feeView.draft)) fail("partner note leaked into the draft");
if (!feeView.partnerNotes.some((note) => /he\/his/.test(note) && /Ruzaina/.test(note))) fail("pronoun note missing");
if (!feeView.partnerNotes.some((note) => /7:30 AM/.test(note) && /clean/.test(note))) fail("clean note missing");
if (!/full thread \(\d+ messages, 1 photo, 1 video\)/.test(feeView.sourceLine) || !/Reservation Nov 11-16/.test(feeView.sourceLine) || !/Airbnb Resolution Center/.test(feeView.sourceLine)) fail(`source ${feeView.sourceLine}`);
if (!feeView.thread.some((message) => message.media.some((item) => item.kind === "photo" && /Resolution Center/i.test(item.shows)))) fail("photo was not read");
if (guestDrafts().some((row) => row.reservationId === feeRow.id)) fail("opening the held thread created a draft");
resetResearch();

resetGuestMessaging();
setGuestUploader(async () => {
  throw new Error("The video didn’t upload.");
});
const commitsBeforeUpload = capturedCommits().length;
let uploadBlocked = false;
try {
  await submitGuestReply({
    reservationId: "stay-ruzaina-fee",
    propertyId: "prop-rose",
    property: "41 Roseglor Cres",
    guest: "Ruzaina",
    english: "Hi Ruzaina, the link is ready.",
    language: "",
    fact: "",
    attachments: [{ name: "clip.mp4", mime: "video/mp4", data: "AAAA" }],
  });
} catch (err) {
  uploadBlocked = err instanceof Error && /didn’t upload/.test(err.message) && /nothing was sent/i.test(err.message);
}
if (!uploadBlocked) fail("upload failure did not stop the send");
if (capturedCommits().length !== commitsBeforeUpload) fail("text sent after the upload failed");

resetGuestMessaging();
installWorld({
  now: new Date("2026-10-08T16:06:00Z"),
  properties: [{ id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true }],
  reservations: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const empty = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
const emptyText = guestTabText(empty);
if (!empty.connected || empty.waiting.length !== 0) fail("empty queue");
if (!emptyText.includes("No one is waiting") || emptyText.includes("Hospitable is not connected.")) fail("honest empty state");

const WINDOWS = "Sorry about that, Eloise. We'll have the windows cleaned for you. Our cleaner can come any day from Oct 14. Would that work?";
const AGREED = "Yes, any day on or after the 14th is fine. Mornings are best.";
const eloiseTurns = [
  { at: "2026-10-04T18:00:00Z", role: "guest", name: "Eloise", body: "Could we get an extra key? My partner arrives a day later." },
  { at: "2026-10-04T18:20:00Z", role: "host", name: "Sam", body: "We can leave an extra key with you tomorrow." },
  { at: "2026-10-04T18:40:00Z", role: "guest", name: "Eloise", body: "No thanks, we don't need one after all. We'll come in together." },
  { at: "2026-10-05T15:00:00Z", role: "guest", name: "Eloise", body: "How does the shower work? I only get a trickle." },
  { at: "2026-10-05T15:30:00Z", role: "host", name: "Sam", body: "The shower is a rainfall head. Pull the diverter lever all the way up and let it run for a minute. That brings the full pressure." },
  { at: "2026-10-05T15:45:00Z", role: "guest", name: "Eloise", body: "Got it, thank you. It's working now." },
  { at: "2026-10-06T22:40:00Z", role: "guest", name: "Eloise", body: "Loving the loft! Only thing, the windows are pretty grimy, hard to see the view." },
  { at: "2026-10-07T17:01:00Z", role: "host", name: "Sam", body: WINDOWS },
  { at: "2026-10-07T17:20:00Z", role: "guest", name: "Eloise", body: AGREED },
  { at: "2026-10-07T17:24:00Z", role: "host", name: "Sam", body: "Perfect, I'll confirm the day closer to then." },
];
const readEloise = detectFollowUps({
  reservationId: "stay-eloise",
  guest: "Eloise",
  property: "8 Charlotte St Unit 606",
  propertyId: "prop-fu",
  checkIn: "2026-10-03",
  checkOut: "2026-10-24",
  turns: eloiseTurns,
}, new Date("2026-10-10T21:12:00-04:00"));
if (readEloise.open.length !== 1) fail(`eloise open loops ${readEloise.open.map((row) => row.topic).join(", ") || "none"}`);
const windows = readEloise.open[0];
if (!windows || windows.kind !== "owe" || windows.due !== "2026-10-14") fail(`eloise due ${windows?.due} ${windows?.kind}`);
if (windows.promised !== WINDOWS || windows.agreed !== AGREED) fail("eloise quotes");
if (windows.dueNow) fail("oct 10 is not due now");
if (/key|shower/i.test(`${windows.topic} ${windows.line}`)) fail("key or shower stayed open");
if (!/Window cleaning promised, Eloise agreed to on or after Oct 14/.test(windows.line)) fail(`eloise line ${windows.line}`);
if (!/Wed 1:01 PM/.test(windows.sourceLine)) fail(`eloise source ${windows.sourceLine}`);

const suitcase = [
  { at: "2026-10-10T15:52:00Z", role: "guest", name: "Priya Raman", body: "I think I left my black suitcase in the bedroom closet! I'm still in the city until tonight." },
  { at: "2026-10-10T16:20:00Z", role: "host", name: "Jordan", body: "Found it. I'll leave it with building security at the front desk, under your name." },
  { at: "2026-10-10T17:40:00Z", role: "host", name: "Jordan", body: "Your suitcase is at the front desk with building security, under Priya Raman. Bring ID; they're there 24/7." },
];
const readBag = detectFollowUps({
  reservationId: "stay-priya",
  guest: "Priya Raman",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-10-07",
  checkOut: "2026-10-10",
  turns: suitcase,
}, new Date("2026-10-10T21:12:00-04:00"));
if (readBag.open.length !== 1 || readBag.open[0]?.kind !== "incident") fail(`suitcase loops ${readBag.open.map((row) => `${row.kind}:${row.topic}`).join(", ") || "none"}`);
if (!/Suitcase at front desk · building security · sent 1:40 PM, no confirmation yet/.test(readBag.open[0]?.line || "")) fail(`suitcase line ${readBag.open[0]?.line}`);
const readPicked = detectFollowUps({
  reservationId: "stay-priya",
  guest: "Priya Raman",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-10-07",
  checkOut: "2026-10-10",
  turns: [...suitcase, { at: "2026-10-10T21:20:00-04:00", role: "guest", name: "Priya Raman", body: "Got it! Picked it up just now, thank you so much." }],
}, new Date("2026-10-10T21:30:00-04:00"));
if (readPicked.open.length !== 0) fail("confirmed suitcase stayed open");
if (!/picked up/i.test(readPicked.settled.map((row) => row.closeText).join(" "))) fail(`suitcase close ${readPicked.settled.map((row) => row.closeText).join(" | ")}`);
const readBagEnded = detectFollowUps({
  reservationId: "stay-priya",
  guest: "Priya Raman",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-10-07",
  checkOut: "2026-10-10",
  turns: suitcase,
}, new Date("2026-10-11T21:00:00-04:00"));
if (readBagEnded.open.length !== 0) fail("suitcase lingered after checkout");
if (!/stay ended/i.test(readBagEnded.settled.map((row) => row.closeText).join(" "))) fail(`ended suitcase ${readBagEnded.settled.map((row) => row.closeText).join(" | ")}`);
const readBagContinued = detectFollowUps({
  reservationId: "stay-priya",
  guest: "Priya Raman",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-10-07",
  checkOut: "2026-10-10",
  turns: [...suitcase, { at: "2026-10-11T15:00:00Z", role: "guest", name: "Priya Raman", body: "The suitcase is still at the front desk." }],
}, new Date("2026-10-11T21:00:00-04:00"));
if (readBagContinued.open.length !== 1 || readBagContinued.open[0]?.kind !== "incident") fail("continued suitcase closed after checkout");

const KEY_LOGISTICS = `Hi Carson,

We're looking forward to hosting you at the condo on Blue Jays Way!

Just a couple quick details to help us prepare for your arrival:

- Address is 20 Blue jays way unit 318.

1️⃣ Keys
We provide 1 key & fob for your stay.
We use a lockbox to store keys. The lockbox is located at a convenience store just steps away from the building located at 270 Wellington street called JC Foodlane.
See below store hours for the store. If your going to be checking in outside of these hours please let us know and we can hand off the keys to you or use an alternative method to get you the keys.
Monday - Friday: 7:30 am - Midnight
Saturday - Sunday: 8 am - Midnight

Lockbox has a blue ribbon on it, circled in red in the attached photo. (see photo to find easier)
Opening the Lockbox
Pull the clear button (C button) down to reset it before you start
Enter the code: 0146
Press the main button down to open.

If you make a mistake, pull the clear button down again to reset and try again.

Note: If your arriving with a vehicle please ensure to pick up keys from lockbox before entering the underground parking garage, as you'll need the fob to get through the door to get to the elevators, and then follow below instructions about parking.

2️⃣ Snacks
We like to leave a few welcome snacks for our guests. Do you have any allergies or dietary restrictions (nuts, gluten, lactose, etc.)?

3️⃣ Parking (if applicable) Parking spot: Level P4, Spot 62
If you'll be parking, you must send us the make, model, and license plate number of your vehicle so we can register it.
Without this information, the gate will not open to the underground garage. If you have any issues with entering the garage please click the button to speak to concierge. They will be able to sort this out for you. If you need additional assistance don't hesitate to let us know. We'd be happy to help.

Thanks, and looking forward to hosting you.`;
const readCarson = detectFollowUps({
  reservationId: "stay-carson",
  guest: "Carson",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-09-30",
  checkOut: "2026-10-04",
  turns: [
    { at: "2026-09-27T20:02:15Z", role: "host", name: "Shane Mosoff", body: KEY_LOGISTICS },
    { at: "2026-10-04T15:46:05Z", role: "guest", name: "Carson", body: "Hello, yes we left a little before 11" },
    { at: "2026-10-05T18:42:09Z", role: "guest", name: "Carson", body: "Thanks for the reminder; I left a 5 star review! We had a phenomenal experience." },
  ],
}, new Date("2026-10-11T21:00:00-04:00"));
if (readCarson.open.length !== 0) fail(`carson key message stayed open ${readCarson.open.map((row) => `${row.kind}:${row.line}`).join(",")}`);
const readDianeKeys = detectFollowUps({
  reservationId: "stay-diane-keys",
  guest: "Diane",
  property: "20 Blue Jays Way Unit 318",
  propertyId: "prop-fu",
  checkIn: "2026-10-09",
  checkOut: "2026-10-12",
  turns: [{ at: "2026-10-06T20:00:29Z", role: "host", name: "Shane Mosoff", body: KEY_LOGISTICS.replace("Hi Carson,", "Hi Diane,") }],
}, new Date("2026-10-11T21:00:00-04:00"));
if (readDianeKeys.open.some((row) => row.kind === "incident")) fail(`diane key logistics ${readDianeKeys.open.map((row) => row.line).join(",")}`);

const readDone = detectFollowUps({
  reservationId: "stay-maya",
  guest: "Maya Chen",
  property: "8 Charlotte St Unit 606",
  propertyId: "prop-fu",
  checkIn: "2026-10-08",
  checkOut: "2026-10-12",
  turns: [
    { at: "2026-10-09T15:00:00Z", role: "guest", name: "Maya Chen", body: "Could we get a couple of extra towels?" },
    { at: "2026-10-09T15:10:00Z", role: "host", name: "Sam", body: "We'll have extra towels brought up this afternoon." },
    { at: "2026-10-09T15:12:00Z", role: "guest", name: "Maya Chen", body: "Yes, that would be great." },
    { at: "2026-10-09T20:00:00Z", role: "host", name: "Sam", body: "The towels are on the bed. All set." },
  ],
}, new Date("2026-10-10T21:12:00-04:00"));
if (readDone.open.length !== 0) fail("fulfilled promise stayed open");

const fuNow = new Date("2026-10-10T21:12:00-04:00");
resetGuestMessaging();
await clearHandledFollowUps();
installWorld({
  now: fuNow,
  properties: [{ id: "prop-fu", name: "8 Charlotte St Unit 606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
  reservations: [
    { id: "stay-eloise", code: "HMELO1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-03", checkOut: "2026-10-24", guest: "Eloise", adults: 1, children: 0, messages: eloiseTurns.map((row, index) => ({ id: `el-${index}`, ...row, role: row.role as "guest" | "host" })) },
    { id: "stay-priya", code: "HMPRI1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-07", checkOut: "2026-10-10", guest: "Priya Raman", adults: 1, children: 0, messages: suitcase.map((row, index) => ({ id: `pr-${index}`, ...row, role: row.role as "guest" | "host" })) },
    { id: "stay-maya", code: "HMMAY1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-08", checkOut: "2026-10-12", guest: "Maya Chen", adults: 1, children: 0, messages: [
      { id: "my-1", at: "2026-10-09T15:00:00Z", role: "guest" as const, name: "Maya Chen", body: "Could we get a couple of extra towels?" },
      { id: "my-2", at: "2026-10-09T15:10:00Z", role: "host" as const, name: "Sam", body: "We'll have extra towels brought up this afternoon." },
      { id: "my-3", at: "2026-10-09T15:12:00Z", role: "guest" as const, name: "Maya Chen", body: "Yes, that would be great." },
      { id: "my-4", at: "2026-10-09T20:00:00Z", role: "host" as const, name: "Sam", body: "The towels are on the bed. All set." },
    ] },
    { id: "stay-imani", code: "HMIMA1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-20", checkOut: "2026-10-23", guest: "Imani", adults: 2, children: 1, messages: [
      { id: "im-1", at: "2026-10-08T18:00:00Z", role: "guest" as const, name: "Imani", body: "Do you have a crib we could use?" },
      { id: "im-2", at: "2026-10-08T18:20:00Z", role: "host" as const, name: "Sam", body: "We'll have a crib set up for you." },
    ] },
    { id: "stay-luis", code: "HMLUI1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-05", checkOut: "2026-10-08", guest: "Luis", adults: 2, children: 0, messages: [
      { id: "lu-1", at: "2026-10-07T14:00:00Z", role: "guest" as const, name: "Luis", body: "Could you send the pancake recipe?" },
      { id: "lu-2", at: "2026-10-07T14:15:00Z", role: "host" as const, name: "Sam", body: "We'll send the recipe." },
    ] },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const fuQueue = await loadGuestQueue(fuNow);
if (fuQueue.followUps.filter((row) => row.guest === "Eloise").length !== 1) fail("queue eloise count");
if (!fuQueue.onGuest.some((row) => row.guest === "Eloise") || fuQueue.waiting.some((row) => row.guest === "Eloise")) fail("eloise follow-up changed who owes the reply");
if (fuQueue.followUps.some((row) => row.guest === "Maya Chen")) fail("queue kept a fulfilled promise");
const queuedBag = fuQueue.followUps.find((row) => row.guest === "Priya Raman");
if (!queuedBag || queuedBag.kind !== "incident") fail("queue suitcase");
const crib = fuQueue.followUps.find((row) => row.guest === "Imani");
if (!crib || crib.due !== "2026-10-20" || crib.dueFrom !== "stay") fail(`crib date ${crib?.due} ${crib?.dueFrom}`);
if (fuQueue.followUps.some((row) => row.guest === "Luis")) fail("ended stay kept the recipe");
if (fuQueue.followUps.map((row) => row.guest).join(",") !== "Eloise,Imani,Priya Raman") fail(`order ${fuQueue.followUps.map((row) => row.guest).join(",")}`);
if (fuQueue.closedFollowUps.length) fail("first load flashed a close");

const oct14 = new Date("2026-10-14T16:00:00-04:00");
const dueQueue = await loadGuestQueue(oct14);
const dueWindows = dueQueue.followUps.find((row) => row.guest === "Eloise");
if (!dueWindows?.dueNow || dueQueue.followUps[0]?.id !== dueWindows.id) fail("due now did not move first");
const inquiry = {
  ...dueWindows,
  id: "inquiry:anlel",
  kind: "inquiry" as const,
  guest: "Anlel",
  tag: "INQUIRY",
  due: "",
  dueNow: false,
  expiresAt: "2026-10-16T20:00:00-04:00",
  sourceAt: "2026-10-10T20:12:00-04:00",
  line: "Booking request expires in 23 hrs",
} satisfies GuestFollowUp;
const ranked = orderFollowUps([inquiry, queuedBag, dueWindows], oct14);
if (ranked.map((row) => row.kind).join(",") !== "owe,inquiry,incident") fail(`inquiry order ${ranked.map((row) => row.kind).join(",")}`);
if (!ranked[0]?.dueNow) fail("dated promise was not due now");

await markFollowUpHandled(dueWindows.id, oct14);
const handledQueue = await loadGuestQueue(oct14);
if (handledQueue.followUps.some((row) => row.id === dueWindows.id)) fail("mark handled came back");
installWorld({
  now: fuNow,
  properties: [{ id: "prop-fu", name: "8 Charlotte St Unit 606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
  reservations: [
    { id: "stay-eloise", code: "HMELO1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-03", checkOut: "2026-10-24", guest: "Eloise", adults: 1, children: 0, messages: eloiseTurns.map((row, index) => ({ id: `el-${index}`, ...row, role: row.role as "guest" | "host" })) },
    { id: "stay-priya", code: "HMPRI1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-07", checkOut: "2026-10-10", guest: "Priya Raman", adults: 1, children: 0, messages: suitcase.map((row, index) => ({ id: `pr-${index}`, ...row, role: row.role as "guest" | "host" })) },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
if (!(await loadGuestQueue(fuNow)).followUps.some((row) => row.guest === "Priya Raman" && row.kind === "incident")) fail("suitcase missing before confirmation");
installWorld({
  now: new Date("2026-10-10T21:30:00-04:00"),
  properties: [{ id: "prop-fu", name: "8 Charlotte St Unit 606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
  reservations: [
    { id: "stay-eloise", code: "HMELO1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-03", checkOut: "2026-10-24", guest: "Eloise", adults: 1, children: 0, messages: eloiseTurns.map((row, index) => ({ id: `el-${index}`, ...row, role: row.role as "guest" | "host" })) },
    { id: "stay-priya", code: "HMPRI1", propertyId: "prop-fu", status: "accepted", checkIn: "2026-10-07", checkOut: "2026-10-10", guest: "Priya Raman", adults: 1, children: 0, messages: [...suitcase.map((row, index) => ({ id: `pr-${index}`, ...row, role: row.role as "guest" | "host" })), { id: "pr-got", at: "2026-10-10T21:20:00-04:00", role: "guest" as const, name: "Priya Raman", body: "Got it! Picked it up just now, thank you so much." }] },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const closedBag = await loadGuestQueue(new Date("2026-10-10T21:30:00-04:00"));
if (closedBag.followUps.some((row) => row.guest === "Priya Raman")) fail("queue kept a confirmed suitcase");
if (closedBag.followUps.some((row) => row.id === dueWindows.id)) fail("handled windows resurfaced");
if (!closedBag.closedFollowUps.some((row) => /Priya/.test(row.guest) && /picked up/i.test(row.closeText))) fail(`thread close ${closedBag.closedFollowUps.map((row) => row.closeText).join(" | ")}`);
const quiet = await loadGuestQueue(new Date("2026-10-10T21:30:00-04:00"));
if (quiet.closedFollowUps.length) fail("closed line repeated on the next load");

const anlelNow = new Date("2026-10-10T21:12:00-04:00");
const anlelPending = "2026-10-11T00:15:00.000Z";
const ANLEL_RULES = "I've read the house rules and I agree to them, no parties and quiet after 10.";
const anlelTurns: InquiryTurn[] = [
  { at: anlelPending, role: "host", name: "Airbnb", body: "Booking request from Anlel: Fri Nov 20 → Mon Nov 23, 3 nights, 2 guests, CA$1,222.13. Respond by Sunday, October 11 at 8:15 PM." },
  { at: "2026-10-11T00:16:00.000Z", role: "host", name: "Sam", body: "House rules: no parties, and quiet after 10." },
  { at: "2026-10-11T00:20:00.000Z", role: "guest", name: "Anlel", body: ANLEL_RULES },
];
const anlelRecord: InquiryRecord = {
  id: "stay-anlel",
  code: "HMANLEL1",
  status: "request",
  guest: "Anlel",
  guestPhoto: "https://example.test/anlel.jpg",
  reviews: 0,
  guestSince: "2026-10-02T16:00:00.000Z",
  property: "20 Blue Jays Way",
  propertyId: "prop-jays",
  checkIn: "2026-11-20",
  checkOut: "2026-11-23",
  adults: 2,
  children: 0,
  total: "CA$1,222.13",
  pendingAt: anlelPending,
  airbnbThread: "481920155",
};
const anlelCard = bookingRequestFollowUp(anlelRecord, anlelTurns, anlelNow);
if (!anlelCard || anlelCard.kind !== "inquiry") fail("anlel card");
if (anlelCard.expiresAt !== "2026-10-12T00:15:00.000Z") fail(`anlel deadline ${anlelCard.expiresAt}`);
if (anlelCard.price !== "CA$1,222.13" || anlelCard.nights !== "3" || anlelCard.guestCount !== "2") fail(`anlel facts ${anlelCard.price} ${anlelCard.nights} ${anlelCard.guestCount}`);
if (!anlelCard.newToAirbnb || anlelCard.guestPhoto !== "https://example.test/anlel.jpg") fail("anlel record signals");
if (anlelCard.rulesQuote !== ANLEL_RULES || !/8:20 PM/.test(anlelCard.rulesWhen || "")) fail(`anlel rules ${anlelCard.rulesQuote} ${anlelCard.rulesWhen}`);
if (anlelCard.suggested !== "approve" || anlelCard.phase) fail("anlel suggested approve before a press");
if (!anlelCard.notes.some((note) => /24 hours to respond/.test(note)) || anlelCard.notes.some((note) => /4 hours left/.test(note))) fail(`anlel escalation ${anlelCard.notes.join(" | ")}`);
if (!anlelCard.airbnbUrl?.endsWith("/481920155")) fail(`anlel link ${anlelCard.airbnbUrl}`);
const unconfirmed = bookingRequestFollowUp(anlelRecord, anlelTurns.slice(0, 2), anlelNow);
if (!unconfirmed || unconfirmed.suggested !== "rules" || unconfirmed.rulesConfirmed) fail("unconfirmed rules still offered acceptance");
if (!/house rules/i.test(unconfirmed.draft)) fail("rules draft missing");
const earlier = responseDeadline(anlelPending, [{ at: anlelPending, role: "host", name: "Airbnb", body: "Respond by Sunday, October 11 at 6:00 PM." }]);
if (earlier?.toISOString() !== "2026-10-11T22:00:00.000Z") fail(`earlier thread deadline ${earlier?.toISOString()}`);
const later = responseDeadline(anlelPending, [{ at: anlelPending, role: "host", name: "Airbnb", body: "Respond by Monday, October 12 at 9:00 PM." }]);
if (later?.toISOString() !== "2026-10-12T00:15:00.000Z") fail(`later thread deadline ${later?.toISOString()}`);
const soon = bookingRequestFollowUp(anlelRecord, anlelTurns, new Date("2026-10-11T16:20:00-04:00"));
if (!soon?.notes.some((note) => /4 hours left/.test(note))) fail(`four hour escalation ${soon?.notes.join(" | ")}`);

resetGuestMessaging();
await clearHandledFollowUps();
await clearInquiryVerifying();
const anlelMessages = anlelTurns.map((row, index) => ({ id: `an-${index}`, at: row.at, role: row.role as "guest" | "host", name: row.name, body: row.body }));
installWorld({
  now: anlelNow,
  properties: [{ id: "prop-jays", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true }],
  reservations: [{
    id: "stay-anlel",
    code: "HMANLEL1",
    propertyId: "prop-jays",
    status: "request",
    checkIn: "2026-11-20",
    checkOut: "2026-11-23",
    guest: "Anlel",
    adults: 2,
    children: 0,
    messages: anlelMessages,
    financials: { currency: "CAD", guest: { total_price: { formatted: "CA$1,222.13" } } },
    airbnbThread: "481920155",
    bookedAt: anlelPending,
    guestPhoto: "https://example.test/anlel.jpg",
    reviews: 0,
    guestSince: "2026-10-02T16:00:00.000Z",
  }],
  inquiries: [{
    id: "inq-jules",
    propertyId: "prop-jays",
    status: "open",
    guest: "Jules",
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    adults: 1,
    children: 0,
    messages: [],
    financials: { guest: { total_price: { formatted: "CA$640.00" } } },
    airbnbThread: "481920166",
    bookedAt: "2026-10-11T01:00:00.000Z",
    reviews: 14,
    guestSince: "2019-04-01T12:00:00.000Z",
  }],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const beforeCommits = capturedCommits().length;
const requestQueue = await loadGuestQueue(anlelNow);
const queuedAnlel = requestQueue.followUps.find((row) => row.guest === "Anlel");
if (!queuedAnlel || queuedAnlel.expiresAt !== anlelCard.expiresAt || queuedAnlel.rulesQuote !== ANLEL_RULES || queuedAnlel.price !== "CA$1,222.13") fail(`queue anlel ${queuedAnlel?.expiresAt} ${queuedAnlel?.price} ${queuedAnlel?.rulesQuote}`);
if (!requestQueue.followUps.some((row) => row.guest === "Jules" && row.kind === "inquiry")) fail("open inquiry missing");
if (queuedAnlel.guestPhoto !== "https://example.test/anlel.jpg") fail(`anlel photo ${queuedAnlel.guestPhoto}`);
if (guestPhotoUrl({ guest: { profile_picture: "https://example.test/anlel.jpg" } }) !== "https://example.test/anlel.jpg") fail("hospitable profile picture");
if (capturedCommits().length !== beforeCommits) fail("inquiry load wrote to Hospitable");
const verified = await beginInquiryVerify(queuedAnlel.id, "approve", anlelNow);
if (verified.airbnbUrl !== queuedAnlel.airbnbUrl || capturedCommits().length !== beforeCommits) fail("approve pressed a Hospitable write");
if (verified.queue.followUps.find((row) => row.id === queuedAnlel.id)?.phase !== "verifying-approve") fail("approve did not start verifying");
installWorld({
  now: new Date("2026-10-10T21:20:00-04:00"),
  properties: [{ id: "prop-jays", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true }],
  reservations: [{
    id: "stay-anlel",
    code: "HMANLEL1",
    propertyId: "prop-jays",
    status: "accepted",
    checkIn: "2026-11-20",
    checkOut: "2026-11-23",
    guest: "Anlel",
    adults: 2,
    children: 0,
    messages: anlelMessages,
    financials: { currency: "CAD", guest: { total_price: { formatted: "CA$1,222.13" } } },
    airbnbThread: "481920155",
    bookedAt: anlelPending,
    reviews: 0,
    guestSince: "2026-10-02T16:00:00.000Z",
  }],
  inquiries: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const readBack = await loadGuestQueue(new Date("2026-10-10T21:20:00-04:00"));
if (readBack.followUps.some((row) => row.guest === "Anlel")) fail("accepted request stayed open");
if (!readBack.closedFollowUps.some((row) => row.guest === "Anlel" && /Confirmed at 9:20 PM/.test(row.closeText) && /accepted/.test(row.closeText))) fail(`read-back ${readBack.closedFollowUps.map((row) => row.closeText).join(" | ")}`);
if (capturedCommits().length !== beforeCommits) fail("read-back wrote to Hospitable");
const quietRequest = await loadGuestQueue(new Date("2026-10-10T21:20:00-04:00"));
if (quietRequest.closedFollowUps.some((row) => row.guest === "Anlel")) fail("acceptance close repeated");

function anlelWorld(status: string, now: Date) {
  installWorld({
    now,
    properties: [{ id: "prop-jays", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true }],
    reservations: [{
      id: "stay-anlel",
      code: "HMANLEL1",
      propertyId: "prop-jays",
      status,
      checkIn: "2026-11-20",
      checkOut: "2026-11-23",
      guest: "Anlel",
      adults: 2,
      children: 0,
      messages: anlelMessages,
      financials: { currency: "CAD", guest: { total_price: { formatted: "CA$1,222.13" } } },
      airbnbThread: "481920155",
      bookedAt: anlelPending,
      guestPhoto: "https://example.test/anlel.jpg",
      reviews: 0,
      guestSince: "2026-10-02T16:00:00.000Z",
    }],
    inquiries: [],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
}
await clearInquiryVerifying();
anlelWorld("request", anlelNow);
const declineOpen = await loadGuestQueue(anlelNow);
if (!declineOpen.followUps.some((row) => row.guest === "Anlel")) fail("anlel missing before decline");
anlelWorld("declined", anlelNow);
const declined = await loadGuestQueue(anlelNow);
if (declined.followUps.some((row) => row.guest === "Anlel")) fail("declined request stayed open");
if (!declined.closedFollowUps.some((row) => row.guest === "Anlel" && /declined/.test(row.closeText))) fail(`decline close ${declined.closedFollowUps.map((row) => row.closeText).join(" | ")}`);
anlelWorld("request", anlelNow);
if (!(await loadGuestQueue(anlelNow)).followUps.some((row) => row.guest === "Anlel")) fail("anlel missing before expiry");
const afterDeadline = new Date("2026-10-12T01:00:00-04:00");
anlelWorld("request", afterDeadline);
const expired = await loadGuestQueue(afterDeadline);
if (expired.followUps.some((row) => row.guest === "Anlel")) fail("expired request stayed open");
if (!expired.closedFollowUps.some((row) => row.guest === "Anlel" && /expired/i.test(row.closeText))) fail(`expiry close ${expired.closedFollowUps.map((row) => row.closeText).join(" | ")}`);
if (capturedCommits().length !== beforeCommits) fail("revalidation wrote to Hospitable");

const liveNow = new Date("2026-10-11T23:00:00.000Z");
const LIVE_PROMISE = "Hey I spoke to the owner. There’s a fee from the building to get an additional fob and key made it’s $100. If you’d like to pay for this. We can get it done for you. \n\nAs per windows. Yes we can send someone to clean the windows. Please let me know some preferred times you will be home over the next week and I’ll try to schedule within those times. \n\nOtherwise if it’s on or after October 14th, I can or someone from my team can take care of it or accompany someone to take care of it. \n\nPlease let me know how you would like to proceed.";
const LIVE_AGREED = "Thank you for the follow-up. No need for the extra key - we’d prefer not to pay. Thank you for inquiring though. \n\nIf you or one of your team could provide access to clean the windows, that would be great. Please just let us know when you think that would be.   On or after 14th is fine";
const LIVE_SUITCASE = "Hey just reaching out as a heads up. Security has informed us one of our guests have left a suitcase at the front desk. This is not allowed. If this is yours or someone in your group. Please pick it up immediately. \n\nIf it is not yours please disregard this message. \n\nThanks";
resetGuestMessaging();
await clearHandledFollowUps();
installWorld({
  now: liveNow,
  properties: [{ id: "prop-live-jays", name: "20 Blue Jays Way", address: "318, 20 Blue Jays Way, Toronto", managed: true }],
  reservations: [{
    id: "stay-anlel-live",
    code: "HM5AN2HEB9",
    propertyId: "prop-live-jays",
    status: "pending payment",
    checkIn: "2026-11-20",
    checkOut: "2026-11-23",
    guest: "Anlel",
    adults: 4,
    children: 0,
    messages: [],
    bookingDate: "2026-10-11T02:48:56Z",
    statusHistory: [
      { status: "checkpoint", category: "Checkpoint", changed_at: "2026-10-10T22:10:49+00:00" },
      { status: "pending", category: "Pending", changed_at: "2026-10-11T00:15:54+00:00" },
      { status: "pending_payment", category: "Pending payment", changed_at: "2026-10-11T15:09:49+00:00" },
    ],
  }],
  inquiries: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const liveAnlel = await loadGuestQueue(liveNow);
if (liveAnlel.followUps.length !== 1 || liveAnlel.followUps[0]?.guest !== "Anlel" || liveAnlel.followUps[0]?.kind !== "inquiry") fail(`live anlel ${liveAnlel.followUps.map((row) => `${row.guest}:${row.kind}`).join(",") || "none"}`);
if (liveAnlel.followUps[0]?.expiresAt !== "2026-10-12T00:15:54.000Z" || !/8:15/.test(liveAnlel.followUps[0]?.dueText || "")) fail(`live anlel countdown ${liveAnlel.followUps[0]?.expiresAt} ${liveAnlel.followUps[0]?.dueText}`);
const liveAnlelAgain = await loadGuestQueue(liveNow);
if (liveAnlelAgain.followUps.length !== 1 || liveAnlelAgain.followUps[0]?.expiresAt !== "2026-10-12T00:15:54.000Z") fail("anlel countdown dropped on revalidation");

resetGuestMessaging();
await clearHandledFollowUps();
installWorld({
  now: liveNow,
  properties: [{ id: "prop-live-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
  reservations: [{
    id: "stay-eloise-live",
    code: "HMJSMMMFSF",
    propertyId: "prop-live-charlotte",
    status: "accepted",
    checkIn: "2026-09-29",
    checkOut: "2026-11-07",
    guest: "Eloise",
    adults: 1,
    children: 0,
    messages: [
      { id: "el-live-3", at: "2026-10-10T15:25:34Z", role: "host", name: "Unknown", body: "Okay I’ll see what I can do for windows." },
      { id: "el-live-2", at: "2026-10-10T15:24:43Z", role: "guest", name: "Eloise", body: LIVE_AGREED },
      { id: "el-live-1", at: "2026-10-07T17:01:04Z", role: "host", name: "Unknown", body: LIVE_PROMISE },
      { id: "el-live-0", at: "2026-10-02T12:30:39Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
    ],
  }],
  inquiries: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const liveEloise = await loadGuestQueue(liveNow);
if (liveEloise.followUps.length !== 1 || liveEloise.followUps[0]?.kind !== "owe") fail(`live eloise ${liveEloise.followUps.map((row) => `${row.kind}:${row.topic}`).join(",") || "none"}`);
const liveWindows = liveEloise.followUps[0];
if (!/clean the windows/i.test(liveWindows?.promised || "") || !/on or after October 14/i.test(liveWindows?.promised || "")) fail(`live eloise promise ${liveWindows?.promised}`);
if (!/On or after 14th is fine/.test(liveWindows?.agreed || "")) fail(`live eloise agreed ${liveWindows?.agreed}`);
if (liveWindows?.due !== "2026-10-14" || !liveWindows.onOrAfter) fail(`live eloise due ${liveWindows?.due} ${liveWindows?.onOrAfter}`);
const liveEloiseAgain = await loadGuestQueue(liveNow);
if (liveEloiseAgain.followUps.length !== 1 || !/On or after 14th is fine/.test(liveEloiseAgain.followUps[0]?.agreed || "")) fail("eloise quotes dropped on revalidation");

resetGuestMessaging();
await clearHandledFollowUps();
installWorld({
  now: liveNow,
  properties: [{ id: "prop-live-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
  reservations: [{
    id: "stay-suitcase-live",
    code: "HMJSMMMFSF",
    propertyId: "prop-live-charlotte",
    status: "accepted",
    checkIn: "2026-09-29",
    checkOut: "2026-11-07",
    guest: "Eloise",
    adults: 1,
    children: 0,
    messages: [
      { id: "bag-live", at: "2026-10-01T17:40:49Z", role: "host", name: "Unknown", body: LIVE_SUITCASE },
    ],
  }],
  inquiries: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const liveBag = await loadGuestQueue(liveNow);
if (liveBag.followUps.length !== 1 || liveBag.followUps[0]?.kind !== "incident") fail(`live suitcase ${liveBag.followUps.map((row) => `${row.kind}:${row.line}`).join(",") || "none"}`);
if (!/no confirmation yet/i.test(liveBag.followUps[0]?.line || "")) fail(`live suitcase line ${liveBag.followUps[0]?.line}`);
const liveBagAgain = await loadGuestQueue(liveNow);
if (liveBagAgain.followUps.length !== 1 || liveBagAgain.followUps[0]?.kind !== "incident") fail("suitcase dropped on revalidation");

resetGuestMessaging();
await clearHandledFollowUps();
const threadNow = new Date("2026-10-11T21:00:00Z");
installWorld({
  now: threadNow,
  properties: [{ id: "prop-thread", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true }],
  reservations: [{
    id: "stay-maya-thread",
    code: "HMMAYA1",
    propertyId: "prop-thread",
    status: "accepted",
    checkIn: "2026-10-14",
    checkOut: "2026-10-17",
    guest: "Maya Chen",
    adults: 2,
    children: 0,
    hostName: "Jordan Hale",
    messages: [
      { id: "maya-4", at: "2026-10-11T20:00:00Z", role: "guest", name: "Maya Chen", body: "Can we leave a bag on Oct 14? The locker is $50." },
      { id: "maya-3", at: "2026-10-11T18:00:00Z", role: "host", name: "Unknown", body: "Yes, the side door is fine." },
      { id: "maya-2", at: "2026-10-10T15:00:00Z", role: "host", name: "Jordan Hale", body: "Welcome, Maya. Check-in is from 4 PM." },
      { id: "maya-1", at: "2026-10-09T12:00:00Z", role: "system", name: "Airbnb", body: "Reservation confirmed: Maya Chen, Wed Oct 14 to Sat Oct 17." },
    ],
  }],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const threadQueue = await loadGuestQueue(threadNow);
const maya = threadQueue.waiting.find((row) => row.guest === "Maya Chen");
if (!maya) fail("maya was not waiting");
const mayaView = await openGuestAnswer(maya, threadNow);
const mayaOrder = mayaView.thread.map((row) => `${row.role}:${row.who}:${row.text}`).join("\n");
if (mayaView.thread.some((row) => /unknown/i.test(row.who))) fail(`unknown sender\n${mayaOrder}`);
if (mayaView.thread[0]?.who !== "Automated message" || mayaView.thread[0]?.role !== "automated") fail(`oldest is not the automated message\n${mayaOrder}`);
if (!mayaView.thread.some((row) => row.role === "guest" && row.who === "Maya Chen")) fail(`guest name\n${mayaOrder}`);
if (!mayaView.thread.filter((row) => row.role === "host").every((row) => row.who === "Jordan Hale")) fail(`co-host name\n${mayaOrder}`);
const mayaTimes = mayaView.thread.map((row) => row.at);
if (mayaTimes.join(",") !== [...mayaTimes].sort().join(",")) fail(`thread is not oldest-first\n${mayaOrder}`);
if (!/Oct 14/.test(mayaView.thread[mayaView.thread.length - 1]?.text || "")) fail("newest message is not last");
const rough = "pls confirm the bag drop on Oct 14 for $50";
const commitsBeforeImprove = capturedCommits().length;
const improved = improveGuestDraft(rough, "Maya");
if (improved === rough || !/please/i.test(improved)) fail(`wording did not change: ${improved}`);
if (!improved.includes("Oct 14") || !improved.includes("$50")) fail(`facts changed: ${improved}`);
if (capturedCommits().length !== commitsBeforeImprove) fail("improve sent a message");
// Improve with AI rewrites what the partner typed, keeping every fact; a rewrite that loses one is not used.
const typed = "Hey Husson quick reminder if you plan on driving a vehicle to send us the make, model, and plate number so we can get you in the system. Thanks!";
setImproveModel(async (input) => (input.guest === "Husson" ? "Hi Husson, a quick reminder: if you're planning to drive, please send us your vehicle's make, model and licence plate number so we can register it with the building. Thanks!" : ""));
const polishedAi = await improveGuestMessage(typed, "Husson Ali", "20 Blue Jays Way Unit 318");
if (!/^Hi Husson, a quick reminder: if you're planning to drive/.test(polishedAi)) fail(`ai improve: ${polishedAi}`);
const withFacts = "pls confirm the bag drop on Oct 14 for $50";
setImproveModel(async () => "Hi Maya, could you please confirm the bag drop for Oct 14?");
const lost = await improveGuestMessage(withFacts, "Maya");
if (!lost.includes("$50") || !lost.includes("Oct 14")) fail(`a rewrite that dropped $50 was used: ${lost}`);
setImproveModel(async () => "Hi Maya, could you please confirm the bag drop on Oct 14 for $50?");
if (await improveGuestMessage(withFacts, "Maya") !== "Hi Maya, could you please confirm the bag drop on Oct 14 for $50?") fail("a rewrite that kept every fact was not used");
setImproveModel(null);
if (capturedCommits().length !== commitsBeforeImprove) fail("improve sent a message");
const sentBody = "The locker on Oct 14 is $50. I'll leave the side door unlatched.";
const sent = await submitGuestReply({
  reservationId: "stay-maya-thread",
  propertyId: "prop-thread",
  property: "1065 Shaw Street",
  guest: "Maya Chen",
  english: sentBody,
  language: "",
  fact: "",
});
if (!sent.sent) fail(`send did not read back: ${sent.reason}`);
const afterSend = await openGuestAnswer(maya, new Date());
if (!afterSend.thread.some((row) => row.text === sentBody)) fail("sent message is not on the thread");
if (!capturedCommits().some((row) => row.detail === "send-reservation-message")) fail("send did not use the commit path");

resetGuestMessaging();
await clearHandledFollowUps();
const pairNow = new Date("2026-10-11T23:00:00.000Z");
installWorld({
  now: pairNow,
  properties: [
    { id: "prop-pair-jays", name: "20 Blue Jays Way", address: "318, 20 Blue Jays Way, Toronto", managed: true },
    { id: "prop-pair-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true },
  ],
  reservations: [
    {
      id: "stay-pair-anlel",
      code: "HM5AN2HEB9",
      propertyId: "prop-pair-jays",
      status: "pending payment",
      checkIn: "2026-11-20",
      checkOut: "2026-11-23",
      guest: "Anlel",
      adults: 4,
      children: 0,
      messages: [],
      bookingDate: "2026-10-11T02:48:56Z",
      statusHistory: [{ status: "pending", category: "Pending", changed_at: "2026-10-11T00:15:54+00:00" }],
    },
    {
      id: "stay-pair-eloise",
      code: "HMJSMMMFSF",
      propertyId: "prop-pair-charlotte",
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Eloise",
      adults: 1,
      children: 0,
      messages: [
        { id: "pair-3", at: "2026-10-10T15:24:43Z", role: "guest", name: "Eloise", body: AGREED },
        { id: "pair-2", at: "2026-10-07T17:01:04Z", role: "host", name: "Jordan Hale", body: WINDOWS },
        { id: "pair-1", at: "2026-10-02T12:30:39Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
      ],
    },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
});
const paired = await loadGuestQueue(pairNow);
const pairedOwe = paired.followUps.find((row) => row.guest === "Eloise" && row.kind === "owe");
const pairedInquiry = paired.followUps.find((row) => row.guest === "Anlel" && row.kind === "inquiry");
if (!pairedOwe || !pairedInquiry) fail(`pair ${paired.followUps.map((row) => `${row.guest}:${row.kind}:${row.tag}`).join(",") || "none"}`);
if (pairedOwe.tag) fail(`commitment labelled ${pairedOwe.tag}`);
if (pairedInquiry.tag !== "INQUIRY") fail(`inquiry tag ${pairedInquiry.tag}`);
if (paired.followUps.some((row) => row.tag === "WE OWE" || row.tag === "INCIDENT")) fail("retired follow-up label");

// Nobody is owed a reply tonight: the list still shows every thread the queue read.
const onlyThanks = guestQueueRows({ waiting: [], held: [], onGuest: queue.thanks, thanks: [] });
if (onlyThanks.length !== 1 || onlyThanks[0]?.guest !== "Tom Becker") fail("the list was empty with a thread on the queue");

// Side by side with the Airbnb inbox: every conversation on the selected property, newest activity first.
{
  const SHAW_ID = "prop-shaw-inbox";
  const at = (iso: string, role: "guest" | "host", name: string, body: string, id: string) => ({ id, at: iso, role, name, body });
  const conv = (id: string, guest: string, checkIn: string, checkOut: string, status: string, messages: ReturnType<typeof at>[], extra: Record<string, unknown> = {}) => ({
    id, code: `HM${id.replace(/[^A-Z0-9]/gi, "").slice(-8).toUpperCase()}`, propertyId: SHAW_ID, status, checkIn, checkOut, guest, adults: 2, children: 0, messages, ...extra,
  });
  const filler = Array.from({ length: 125 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const month = String((Math.floor(index / 28) % 9) + 1).padStart(2, "0");
    return conv(`stay-past-${index}`, `Past${index}`, `2025-${month}-${day}`, `2025-${month}-${day}`, "accepted", [
      at(`2025-${month}-${day}T${String(10 + (index % 9)).padStart(2, "0")}:00:00Z`, "guest", `Past${index}`, "Thanks for the stay!", `past-${index}`),
    ]);
  });
  const reservations = [
    conv("stay-michael", "Michael & Adele", "2026-10-06", "2026-10-12", "accepted", [
      at("2026-10-06T20:00:00Z", "host", "Sam", "Welcome to 1065 Shaw Street! Let us know if you need anything.", "m1"),
      at("2026-10-12T13:20:20Z", "guest", "Michael", "Thanks! We're fine", "m2"),
    ], { lastMessageAt: "2026-10-12T13:20:20Z" }),
    conv("stay-eloise-inbox", "Eloise", "2026-10-03", "2026-10-10", "accepted", eloiseTurns.map((turn, index) => at(turn.at, turn.role as "guest" | "host", turn.name, turn.body, `e${index}`))),
    conv("stay-august", "August", "2026-08-01", "2026-08-05", "accepted", [
      at("2026-08-06T14:00:00Z", "host", "Sam", "Thanks for staying with us!", "a1"),
    ]),
    conv("stay-cancelled", "Casey", "2026-11-02", "2026-11-04", "cancelled", [
      at("2026-09-20T12:00:00Z", "guest", "Casey", "Sorry, we have to cancel.", "c1"),
    ]),
    conv("stay-future", "Farah", "2026-12-01", "2026-12-05", "accepted", [], { bookedAt: "2026-09-30T12:00:00Z" }),
    ...filler,
  ];
  resetGuestMessaging();
  installWorld({
    now: new Date("2026-10-12T14:00:00Z"),
    properties: [{ id: SHAW_ID, name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true }],
    reservations,
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  const inbox = await loadGuestQueue(new Date("2026-10-12T14:00:00Z"));
  const listed = guestQueueRows(inbox).map((row) => row.id);
  const activity = (row: (typeof reservations)[number]) => String((row as { lastMessageAt?: string }).lastMessageAt || row.messages.map((message) => message.at).sort().at(-1) || (row as { bookedAt?: string }).bookedAt || row.checkIn);
  const airbnb = reservations.slice().sort((a, b) => activity(b).localeCompare(activity(a)) || a.id.localeCompare(b.id)).map((row) => row.id);
  if (inbox.failed.length) fail(`inbox read failed: ${inbox.failed.join(" | ")}`);
  if (listed[0] !== "stay-michael") fail(`Michael & Adele's thread is not first: ${listed.slice(0, 3).join(", ")}`);
  for (const id of airbnb) if (!listed.includes(id)) fail(`conversation ${id} is missing from the queue`);
  if (listed.length !== airbnb.length) fail(`queue lists ${listed.length} conversations, the inbox has ${airbnb.length}`);
  if (listed.join(",") !== airbnb.join(",")) fail(`queue order differs from the inbox at ${listed.findIndex((id, index) => id !== airbnb[index])}`);
  const michael = guestQueueRows(inbox).find((row) => row.id === "stay-michael");
  if (michael?.preview !== "Thanks! We're fine") fail(`Michael's latest message ${michael?.preview}`);
  if (!(inbox.followUps ?? []).some((row) => row.reservationId === "stay-eloise-inbox" && /Window cleaning/i.test(row.line))) fail("Eloise's window cleaning is missing from Follow-ups");

  installWorld({
    now: new Date("2026-10-12T14:00:00Z"),
    properties: [{ id: SHAW_ID, name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true, reservationsError: "Hospitable timed out." }],
    reservations,
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  resetGuestMessaging();
  const down = await loadGuestQueue(new Date("2026-10-12T14:00:00Z"));
  if (down.failed.length !== 1 || !/Couldn't read the conversations for 1065 Shaw Street/.test(down.failed[0] ?? "")) fail(`a failed read did not say so in one line: ${down.failed.join(" | ") || "no failure line"}`);
}

// A promise dated after checkout stays open until its date, then closes.
for (const [when, open] of [["2026-10-12T12:00:00-04:00", true], ["2026-10-14T12:00:00-04:00", true], ["2026-10-15T12:00:00-04:00", false]] as const) {
  const read = detectFollowUps({
    reservationId: "stay-eloise-ended",
    guest: "Eloise",
    property: "8 Charlotte 606",
    propertyId: "prop-fu",
    checkIn: "2026-10-03",
    checkOut: "2026-10-10",
    turns: eloiseTurns,
  }, new Date(when));
  const windowsOpen = read.open.some((row) => /Window cleaning/i.test(row.line));
  if (windowsOpen !== open) fail(`Eloise's window cleaning on ${when.slice(0, 10)} after a stay that ended Oct 10: ${windowsOpen ? "open" : "closed"}`);
}

// A host note about towels at the building is logistics, never an incident.
const thomasTurns = [
  { at: "2026-09-25T16:53:00Z", role: "host", name: "Sam", body: "Hi Thomas, building security reported a package of fresh towels for you. It's at the building front desk." },
];
for (const when of ["2026-09-26T12:00:00-04:00", "2026-10-12T12:00:00-04:00"]) {
  const read = detectFollowUps({ reservationId: "stay-thomas", guest: "Thomas", property: "1065 Shaw Street", propertyId: "prop-fu", checkIn: "2026-09-22", checkOut: "2026-09-27", turns: thomasTurns }, new Date(when));
  if (read.open.some((row) => row.kind === "incident")) fail(`a towels note opened an incident on ${when.slice(0, 10)}: ${read.open.map((row) => row.line).join(" | ")}`);
}
// A guest told to pick up their suitcase still opens one.
const pickUp = detectFollowUps({
  reservationId: "stay-left", guest: "Priya", property: "20 Blue Jays Way Unit 318", propertyId: "prop-fu", checkIn: "2026-10-09", checkOut: "2026-10-12",
  turns: [{ at: "2026-10-12T17:00:00Z", role: "host", name: "Jordan", body: "You left your suitcase in the bedroom closet. Please pick it up from the front desk right away." }],
}, new Date("2026-10-12T14:00:00-04:00"));
if (!pickUp.open.some((row) => row.kind === "incident" && /suitcase/i.test(`${row.topic} ${row.line}`))) fail(`the suitcase pickup did not open an incident: ${pickUp.open.map((row) => row.line).join(" | ") || "none"}`);

// An incident saved last time does not come back for an ended stay whose thread went quiet.
{
  const SHAW = "prop-shaw-thomas";
  const base = (id: string, guest: string, checkIn: string, checkOut: string, messages: { id: string; at: string; role: "guest" | "host"; name: string; body: string }[]) => ({
    id, code: `HM${id.slice(-6).toUpperCase()}`, propertyId: SHAW, status: "accepted", checkIn, checkOut, guest, adults: 2, children: 0, messages,
  });
  installWorld({
    now: new Date("2026-10-12T16:00:00Z"),
    properties: [{ id: SHAW, name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true }],
    reservations: [
      base("stay-thomas", "Thomas", "2026-09-22", "2026-09-27", thomasTurns.map((turn, index) => ({ id: `t${index}`, at: turn.at, role: "host" as const, name: turn.name, body: turn.body }))),
      base("stay-oldtom", "Tomas", "2026-07-20", "2026-08-01", [{ id: "o1", at: "2026-07-30T16:53:00Z", role: "host", name: "Sam", body: "Towels are at the front desk." }]),
    ],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  resetGuestMessaging();
  const template = readBag.open.find((row) => row.kind === "incident");
  if (!template) fail("no incident template");
  const stale = [
    { ...template, id: "incident:stay-thomas:towels", reservationId: "stay-thomas", guest: "Thomas", property: "1065 Shaw Street", checkIn: "2026-09-22", checkOut: "2026-09-27", line: "Towels at building · sent 12:53 PM, no confirmation yet" },
    { ...template, id: "incident:stay-oldtom:towels", reservationId: "stay-oldtom", guest: "Tomas", property: "1065 Shaw Street", checkIn: "2026-07-20", checkOut: "2026-08-01", line: "Towels at building · sent 12:53 PM, no confirmation yet" },
  ];
  await saveGuestQueueSnapshot({ ...queue, followUps: stale });
  await readSavedGuestQueue();
  const after = await loadGuestQueue(new Date("2026-10-12T16:00:00Z"));
  const left = (after.followUps ?? []).filter((row) => /towels/i.test(row.line));
  if (left.length) fail(`an ended stay's towels incident is still open: ${left.map((row) => `${row.guest} ${row.line}`).join(" | ")}`);
}

// Watermarks: a second load reads no thread whose activity did not change, and one new message re-reads one thread.
{
  const SHAW = "prop-shaw-marks";
  const conv = (id: string, at: string, rateLimitOnce = false) => ({
    id, code: `HM${id.slice(-6).toUpperCase()}`, propertyId: SHAW, status: "accepted", checkIn: "2026-10-10", checkOut: "2026-10-14", guest: id, adults: 2, children: 0, rateLimitOnce,
    messages: [{ id: `${id}-1`, at, role: "guest" as const, name: id, body: "Is parking included?" }],
  });
  installWorld({
    now: new Date("2026-10-12T16:00:00Z"),
    properties: [{ id: SHAW, name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true }],
    reservations: [conv("stay-mark-a", "2026-10-12T10:00:00Z", true), conv("stay-mark-b", "2026-10-12T11:00:00Z"), conv("stay-mark-c", "2026-10-12T12:00:00Z")],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  resetGuestMessaging();
  const first = await loadGuestQueue(new Date("2026-10-12T16:00:00Z"));
  if (first.failed.length) fail(`a rate-limited read failed the queue instead of retrying: ${first.failed.join(" | ")}`);
  if (guestQueueRows(first).find((row) => row.id === "stay-mark-a")?.preview !== "Is parking included?") fail("the retried thread is missing its latest message");
  const afterFirst = parityThreadReads();
  await loadGuestQueue(new Date("2026-10-12T16:05:00Z"));
  if (parityThreadReads() !== afterFirst) fail(`a load with no new activity re-read ${parityThreadReads() - afterFirst} threads`);
  pushParityMessage("stay-mark-b", { id: "stay-mark-b-2", at: "2026-10-12T16:06:00Z", role: "guest", name: "stay-mark-b", body: "Also, is there a crib?" });
  const third = await loadGuestQueue(new Date("2026-10-12T16:10:00Z"));
  if (parityThreadReads() !== afterFirst + 1) fail(`one new message re-read ${parityThreadReads() - afterFirst} threads`);
  if (guestQueueRows(third)[0]?.id !== "stay-mark-b" || guestQueueRows(third)[0]?.preview !== "Also, is there a crib?") fail("the new message did not reach the list");
}

// Item 6. A promise that comes due asks the partner, with the draft ready, and never disappears on its own.
{
  const eloiseWorld = (now: Date, unreadable = false) => installWorld({
    now,
    properties: [{ id: "prop-live-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
    reservations: [{
      id: "stay-eloise-due",
      code: "HMJSMMMFSF",
      propertyId: "prop-live-charlotte",
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Eloise",
      adults: 1,
      children: 0,
      ...(unreadable ? { threadUnreadable: true } : {}),
      messages: [
        { id: "due-0", at: "2026-10-02T12:30:39Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
        { id: "due-1", at: "2026-10-07T17:01:04Z", role: "host", name: "Unknown", body: LIVE_PROMISE },
        { id: "due-2", at: "2026-10-10T15:24:43Z", role: "guest", name: "Eloise", body: LIVE_AGREED },
        { id: "due-3", at: "2026-10-10T15:25:34Z", role: "host", name: "Unknown", body: "Okay I’ll see what I can do for windows." },
      ],
    }],
    inquiries: [],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  const questions = (id: string) => parityChecksMessages().filter((message) => message.draft?.followUp?.id === id);
  resetGuestMessaging();
  await clearHandledFollowUps();
  resetParityChecksMessages();
  resetCaptures();

  // Oct 13: the agreed window opens tomorrow.
  const oct13 = new Date("2026-10-13T15:00:00Z");
  eloiseWorld(oct13);
  await runUnattendedChecks(oct13);
  const queue13 = await loadGuestQueue(oct13);
  const windowsDue = queue13.followUps.find((row) => row.guest === "Eloise" && row.kind === "owe");
  if (!windowsDue || windowsDue.due !== "2026-10-14") fail(`due windows ${windowsDue?.due}`);
  const asked = questions(windowsDue.id);
  if (asked.length !== 1 || asked[0]?.draft?.status !== "waiting") fail(`due question count ${asked.length}`);
  const question = asked[0];
  const lead = question?.body ?? "";
  if (!/on or after October 14th/.test(lead) || !/On or after 14th is fine/.test(lead)) fail(`question quotes ${lead}`);
  if (!/What was promised/.test(lead) || !/What Eloise agreed/.test(lead) || !/Why now: .*tomorrow/.test(lead)) fail(`question shape ${lead}`);
  if (!/Already handled/.test(lead) || !/Nothing has been sent/.test(lead)) fail(`question close ${lead}`);
  const draftText = question?.draft?.body ?? "";
  if (!draftText.includes("[day and time]") || !BLANK.test(draftText) || !/^Hi Eloise/.test(draftText)) fail(`question draft ${draftText}`);
  if (question?.draft?.hospitable?.args.reservation_id !== "stay-eloise-due") fail("the draft does not answer Eloise's reservation");
  if (capturedCommits().length) fail(`the checks sent ${capturedCommits().map((row) => row.detail).join(" ")}`);
  const brief13 = await buildBrief(oct13);
  const card13 = [...brief13.focus, ...brief13.eating].find((card) => card.followUpId === windowsDue.id);
  if (!card13 || !card13.actions?.includes("Already handled") || !/tomorrow/i.test(card13.headline ?? "")) fail(`overview card ${card13?.headline}`);
  if (questions(windowsDue.id).length !== 1) fail("Overview repeated the question");

  // A fresh server instance that cannot read the thread still shows the stored follow-up.
  forgetGuestProcessMemory();
  eloiseWorld(oct13, true);
  const unreadQueue = await loadGuestQueue(oct13);
  if (!unreadQueue.followUps.some((row) => row.id === windowsDue.id)) fail("a stored follow-up disappeared when its thread was not read");

  // Oct 14, unresolved: it is still there, once.
  const oct14 = new Date("2026-10-14T15:00:00Z");
  eloiseWorld(oct14);
  const brief14 = await buildBrief(oct14);
  if (questions(windowsDue.id).filter((message) => message.draft?.status === "waiting").length !== 1) fail(`next day questions ${questions(windowsDue.id).length}`);
  if (![...brief14.focus, ...brief14.eating].some((card) => card.followUpId === windowsDue.id)) fail("the question left Overview the next day");
  const queue14 = await loadGuestQueue(oct14);
  if (!queue14.followUps.some((row) => row.id === windowsDue.id)) fail("the follow-up left Guest messaging the next day");

  // A partner closes it: gone from Checks, Overview, and Guest messaging, and not raised again.
  await closeFollowUpEverywhere(windowsDue.id);
  if (questions(windowsDue.id).some((message) => message.draft?.status === "waiting")) fail("the question stayed open after Already handled");
  const brief14b = await buildBrief(oct14);
  if ([...brief14b.focus, ...brief14b.eating].some((card) => card.followUpId === windowsDue.id)) fail("Overview kept a handled follow-up");
  const queue14b = await loadGuestQueue(oct14);
  if (queue14b.followUps.some((row) => row.id === windowsDue.id)) fail("Guest messaging kept a handled follow-up");
  const oct15 = new Date("2026-10-15T15:00:00Z");
  eloiseWorld(oct15);
  await runUnattendedChecks(oct15);
  if (questions(windowsDue.id).some((message) => message.draft?.status === "waiting")) fail("a handled follow-up was asked again");
  if (capturedCommits().length) fail(`the checks sent ${capturedCommits().map((row) => row.detail).join(" ")}`);
  await clearHandledFollowUps();
  resetParityChecksMessages();
}

// Inbox filters: Needs reply is the waiting set the sidebar counts; property, stay and search narrow it.
{
  const row = (id: string, propertyId: string, property: string, checkIn: string, checkOut: string, preview: string, activityAt: string, extra: Partial<GuestRow> = {}): GuestRow => ({
    id, guest: id[0]!.toUpperCase() + id.slice(1), first: id, initials: id.slice(0, 1).toUpperCase(), guestPhoto: "", property, propertyId, propertyPhoto: "",
    asked: "", askedEn: "", language: "", wait: "", waitedMs: 0, thanks: false, lane: "reply", status: "", statusLead: "", statusRest: "", watch: "", when: "",
    urgent: false, dates: "", checkIn, checkOut, mediaLabel: "", lastNote: "", activityAt, preview, ...extra,
  });
  const imani = row("imani", "p318", "20 Blue Jays Way Unit 318", "2026-10-12", "2026-10-17", "What’s the wifi password again?", "2026-10-13T18:31:00Z");
  const diane = row("diane", "pros", "41 Roseglor Cres", "2026-10-11", "2026-10-15", "The smoke detector keeps chirping.", "2026-10-13T18:18:00Z");
  const jules = row("jules", "pros", "41 Roseglor Cres", "2026-10-16", "2026-10-19", "Is parking included?", "2026-10-12T20:12:00Z", { inquiry: true });
  const michael = row("michael", "p606", "8 Charlotte 606", "2026-10-24", "2026-10-31", "You’re all set for the 24th.", "2026-10-13T16:30:00Z", { lastBy: "Sam" });
  const lee = row("lee", "pshaw", "1065 Shaw Street", "2026-09-25", "2026-10-01", "Safe travels.", "2026-10-02T12:15:00Z");
  const queue = {
    connected: true, line: "", summaryLead: "", summaryRest: "", answer: "", failed: [], closedFollowUps: [],
    waiting: [imani, diane, jules], onGuest: [michael], held: [], thanks: [], quiet: [lee],
    properties: [{ id: "p318", label: "20 Blue Jays Way Unit 318", failed: false }, { id: "pros", label: "41 Roseglor Cres", failed: false }, { id: "p606", label: "8 Charlotte 606", failed: false }, { id: "pshaw", label: "1065 Shaw Street", failed: false }],
    followUps: [{ ...(fuQueue.followUps[0] as GuestFollowUp), id: "fu-diane", reservationId: "diane", guest: "Diane", propertyId: "pros", property: "41 Roseglor Cres", checkIn: "2026-10-11", checkOut: "2026-10-15", line: "Battery promised" }],
  } as GuestQueue;
  const today = "2026-10-13";
  const all = filterInbox(queue, NO_GUEST_FILTERS, today);
  if (all.rows.map((item) => item.id).join(",") !== "imani,diane,michael,jules,lee") fail(`inbox order ${all.rows.map((item) => item.id).join(",")}`);
  if (all.counts.all !== 5 || all.counts.needs !== 3 || all.counts.fu !== 1 || all.counts.inq !== 1) fail(`chip counts ${JSON.stringify(all.counts)}`);
  if (all.counts.needs !== queue.waiting.length) fail("Needs reply does not match the sidebar count");
  if (all.needs.has("michael") || !all.needs.has("imani")) fail("answered and waiting rows are not told apart");
  const needsRos = filterInbox(queue, { ...NO_GUEST_FILTERS, status: "needs", property: "pros" }, today);
  if (needsRos.rows.map((item) => item.id).join(",") !== "diane,jules" || needsRos.followUps.length) fail(`needs at Roseglor ${needsRos.rows.map((item) => item.id).join(",")}`);
  if (needsRos.propertyCounts.get("p318") !== 1 || needsRos.propertyCounts.get("all") !== 3) fail("property counts do not follow the status chip");
  const now = filterInbox(queue, { ...NO_GUEST_FILTERS, stay: "now" }, today);
  if (now.rows.map((item) => item.id).join(",") !== "imani,diane") fail(`staying now ${now.rows.map((item) => item.id).join(",")}`);
  if (stayPhase("2026-10-16", "2026-10-19", today) !== "upcoming" || stayPhase("2026-09-25", "2026-10-13", today) !== "past") fail("stay phases");
  const fuOnly = filterInbox(queue, { ...NO_GUEST_FILTERS, status: "fu" }, today);
  if (fuOnly.rows.length || fuOnly.followUps.length !== 1) fail("the Follow-ups chip did not show only that group");
  const searched = filterInbox(queue, { ...NO_GUEST_FILTERS, q: "smoke" }, today);
  if (searched.rows.map((item) => item.id).join(",") !== "diane") fail("search");
  const empty = filterInbox(queue, { ...NO_GUEST_FILTERS, status: "needs", property: "pshaw" }, today);
  if (empty.rows.length || emptyInboxLine({ ...NO_GUEST_FILTERS, status: "needs", property: "pshaw" }, "1065 Shaw Street") !== "No conversations need a reply at 1065 Shaw Street.") fail("empty line");
  if (waitedFor("2026-10-13T18:22:00Z", Date.parse("2026-10-13T18:31:00Z")) !== "9m" || waitedFor("2026-10-12T18:00:00Z", Date.parse("2026-10-13T19:00:00Z")) !== "1d") fail("wait labels");
}

// Needs reply is judged from the whole thread state. Shaped like the live Oct 13 inbox.
{
  resetGuestMessaging();
  await clearHandledFollowUps();
  const now = new Date("2026-10-13T15:46:00Z");
  const HUB = [
    "Building Access:",
    "If entry fails, press the intercom button at the gate, call concierge, and state you are staying at unit 318.",
    "Extra Towels & Supplies:",
    "Extra towels are in the hallway closet, top shelf.",
    "Parking:",
    "Parking is in the underground garage, spot P2 #14. The garage door opens with the grey fob on your key ring.",
  ].join("\n");
  const BJ = { id: "prop-bj", name: "20 Blue Jays Way Unit 318", address: "20 Blue Jays Way, Toronto", managed: true };
  const SHAW = { id: "prop-shaw-nr", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true };
  const ROSE = { id: "prop-rose-nr", name: "41 Roseglor Cres", address: "41 Roseglor Crescent, Toronto", managed: true };
  const turn = (id: string, at: string, role: "guest" | "host", name: string, body: string) => ({ id, at, role, name, body });
  installWorld({
    now,
    properties: [BJ, SHAW, ROSE],
    reservations: [
      {
        id: "stay-yingjia", code: "HMYJ01", propertyId: BJ.id, status: "cancelled", checkIn: "2026-10-06", checkOut: "2026-10-09", guest: "盈佳", adults: 2, children: 0,
        messages: [
          turn("yj-0", "2026-09-28T15:00:00Z", "host", "Shane Mosoff", "Thanks for booking! We’re excited to host you — Mandel Realty Group"),
          turn("yj-1", "2026-09-30T17:40:00Z", "host", "Shane Mosoff", "Hey may I ask why you cancelled anything we can do?"),
          turn("yj-2", "2026-09-30T19:44:00Z", "guest", "盈佳", "Hi, I’m really sorry, but we need to cancel our stay because our travel plans have changed. Apologies for any inconvenience, and thank you for your understanding."),
        ],
      },
      {
        id: "stay-emile-old", code: "HMEM01", propertyId: SHAW.id, status: "cancelled", checkIn: "2026-10-02", checkOut: "2026-10-04", guest: "Emile", guestEmail: "emile@example.com", adults: 1, children: 0, bookedAt: "2026-09-10T12:00:00Z",
        messages: [
          turn("em-0", "2026-09-19T04:54:00Z", "host", "Shane Mosoff", "Hey there, may I now why you cancelled? Anything we can do?"),
          turn("em-1", "2026-09-19T14:15:00Z", "guest", "Emile", "Hey Ryan! Sorry about the false start. Still working out whether it will be a group or just me that weekend. I may rebook if the place is still available once I hear from my friends. Have a great weekend!"),
          turn("em-2", "2026-09-19T14:37:00Z", "guest", "Emile", "Update, just got confirmation so I’ll be rebooking!"),
          turn("em-3", "2026-09-19T14:38:00Z", "guest", "Emile", "+ adding an extra night!"),
        ],
      },
      {
        id: "stay-emile-new", code: "HMEM02", propertyId: SHAW.id, status: "accepted", checkIn: "2026-10-16", checkOut: "2026-10-19", guest: "Emile", guestEmail: "emile@example.com", adults: 3, children: 0, bookedAt: "2026-09-19T15:00:00Z",
        messages: [
          turn("en-0", "2026-10-13T13:00:00Z", "guest", "Emile", "Hi! Where do we park when we arrive on Friday?"),
        ],
      },
      {
        id: "stay-imani-nr", code: "HMIM01", propertyId: BJ.id, status: "accepted", checkIn: "2026-10-12", checkOut: "2026-10-17", guest: "Imani", adults: 2, children: 0,
        messages: [
          turn("im-0", "2026-10-12T20:00:00Z", "host", "Shane Mosoff", "Welcome! Let us know if you need anything."),
          turn("im-1", "2026-10-13T15:30:00Z", "guest", "Imani", "Hi! Could we get a few extra towels? We only found two in the bathroom."),
        ],
      },
    ],
    inquiries: [
      {
        id: "inq-elizabeth", propertyId: ROSE.id, status: "inquiry", guest: "Elizabeth", checkIn: "2026-11-20", checkOut: "2026-11-23", adults: 2, children: 0,
        messages: [
          turn("el-q", "2026-08-08T14:00:00Z", "guest", "Elizabeth", "Hi, is the place available for these dates and do you allow early check-in?"),
          turn("el-a", "2026-08-08T15:00:00Z", "host", "Ryan", "Hi Elizabeth, those dates are open and early check-in depends on the clean that morning."),
          turn("el-c", "2026-08-09T14:00:00Z", "guest", "Elizabeth", "Thanks Ryan for your speedy response! And no problem, perhaps another time."),
        ],
      },
      {
        id: "inq-ira", propertyId: SHAW.id, status: "inquiry", guest: "Ira", checkIn: "2026-09-25", checkOut: "2026-09-27", adults: 3, children: 0,
        messages: [
          turn("ira-0", "2026-08-25T14:00:00Z", "guest", "Ira", "Hi Ryan: As it turns out we ended up adding another person to our travel party, so could we fit a third guest?"),
        ],
      },
    ],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
    hub: [{ propertyId: BJ.id, body: HUB }, { propertyId: SHAW.id, body: HUB }],
  });
  const inbox = await loadGuestQueue(now);
  const waitingNames = inbox.waiting.map((row) => row.id).sort().join(",");
  if (waitingNames !== "stay-emile-new,stay-imani-nr") fail(`needs reply ${waitingNames}`);
  const quietRow = (id: string) => (inbox.quiet ?? []).find((row) => row.id === id);
  for (const id of ["stay-yingjia", "stay-emile-old", "inq-elizabeth", "inq-ira"]) {
    const row = quietRow(id);
    if (!row) fail(`${id} left the inbox`);
    if (row.wait || row.waitedMs) fail(`${id} shows a waiting time`);
    if (!row.quietReason) fail(`${id} has no reason`);
  }
  if (!/cancelled/.test(quietRow("stay-yingjia")?.quietReason ?? "")) fail(`yingjia reason ${quietRow("stay-yingjia")?.quietReason}`);
  if (!/newer booking/.test(quietRow("stay-emile-old")?.quietReason ?? "")) fail(`emile reason ${quietRow("stay-emile-old")?.quietReason}`);
  if (!/closed the inquiry/.test(quietRow("inq-elizabeth")?.quietReason ?? "")) fail(`elizabeth reason ${quietRow("inq-elizabeth")?.quietReason}`);
  if (!/have passed/.test(quietRow("inq-ira")?.quietReason ?? "")) fail(`ira reason ${quietRow("inq-ira")?.quietReason}`);

  const yingjia = await openGuestAnswer(quietRow("stay-yingjia") as GuestRow, now);
  if (yingjia.draft || yingjia.sendable || yingjia.lane !== "none") fail(`cancelled thread drafted ${yingjia.draft}`);
  if (/intercom|concierge/i.test(yingjia.draft)) fail("entry instructions for a cancelled stay");
  const emileOld = await openGuestAnswer(quietRow("stay-emile-old") as GuestRow, now);
  if (emileOld.draft || emileOld.lane !== "none") fail(`superseded thread drafted ${emileOld.draft}`);

  const imaniRow = inbox.waiting.find((row) => row.id === "stay-imani-nr") as GuestRow;
  if (!imaniRow.wait) fail("a live question shows no waiting time");
  const imani = await openGuestAnswer(imaniRow, now);
  if (imani.lane !== "reply" || !imani.sendable) fail(`live question has no draft (${imani.gap})`);
  if (!/hallway closet/i.test(imani.draft) || /Supplies:|:\s*\.?$/m.test(imani.draft)) fail(`towel draft ${JSON.stringify(imani.draft)}`);
  const emileNew = await openGuestAnswer(inbox.waiting.find((row) => row.id === "stay-emile-new") as GuestRow, now);
  if (emileNew.lane !== "reply" || !/P2 #14|garage/i.test(emileNew.draft)) fail(`rebooked thread draft ${JSON.stringify(emileNew.draft)}`);
  if (/Parking:/.test(emileNew.draft)) fail("the parking heading reached the draft");
}

// Chat answers about a follow-up come from its stored record and end with the next step while open.
{
  resetGuestMessaging();
  await clearHandledFollowUps();
  resetCaptures();
  const now = new Date("2026-10-13T16:03:00Z");
  const world = (resolved: boolean) => installWorld({
    now,
    properties: [{ id: "prop-charlotte-606", name: "8 Charlotte 606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
    reservations: [{
      id: "stay-eloise-chat",
      code: "HMJSMMMFSF",
      propertyId: "prop-charlotte-606",
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Eloise",
      adults: 1,
      children: 0,
      messages: [
        { id: "ec-0", at: "2026-10-02T12:30:39Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
        { id: "ec-1", at: "2026-10-07T17:01:04Z", role: "host", name: "Unknown", body: LIVE_PROMISE },
        { id: "ec-2", at: "2026-10-10T15:24:43Z", role: "guest", name: "Eloise", body: LIVE_AGREED },
        { id: "ec-3", at: "2026-10-10T15:25:34Z", role: "host", name: "Unknown", body: "Okay I’ll see what I can do for windows." },
        ...(resolved ? [
          { id: "ec-4", at: "2026-10-13T14:00:00Z", role: "host" as const, name: "Unknown", body: "The windows were cleaned this morning." },
          { id: "ec-5", at: "2026-10-13T15:00:00Z", role: "guest" as const, name: "Eloise", body: "They look great, thank you so much!" },
        ] : []),
      ],
    }],
    inquiries: [],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  world(false);
  await loadGuestQueue(now);
  const asked = await answerFollowUpTurn("Which stay had the window cleaning task?", "", now);
  const said = asked?.body ?? "";
  if (!said.includes("Eloise’s stay at 8 Charlotte 606, Sep 29 – Nov 7")) fail(`window answer stay ${said}`);
  if (/Blue Jays|October 1\b|Oct 1\b/.test(said)) fail(`window answer invented a stay ${said}`);
  if (!/Eloise asked on Oct 2/.test(said) || !/on or after October 14th/.test(said) || !/On or after 14th is fine/.test(said)) fail(`window answer record ${said}`);
  if (!said.trim().endsWith("Do you want me to draft the message to Eloise? Have you picked the day you want to set up the window cleaning?")) fail(`window answer ending ${said}`);
  if (asked?.draft) fail("the draft was made before the partner said yes");
  if (await answerFollowUpTurn("When is checkout at Charlotte?", "", now)) fail("a plain checkout question was taken as a follow-up");

  const yes = await answerFollowUpTurn("Yes", said, now);
  const draft = yes?.draft;
  if (!draft || draft.status !== "waiting" || draft.channel !== "hospitable" || !draft.followUp) fail("yes did not leave a draft for approval");
  if (!draft.body.includes("[day and time]") || !/^Hi Eloise/.test(draft.body)) fail(`draft ${draft.body}`);
  if (draft.hospitable?.args.reservation_id !== "stay-eloise-chat") fail("the draft is not on Eloise's reservation");
  if (!/Nothing has been sent/.test(yes?.body ?? "")) fail(`yes body ${yes?.body}`);
  const no = await answerFollowUpTurn("No", said, now);
  if (no?.draft || !/Nothing was drafted/.test(no?.body ?? "")) fail("no still drafted");
  if (capturedCommits().length) fail(`answering sent ${capturedCommits().map((row) => row.detail).join(" ")}`);

  // Once the thread shows it done, the same question gets the facts and no next-step question.
  world(true);
  const closedQueue = await loadGuestQueue(now);
  if (closedQueue.followUps.some((row) => row.reservationId === "stay-eloise-chat")) fail("the cleaned windows stayed open");
  const closedAnswer = await answerFollowUpTurn("Which stay had the window cleaning task?", "", now);
  const closedSaid = closedAnswer?.body ?? "";
  if (!closedSaid.includes("8 Charlotte 606") || !/It is closed/.test(closedSaid)) fail(`closed answer ${closedSaid}`);
  if (/Do you want me to draft|Have you picked|\?\s*$/.test(closedSaid)) fail(`closed answer asked a next step ${closedSaid}`);
}

// The Knowledge Hub learns what a partner answers once.
{
  resetGuestMessaging();
  await clearHandledFollowUps();
  resetCaptures();
  const now = new Date("2026-10-13T18:00:00Z");
  const UNIT = { id: "prop-hub-606", name: "8 Charlotte 606", address: "606, 8 Charlotte Street, Toronto", managed: true };
  const stay = (id: string, guest: string, ask: string, at: string) => ({
    id, code: id.toUpperCase(), propertyId: UNIT.id, status: "accepted", checkIn: "2026-10-12", checkOut: "2026-10-18", guest, adults: 2, children: 0,
    messages: [{ id: `${id}-q`, at, role: "guest" as const, name: guest, body: ask }],
  });
  const hubBody = "Extra towels are in the hallway closet, top shelf.\nThe Wi-Fi network is MRG-606.";
  const world = {
    now,
    properties: [UNIT],
    reservations: [
      stay("stay-rack-1", "Maya", "Hi! Where is the dish drying rack?", "2026-10-13T16:00:00Z"),
      stay("stay-coffee", "Tom", "Where is the coffee maker?", "2026-10-13T16:10:00Z"),
    ],
    inquiries: [],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
    hub: [{ propertyId: UNIT.id, body: hubBody, items: [] }],
  };
  installWorld(world as never);
  setParityClock(now);
  await loadGuestQueue(now);

  // (1) The Hub has no answer; the partner's reply teaches it.
  const rackRow = (await loadGuestQueue(now)).waiting.find((row) => row.id === "stay-rack-1") as GuestRow;
  if (!rackRow) fail("the dish rack question is not waiting");
  const rackView = await openGuestAnswer(rackRow, now);
  if (rackView.mode !== "gap" || rackView.draft) fail(`the Hub answered the dish rack already: ${rackView.draft}`);
  const sent = await submitGuestReply({ reservationId: rackRow.id, propertyId: UNIT.id, property: UNIT.name, guest: "Maya", english: "It's in the cabinet under the sink.", language: "", fact: "" });
  if (!sent.sent) fail(`the reply did not send: ${sent.reason}`);
  const offers = sent.hubOffers ?? [];
  if (offers.length !== 1) fail(`hub offers ${JSON.stringify(offers)}`);
  const offer = offers[0]!;
  if (offer.title !== "Dish drying rack" || offer.content !== "The dish drying rack is in the cabinet under the sink.") fail(`offer ${offer.title} / ${offer.content}`);
  if (/maya|oct|2026/i.test(`${offer.title} ${offer.content}`) || offer.itemId) fail(`offer carries the guest, a date, or an update: ${JSON.stringify(offer)}`);
  if (capturedCommits().some((row) => /knowledge-hub/.test(row.detail))) fail("the Hub was written before approval");
  const saved = await saveHubEntry({ propertyId: offer.propertyId, property: offer.property, title: offer.title, content: offer.content });
  if (!saved.saved || saved.line !== "Saved to the 8 Charlotte 606 Knowledge Hub as “Dish drying rack”.") fail(`save ${saved.line}`);
  const items = parityHubItems(UNIT.id);
  if (items.length !== 1 || items[0]?.content !== "The dish drying rack is in the cabinet under the sink.") fail(`hub after save ${JSON.stringify(items)}`);
  if (!capturedCommits().some((row) => row.detail === "create-knowledge-hub-item")) fail("create was not the path for a new topic");

  // The same question from the next guest is drafted from the new item, and teaches nothing new.
  world.reservations.push(stay("stay-rack-2", "Ben", "Where is the dish drying rack?", "2026-10-13T17:30:00Z"));
  installWorld({ ...world, hub: [{ propertyId: UNIT.id, body: hubBody, items }] } as never);
  const nextRow = (await loadGuestQueue(now)).waiting.find((row) => row.id === "stay-rack-2") as GuestRow;
  const nextView = await openGuestAnswer(nextRow, now);
  if (nextView.mode !== "hub" || !/The dish drying rack is in the cabinet under the sink\./.test(nextView.draft)) fail(`second draft ${JSON.stringify(nextView.draft)}`);
  const resend = await submitGuestReply({ reservationId: nextRow.id, propertyId: UNIT.id, property: UNIT.name, guest: "Ben", english: nextView.draft, language: "", fact: "" });
  if (!resend.sent || resend.hubOffers?.length) fail(`second answer offered again: ${JSON.stringify(resend.hubOffers)}`);

  // (2) A one-off answer teaches nothing and says nothing.
  const coffee = await submitGuestReply({ reservationId: "stay-coffee", propertyId: UNIT.id, property: UNIT.name, guest: "Tom", english: "I'll refund you $20 this once.", language: "", fact: "" });
  if (!coffee.sent || coffee.hubOffers?.length) fail(`one-off offered: ${JSON.stringify(coffee.hubOffers)}`);

  // (3) An item on the same topic exists: approving updates it, never a duplicate.
  const updated = await saveHubEntry({ propertyId: UNIT.id, property: UNIT.name, title: "Dish drying rack", content: "The dish drying rack is in the cabinet left of the sink." });
  if (!updated.saved || updated.line !== "Updated “Dish drying rack” in the 8 Charlotte 606 Knowledge Hub.") fail(`update ${updated.line}`);
  const after = parityHubItems(UNIT.id).filter((item) => /drying rack/i.test(`${item.title} ${item.content}`));
  if (after.length !== 1 || after[0]?.content !== "The dish drying rack is in the cabinet left of the sink.") fail(`same-topic items ${JSON.stringify(after)}`);
  if (!capturedCommits().some((row) => row.detail === "update-knowledge-hub-item")) fail("the update path was not taken");
}

// An inquiry asking about availability gets no Hub draft (the live case: "Laundry rack available…").
{
  const lee = "Hi Shane/Roya. This property is still listed as available on Oct 30. Could you confirm it is no longer available?";
  const hub = "Laundry rack available for drying clothes.\nThe dish drying rack is in the cabinet left of the sink.";
  const drafted = draftFromHub("Lee", lee, hub, { place: "1065 Shaw Street" });
  if (drafted.mode !== "gap" || drafted.draft) fail(`availability inquiry drafted: ${drafted.draft}`);
  if (draftFromHub("Lee", "Is there a laundry rack for drying clothes?", hub, { place: "1065 Shaw Street" }).mode !== "hub") fail("a real Hub question lost its draft");
}

// Mark handled: out of Needs reply with nothing sent, back in when the guest writes again; Undo restores it.
{
  const commits = capturedCommits().length;
  await markThreadHandled("res-lee", "2026-10-14T16:35:00.000Z", "Shane");
  if (!handledReason("res-lee", "2026-10-14T16:35:00.000Z").startsWith("Marked handled by Shane")) fail("handled thread still owes a reply");
  if (handledReason("res-lee", "2026-10-14T18:00:00.000Z")) fail("a new guest message didn't bring the thread back");
  await unmarkThreadHandled("res-lee");
  if (handledReason("res-lee", "2026-10-14T16:35:00.000Z")) fail("Undo didn't restore the thread");
  if (capturedCommits().length !== commits) fail("marking handled sent something");
}

// Translation: only non-English goes to the model, one batched call, stored so it's never paid for twice.
{
  resetTranslations();
  const calls: string[][] = [];
  setTranslator(async (texts) => {
    calls.push(texts);
    return texts.map((text) => (/questionnaire/.test(text) ? { language: "French", english: "Hello, I completed this questionnaire on the day of my departure. Thank you and have a good day." } : { language: "Spanish", english: "Thank you so much!" }));
  });
  const diane = "Bonjour j'ai fait ce questionnaire la journée de mon départ. Merci et bonne journée";
  const english = ["Hi! Can we check in early tomorrow?", "Thanks 😊", "ok", "Perfect, see you at 4pm"];
  for (const text of english) if (!looksEnglish(text)) fail(`English read as foreign: ${text}`);
  if (looksEnglish(diane) || looksEnglish("¡Muchas gracias por todo!")) fail("a foreign message read as English");
  const first = await translateMessages([diane, ...english, "¡Muchas gracias por todo!"]);
  if (calls.length !== 1 || calls[0]!.length !== 2 || calls[0]!.some((text) => english.includes(text))) fail(`translation calls ${JSON.stringify(calls)}`);
  if (first.get(diane)?.english !== "Hello, I completed this questionnaire on the day of my departure. Thank you and have a good day." || first.get(diane)?.language !== "French") fail("Diane's message wasn't translated");
  await translateMessages([diane]);
  if (calls.length !== 1) fail("a stored translation was paid for again");
  setTranslator(null);
}

// No em dashes ever go to a guest: not from a suggestion, not from what the partner typed.
{
  setSuggestModel(async () => "Hi Diane — thank you so much! Safe travels — we'd love to host you again.");
  const clean = await suggestGuestReply({ guest: "Diane", property: "20 Blue Jays Way", stay: "", thread: [{ who: "guest", name: "Diane", text: "Thanks!" }], hub: "", memory: "" });
  if (/—/.test(clean) || clean !== "Hi Diane, thank you so much! Safe travels, we'd love to host you again.") fail(`suggestion kept an em dash: ${clean}`);
  setSuggestModel(null);
  const typed = await submitGuestReply({ reservationId: "stay-daniel", propertyId: "prop-blue", property: "Blue Jays Way", guest: "Daniel Okafor", english: "Thanks Daniel — the rack is in the cabinet left of the sink.", language: "", fact: "" });
  if (/—/.test(typed.sentText)) fail(`an em dash was sent: ${typed.sentText}`);
}

// Suggest with AI: any conversation, from the thread in English and the Hub; nothing is sent.
{
  const commits = capturedCommits().length;
  let seen: { thread: { text: string }[]; hub: string } | null = null;
  setSuggestModel(async (input) => {
    seen = input;
    return "Hi Diane, thank you so much for filling it in, and for staying with us. Safe travels!";
  });
  const suggested = await suggestGuestReply({ guest: "Diane", property: "20 Blue Jays Way", stay: "Oct 9–12", thread: [{ who: "guest", name: "Diane", text: "Hello, I completed this questionnaire on the day of my departure." }], hub: "Checkout is 11 AM.", memory: "" });
  if (!/^Hi Diane/.test(suggested) || !seen) fail(`suggest: ${suggested}`);
  setSuggestModel(null);
  if (capturedCommits().length !== commits) fail("a suggestion sent something");
}

// Suggest with AI still drafts when Hospitable's re-read comes back empty, from the thread on screen.
{
  setSuggestModel(async (input) => {
    if (!input.thread.some((row) => /tomorrow afternoon/i.test(row.text))) throw new Error(`shown thread missing: ${input.thread.map((row) => row.text).join(" | ")}`);
    return "Hi Eloise, tomorrow afternoon works. If you will not be home, please leave the keys in the lockbox.";
  });
  const draft = await suggestReply(
    { id: "no-such-stay", guest: "Eloise", property: "8 Charlotte 606", propertyId: "", dates: "", checkIn: "", checkOut: "" } as unknown as GuestRow,
    new Date(),
    [{ at: "2026-10-15T19:55:00.000Z", role: "guest", name: "Eloise", body: "Thanks Ryan, might it be possible to take a look tomorrow afternoon?" }],
  );
  if (!/tomorrow afternoon works/.test(draft)) fail(`shown thread was ignored: ${draft}`);
  setSuggestModel(null);
}

// A co-host reply whose Airbnb sender is "Unknown" is named from the Hospitable channel user, not the listing host.
{
  resetGuestMessaging();
  const ryanNow = new Date("2026-10-15T20:10:00Z");
  installWorld({
    now: ryanNow,
    properties: [{ id: "prop-ryan", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true }],
    reservations: [{
      id: "stay-ryan",
      code: "HMJSMMMFSF",
      propertyId: "prop-ryan",
      status: "accepted",
      checkIn: "2026-09-29",
      checkOut: "2026-11-07",
      guest: "Eloise",
      adults: 2,
      children: 0,
      hostName: "Shane Mosoff",
      messages: [
        { id: "shane-auto", at: "2026-10-01T20:01:18Z", role: "host" as const, name: "Shane Mosoff", body: "I hope you're enjoying your stay." },
        { id: "ryan-reply", at: "2026-10-15T20:03:41Z", role: "host" as const, name: "Unknown", senderName: "Unknown", userName: "Ryan Mandel", body: "Yes what time works for you?" },
      ],
    }],
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
  });
  const ryanQueue = await loadGuestQueue(ryanNow);
  const ryanRow = [...ryanQueue.onGuest, ...(ryanQueue.quiet ?? []), ...ryanQueue.waiting].find((row) => row.id === "stay-ryan");
  if (!ryanRow) fail("ryan stay was not listed");
  const ryanView = await openGuestAnswer(ryanRow, ryanNow);
  const ryanHosts = ryanView.thread.filter((row) => row.role === "host").map((row) => `${row.who}: ${row.text}`);
  if (!ryanHosts.some((line) => line.startsWith("Ryan Mandel:"))) fail(`co-host name\n${ryanHosts.join("\n")}`);
  if (!ryanHosts.some((line) => line.startsWith("Shane Mosoff:"))) fail(`listing host name\n${ryanHosts.join("\n")}`);
  if (ryanHosts.filter((line) => line.startsWith("Shane Mosoff:")).length !== 1) fail(`ryan reply labeled as shane\n${ryanHosts.join("\n")}`);
}

console.log("Guest messaging harness passed.");
