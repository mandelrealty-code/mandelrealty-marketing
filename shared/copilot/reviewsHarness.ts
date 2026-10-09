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
} from "./reviewsQueue.js";

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

console.log("Reviews harness passed.");
