/**
 * Public review replies are written from the review's own words, in its language, never from
 * private feedback or the conversation. Submit is the only post.
 */

import { resetHospitableConnection, saveHospitableToken, setHospitableProbe } from "./hospitableConnection.js";
import {
  SOURCE_PUBLIC,
  rankReviews,
  regenerateFromConnection,
  resetReviewsQueue,
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
import { checkReviewReply, newVoiceMemory, reviewLanguage, sentencesOf, norm, withoutName } from "./reviewVoice.js";
import { adjustDraft, ADJUST_KINDS } from "./reviewAdjust.js";
import { installWorld, type ParityReview } from "./parity/world.js";
import { NO_REVIEWS_SYNCED } from "./reviewTypes.js";

const GOOD = "copilot-review-token-not-a-secret-7Kq2";

function fail(label: string): never {
  throw new Error(`Reviews harness failed: ${label}`);
}

resetHospitableConnection();
resetReviewsQueue();
const posts: string[] = [];
setReviewPoster(async (id, text) => {
  posts.push(`${id}:${text.length}`);
});

// ---------- The Unit 606 queue: private facts exist everywhere except the reply ----------

setHospitableProbe(async (token) => {
  if (token !== GOOD) throw new Error("rejected");
  return { data: [] };
});
await saveHospitableToken(GOOD);
setHospitableProbe(null);
const U606 = { id: "prop-606", name: "20 Blue Jays Way Unit 606", address: "20 Blue Jays Way, Unit 606, Toronto", managed: true };
const nowQ = new Date("2026-10-15T15:00:00-04:00");
type Fixture = { id: string; guest: string; stars: number; review: string; private: string; thread: string[]; need: RegExp };
const FIX: Fixture[] = [
  { id: "edith", guest: "Edith", stars: 5, review: "Nous avons passé un séjour merveilleux. L'appartement était très propre et la vue sur la ville est magnifique. L'accueil était parfait.", private: "", thread: [], need: /propre|vue/i },
  { id: "virginie", guest: "Virginie", stars: 5, review: "Appartement très bien situé, avec un balcon agréable. Lit confortable et cuisine bien équipée. Nous reviendrons avec plaisir.", private: "Les pommeaux de douche étaient bouchés et la poubelle débordait.", thread: ["Les pommeaux de douche ne marchent pas bien, et la poubelle est pleine."], need: /situ|balcon|lit|cuisine/i },
  { id: "samuel", guest: "Samuel", stars: 5, review: "Amazing location. Great host.", private: "", thread: [], need: /location|host/i },
  { id: "henry", guest: "Henry", stars: 5, review: "Wonderful stay with a great view of the city from the balcony. The bed was very comfortable and the check-in was easy. Windows could use a clean, but everything else was great and we would happily stay again.", private: "The shower door was off its track.", thread: ["The shower door is stuck and won't close."], need: /view|balcony|bed|check-?in/i },
  { id: "gakte", guest: "Gákte Biera", stars: 5, review: "Perfect place for our family trip. The kitchen had everything we needed and the location near the CN Tower and the waterfront was ideal. The host was very responsive.", private: "The washing machine leaked on the floor.", thread: ["The washing machine is leaking."], need: /kitchen|location|CN Tower|waterfront|host|family/i },
  { id: "josh", guest: "Josh", stars: 5, review: "Great condo, super clean and the building is quiet. The parking spot was a little tight for our SUV but no big deal. Loved the decor.", private: "No paper towels, and a mess on the sink.", thread: ["Paper towels on the sink were left out."], need: /clean|quiet|decor|parking/i },
  { id: "lindsay", guest: "Lindsay", stars: 5, review: "Lovely, bright space in a perfect downtown location. The den was a bit cramped as a second bedroom, though the main bedroom was very comfortable. Check-in was a breeze.", private: "Please check the bed frame, it creaked.", thread: ["The bed frame needs a check."], need: /bright|downtown|location|den|bedroom|check-?in/i },
  { id: "jennifer", guest: "Jennifer", stars: 5, review: "We loved the pool and gym in the building, and the unit was spotless. The host was friendly and communication was great.", private: "", thread: ["Could you pick up a paper towel roll for us?"], need: /pool|gym|spotless|clean|host|communication/i },
  { id: "marco", guest: "Marco", stars: 4, review: "Nice stay overall. Great views at night and a comfortable mattress. The elevator wait was long in the mornings.", private: "", thread: [], need: /view|mattress/i },
  { id: "nina", guest: "Nina", stars: 5, review: "Spacious, stylish and exactly like the photos. We loved walking to restaurants and the subway. Would stay again for sure!", private: "", thread: [], need: /space|spacious|stylish|photos|restaurants|subway|walking/i },
];
const LEAK = /shower door|washing machine|washer|showerhead|shower head|pommeau|poubelle|\bbin\b|paper towel|bed frame|creak|leak|stuck|track/i;
installWorld({
  now: nowQ,
  properties: [U606],
  reservations: FIX.map((row, index) => ({
    id: `res-${row.id}`,
    code: `HM${index}`,
    propertyId: U606.id,
    status: "accepted",
    checkIn: "2026-09-01",
    checkOut: "2026-09-05",
    guest: row.guest,
    adults: 2,
    children: 0,
    messages: row.thread.map((body, at) => ({ id: `${row.id}-${at}`, at: `2026-09-02T1${at}:00:00Z`, role: "guest" as const, name: row.guest, body })),
  })),
  gmail: [],
  outlook: [],
  memory: [],
  items: [],
  reviews: FIX.map((row, index) => ({
    id: row.id,
    propertyId: U606.id,
    reservationId: `res-${row.id}`,
    guest: row.guest,
    platform: "airbnb",
    reviewedAt: `2026-10-${String(14 - index).padStart(2, "0")}T12:00:00Z`,
    rating: row.stars,
    publicReview: row.review,
    privateFeedback: row.private,
  })),
});
const queue = await loadReviewQueue(nowQ);
if (!queue.connected) fail(`queue ${queue.line}`);
const byId = new Map(queue.reviews.map((row) => [row.id, row]));
const lines: string[] = [];
const openingSeen = new Map<string, string>();
const closingSeen = new Map<string, string>();
for (const row of FIX) {
  const got = byId.get(row.id);
  if (!got) fail(`${row.id} missing from the queue`);
  const draft = got.draft;
  lines.push(`${row.guest} (${row.stars}★): ${draft}`);
  if (!draft.trim()) fail(`${row.id} has no draft`);
  if (LEAK.test(draft)) fail(`${row.id} leaks a private fact: ${draft}`);
  if (!row.need.test(draft)) fail(`${row.id} names nothing from its own review: ${draft}`);
  if (/\u2014/.test(draft)) fail(`${row.id} has an em dash`);
  if (got.sourceLine !== SOURCE_PUBLIC) fail(`${row.id} source line ${got.sourceLine}`);
  const sentences = sentencesOf(draft);
  const first = norm(withoutName(sentences[0] ?? "", row.guest));
  const last = norm(withoutName(sentences[sentences.length - 1] ?? "", row.guest));
  if (openingSeen.has(first)) fail(`${row.id} shares an opening with ${openingSeen.get(first)}: ${first}`);
  openingSeen.set(first, row.id);
  if (sentences.length > 1) {
    if (closingSeen.has(last)) fail(`${row.id} shares a closing with ${closingSeen.get(last)}: ${last}`);
    closingSeen.set(last, row.id);
  }
  if (!new RegExp(`\\b${row.guest.split(" ")[0]}\\b`).test(draft)) fail(`${row.id} never uses the guest's name`);
  if ((draft.match(new RegExp(`\\b${row.guest.split(" ")[0]}\\b`, "g")) ?? []).length > 1) fail(`${row.id} repeats the name`);
  if (/^[^,]+, we('re| are) (really )?glad/i.test(draft)) fail(`${row.id} stiff opening: ${draft}`);
}
// Every sentence in the queue differs from every other sentence apart from the name.
const allSentences = new Map<string, string>();
for (const row of FIX) {
  for (const sentence of sentencesOf(byId.get(row.id)!.draft)) {
    const key = norm(withoutName(sentence, row.guest));
    if (allSentences.has(key)) fail(`${row.id} and ${allSentences.get(key)} share a sentence: ${key}`);
    allSentences.set(key, row.id);
  }
}
for (const french of ["edith", "virginie"]) {
  const draft = byId.get(french)!.draft;
  if (/\b(the|and|was|were|your|stay|thank|we're|glad|hope|welcome|you)\b/i.test(draft)) fail(`${french} is not fully French: ${draft}`);
  if (!/\b(merci|plaisir|ravi|heureux|content|belle|bien|revoir|accueillir|accueil)\b/i.test(draft)) fail(`${french} is not French: ${draft}`);
}
const wordsOf = (id: string) => byId.get(id)!.draft.split(/\s+/).length;
if (sentencesOf(byId.get("samuel")!.draft).length > 2 || wordsOf("samuel") > 28) fail(`Samuel's two-line review got a long reply: ${byId.get("samuel")!.draft}`);
if (wordsOf("henry") <= wordsOf("samuel")) fail("a long review did not get a longer reply than a short one");
// One brief warm acknowledgement of a small critique, only where the review has one.
for (const id of ["henry", "josh", "lindsay"]) {
  const draft = byId.get(id)!.draft;
  if (!/window|parking|spot|den|space|cramp|tight|clean/i.test(draft)) fail(`${id} ignored its small critique: ${draft}`);
  if (/\b(actually|however|but we|not our fault|you're wrong)\b/i.test(draft)) fail(`${id} is defensive: ${draft}`);
}
for (const id of ["samuel", "edith", "nina", "gakte", "jennifer"]) {
  if (/windows|parking|elevator|cramped|too small|tight/i.test(byId.get(id)!.draft)) fail(`${id} acknowledges a critique that is not in its review: ${byId.get(id)!.draft}`);
}
if (posts.length) fail("loading the queue posted");
console.log(lines.join("\n\n"));

// The model seam cannot slip a private fact or a wrong language past the checks.
resetReviewAi();
const modelSaw: string[] = [];
setReviewModel(async (_system, user) => {
  modelSaw.push(user);
  if (/Henry/.test(user)) return "Thanks Henry! So glad you enjoyed the balcony. We'll sort the shower door right away.";
  if (/Edith/.test(user)) return "Merci Edith! We loved hosting you.";
  return "Thanks so much! Hope to see you again.";
});
const henryAi = await writeReviewAi({ guest: "Henry", stars: 5, review: FIX[3]!.review, privateFeedback: FIX[3]!.private, property: "Unit #606", messages: [{ role: "guest", body: FIX[3]!.thread[0]! }], reservation: "", hub: "" });
if (henryAi?.kind !== "reply" || LEAK.test(henryAi.reply)) fail(`model leak reached the draft: ${JSON.stringify(henryAi)}`);
if (/shower door|washing machine|paper towel/i.test(modelSaw[0] ?? "")) fail("private facts were sent to the public-reply prompt");
const edithAi = await writeReviewAi({ guest: "Edith", stars: 5, review: FIX[0]!.review, privateFeedback: "", property: "Unit #606", messages: [], reservation: "", hub: "" });
if (edithAi?.kind !== "reply" || /\b(we|loved|hosting)\b/i.test(edithAi.reply)) fail(`English model reply kept for a French review: ${JSON.stringify(edithAi)}`);
setReviewModel(null);

// The checker itself.
const memory = newVoiceMemory();
const sameOpen = checkReviewReply({ reply: "Thanks Henry! Loved hearing about the balcony.", review: FIX[3]!.review, guest: "Henry", memory });
if (!sameOpen.ok) fail(`a good reply failed: ${sameOpen.problems.join(", ")}`);
if (checkReviewReply({ reply: "Thanks Henry! The shower door is fixed.", review: FIX[3]!.review, guest: "Henry" }).ok) fail("a fact not in the review passed");
if (checkReviewReply({ reply: "Thanks Edith! We loved the clean apartment.", review: FIX[0]!.review, guest: "Edith", language: reviewLanguage(FIX[0]!.review) }).ok) fail("English reply to a French review passed");
if (reviewLanguage("Nous avons adoré le séjour").code !== "fr" || reviewLanguage("Great stay").code !== "en") fail("language detection");

// A thin review regenerates in place without touching the conversation.
const stub: string[] = [];
setHospitableProbe(async (token, name) => {
  if (token !== GOOD) throw new Error("rejected");
  stub.push(name);
  return { data: [] };
});
const again = await regenerateFromConnection({ guest: "Nina", review: FIX[9]!.review, current: "", reservationId: "res-nina", propertyId: U606.id, stars: 5 });
if (again.unchanged || !again.draft.trim() || LEAK.test(again.draft)) fail(`regenerate ${JSON.stringify(again)}`);
if (again.sourceLine !== SOURCE_PUBLIC) fail(`regenerate source ${again.sourceLine}`);
if (stub.includes("get-reservation-messages")) fail("a public reply read the conversation");
if (posts.length) fail("regenerate posted");
setHospitableProbe(null);

const care = seedDraft("Casey", "The bed was too soft.", 3);
if (!reviewNeedsCare("The bed was too soft.") || !care || /sorry for/i.test("") ) fail(`soft bed care ${care}`);
if (reviewSummary(2, 1) !== "2 reviews waiting. 1 needs care.") fail("summary");
if (reviewSummary(0, 0, "Unit #606") !== "No reviews waiting at Unit #606.") fail("empty summary");
const ranked = rankReviews([
  { id: "b", stars: 5, reviewedAt: "2026-10-08", review: "Great", returned: false },
  { id: "a", stars: 1, reviewedAt: "2026-10-01", review: "Short", returned: false },
]);
if (ranked[0]?.id !== "a") fail("ranking");
await submitReviewReply("res-nina", again.draft, "Nina", "Unit #606", 5);
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
setReviewModel(async (_system, user) => {
  prompts.push(user);
  if (/low Airbnb guest review/.test(_system)) {
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
setReviewModel(null);

// "Thank you Kahina for…": no commas around the name after the thanks.
if (thanksByName("Thank you, Kahina, for the wonderful review.") !== "Thank you Kahina for the wonderful review.") fail("commas kept around the name");
if (thanksByName("Thank you, Marty and Jenny, for the kind words.") !== "Thank you Marty and Jenny for the kind words.") fail("two names split");
if (thanksByName("Thank you for staying, Don.") !== "Thank you for staying, Don.") fail("a later comma was removed");

// ---------- Adjust: length and tone only, chained, idempotent, grounded ----------

const postsBefore = posts.length;
const lindsayReview = "Perfect for our family trip. The kids loved the games in the den and the downtown location was ideal. The den was a bit cramped though.";
const lindsayLong = "Thank you Lindsay, we are really glad your family chose our home for this trip. It was lovely to hear that everyone settled in so well. We are so happy the games were such a hit with the kids. Thanks for mentioning the den, we will look into it. We hope the downtown location suited you. Safe travels!";
const short = adjustDraft({ draft: lindsayLong, review: lindsayReview, guest: "Lindsay", stars: 5, kind: "shorter" });
const shortSentences = sentencesOf(short.draft);
if (!short.changed || shortSentences.length < 2 || shortSentences.length > 3) fail(`Lindsay shorter shape: ${short.draft}`);
if (!/family/i.test(short.draft) || !/games/i.test(short.draft) || !/Lindsay/.test(short.draft)) fail(`Lindsay shorter lost her family or the games: ${short.draft}`);
if (short.draft.split(/\s+/).length > lindsayLong.split(/\s+/).length * 0.65) fail(`Lindsay shorter is not about half: ${short.draft}`);
const stiff = "Lindsay, we're really glad the family loved the games.";
const warmer = adjustDraft({ draft: stiff, review: lindsayReview, guest: "Lindsay", stars: 5, kind: "personal" });
if (warmer.draft !== "Thanks Lindsay! We're really glad the family loved the games.") fail(`stiff to personal: ${warmer.draft}`);
const samuelShort = "Thanks Samuel, that's great to hear! Wonderful that the location stood out for you.";
const samuelAgain = adjustDraft({ draft: samuelShort, review: "Amazing location. Great host.", guest: "Samuel", stars: 5, kind: "shorter" });
if (samuelAgain.changed || samuelAgain.draft !== samuelShort) fail(`Samuel shorter changed a short reply: ${samuelAgain.draft}`);
for (const kind of ADJUST_KINDS) {
  const once = adjustDraft({ draft: lindsayLong, review: lindsayReview, guest: "Lindsay", stars: 5, kind });
  const twice = adjustDraft({ draft: once.draft, review: lindsayReview, guest: "Lindsay", stars: 5, kind });
  if (twice.draft !== once.draft) fail(`${kind} twice stacked: ${once.draft} | ${twice.draft}`);
  if (/\u2014/.test(once.draft) || LEAK.test(once.draft)) fail(`${kind} broke grounding`);
  if (!/Lindsay/.test(once.draft) || !/(games|family)/i.test(once.draft)) fail(`${kind} lost the facts: ${once.draft}`);
}
const casual = adjustDraft({ draft: lindsayLong, review: lindsayReview, guest: "Lindsay", stars: 5, kind: "casual" });
if (/we are|We are|Thank you/.test(casual.draft) || !/we're/i.test(casual.draft)) fail(`casual: ${casual.draft}`);
const formal = adjustDraft({ draft: "Thanks Lindsay! We're so glad the family loved the games, we'll keep an eye on the den!", review: lindsayReview, guest: "Lindsay", stars: 5, kind: "professional" });
if (/!|We're|we'll/.test(formal.draft) || !/Thank you Lindsay/.test(formal.draft) || !/games/.test(formal.draft)) fail(`professional: ${formal.draft}`);
const friendly = adjustDraft({ draft: "Thank you Lindsay. We are glad the family loved the games. Safe travels.", review: lindsayReview, guest: "Lindsay", stars: 5, kind: "friendlier" });
if (!friendly.draft.endsWith("!") || !/so glad/.test(friendly.draft) || !/games/.test(friendly.draft)) fail(`friendlier: ${friendly.draft}`);
// Chained on edits the partner made: Shorter, then Friendlier, each on the current text.
const edited = `${lindsayLong} Our hosts are looking forward to the next visit.`;
const step1 = adjustDraft({ draft: edited, review: lindsayReview, guest: "Lindsay", stars: 5, kind: "shorter" });
const step2 = adjustDraft({ draft: step1.draft, review: lindsayReview, guest: "Lindsay", stars: 5, kind: "friendlier" });
if (!step1.changed || !step2.changed || step2.draft.split(/\s+/).length > step1.draft.split(/\s+/).length + 3) fail(`chain: ${step1.draft} | ${step2.draft}`);
// A French reply is adjusted in French, and an adjustment never adds a detail the review didn't name.
const frAdj = adjustDraft({ draft: byId.get("virginie")!.draft, review: FIX[1]!.review, guest: "Virginie", stars: 5, kind: "professional" });
if (/\b(the|and|thanks)\b/i.test(frAdj.draft)) fail(`French adjust: ${frAdj.draft}`);
for (const kind of ADJUST_KINDS) {
  const out = adjustDraft({ draft: byId.get("henry")!.draft, review: FIX[3]!.review, guest: "Henry", stars: 5, kind });
  if (LEAK.test(out.draft) || /(parking|pool|gym|kitchen|elevator)/i.test(out.draft)) fail(`${kind} added a detail: ${out.draft}`);
}
if (posts.length !== postsBefore) fail("adjust posted");

console.log("Reviews harness passed.");
