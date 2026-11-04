/**
 * The watch loop's cost: a pass with nothing new calls no model, the cadence backs off while it stays quiet and snaps back
 * on a change, threads with no trigger aren't re-read, earlier items survive a pass that didn't look at them, and the day's
 * spend is split by phase. No real API is called.
 */

import { agentTools } from "./agentChat.js";
import { setBrainModel, type BrainRequest } from "./brain.js";
import { resetBusinessFacts } from "./businessFacts.js";
import { setParityClock } from "./parity/clock.js";
import { resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld, type ParityMail, type ParityReservation } from "./parity/world.js";
import { setHospitableLogger } from "../pm/hospitableClient.js";
import { torontoToday } from "./time.js";
import { costOf } from "./watchMeta.js";
import { intervalFor, resetWatch, runWatch, setWatchLogger, setWatchSource, watchDecisions, watchSpendReport, type Collected } from "./watch.js";

function fail(label: string): never {
  throw new Error(`Loop cost harness failed: ${label}`);
}

const MIN = 60_000;
const T0 = new Date("2026-11-03T15:00:00Z"); // 10 AM Toronto
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);

// ---------- The cadence rule, and the prices ----------
if ([0, 1].some((n) => intervalFor(n) !== 15) || [2, 3].some((n) => intervalFor(n) !== 30) || [4, 5, 40].some((n) => intervalFor(n) !== 60)) fail("15, then 30, then 60 minutes");
if (Math.abs(costOf("claude-haiku-4-5", 1000, 200).usd - 0.002) > 1e-9 || Math.abs(costOf("claude-sonnet-4-6", 1000, 200).usd - 0.006) > 1e-9 || costOf("seam", 1000, 200).priced) fail("what a call costs, and a model with no price isn't guessed at");

// ---------- A world with real gaps in it ----------
const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
const stay = (id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, messages: ParityReservation["messages"], status = "accepted"): ParityReservation => ({ id, code: id.toUpperCase(), propertyId, status, checkIn, checkOut, guest, adults: 2, children: 0, messages });
const msg = (id: string, when: string, role: "guest" | "host", body: string) => ({ id, at: when, role, name: role === "guest" ? "Guest" : "Shane", body });
const mail: ParityMail[] = [
  { id: "reg-old", mailbox: "gmail", folder: "sent", from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-11-02T15:00:00-05:00", subject: "AirBNB Rental for Unit 318 from November 10, 2026 - November 13, 2026", snippet: "20 Blue Jays Way Unit 318", body: "Hello,\n\nPlease see below the details for our AirBNB guest Dana Cole, November 10, 2026 to November 13, 2026.\n\nMake: Honda\nModel: Civic\nPlate: DANA123\nColour: Blue\n\nThank you,\n\nShane, Co-Host 647-822-0448", airbnb: false },
];
const base = (extra: ParityReservation[] = []) => {
  const world = worldAt("2026-11-03T10:00:00-05:00", false, mail);
  world.reservations = [
    stay("r-michelle", ID.blue, "Michelle Sanders", "2026-11-12", "2026-11-16", [msg("m1", "2026-10-29T14:00:00Z", "host", "Please send your car make, model and plate for the building."), msg("m2", "2026-10-30T18:00:00Z", "guest", "Make: Kia. Model: Soul. Plate: BXYZ456. One car.")]),
    stay("r-leo", ID.shaw, "Leo Park", "2026-11-20", "2026-11-23", [msg("l1", "2026-10-30T18:00:00Z", "guest", "Could we check in early?"), msg("l2", "2026-10-30T19:00:00Z", "host", "Yes, early check-in at 1 PM works for us.")]),
    stay("r-quiet", ID.rose, "Quinn Reed", "2026-11-25", "2026-11-28", [msg("q1", "2026-10-30T19:00:00Z", "host", "Welcome!")]),
    ...extra,
  ];
  return world;
};

let judgeCalls = 0;
let judgePrompts: string[] = [];
const decide = (surface: boolean) => async (request: BrainRequest) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" as const };
  judgeCalls += 1;
  judgePrompts.push(String(request.user ?? ""));
  const keys = [...String(request.user ?? "").matchAll(/key=(\S+)/g)].map((m) => m[1]!);
  const text = JSON.stringify({ items: keys.map((key) => ({ key, surface, reason: "Worth a look." })) });
  return { text, toolUses: [], blocks: [{ type: "text" as const, text }], stop: "end_turn" as const, usage: { input: 1200, output: 150 } };
};

setWatchSource(null);
resetWatch();
resetBusinessFacts();
resetCaptures();
installWorld(base());
const logs: Record<string, unknown>[] = [];
setWatchLogger((line) => logs.push(line));
const threadReads: string[] = [];
setHospitableLogger((line) => {
  if (/\/messages/.test(String(line.path))) threadReads.push(String(line.path));
});
setBrainModel(decide(true));

