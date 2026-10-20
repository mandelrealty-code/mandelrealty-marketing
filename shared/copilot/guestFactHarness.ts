/**
 * The Oct 20 live failure, replayed: "did rebecca send her car detials" (Rebecca, 20 Blue Jays Way Unit 318, Oct 21-25).
 * Copilot searched email, answered no twice, asked whether she had a reservation, and drafted the parking email without the
 * car she had already sent.
 *
 *  1. A guest fact is answered from the guest's reservation and their full thread, never from email first, never by asking.
 *  2. A failed or shallow thread read is never turned into a "no".
 *  3. The building email carries the facts already found, and drops the template's "provide shortly" line.
 *  4. A request found in a thread read for another reason still opens its follow-up, once.
 *  6. A follow-up stands on a quote from its own guest's thread, is re-checked against it every run, and no fact travels
 *     between threads.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { forgetGuestProcessMemory, loadGuestQueue, readSavedGuestQueue, resetGuestMessaging } from "./guestMessaging.js";
import { capturedCommits, capturedDrafts, capturedMailQueries, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld, pushParityMessage, type ParityMail, type ParityReservation } from "./parity/world.js";
import { resetParityChecksMessages } from "./parity/storeStub.js";
import { saveGuestQueueSnapshot } from "./store.js";
import { vehiclesFrom, noCarSaid } from "./guestVehicle.js";
import { advertisedPages, readAdvertisedPages } from "./hospitableConnection.js";
import { findGuestName, stayRange, topicOf } from "./guestFacts.js";
import { verifyFollowUp } from "./guestFollowUps.js";
import type { GuestFollowUp } from "./guestTypes.js";

function fail(message: string): never {
  throw new Error(`Guest fact harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

type Reply = { body: string; steps?: { text: string }[] | null };

async function send(chatId: string, text: string): Promise<Reply> {
  let payload: { messages?: (Reply & { role: string })[]; error?: string } = {};
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text, chatId, kind: "chat" }, query: {} } as never,
    { status() { return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
  );
  const reply = [...(payload.messages ?? [])].reverse().find((row) => row.role === "assistant");
  if (!reply) fail(`no answer to "${text}": ${payload.error ?? ""}`);
  return reply;
}

const BUILDING = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
const NOW = "2026-10-20T10:00:00-04:00";
const RES = { rebecca: "00000000-0000-4000-8000-0000000b0001", eloise: "00000000-0000-4000-8000-0000000b0002", marta: "00000000-0000-4000-8000-0000000b0003", dana: "00000000-0000-4000-8000-0000000b0004" };

function stay(id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, messages: ParityReservation["messages"] = [], extra: Partial<ParityReservation> = {}): ParityReservation {
  return { id, code: id.slice(-6).toUpperCase(), propertyId, status: "accepted", checkIn, checkOut, guest, adults: 2, children: 0, messages, ...extra };
}

const HOST_ASK = "Hi Rebecca, thanks for booking! We like to leave a few welcome snacks for our guests. Do you have any allergies or dietary restrictions (nuts, gluten, lactose, etc.)? Parking is the tandem spot P4-62. Please send the make, model, colour and licence plate of your car.";
const REBECCA_SAYS = "Thank you so much! I have a gluten allergy. Likely just an hour before, even if I could just use the parking spot to feed the babe in the car that would be fine. Car is a Nissan Rogue CDDD 686 Thank you so much.";
const msg = (id: string, at: string, role: "guest" | "host", name: string, body: string) => ({ id, at, role, name, body });

// What the hosts sent the building last time: the car wasn't known yet.
const TEMPLATE_BODY = [
  "Hello,", "",
  "Please see below the details for our AirBNB guest in Unit 318.", "",
  "Guest: Diane", "Check-in: October 14, 2026", "Check-out: October 17, 2026", "",
  "We will provide the vehicle information shortly.", "",
  "Thank you,", "", "Shane, Co-Host 647-822-0448",
].join("\n");
const sentTemplate: ParityMail = {
  id: "diane-reg", mailbox: "gmail", folder: "sent", from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: BUILDING,
  date: "2026-10-13T11:24:00-04:00", subject: "AirBNB Rental for Unit 318 from October 14, 2026 - October 17, 2026", snippet: "AirBNB Rental for Unit 318", body: TEMPLATE_BODY, airbnb: false,
};

function buildWorld(options: { rebeccaMessages?: ReturnType<typeof msg>[]; eloiseMessages?: ReturnType<typeof msg>[]; marta?: Partial<ParityReservation>; template?: ParityMail } = {}) {
  const world = worldAt(NOW, false, [options.template ?? sentTemplate]);
  world.reservations = [
    stay(RES.rebecca, ID.blue, "Rebecca", "2026-10-21", "2026-10-25", options.rebeccaMessages ?? [
      msg("r1", "2026-10-14T15:00:00-04:00", "host", "Shane", HOST_ASK),
      msg("r2", "2026-10-19T14:10:00-04:00", "guest", "Rebecca", REBECCA_SAYS),
    ]),
    stay(RES.eloise, ID.charlotte, "Eloise", "2026-09-29", "2026-11-07", options.eloiseMessages ?? [
      msg("e1", "2026-10-02T14:00:00-04:00", "guest", "Eloise", "Hi! Could we get an extra key and a fob for the second adult?"),
      msg("e2", "2026-10-03T09:00:00-04:00", "host", "Shane", "Yes, I'll leave an extra key and a fob with the concierge before you arrive."),
      msg("e3", "2026-10-10T18:00:00-04:00", "guest", "Eloise", "No need for the extra key, we're fine, thanks!"),
    ]),
    ...(options.marta ? [stay(RES.marta, ID.blue, "Marta", "2026-11-02", "2026-11-05", [msg("m1", "2026-10-18T12:00:00-04:00", "guest", "Marta", "Hi! Looking forward to it.")], options.marta)] : []),
  ];
  return world;
}

function reset(world: ReturnType<typeof buildWorld>) {
  installWorld(world);
  resetGuestMessaging();
  resetCaptures();
  resetParityChecksMessages();
}

// ---------- Reading what a guest wrote ----------
{
  const has = (text: string, want: { make?: string; model?: string; plate?: string }, label: string) => {
    const car = vehiclesFrom(text, "Rebecca")[0];
    if (!car || (want.make && car.make !== want.make) || (want.model && car.model !== want.model) || (want.plate && car.plate !== want.plate)) fail(`${label}: ${JSON.stringify(car)}`);
  };
  has("Car is a Nissan Rogue CDDD 686 Thank you so much.", { make: "Nissan", model: "Rogue", plate: "CDDD 686" }, "Rebecca's real wording");
  has("Nissan Rogue, plate CDDD 686", { make: "Nissan", model: "Rogue", plate: "CDDD 686" }, "comma and plate cue");
  has("nissan rogue cddd 686", { make: "Nissan", model: "Rogue", plate: "CDDD 686" }, "lowercase");
  has("Make: Mazda. Model: CX-5. Plate: CKTR902. One car.", { make: "Mazda", model: "CX-5", plate: "CKTR902" }, "labelled");
  has("Make: Nissan Model: Rogue Plate: CDDD 686", { make: "Nissan", model: "Rogue", plate: "CDDD 686" }, "labelled on one line");
  if (vehiclesFrom("Hi, this is Lincoln, looking forward to the stay!", "x").length) fail("a name was read as a car make");
  if (vehiclesFrom("plate details coming soon", "x").length) fail("a promise of a plate was read as a plate");
  if (!noCarSaid("We don't have a car, we're taking the train")) fail("no car said");
  if (noCarSaid("Car is a Nissan Rogue CDDD 686")) fail("a car was read as no car");
  // Questions about a guest's own facts, and the ones that aren't.
  if (topicOf("did rebecca send her car detials") !== "vehicle") fail("the live question wasn't a vehicle question");
  if (topicOf("does lee have any allergies?") !== "dietary") fail("dietary question");
  if (topicOf("did we send the parking email to the building for rebecca")) fail("a building-email question was taken as a guest fact");
  if (topicOf("how many check-ins are today?")) fail("an inbox count was taken as a guest fact");
  if (findGuestName("did rebecca send her car", ["Rebecca", "Lee"]) !== "Rebecca") fail("a lowercase name wasn't found");
  if (findGuestName("will she send it", ["Will"]) !== "") fail("the word will was taken for the guest Will");
  if (findGuestName("did Will send her car", ["Will"]) !== "Will") fail("the guest Will wasn't found after did");
  if (stayRange("2026-10-21", "2026-10-25") !== "Oct 21-25, 2026" || stayRange("2026-10-30", "2026-11-02") !== "Oct 30-Nov 2, 2026") fail("stay range");
  // A paged thread is read whole, or not at all.
  if (advertisedPages({ data: [], meta: { last_page: 3 } }) !== 3 || advertisedPages({ data: [] }) !== 1) fail("advertised pages");
  const pages = [{ data: [1], meta: { last_page: 3 } }, { data: [2] }, { data: [3] }];
  const merged = (await readAdvertisedPages(pages[0], async (page) => pages[page - 1])) as { data: number[] };
  if (merged.data.join() !== "1,2,3") fail(`pages merged as ${merged.data.join()}`);
  let threw = false;
  try { await readAdvertisedPages(pages[0], async (page) => { if (page === 3) throw new Error("page 3 failed"); return pages[page - 1]; }); } catch { threw = true; }
  if (!threw) fail("a thread with an unreadable page was returned as the whole thread");
}

// ---------- Fixture 1: the first question in a fresh chat ----------
reset(buildWorld());
const first = await send("gf-fresh", "did rebecca send her car detials");
for (const [pattern, why] of [[/^Yes\b/, "yes"], [/Nissan Rogue/, "make and model"], [/CDDD 686/, "plate"], [/Airbnb thread/, "from her Airbnb thread"], [/20 Blue Jays Way/, "the property"], [/Unit 318/, "unit 318"], [/Oct 21-25, 2026/, "the stay dates"]] as const) {
  if (!pattern.test(first.body)) fail(`fixture 1 is missing ${why}: ${first.body}`);
}
if (/Gmail|Outlook|\bemail\b|searched|which property|do you have a reservation|does .* have a reservation|show me|paste/i.test(first.body)) fail(`fixture 1 leaned on email or asked the partner: ${first.body}`);
if (/Searched/i.test(first.steps?.[0]?.text ?? "")) fail(`fixture 1 step: ${first.steps?.[0]?.text}`);
if (capturedMailQueries().length) fail(`fixture 1 searched email: ${JSON.stringify(capturedMailQueries())}`);
if (capturedCommits().length) fail("a lookup sent something");

// ---------- Fixture 2: the building email, in the same chat ----------
const building = await send("gf-fresh", "we need to send her the email for parking and her name and her stay like the other ones we sent to the building");
const draft = capturedDrafts().filter((row) => row.channel === "email").at(-1);
if (!draft) fail(`fixture 2 left no draft: ${building.body}`);
if (draft.to !== BUILDING) fail(`fixture 2 recipients: ${draft.to}`);
if (draft.subject !== "AirBNB Rental for Unit 318 from October 21, 2026 - October 25, 2026") fail(`fixture 2 subject: ${draft.subject}`);
for (const want of [/Nissan/, /Rogue/, /CDDD 686/, /Guest: Rebecca/, /October 21, 2026/, /October 25, 2026/, /Shane, Co-Host 647-822-0448/]) {
  if (!want.test(draft.body)) fail(`fixture 2 draft is missing ${want}: ${draft.body}`);
}
if (/provide the vehicle information shortly|\bDiane\b|October 14|October 17/i.test(draft.body)) fail(`fixture 2 kept the template's line or the old guest: ${draft.body}`);
if (/show me|paste|which guest|which property/i.test(building.body)) fail(`fixture 2 handed the question back: ${building.body}`);
if (capturedCommits().length) fail("drafting the building email sent something");

// The same request as the FIRST message of a fresh chat: the facts come from the thread itself, no round trip.
reset(buildWorld());
await send("gf-cold", "we need to send her the email for parking and her name and her stay like the other ones we sent to the building");
const cold = capturedDrafts().filter((row) => row.channel === "email").at(-1);
if (!cold || !/CDDD 686/.test(cold.body) || !/Nissan/.test(cold.body) || /provide the vehicle information shortly/i.test(cold.body)) fail(`cold request: ${cold?.body}`);

// Genuinely unknown after a full read: the line stays, and the draft says so plainly.
reset(buildWorld({ rebeccaMessages: [msg("r1", "2026-10-14T15:00:00-04:00", "host", "Shane", HOST_ASK), msg("r2", "2026-10-19T14:10:00-04:00", "guest", "Rebecca", "Thank you so much! See you on the 21st.")] }));
await send("gf-unknown", "did rebecca send her car detials").then((reply) => {
  if (!/^No\b/.test(reply.body) || !/read all 2 messages/.test(reply.body)) fail(`a verified negative: ${reply.body}`);
});
const unknown = await send("gf-unknown", "we need to send her the email for parking and her name and her stay like the other ones we sent to the building");
const unknownDraft = capturedDrafts().filter((row) => row.channel === "email").at(-1);
if (!unknownDraft || !/provide the vehicle information shortly/i.test(unknownDraft.body)) fail(`unknown car: the template line should stay: ${unknownDraft?.body}`);
if (!/I read all 2 messages in Rebecca's thread and she hasn't sent vehicle details/.test(unknown.body)) fail(`the draft didn't say plainly that the car is unknown: ${unknown.body}`);

// ---------- Fixture 3: a failed or shallow read is never a "no" ----------
reset(buildWorld({ marta: { threadUnreadable: true } }));
const failed = await send("gf-failed", "did marta send her car details");
if (/^No\b|hasn't (sent|given)|has not sent|did not send|didn't send/i.test(failed.body)) fail(`a failed thread read became a negative: ${failed.body}`);
if (!/couldn't read her messages/.test(failed.body) || !/not a "no"/.test(failed.body)) fail(`the failed read wasn't named: ${failed.body}`);
if (capturedMailQueries().length) fail("a failed read fell back to email");
const failedDraft = await send("gf-failed", "we need to send her the email for parking and her name and her stay like the other ones we sent to the building");
if (/is in Checks/.test(failedDraft.body) && capturedDrafts().some((row) => /Marta/.test(row.body))) fail("an email was drafted for a guest whose thread couldn't be read");
// Hospitable's own stamp says there is a newer message than the thread returned: the answer says so.
reset(buildWorld({ marta: { lastMessageAt: "2026-10-20T12:00:00Z" } }));
const shallow = await send("gf-shallow", "did marta send her car details");
if (/^No\b/.test(shallow.body) || !/can't confirm/.test(shallow.body)) fail(`a shallow read became a negative: ${shallow.body}`);
// A guest who isn't in the records at all: said plainly, never asked about.
const stranger = await send("gf-stranger", "did zxqvbn send her car details");
if (!/don't see a guest named zxqvbn/.test(stranger.body) || /which property|do you have a reservation/i.test(stranger.body)) fail(`an unknown guest: ${stranger.body}`);

// ---------- Rule 4: a request in a thread read for another reason still opens its follow-up, once ----------
reset(buildWorld({ rebeccaMessages: [msg("r1", "2026-10-14T15:00:00-04:00", "host", "Shane", HOST_ASK)] }));
await loadGuestQueue(new Date(NOW));
if ((await readSavedGuestQueue())?.followUps.some((row) => row.reservationId === RES.rebecca)) fail("Rebecca had a follow-up before she wrote");
pushParityMessage(RES.rebecca, msg("r2", "2026-10-19T14:10:00-04:00", "guest", "Rebecca", REBECCA_SAYS));
await send("gf-side", "did rebecca send her car detials");
const sideRows = ((await readSavedGuestQueue())?.followUps ?? []).filter((row) => row.reservationId === RES.rebecca);
if (sideRows.length !== 1) fail(`the early-arrival ask should open exactly one follow-up from a chat read: ${sideRows.length}`);
const side = sideRows[0]!;
if (side.kind !== "ask" || side.tag !== "" || !/early check-in/i.test(side.line)) fail(`the follow-up: ${JSON.stringify({ kind: side.kind, tag: side.tag, line: side.line })}`);
if (!side.agreed.includes("an hour before") || side.grounding?.quote !== side.agreed || side.grounding?.role !== "guest") fail(`the follow-up doesn't quote her own words: ${JSON.stringify(side.grounding)}`);
if (/key/i.test(JSON.stringify(sideRows))) fail("a key appeared on Rebecca's thread");
const scanned = await loadGuestQueue(new Date(NOW));
if (scanned.followUps.filter((row) => row.reservationId === RES.rebecca).length !== 1) fail("the next scan duplicated the follow-up");
if (!/early check-in at 3 PM/.test(side.line)) fail(`the follow-up should name the time an hour before a 4 PM check-in: ${side.line}`);
// It closes when the host's reply grants it.
pushParityMessage(RES.rebecca, msg("r3", "2026-10-19T16:00:00-04:00", "host", "Shane", "Thank you Rebecca, I've registered the Nissan and noted the gluten allergy. An hour early works, see you at 3 PM."));
const granted = await loadGuestQueue(new Date(NOW));
if (granted.followUps.some((row) => row.reservationId === RES.rebecca)) fail(`the host granted it and the follow-up stayed: ${JSON.stringify(granted.followUps.map((row) => row.line))}`);

// ---------- Rule 6: grounded in a quote from the same thread ----------
reset(buildWorld());
const q1 = await loadGuestQueue(new Date(NOW));
if (q1.followUps.some((row) => row.reservationId === RES.rebecca && row.kind !== "ask")) fail("Rebecca's thread carries something other than her early-arrival ask");
if (q1.followUps.some((row) => row.reservationId === RES.rebecca && /key/i.test(row.line))) fail("an 'Extra key' follow-up exists on Rebecca's thread");
if (q1.followUps.some((row) => row.reservationId === RES.eloise)) fail(`Eloise declined on Oct 10, so her key follow-up must be closed: ${JSON.stringify(q1.followUps.filter((row) => row.reservationId === RES.eloise).map((row) => row.line))}`);
for (const row of q1.followUps) {
  if (row.kind === "inquiry") continue;
  if (!row.grounding?.quote) fail(`a follow-up with no quote: ${row.line}`);
}

// Eloise before she declined: her ask is a valid key follow-up, grounded in her own October 2 message.
reset(buildWorld({ eloiseMessages: [
  msg("e1", "2026-10-02T14:00:00-04:00", "guest", "Eloise", "Hi! Could we get an extra key and a fob for the second adult?"),
  msg("e2", "2026-10-03T09:00:00-04:00", "host", "Shane", "Yes, I'll leave an extra key and a fob with the concierge before you arrive."),
] }));
const q2 = await loadGuestQueue(new Date(NOW));
const eloise = q2.followUps.find((row) => row.reservationId === RES.eloise);
if (!eloise || !/key/i.test(eloise.line)) fail(`Eloise's key follow-up should exist: ${JSON.stringify(q2.followUps.map((row) => row.line))}`);
if (!/extra key and a fob/.test(eloise.grounding?.quote ?? "") || eloise.grounding?.role !== "guest" || eloise.grounding?.at !== "2026-10-02T14:00:00-04:00") fail(`Eloise's grounding: ${JSON.stringify(eloise.grounding)}`);
if (!eloise.grounding?.also?.some((m) => m.as === "promise" && /extra key/.test(m.quote))) fail("the host's promise should also be quoted");
const eloiseTurns = [
  { at: "2026-10-02T14:00:00-04:00", role: "guest", name: "Eloise", body: "Hi! Could we get an extra key and a fob for the second adult?" },
  { at: "2026-10-03T09:00:00-04:00", role: "host", name: "Shane", body: "Yes, I'll leave an extra key and a fob with the concierge before you arrive." },
];
if (!verifyFollowUp(eloise, eloiseTurns).ok) fail("a grounded follow-up failed its own check");
// ...and it closes on her October 10 message declining it.
pushParityMessage(RES.eloise, msg("e3", "2026-10-10T18:00:00-04:00", "guest", "Eloise", "No need for the extra key, we're fine, thanks!"));
const q3 = await loadGuestQueue(new Date(NOW));
if (q3.followUps.some((row) => row.reservationId === RES.eloise)) fail("Eloise declined and the key follow-up stayed");

// A stale or invented follow-up cannot survive a check. Seed three ghosts on Rebecca's thread and one real one on Eloise's.
reset(buildWorld({ eloiseMessages: [
  msg("e1", "2026-10-02T14:00:00-04:00", "guest", "Eloise", "Hi! Could we get an extra key and a fob for the second adult?"),
  msg("e2", "2026-10-03T09:00:00-04:00", "host", "Shane", "Yes, I'll leave an extra key and a fob with the concierge before you arrive."),
] }));
const base = await loadGuestQueue(new Date(NOW));
const real = base.followUps.find((row) => row.reservationId === RES.eloise);
if (!real) fail("the real Eloise follow-up wasn't built");
const ghost = (id: string, grounding: GuestFollowUp["grounding"]): GuestFollowUp => ({ ...real, id, reservationId: RES.rebecca, guest: "Rebecca", first: "Rebecca", initials: "R", property: "20 Blue Jays Way Unit 318", propertyId: ID.blue, line: "Extra key promised, Rebecca agreed", topic: "Extra key", agreedAs: "agreed", ...(grounding ? { grounding } : { grounding: undefined }) });
const saved = (await readSavedGuestQueue())!;
saved.followUps = [
  real,
  ghost("owe:rebecca:key-none", undefined),
  ghost("owe:rebecca:key-copied", { quote: "Hi! Could we get an extra key and a fob for the second adult?", at: "2026-10-02T14:00:00-04:00", role: "guest", name: "Eloise" }),
  ghost("owe:rebecca:key-invented", { quote: "I have a gluten allergy.", at: "2026-10-19T14:10:00-04:00", role: "guest", name: "Rebecca" }),
];
const after = await loadGuestQueue(new Date(NOW));
if (after.followUps.some((row) => row.reservationId === RES.rebecca && /key/i.test(row.line))) fail(`a ghost 'Extra key' follow-up survived the check: ${JSON.stringify(after.followUps.map((row) => [row.id, row.line]))}`);
if (!after.followUps.some((row) => row.id === real.id)) fail("the real follow-up was closed by the check");
const closedWhy = (after.closedFollowUps ?? []).filter((row) => /^owe:rebecca:key/.test(row.id)).map((row) => row.closeText).join(" | ");
if (!/no quote|isn't in this guest's thread|doesn't mention/.test(closedWhy)) fail(`the ghosts should say why they closed: ${closedWhy}`);
// A fresh server reads the saved queue: a row with no quote is never shown, with or without a scan.
await saveGuestQueueSnapshot({ ...base, followUps: [real, ghost("owe:rebecca:key-saved", undefined)] }).catch(() => undefined);
forgetGuestProcessMemory();
const reread = await readSavedGuestQueue();
if (reread?.followUps.some((row) => /key-saved/.test(row.id))) fail("a saved follow-up with no quote was shown");
// Each check on its own.
if (verifyFollowUp(ghost("g1", undefined), eloiseTurns).ok) fail("no quote passed");
if (verifyFollowUp(ghost("g2", { quote: "Hi! Could we get an extra key and a fob for the second adult?", at: "x", role: "guest", name: "Eloise" }), [{ at: "x", role: "guest", name: "Rebecca", body: "I have a gluten allergy." }]).ok) fail("another thread's quote passed");
if (verifyFollowUp({ ...real, topic: "Towels" }, eloiseTurns).ok) fail("a topic the quote doesn't mention passed");
if (verifyFollowUp({ ...real, agreedAs: "agreed" }, eloiseTurns).ok) fail("'agreed' with no agreement quoted passed");

console.log("Guest fact harness passed.");
