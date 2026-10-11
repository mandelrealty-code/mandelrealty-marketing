/**
 * A French guest is translated and the send-version is French.
 * A Hub fact marks the draft. A missing fact is written back only after it is read again.
 * Thanks does not wait and does not draft.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import { installResearch, resetResearch } from "./skillResearch.js";
import { answerWaitingDrafts } from "./guestInboxAnswer.js";
import { detectFollowUps, orderFollowUps } from "./guestFollowUps.js";
import {
  clearHandledFollowUps,
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
  setGuestPoster,
  setGuestUploader,
  setHubWriter,
  submitGuestReply,
  toEnglish,
  toGuestLanguage,
  guestDrafts,
  guestTabText,
} from "./guestMessaging.js";
import type { GuestFollowUp } from "./guestTypes.js";
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
const sent: string[] = [];
const hub = new Map<string, string>();
setGuestPoster(async (_id, text) => {
  sent.push(text);
});
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
const posted = await submitGuestReply({
  reservationId: "stay-daniel",
  propertyId: "prop-blue",
  property: "Blue Jays Way",
  guest: "Daniel Okafor",
  english: answer,
  language: "",
  fact: "The dish drying rack is folded flat in the cabinet left of the sink.",
});
if (sent.length !== 1 || sent[0] !== answer) fail("submit sent the draft");
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
setGuestPoster(async () => undefined);
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
if (blocked.failed.length !== 1 || blocked.failed[0] !== "Couldn't read messages for 20 Blue Jays Way Unit 318, so anyone waiting there isn't listed. Nothing was sent.") fail("one failure line");
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
setGuestPoster(async () => {
  sent.push("should-not-send");
});
setGuestUploader(async () => {
  throw new Error("The video didn’t upload.");
});
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
if (sent.includes("should-not-send")) fail("text sent after the upload failed");

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
const recipe = fuQueue.followUps.find((row) => row.guest === "Luis");
if (!recipe || recipe.due || recipe.when !== "No date given") fail(`recipe dropped ${recipe?.when}`);
if (fuQueue.followUps.map((row) => row.guest).join(",") !== "Eloise,Imani,Luis,Priya Raman") fail(`order ${fuQueue.followUps.map((row) => row.guest).join(",")}`);
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

console.log("Guest messaging harness passed.");
