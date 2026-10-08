/**
 * A contradicted review regenerates from the thread. A review with no conversation
 * stays on the review alone. Submit is the only post.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import {
  SOURCE_ALONE,
  SOURCE_FULL,
  rankReviews,
  regenerateDraft,
  regenerateFromConnection,
  resetReviewsQueue,
  reviewSummary,
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
        { sender_role: "guest", body: "There's a stain on the sofa." },
        { sender_role: "host", body: "We cleaned the sofa stain this evening." },
        { sender_role: "guest", body: "Thanks for getting back so quickly." },
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
if (!/answered/i.test(contradicted.draft)) fail("correction");
if (/never answered|actually|you're wrong|you are wrong/i.test(contradicted.draft)) fail("defensive");
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
if (!/Knowledge Hub read failed/.test(named.sourceLine) || !named.sourceLine.startsWith(SOURCE_FULL.replace(/\.$/, ""))) fail("failed read name");

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