// ---------- Pass 1: the first look runs the model; everything after it, with nothing new, costs nothing ----------
setParityClock(at(0));
const first = await runWatch(at(0), { adaptive: true });
if (first.phase !== "triaged" || !first.reasons?.includes("first pass") || judgeCalls !== 1 || first.delivered < 2) fail(`the first pass: ${JSON.stringify({ phase: first.phase, judgeCalls, delivered: first.delivered })}`);
const surfaced = (await watchDecisions()).map((row) => row.key.split(":")[1]).sort().join();
if (surfaced !== "building_email,confirm_early_checkin") fail(`the gaps surfaced: ${surfaced}`);

const steps: { min: number; phase: string; interval: number }[] = [];
threadReads.length = 0;
let minute = 15;
const pass = async (when: number) => {
  setParityClock(at(when));
  const out = await runWatch(at(when), { adaptive: true });
  steps.push({ min: when, phase: out.phase ?? "", interval: out.intervalMin ?? 0 });
  return out;
};
const second = await pass(minute);
if (second.phase !== "no-change" || judgeCalls !== 1 || threadReads.length) fail(`an empty pass: ${JSON.stringify({ phase: second.phase, judgeCalls, threadReads })}`);
if (!logs.some((line) => line.watch === "no change, skipped triage")) fail(`the skip isn't logged: ${JSON.stringify(logs)}`);
// Backing off: 15, then 30, then 60. A pass that comes early isn't even checked.
minute = 30;
const third = await pass(minute);
if (third.phase !== "no-change" || third.intervalMin !== 30) fail(`after two quiet passes the interval is 30: ${JSON.stringify(steps)}`);
const early = await pass(45);
if (early.phase !== "backoff" || judgeCalls !== 1) fail(`a pass inside the back-off was run: ${JSON.stringify(steps)}`);
const fourth = await pass(60);
if (fourth.phase !== "no-change" || fourth.intervalMin !== 30) fail(`the third quiet pass: ${JSON.stringify(steps)}`);
const fifth = await pass(90);
if (fifth.phase !== "no-change" || fifth.intervalMin !== 60) fail(`after four quiet passes the interval is 60: ${JSON.stringify(steps)}`);
if ((await pass(120)).phase !== "backoff" || (await pass(140)).phase !== "backoff") fail("inside the hour nothing runs");
if (judgeCalls !== 1 || threadReads.length) fail(`a quiet stretch cost a model call or a thread read: ${judgeCalls} ${threadReads.length}`);
// The still-open items were not taken for resolved by passes that didn't look.
if ((await watchDecisions()).length !== 2) fail("a quiet pass dropped an open item");

// ---------- A change snaps the cadence back and reads only the thread that moved ----------
const moved = base([]);
moved.reservations[2]!.messages.push(msg("q2", "2026-11-03T20:30:00Z", "guest", "Hi, what time is check-in?"));
installWorld(moved);
threadReads.length = 0;
const changed = await pass(150);
if (changed.phase !== "triaged" || changed.intervalMin !== 15 || !changed.reasons?.some((reason) => /new message/.test(reason))) fail(`a new message: ${JSON.stringify(changed)}`);
// The gap reader itself reads only the thread that moved; the rest keep what earlier passes found.
const gapReads: string[] = [];
setHospitableLogger((line) => {
  if (/\/messages/.test(String(line.path))) gapReads.push(String(line.path));
});
const { collectThreadGaps } = await import("./threadGaps.js");
const onlyOne = await collectThreadGaps(at(150), new Set(["r-quiet"]));
if (gapReads.length > 1 || (gapReads[0] && !/r-quiet/.test(gapReads[0])) || onlyOne.unevaluated.length !== 2) fail(`only the changed thread should be read for gaps: ${gapReads.join()} ${onlyOne.unevaluated.join()}`);
setHospitableLogger((line) => {
  if (/\/messages/.test(String(line.path))) threadReads.push(String(line.path));
});
if ((await watchDecisions()).length !== 2) fail("a pass that read one thread dropped the other threads' open items");
const settled = await pass(165);
if (settled.phase !== "no-change") fail(`after the change, quiet again and no more reads: ${JSON.stringify(steps.at(-1))}`);

