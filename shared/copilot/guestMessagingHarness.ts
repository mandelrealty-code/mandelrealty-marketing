/**
 * A French guest is translated and the send-version is French.
 * A Hub fact marks the draft. A missing fact is written back only after it is read again.
 * Thanks does not wait and does not draft.
 */

import { hospitableRead, resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
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
  toEnglish,
  toGuestLanguage,
  guestDrafts,
  guestTabText,
  improveGuestDraft,
} from "./guestMessaging.js";
import type { GuestFollowUp } from "./guestTypes.js";
import { guestQueueRows } from "./guestQueueRows.js";
import { installWorld } from "./parity/world.js";

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
const sentVersion = toGuestLanguage(covered.draft, "French");
if (sentVersion === covered.draft || !/bonjour|vous pouvez|14 h/i.test(sentVersion)) fail("french send version");
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
if (!/not sent/i.test(missed.reason)) fail(`forced failure reason: ${missed.reason}`);
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
if (blocked.failed.length !== 1 || blocked.failed[0] !== "Couldn't read messages for 20 Blue Jays Way Unit 318, so those conversations show without their latest message. Nothing was sent.") fail("one failure line");
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
  if (!down.failed.some((line) => /Couldn't read the conversations for 1065 Shaw Street/.test(line))) fail(`a failed read did not say so: ${down.failed.join(" | ") || "no failure line"}`);
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

console.log("Guest messaging harness passed.");
