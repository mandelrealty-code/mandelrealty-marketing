/**
 * A contradicted review regenerates from the thread. A review with no conversation
 * stays on the review alone. Submit is the only post.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import {
  SOURCE_ALONE,
  SOURCE_FULL,
  SOURCE_REVIEW,
  rankReviews,
  regenerateDraft,
  regeneratedDraftFails,
  regenerateFromConnection,
  resetReviewsQueue,
  reviewDraftRejected,
  reviewNeedsCare,
  reviewSummary,
  seedDraft,
  setReviewPoster,
  submitReviewReply,
  loadReviewQueue,
  reviewWindowStart,
  reviewDate,
} from "./reviewsQueue.js";
import { checkedAssessment, thanksByName, resetReviewAi, setReviewModel, writeReviewAi } from "./reviewAi.js";
import { installWorld, type ParityReview } from "./parity/world.js";
import { NO_REVIEWS_SYNCED } from "./reviewTypes.js";

const GOOD = "copilot-review-token-not-a-secret-7Kq2";

function fail(label: string): never {
  throw new Error(`Reviews harness failed: ${label}`);
}

resetHospitableConnection();
resetReviewsQueue();
const posts: string[] = [];
const reads: string[] = [];
setReviewPoster(async (id, text) => {
  posts.push(`${id}:${text.length}`);
});
setHospitableProbe(async (token, name) => {
  if (token !== GOOD) throw new Error("rejected");
  reads.push(name);
  if (name === "get-properties") return { data: [{ id: "prop-charlotte", name: "Charlotte 606" }] };
  if (name === "get-reservation-messages") {
    return {
      data: [
        { sender_role: "host", body: "Check-in instructions: the door code is 4581. The lockbox is by the front door." },
        { sender_role: "guest", body: "There's a stain on the sofa." },
        { sender_role: "host", body: "We cleaned the sofa stain this evening." },
        { sender_role: "host", body: "Hope you're enjoying your stay. Let us know if you need anything." },
        { sender_role: "guest", body: "Thanks for getting back so quickly." },
        { sender_role: "host", body: "Check-out reminder: please check out by 11 AM and leave the keys on the counter." },
      ],
    };
  }
  if (name === "get-reservation") return { data: { status: "accepted", arrival_date: "2026-10-03" } };
  if (name === "get-property-knowledge-hub") return { data: { topics: [{ name: "Hub", aggregate_items: [{ content: "Sofa cover is spare, in the hall closet." }] }] } };
  return { data: [] };
});

await saveHospitableToken(GOOD);

const contradicted = await regenerateFromConnection({
  guest: "Jordan Lee",
  review: "The host never answered our messages, and the sofa was stained when we arrived.",
  current: "Jordan, thank you for writing. We've read what you wrote. Thank you for staying with us.",
  reservationId: "stay-jordan",
  propertyId: "prop-charlotte",
});
if (contradicted.unchanged) fail("thread draft was not written");
if (contradicted.sourceLine !== SOURCE_FULL) fail("full conversation line");
if (!/sofa stain/i.test(contradicted.draft) || !/this evening/i.test(contradicted.draft)) fail("thread facts");
if ((contradicted.draft.match(/you're right that/gi) ?? []).length !== 1) fail("acknowledgement once");
if ((contradicted.draft.match(/your messages were answered/gi) ?? []).length !== 1) fail("correction once");
if (/never answered|actually|you're wrong|you are wrong|you're right about this part/i.test(contradicted.draft)) fail("defensive");
if (/door code|lockbox|4581|check-?out reminder|hope you're enjoying|leave the keys|check-in instructions/i.test(contradicted.draft)) fail("stay template in the reply");
if (contradicted.draft.includes("We cleaned the sofa stain this evening.")) fail("copied the thread");
if (!reads.includes("get-reservation-messages") || !reads.includes("get-reservation") || !reads.includes("get-property-knowledge-hub")) fail("stay was not re-read");
if (posts.length) fail("regenerate posted");
if (JSON.stringify(contradicted).includes(GOOD)) fail("token rendered");

const again = regenerateDraft({
  guest: "Jordan Lee",
  review: "The host never answered our messages, and the sofa was stained when we arrived.",
  current: contradicted.draft,
  stay: {
    messages: [
      { role: "guest", body: "There's a stain on the sofa." },
      { role: "host", body: "We cleaned the sofa stain this evening." },
      { role: "guest", body: "Thanks for getting back so quickly." },
    ],
    reservation: "Status accepted, check-in 2026-10-03",
    hub: "Sofa cover is spare, in the hall closet.",
    failed: [],
  },
});
if (again.previous !== contradicted.draft) fail("previous draft");
if (again.draft === again.previous && again.previous.length < 20) fail("kept a previous version");

const alone = regenerateDraft({
  guest: "Casey Ng",
  review: "The bed was too soft and the shower pressure was weak.",
  current: "Casey, thank you for writing. We've read what you wrote. Thank you for staying with us.",
  stay: { messages: [], reservation: "", hub: "", failed: [] },
});
if (alone.sourceLine !== SOURCE_ALONE) fail("review alone line");
if (!/bed/i.test(alone.draft) || !/shower/i.test(alone.draft)) fail("review topics");
if (/conversation|thread|answered/i.test(alone.draft)) fail("invented a conversation");

const named = regenerateDraft({
  guest: "Jordan Lee",
  review: "The host never answered our messages, and the sofa was stained when we arrived.",
  current: contradicted.draft,
  stay: {
    messages: [
      { role: "guest", body: "There's a stain on the sofa." },
      { role: "host", body: "We cleaned the sofa stain this evening." },
      { role: "guest", body: "Thanks for getting back so quickly." },
    ],
    reservation: "",
    hub: "",
    failed: ["The Knowledge Hub read failed."],
  },
});
if (!/Knowledge Hub read failed/.test(named.sourceLine) || !named.sourceLine.startsWith("Based on the full conversation")) fail(`failed read name ${named.sourceLine}`);
if (/stay record/i.test(named.sourceLine)) fail(named.sourceLine);

const cormacStay = {
  messages: [
    { role: "host" as const, body: "Check-in instructions: the door code is 4581. The lockbox is by the front door. WiFi password is charlotte606." },
    { role: "guest" as const, body: "Got in fine, thanks." },
    { role: "host" as const, body: "Hope you're enjoying your stay. The coffee is in the cupboard if you need anything during your stay." },
    { role: "guest" as const, body: "All good here." },
    { role: "host" as const, body: "Check-out reminder: please check out by 11 AM and leave the keys on the counter." },
  ],
  reservation: "Status accepted, check-in 2026-10-03",
  hub: "Door code 4581. Check-out is 11 AM. Lockbox by the front door.",
  failed: [],
};
const cormac = regenerateDraft({
  guest: "Cormac",
  review: "Great location... Host was very responsive and check in / check out was simple and easy",
  current: "Cormac, thank you for writing. We've read what you wrote. Thank you for staying with us.",
  stars: 5,
  stay: cormacStay,
});
const cormacSentences = cormac.draft.split(/(?<=[.!?])\s+/).filter((line) => line.trim());
if (cormacSentences.length < 2 || cormacSentences.length > 4) fail(`thank-you length ${cormac.draft}`);
const cormacThemes = ["location", "host", "responsive", "check-in", "check-out"].filter((theme) => new RegExp(theme, "i").test(cormac.draft));
if (cormacThemes.length < 1 || cormacThemes.length > 2) fail(`praised points ${cormac.draft}`);
for (const theme of ["location", "hosts", "responsive", "check-in", "check-out"]) {
  if ((cormac.draft.match(new RegExp(theme, "gi")) ?? []).length > 1) fail(`stuffed ${theme} ${cormac.draft}`);
}
if (!/welcome back/i.test(cormac.draft) || !/\bCormac\b/.test(cormac.draft)) fail(cormac.draft);
if (/door code|lockbox|wifi password|charlotte606|4581|check-?in instructions|check-?out reminder|hope you're enjoying|leave the keys|you're right about this part|during your stay/i.test(cormac.draft)) fail(`stay template ${cormac.draft}`);
if (/you're right/i.test(cormac.draft)) fail("acknowledgement on a compliment");
if (cormac.sourceLine !== SOURCE_REVIEW) fail(cormac.sourceLine);
if (reviewDraftRejected(cormac.draft, "Cormac", cormacStay)) fail("thank-you rejected");
const stitched = "Cormac, thank you for writing. You're right about this part: Check-in instructions: the door code is 4581. You're right about this part: Check-out reminder: please check out by 11 AM and leave the keys on the counter. Hi Cormac, hope you're enjoying your stay.";
if (!reviewDraftRejected(stitched, "Cormac", cormacStay)) fail("sanity gate");

const falseStay = {
  messages: [
    { role: "host" as const, body: "Check-in instructions: the door code is 4581. The lockbox is by the front door." },
    { role: "guest" as const, body: "There's a stain on the sofa." },
    { role: "host" as const, body: "We cleaned the sofa stain this evening." },
    { role: "host" as const, body: "Hope you're enjoying your stay. Let us know if you need anything." },
    { role: "guest" as const, body: "Thanks for getting back so quickly." },
    { role: "host" as const, body: "Check-out reminder: please check out by 11 AM and leave the keys on the counter." },
  ],
  reservation: "Status accepted, check-in 2026-10-03",
  hub: "Sofa cover is spare, in the hall closet.",
  failed: [] as string[],
};
const falseClaim = regenerateDraft({
  guest: "Jordan Lee",
  review: "The host never answered our messages, and the sofa was stained when we arrived.",
  current: "Jordan, thank you for writing. We've read what you wrote. Thank you for staying with us.",
  stars: 2,
  stay: falseStay,
});
if ((falseClaim.draft.match(/you're right that/gi) ?? []).length !== 1) fail("false-claim acknowledgement");
if ((falseClaim.draft.match(/your messages were answered/gi) ?? []).length !== 1) fail("false-claim correction");
if (/door code|lockbox|4581|check-?in instructions|check-?out reminder|hope you're enjoying|leave the keys|you're right about this part/i.test(falseClaim.draft)) fail("false-claim template");
if (falseClaim.draft.includes("We cleaned the sofa stain this evening.")) fail("false-claim copied the thread");
if (reviewDraftRejected(falseClaim.draft, "Jordan Lee", falseStay)) fail(`false-claim rejected ${falseClaim.draft}`);

const copiedHub = "A spare cover for the sofa is kept in the closet in the hall.";
const rewritten = regenerateDraft({
  guest: "Jordan Lee",
  review: "The host never answered our messages, and the sofa was stained when we arrived.",
  current: "Jordan, thank you for writing. We've read what you wrote. Thank you for staying with us.",
  stars: 2,
  stay: { ...falseStay, hub: copiedHub },
});
if (rewritten.draft.includes(copiedHub)) fail("rejected draft was shown");
if ((rewritten.draft.match(/you're right that/gi) ?? []).length !== 1) fail("regenerated acknowledgement");
if ((rewritten.draft.match(/your messages were answered/gi) ?? []).length !== 1) fail("regenerated correction");
if (/stay record|Knowledge Hub/i.test(rewritten.sourceLine)) fail(rewritten.sourceLine);

const FILLER = /we'?ve read what you wrote|we have read what you wrote|read what you wrote/i;
const APOLOGY = /\b(sorry|apologize|apology|désolé|desole)\b/i;
const waiting = [
  { guest: "Noah", review: "We loved the mattresses. Best sleep of the trip.", detail: /mattress/i },
  { guest: "Priya", review: "Check-in was easy and the instructions were clear.", detail: /check-?in/i },
  { guest: "Elena", review: "The place was spotless. The bed was comfortable and check-in was easy.", detail: /clean/i },
  { guest: "Camille", review: "Nous avons adoré les matelas. L'arrivée a été facile et tout était très propre.", detail: /matelas/i },
  { guest: "Alex", review: "Great location!", detail: /location/i },
];
const bodies = new Map<string, string>();
for (const row of waiting) {
  const draft = seedDraft(row.guest, row.review);
  const sentences = draft.split(/(?<=[.!?])\s+/).filter((line) => line.trim());
  if (sentences.length < 2 || sentences.length > 4) fail(`waiting length ${row.guest}: ${draft}`);
  if (APOLOGY.test(draft)) fail(`waiting apology ${row.guest}: ${draft}`);
  if (FILLER.test(draft)) fail(`waiting filler ${row.guest}: ${draft}`);
  if (!row.detail.test(draft)) fail(`waiting detail ${row.guest}: ${draft}`);
  if (reviewNeedsCare(row.review)) fail(`waiting care ${row.guest}`);
  if (row.guest === "Elena" && /not what you wanted|harder than it should|not as clean/i.test(draft)) fail(`clean misread ${draft}`);
  if (row.guest === "Camille" && (/\b(thank you|sorry|we've|we are|the mattresses|and)\b/i.test(draft) || !/merci/i.test(draft))) fail(`french ${draft}`);
  const name = row.guest.toLowerCase();
  for (const sentence of sentences) {
    const body = sentence.toLowerCase().replace(new RegExp(`\\b${name}\\b`, "g"), "").replace(/\s+/g, " ").trim();
    const prior = bodies.get(body);
    if (prior) fail(`shared sentence ${prior} and ${row.guest}: ${body}`);
    bodies.set(body, row.guest);
  }
}
const samuelReview = "Amazing location & amazing hosts felt right at home";
const samuelStay = {
  messages: [
    { role: "guest" as const, body: "Hi, we arrived." },
    { role: "host" as const, body: "Welcome, the lockbox is by the door." },
    { role: "guest" as const, body: "All set, thank you." },
  ],
  reservation: "Status accepted, check-in 2026-09-12",
  hub: "Coffee is in the cupboard.",
  failed: [] as string[],
};
function naturalSamuel(draft: string, label: string): void {
  const sentences = draft.split(/(?<=[.!?])\s+/).filter((line) => line.trim());
  if (sentences.length < 2 || sentences.length > 4) fail(`${label} length ${draft}`);
  if (!/\bSamuel\b/.test(draft) || !/welcome back/i.test(draft)) fail(`${label} shape ${draft}`);
  const location = draft.match(/\blocation\b/gi)?.length ?? 0;
  const hosts = draft.match(/\bhosts?\b/gi)?.length ?? 0;
  if (location + hosts < 1 || location > 1 || hosts > 1) fail(`${label} praise ${draft}`);
  if (/noticed the location|want the location again|telling us about the location/i.test(draft)) fail(`${label} stuffed ${draft}`);
  if (regeneratedDraftFails(draft, samuelReview)) fail(`${label} gate ${draft}`);
}
naturalSamuel(seedDraft("Samuel", samuelReview), "standing");
const samuel = regenerateDraft({
  guest: "Samuel",
  review: samuelReview,
  current: seedDraft("Samuel", samuelReview),
  stars: 5,
  stay: samuelStay,
});
naturalSamuel(samuel.draft, "regenerate");
if (samuel.sourceLine !== SOURCE_REVIEW) fail(samuel.sourceLine);
if (/conversation|stay record|Knowledge Hub|reservation/i.test(samuel.sourceLine)) fail(samuel.sourceLine);
const samuelHub = regenerateDraft({
  guest: "Samuel",
  review: samuelReview,
  current: samuel.draft,
  stars: 5,
  stay: { ...samuelStay, hub: "", failed: ["The Knowledge Hub read failed."] },
});
if (samuelHub.sourceLine !== "Based on the review. The Knowledge Hub read failed.") fail(samuelHub.sourceLine);
if (!regeneratedDraftFails("Thank you for staying with us.", samuelReview)) fail("one sentence kept");
if (!regeneratedDraftFails("Thank you for staying with us. You are welcome back.", samuelReview)) fail("nameless reply kept");
naturalSamuel(samuelHub.draft, "failed read");

const soft = "The bed was too soft.";
if (!reviewNeedsCare(soft)) fail("soft bed needs care");
const softDraft = seedDraft("Casey", soft);
if (!/\bsorry\b/i.test(softDraft) || !/too soft/i.test(softDraft)) fail(`soft apology ${softDraft}`);
if (/mattress|check-in|not as clean|not what you wanted/i.test(softDraft)) fail(`soft extra ${softDraft}`);

const ranked = rankReviews([
  { id: "b", stars: 5, reviewedAt: "2026-10-08", review: "Great", returned: false },
  { id: "a", stars: 1, reviewedAt: "2026-10-01", review: "Short", returned: false },
]);
if (ranked[0]?.id !== "a") fail("ranking");
if (reviewSummary(2, 1) !== "2 reviews waiting. 1 needs care.") fail("summary");
if (reviewSummary(0, 0, "Charlotte 606") !== "No reviews waiting at Charlotte 606.") fail("empty summary");

await submitReviewReply("stay-jordan", contradicted.draft, "Jordan Lee", "Charlotte 606", 1);
if (posts.length !== 1) fail("submit");

// The queue shows the last 12 months only. Older reviews stay in Hospitable, untouched.
const windowNow = new Date("2026-10-12T15:00:00-04:00");
if (reviewWindowStart(windowNow) !== "2025-10-12") fail(`window start ${reviewWindowStart(windowNow)}`);
const BLUE = { id: "prop-blue-window", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true };
const SHAW = { id: "prop-shaw-window", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true };
const ROSE = { id: "prop-rose-window", name: "41 Roseglor Cres", address: "41 Roseglor Crescent, Toronto", managed: true };
const aged = (id: string, reviewedAt: string, guest: string, extra: Partial<ParityReview> = {}): ParityReview => ({
  id,
  propertyId: BLUE.id,
  reservationId: `${id}-stay`,
  guest,
  platform: "airbnb",
  reviewedAt,
  rating: 5,
  publicReview: `${guest} loved the view and the quiet building.`,
  ...extra,
});
installWorld({
  now: windowNow,
  properties: [BLUE, SHAW, ROSE],
  reservations: [],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
  reviews: [
    aged("rev-13m", "2025-09-12T18:00:00Z", "Thirteen"),
    aged("rev-11m", "2025-11-12T18:00:00Z", "Eleven"),
    aged("rev-2y", "2024-10-12T18:00:00Z", "Twoyears"),
    aged("rev-rose-answered", "2026-09-01T18:00:00Z", "Answered", { propertyId: ROSE.id, response: "Thank you, Answered!" }),
  ],
});
const windowed = await loadReviewQueue(windowNow);
if (!windowed.connected) fail(`window queue ${windowed.line}`);
const shownIds = windowed.reviews.map((row) => row.id);
if (shownIds.length !== 1 || shownIds[0] !== "rev-11m") fail(`window shows ${shownIds.join(", ") || "nothing"}`);
const waitingNow = windowed.reviews.length;
if (waitingNow !== 1) fail(`waiting count ${waitingNow}`);
const filterRows = windowed.properties ?? [];
const shaw = filterRows.find((row) => row.id === SHAW.id);
if (!shaw) fail("a property with no reviews vanished from the Reviews filter");
if (shaw.synced !== false) fail("a property with no reviews was not marked as not synced");
const rose = filterRows.find((row) => row.id === ROSE.id);
if (!rose || rose.synced !== true) fail("a property whose only review is answered was called not synced");
const blue = filterRows.find((row) => row.id === BLUE.id);
if (!blue || blue.synced !== true) fail("Blue Jays Way lost its synced state");
if (NO_REVIEWS_SYNCED !== "No reviews synced for this property yet") fail(`empty-state line ${NO_REVIEWS_SYNCED}`);

// ---------- The real review date, low-star flags, retaliation, and nothing ever posted ----------

// Hospitable's "reviewed" time months after checkout is a record time: the stay's end is shown instead.
const stale = reviewDate("2026-10-14T09:00:00Z", "2025-12-03");
if (!stale.fromStay || !stale.at.startsWith("2025-12-03")) fail(`stale review date ${JSON.stringify(stale)}`);
const fresh = reviewDate("2026-10-05T09:00:00Z", "2026-09-28");
if (fresh.fromStay || fresh.at !== "2026-10-05T09:00:00Z") fail(`fresh review date ${JSON.stringify(fresh)}`);

const threadInput = {
  guest: "Dana",
  stars: 1,
  review: "Dirty and the host was rude.",
  privateFeedback: "",
  property: "20 Blue Jays Way",
  messages: [
    { role: "guest" as const, body: "Give me a 50% refund or I will leave a 1 star review." },
    { role: "host" as const, body: "We can't refund a stay that's complete, but we're happy to look at any issue." },
  ],
  reservation: "",
  hub: "",
};
const realQuote = checkedAssessment({ headline: "Guest demanded a refund under threat of a bad review.", facts: [], retaliation: { level: "likely", why: "Threatened a 1 star review for a refund.", quotes: ["Give me a 50% refund or I will leave a 1 star review."] }, removalRequest: "Please remove this review — it was coercive.", reply: "Thank you — we take cleanliness seriously." }, threadInput);
if (realQuote?.retaliation.level !== "likely" || realQuote.retaliation.quotes.length !== 1) fail(`a quoted threat lost its level: ${JSON.stringify(realQuote?.retaliation)}`);
if (/\u2014/.test(`${realQuote.reply}${realQuote.removalRequest}`)) fail("an em dash survived in a review draft");
const madeUp = checkedAssessment({ headline: "Retaliation.", facts: [], retaliation: { level: "likely", why: "x", quotes: ["I will ruin your listing"] }, removalRequest: "Remove it.", reply: "Thank you for staying." }, threadInput);
if (madeUp?.retaliation.level !== "possible" || madeUp.retaliation.quotes.length) fail("an invented quote was kept as proof");

resetReviewAi();
const prompts: string[] = [];
setReviewModel(async (system, user) => {
  prompts.push(user);
  if (/low Airbnb guest review/.test(system)) {
    return JSON.stringify({ headline: "Guest threatened a bad review unless refunded.", facts: [{ claim: "Dirty", record: "No cleanliness issue was reported during the stay.", source: "Conversation" }], retaliation: { level: "likely", why: "Refund demand with a review threat.", quotes: ["Give me a 50% refund or I will leave a 1 star review."] }, removalRequest: "Hello Airbnb Support, this review followed a refund demand under threat.", reply: "Thank you for the feedback, Dana. No issue was raised during the stay, and the home was cleaned to our standard." });
  }
  return "Thank you, Sam! We're so glad the view from the balcony made the stay. We'd love to host you again.";
});
const five = await writeReviewAi({ ...threadInput, guest: "Sam", stars: 5, review: "Loved the balcony view." });
if (five?.kind !== "reply" || !/balcony/.test(five.reply)) fail(`5 stars did not get a reply draft: ${JSON.stringify(five)}`);
const one = await writeReviewAi(threadInput);
if (one?.kind !== "flag" || one.assessment.retaliation.level !== "likely" || !one.assessment.removalRequest) fail(`1 star was not flagged with a removal request: ${JSON.stringify(one)}`);
if (!prompts.some((text) => text.includes("Give me a 50% refund"))) fail("the assessment did not read the conversation");

// The queue: every selected property, flagged first then newest, closed reviews counted, nothing posted.
// The queue reads the fake world itself, not the stub reader used above.
setHospitableProbe(null);
const MAIN = { id: "prop-main-q", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true };
const BLUE2 = { id: "prop-blue-q", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true };
const qNow = new Date("2026-10-15T15:00:00-04:00");
const rv = (id: string, propertyId: string, reviewedAt: string, rating: number, extra: Partial<ParityReview> = {}): ParityReview => ({
  id, propertyId, reservationId: `${id}-stay`, guest: id.toUpperCase(), platform: "airbnb", reviewedAt, rating, publicReview: `${id} stayed here and it was fine.`, ...extra,
});
installWorld({
  now: qNow,
  properties: [MAIN, BLUE2],
  reservations: [
    { id: "res-don-old", code: "HMDON1", propertyId: MAIN.id, status: "accepted", checkIn: "2026-05-01", checkOut: "2026-05-04", guest: "Don", adults: 2, children: 0, messages: [] },
    { id: "res-don-cxl", code: "HMDON2", propertyId: MAIN.id, status: "cancelled", checkIn: "2026-09-01", checkOut: "2026-09-04", guest: "Don", adults: 2, children: 0, messages: [] },
  ],
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
  reviews: [
    rv("don", MAIN.id, "2026-10-14T09:00:00Z", 5, { guest: "Don", reservationId: "" }),
    rv("older5", BLUE2.id, "2026-09-20T18:00:00Z", 5),
    rv("newer5", MAIN.id, "2026-10-12T18:00:00Z", 5),
    rv("low2", MAIN.id, "2026-08-01T18:00:00Z", 2, { privateFeedback: "Heat was off." }),
    rv("closed5", BLUE2.id, "2026-06-01T18:00:00Z", 5, { canRespond: false }),
    rv("stale", BLUE2.id, "2026-10-14T09:00:00Z", 4, { checkOut: "2026-03-02" }),
  ],
});
posts.length = 0;
const q = await loadReviewQueue(qNow);
const order = q.reviews.map((row) => row.id);
if (order[0] !== "low2") fail(`a 2-star review was not first: ${order.join(", ")}`);
if (order.indexOf("newer5") > order.indexOf("older5")) fail(`newest was not first after the flags: ${order.join(", ")}`);
if (order.includes("closed5")) fail("a review Airbnb no longer takes a reply to was listed");
if (!/1 older review can no longer be answered/.test(q.note ?? "")) fail(`closed review not said: ${q.note}`);
const low = q.reviews.find((row) => row.id === "low2");
if (!low?.flagged || !/Flagged for the team/.test(low.dispute)) fail(`low review not flagged: ${JSON.stringify(low)}`);
if (low.privateFeedback !== "Heat was off.") fail("private feedback was not carried to the assessment");
const staleRow = q.reviews.find((row) => row.id === "stale");
if (staleRow?.when !== "Stay ended Mar 2") fail(`a months-old review said ${staleRow?.when}`);
if (new Set(q.reviews.map((row) => row.propertyId)).size !== 2) fail("reviews from only one property");
// A review with no reservation link is matched to the guest's stay: the real date, and the conversation to read.
const don = q.reviews.find((row) => row.id === "don");
if (don?.reservationId !== "res-don-old") fail(`review not matched to its stay: ${don?.reservationId}`);
if (don.when !== "Stay ended May 4") fail(`a months-old review with no link said ${don.when}`);
if (posts.length) fail(`loading reviews posted ${posts.length} replies`);
if (!prompts.some((text) => text.includes("Openings already used"))) fail("later reviews were not told which openings were already used");
setReviewModel(null);

// "Thank you Kahina for…": no commas around the name after the thanks.
if (thanksByName("Thank you, Kahina, for the wonderful review.") !== "Thank you Kahina for the wonderful review.") fail("commas kept around the name");
if (thanksByName("Thank you, Marty and Jenny, for the kind words.") !== "Thank you Marty and Jenny for the kind words.") fail("two names split");
if (thanksByName("Thank you for staying, Don.") !== "Thank you for staying, Don.") fail("a later comma was removed");

console.log("Reviews harness passed.");
