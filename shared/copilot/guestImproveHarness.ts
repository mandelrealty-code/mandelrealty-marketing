/**
 * Improve with AI is a rewrite for quality, not a proofread: clearer, warmer, complete sentences, in the guest's order, in the
 * host's voice. Every fact and decision in the partner's text survives exactly; nothing new is added (no commitment, offer,
 * fact or apology, no hedge); anything still unanswered is named in one plain line; a clean draft comes back as it was; and
 * Improve itself sends nothing.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { improveGuestDraft, improveGuestMessage, improveGuestReview, resetGuestMessaging, setImproveModel } from "./guestMessaging.js";
import { improvementProblems, isCleanDraft, rewriteDraft, unansweredLine } from "./guestImprove.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";

function fail(message: string): never {
  throw new Error(`Guest improve harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();
resetGuestMessaging();
resetCaptures();

const numbers = (text: string) => (text.match(/\$?\d[\d,.:]*(?:\s?(?:am|pm))?/gi) ?? []).map((value) => value.toLowerCase().replace(/\s+/g, "").replace(/[.,:]+$/, "")).sort().join("|");
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);

// ---------- Fixture 1: a rough draft becomes a warm, complete message, and only the quality changes ----------
const ROUGH = "hi ya unit ready at 4 parking is the p4 spot code comes by email let me know if u need anything";
const one = await improveGuestReview(ROUGH, "Rebecca", "20 Blue Jays Way Unit 318");
if (!one.changed) fail("a rough draft came back unchanged");
for (const [pattern, what] of [[/^Hi Rebecca,/, "a greeting by name"], [/ready at 4\b/, "ready at 4"], [/Parking is the P4 spot/, "parking is the P4 spot"], [/code comes by email/, "code comes by email"], [/let me know if you need anything/i, "the offer to help the partner wrote"]] as const) {
  if (!pattern.test(one.text)) fail(`fixture 1 is missing ${what}:\n${one.text}`);
}
if (/\bya\b|\bu\b|\bp4\b|\bpls\b/.test(one.text)) fail(`shorthand survived:\n${one.text}`);
for (const sentence of sentences(one.text)) {
  if (!/^[A-Z]/.test(sentence) || !/[.!?,]$/.test(sentence)) fail(`not a complete sentence "${sentence}":\n${one.text}`);
}
if (numbers(one.text) !== numbers(ROUGH)) fail(`a number was added or lost: ${numbers(one.text)} vs ${numbers(ROUGH)}`);
if (improvementProblems(ROUGH, one.text).length) fail(`the rewrite adds or drops something: ${improvementProblems(ROUGH, one.text).join(", ")}`);
if (/\b(PM|AM)\b|sorry|apolog|we'll|i'll|happy to|free|complimentary/i.test(one.text)) fail(`something new was added:\n${one.text}`);
if (/\n/.test(one.unanswered) || one.unanswered) fail(`nothing was left unanswered (no guest message given): ${one.unanswered}`);
if (one.text.split("\n\n").length !== 3) fail(`structure: a greeting, the facts, then the closing line:\n${one.text}`);

// ---------- Fixture 2: a decision stays a decision ----------
const two = await improveGuestReview("we can do 2pm check in", "Lee");
if (!/2pm check-in/.test(two.text) || !/We can do/.test(two.text)) fail(`fixture 2 changed or moved the decision:\n${two.text}`);
if (/\b(maybe|perhaps|hopefully|might|possibly|try|should|if possible|subject to|hope)\b/i.test(two.text)) fail(`fixture 2 was hedged:\n${two.text}`);
if (numbers(two.text) !== "2pm") fail(`the time moved: ${numbers(two.text)}`);
const withNo = await improveGuestReview("yes we can do 2pm check in but no early bag drop thx", "Lee");
if (!/2pm check-in/.test(withNo.text) || !/\bno early bag drop\b/.test(withNo.text) || !/^Yes, we can do/m.test(withNo.text) || /Hopefully|if possible/i.test(withNo.text)) fail(`a yes and a no both survive:\n${withNo.text}`);

// ---------- Fixture 3: a clean, complete draft comes back as it was ----------
const CLEAN = "Hi Rebecca,\n\nYour unit is ready at 4. Parking is the P4 spot, and the code comes by email.\n\nPlease let me know if you need anything.";
if (!isCleanDraft(CLEAN)) fail("a clean draft wasn't recognized as clean");
const three = await improveGuestReview(CLEAN, "Rebecca");
if (three.text !== CLEAN || three.changed) fail(`a clean draft was changed:\n${three.text}`);
// Even a model that wants to pad is never asked: the clean draft is returned.
let asked = 0;
setImproveModel(async () => { asked += 1; return `${CLEAN}\n\nWe will also leave fresh towels and a welcome basket, and we are so sorry for any inconvenience.`; });
const padded = await improveGuestReview(CLEAN, "Rebecca");
if (padded.text !== CLEAN || asked) fail(`a clean draft was padded or sent to a model: ${padded.text}`);
setImproveModel(null);

// ---------- A model's rewrite is used only when it keeps every fact and adds nothing ----------
const seen: { guestMessage?: string; voice?: string[] }[] = [];
const model = (reply: string) => setImproveModel(async (input) => { seen.push({ guestMessage: input.guestMessage, voice: input.voice }); return reply; });
const cases: [string, string, string][] = [
  ["a good rewrite", "Hi Rebecca, your unit is ready at 4. Parking is the P4 spot, and the code comes by email. Let me know if you need anything.", "used"],
  ["a moved time", "Hi Rebecca, your unit is ready at 5. Parking is the P4 spot. The code comes by email.", "rejected"],
  ["a changed time format", "Hi Rebecca, your unit is ready at 4:00 PM. Parking is the P4 spot. The code comes by email.", "rejected"],
  ["a dropped fact", "Hi Rebecca, your unit is ready at 4. Parking is available. The code comes by email.", "rejected"],
  ["an apology", "Hi Rebecca, sorry for the wait. Your unit is ready at 4. Parking is the P4 spot. The code comes by email.", "rejected"],
  ["a new offer", "Hi Rebecca, your unit is ready at 4. Parking is the P4 spot. The code comes by email. We'll leave you some snacks.", "rejected"],
  ["a new fact", "Hi Rebecca, your unit is ready at 4. Parking is the P4 spot on level 2. The code comes by email.", "rejected"],
  ["a hedge", "Hi Rebecca, your unit should be ready at 4. Parking is the P4 spot. The code comes by email.", "rejected"],
  ["padding", `Hi Rebecca, your unit is ready at 4. ${"Parking is the P4 spot. ".repeat(1)}The code comes by email. We hope you have a lovely stay. The building is close to everything. You are going to love the neighbourhood. Check out the view from the balcony. Enjoy the city.`, "rejected"],
];
for (const [label, reply, want] of cases) {
  model(reply);
  const result = await improveGuestReview(ROUGH, "Rebecca", "20 Blue Jays Way Unit 318", { guestMessage: "Is the unit ready? Where do we park?", voice: ["Hi Dana, welcome! Parking is the tandem spot.", "Hi Lee, the code comes by email."] });
  const used = result.text === reply;
  if (want === "used" && !used) fail(`${label}: a rewrite that kept every fact was not used:\n${result.text}`);
  if (want === "rejected") {
    if (used) fail(`${label}: a bad rewrite replaced the partner's text:\n${result.text}`);
    if (!/ready at 4/.test(result.text) || !/Parking is the P4 spot/.test(result.text) || !/code comes by email/.test(result.text)) fail(`${label}: the fallback lost a fact:\n${result.text}`);
  }
}
setImproveModel(null);
if (!seen.every((row) => row.guestMessage === "Is the unit ready? Where do we park?" && row.voice?.length === 2)) fail(`the model wasn't given the guest's message and the host's voice: ${JSON.stringify(seen[0])}`);
// A "no" a model drops is a lost decision.
if (!improvementProblems("no early bag drop, we can do 2pm", "We can do 2pm and an early bag drop.").some((line) => /no, a not/.test(line))) fail("a dropped no passed");

// ---------- In the guest's order, and what is left unanswered ----------
const GUEST = "Hi! What time can we get in? Also is there wifi? And where do we park?";
const ordered = rewriteDraft("parking is the p4 spot. we can do 2pm check in", { first: "Lee", guestMessage: GUEST });
if (ordered.indexOf("2pm check-in") > ordered.indexOf("Parking is the P4 spot")) fail(`the guest asked about arrival first:\n${ordered}`);
const improved = await improveGuestReview("parking is the p4 spot. we can do 2pm check in", "Lee", "", { guestMessage: GUEST });
if (improved.unanswered !== "Still unanswered: the Wi-Fi.") fail(`the unanswered line: ${JSON.stringify(improved.unanswered)}`);
if (/wi-?fi|password|internet/i.test(improved.text)) fail(`an answer was invented for the Wi-Fi:\n${improved.text}`);
if (/\n/.test(improved.unanswered)) fail("the unanswered note must be one line");
if (unansweredLine("Thanks so much!", "Hi Lee,\n\nOkay.") !== "") fail("a thank-you left something unanswered");
if (unansweredLine("What time can we get in?", "Hi Lee,\n\nWe can do 2pm check-in.") !== "") fail("an answered question was reported");
if (unansweredLine("Where do we park? Is there wifi? Do you have a crib? Can we bring a dog?", "Hi Lee,\n\nOkay.") !== "Still unanswered: the parking, the Wi-Fi, “Do you have a crib?” and 1 more.") fail(`several unanswered: ${unansweredLine("Where do we park? Is there wifi? Do you have a crib? Can we bring a dog?", "Hi Lee,\n\nOkay.")}`);

// ---------- Compatibility, and nothing is ever sent ----------
if (!/please/i.test(improveGuestDraft("pls confirm the bag drop on Oct 14 for $50", "Maya")) || !improveGuestDraft("pls confirm the bag drop on Oct 14 for $50", "Maya").includes("$50")) fail("the plain rewrite lost a fact");
if ((await improveGuestMessage("pls confirm the bag drop on Oct 14 for $50", "Maya")).includes("$50") === false) fail("improveGuestMessage lost a fact");
if (improveGuestDraft("", "Maya") !== "") fail("an empty draft");

let payload: { draft?: string; unanswered?: string; changed?: boolean } = {};
await handleCopilot(
  { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "guests-improve", text: ROUGH, guest: "Rebecca", property: "20 Blue Jays Way Unit 318", guestMessage: "Is the unit ready? Where do we park? Is there wifi?", voice: [] }, query: {} } as never,
  { status() { return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
);
if (!/^Hi Rebecca,/.test(payload.draft ?? "") || payload.changed !== true || payload.unanswered !== "Still unanswered: the Wi-Fi.") fail(`the improve op: ${JSON.stringify(payload)}`);
if (capturedCommits().length) fail("Improve sent something");

console.log("Guest improve harness passed.");
