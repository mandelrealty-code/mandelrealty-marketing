/**
 * A French guest is translated and the send-version is French.
 * A Hub fact marks the draft. A missing fact is written back only after it is read again.
 * Thanks does not wait and does not draft.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import { answerWaitingDrafts } from "./guestInboxAnswer.js";
import {
  draftFromHub,
  isThanksOnly,
  loadGuestQueue,
  messageLanguage,
  needsGuestReply,
  openGuestAnswer,
  readSavedGuestQueue,
  replyFromAnswer,
  resetGuestMessaging,
  setGuestPoster,
  setHubWriter,
  submitGuestReply,
  toEnglish,
  toGuestLanguage,
  guestDrafts,
  guestTabText,
} from "./guestMessaging.js";
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
if (!partial.failed.some((line) => /Shaw/.test(line))) fail("failed thread named");

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

console.log("Guest messaging harness passed.");
