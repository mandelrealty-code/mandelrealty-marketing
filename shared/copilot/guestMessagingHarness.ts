/**
 * A French guest is translated and the send-version is French.
 * A Hub fact marks the draft. A missing fact is written back only after it is read again.
 * Thanks does not wait and does not draft.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import {
  draftFromHub,
  isThanksOnly,
  loadGuestQueue,
  messageLanguage,
  replyFromAnswer,
  resetGuestMessaging,
  setGuestPoster,
  setHubWriter,
  submitGuestReply,
  toEnglish,
  toGuestLanguage,
} from "./guestMessaging.js";

const GOOD = "copilot-guest-token-not-a-secret-7Kq2";
const FRENCH = "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h ? Notre vol atterrit à 11 h.";
const HUB = "Early check-in from 2 PM when no one checks out that day.";

function fail(label: string): never {
  throw new Error(`Guest messaging harness failed: ${label}`);
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
const queue = await loadGuestQueue(new Date("2026-10-08T16:06:00Z"));
if (!queue.connected) fail("queue");
if (queue.waiting.length !== 1 || queue.waiting[0]?.guest !== "Isabelle Fournier") fail("waiting row");
if (queue.waiting.some((row) => row.property === "Partner Loft") || queue.thanks.some((row) => row.property === "Partner Loft")) fail("unmanaged property");
if (queue.thanks.length !== 1 || queue.thanks[0]?.guest !== "Tom Becker") fail("thanks row");
if (queue.waiting.some((row) => /thanks so much/i.test(row.asked))) fail("thanks is waiting");
const isabelle = queue.waiting[0];
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

console.log("Guest messaging harness passed.");