// New mail alone doesn't re-read a single thread: nothing about a reservation moved.
const mailed = base([]);
mailed.reservations[2]!.messages.push(msg("q2", "2026-11-03T20:30:00Z", "guest", "Hi, what time is check-in?"));
mailed.gmail = [...mailed.gmail, { id: "new-mail-2", mailbox: "gmail", folder: "inbox", from: "Ryan", email: "ryan@contractor.example", to: "info@mandelrealtygroup.com", date: "2026-11-03T21:30:00Z", subject: "Parts", snippet: "parts", body: "The parts arrived.", airbnb: false }];
installWorld(mailed);
threadReads.length = 0;
const mailOnly = await pass(180);
if (mailOnly.phase !== "triaged" || !mailOnly.reasons?.includes("new mail") || threadReads.length) fail(`new mail alone read threads: ${JSON.stringify({ reasons: mailOnly.reasons, threadReads })}`);
if ((await watchDecisions()).length !== 2) fail("a pass that skipped the threads dropped their open items");

// ---------- What the judgment turned down isn't judged again until it changes ----------
resetWatch();
installWorld(base());
judgeCalls = 0;
setBrainModel(decide(false));
await runWatch(at(300), { adaptive: true });
if (judgeCalls !== 1 || (await watchDecisions()).length) fail(`the judgment declined everything: ${judgeCalls}`);
const declined = base();
declined.gmail = [...declined.gmail, { id: "new-mail", mailbox: "gmail", folder: "inbox", from: "Someone", email: "someone@example.com", to: "info@mandelrealtygroup.com", date: "2026-11-03T21:00:00Z", subject: "Hello", snippet: "hi", body: "hi", airbnb: false }];
installWorld(declined);
const again = await runWatch(at(330), { adaptive: true });
if (again.phase !== "triaged" || judgeCalls !== 1) fail(`candidates the model already declined were judged again: ${judgeCalls}`);
setBrainModel(decide(true));

// ---------- Overnight the model is only for a guest who is waiting ----------
resetWatch();
installWorld(base());
judgeCalls = 0;
const night = new Date("2026-11-04T04:30:00Z"); // 11:30 PM Toronto
setParityClock(night);
const nightPass = await runWatch(night, { adaptive: true });
if (judgeCalls !== 0 || nightPass.delivered !== 0 || !nightPass.deferred) fail(`the model ran overnight for items that can wait: ${JSON.stringify({ judgeCalls, nightPass })}`);

// ---------- A threshold that passes with time re-triggers, with no state change ----------
resetWatch();
let pool: Collected = { candidates: [], failed: [], nextReviewAt: at(120).toISOString() };
setWatchSource(async () => pool);
setParityClock(at(0));
if ((await runWatch(at(0), { adaptive: true })).phase !== "triaged") fail("seam first pass");
if ((await runWatch(at(15), { adaptive: true })).phase !== "no-change") fail("seam quiet pass");
const timed = await runWatch(at(125), { adaptive: true });
if (timed.phase !== "triaged" || !timed.reasons?.some((reason) => /crossed its time floor/.test(reason))) fail(`a guest crossing the two-hour floor with no new state: ${JSON.stringify(timed)}`);
pool = { candidates: [], failed: ["Guest messages"] };
if ((await runWatch(at(260), { adaptive: true })).phase !== "triaged") fail("a source that couldn't be read can't be confirmed unchanged");
setWatchSource(null);

// ---------- A whole idle day, and what the report says ----------
resetWatch();
installWorld(base());
judgeCalls = 0;
setBrainModel(decide(true));
let ran = 0;
let skipped = 0;
for (let step = 0; step < 96; step += 1) {
  const when = new Date(T0.getTime() + step * 15 * MIN);
  setParityClock(when);
  const out = await runWatch(when, { adaptive: true });
  if (torontoToday(when) !== "2026-11-03") continue;
  if (out.phase === "backoff") skipped += 1;
  else ran += 1;
}
if (judgeCalls !== 1) fail(`an idle day made ${judgeCalls} model calls`);
if (ran > 20) fail(`an idle day still ran ${ran} checks (96 before)`);
const report = await watchSpendReport(T0, 1);
const row = report.rows[0]!;
if (row.day !== "2026-11-03" || row.modelCalls !== 1 || row.triages !== 1 || row.checks !== ran || row.skippedTriage !== ran - 1 || row.backedOff !== skipped) fail(`the day's spend: ${JSON.stringify(row)}`);
if (row.inputTokens !== 1200 || row.outputTokens !== 150 || row.unpricedTokens !== 1350) fail(`the tokens: ${JSON.stringify(row)}`);
if (!/model passes 1 \(1 call, 1350 tokens/.test(report.text) || !/no model, \$0\.0000/.test(report.text)) fail(`the report: ${report.text}`);
const viaTool = (await agentTools({ partnerText: "what has the loop cost today" }).find((tool) => tool.name === "watch_spend")!.run({ days: 1 }, "c")) as { text: string };
void viaTool;

setWatchLogger(null);
setHospitableLogger(null);
setBrainModel(null);
setParityClock(null);

console.log("Loop cost harness passed.");
