/**
 * The watch loop: judgment, quiet rules, ledger, dismissal learning, delivery to the Decisions queue.
 * Nothing is sent, booked or charged. Nothing calls a real API.
 */

import cron from "../../api/cron/follow-ups.js";
import { setBrainModel, type BrainRequest } from "./brain.js";
import { listFacts, resetBusinessFacts } from "./businessFacts.js";
import { setParityClock } from "./parity/clock.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { worldAt, ID } from "./parity/catalog.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { chatExists, deleteChat, listChats, listMessages, updateDraft } from "./store.js";
import { collectCandidates, judge, parseJudgment, quietHours, resetWatch, runWatch, setWatchSource, syncWatchLedger, watchLedger, type Candidate } from "./watch.js";

function fail(label: string): never {
  throw new Error(`Watch harness failed: ${label}`);
}

installWorld({ now: new Date("2026-10-20T15:00:00-04:00"), properties: [], reservations: [], gmail: [], outlook: [], memory: [], items: [] });
resetCaptures();
resetWatch();
resetBusinessFacts();
setBrainModel(null);

// 10 AM Toronto. Hours: 03:00Z is 23:00 the evening before; 12:30Z is 08:30.
const NOON = new Date("2026-10-20T14:00:00Z");
const NIGHT = new Date("2026-10-21T03:00:00Z");
const MORNING = new Date("2026-10-21T12:30:00Z");

const draft = { subject: "", body: "Hi Eloise, following up on the window cleaning. We can take care of it on [day and time]. Does that work for you?", to: "Eloise", status: "waiting" as const, channel: "hospitable" as const, hospitable: { tool: "send-reservation-message", args: { reservation_id: "res-1", body: "x" } } };
const item = (key: string, kind: Candidate["kind"], urgency: number, extra: Partial<Candidate> = {}): Candidate => ({ key, kind, native: false, title: `${kind} ${key}`, reason: `Because ${key}.`, property: "20 Blue Jays Way", urgency, guestWaiting: false, ...extra });
let pool: Candidate[] = [];
setWatchSource(async () => ({ candidates: pool, failed: [] }));

// ---------- Quiet hours ----------
if (quietHours(NOON) || !quietHours(NIGHT) || quietHours(MORNING)) fail("quiet hours are not 10 PM to 8 AM Toronto");
if (!quietHours(new Date("2026-10-21T02:00:00Z")) || quietHours(new Date("2026-10-21T00:30:00Z")) === true) fail("quiet hours edges (10 PM starts, 9 PM does not)");

// ---------- Ranking, delivery, once only ----------
pool = [
  item("task-1", "task", 66),
  item("followup-1", "commitment", 80, { draft }),
  item("incident-1", "incident", 88),
  item("guest-1", "guest_waiting", 70, { native: true, guestWaiting: true }),
];
const first = await runWatch(NOON);
if (first.ranked.length !== 4 || first.delivered !== 3) fail(`first pass ${JSON.stringify(first.ranked.map((r) => [r.kind, r.delivered]))}`);
const guestRow = first.ranked.find((row) => row.kind === "guest_waiting")!;
if (guestRow.delivered || guestRow.chatId) fail("a guest the Overview already shows got a second row");
const chats = (await listChats()).filter((chat) => chat.needs_you_at);
if (chats.length !== 3) fail(`${chats.length} rows in Decisions, expected one per item`);
const commitmentChat = chats.find((chat) => /commitment followup-1/.test(chat.title))!;
const messages = await listMessages(commitmentChat.id);
const waiting = messages.find((message) => message.draft)!;
if (waiting.draft?.status !== "waiting" || !/following up on the window cleaning/.test(waiting.draft.body) || !/Nothing has been sent/.test(waiting.body)) fail("the exact draft is not waiting for approval");
if (capturedCommits().length) fail("the watch loop committed something");
const again = await runWatch(new Date(NOON.getTime() + 15 * 60_000));
if (again.ranked.length || again.delivered || (await listChats()).filter((chat) => chat.needs_you_at).length !== 3) fail("an item was surfaced twice");

// ---------- Quiet hours: only a guest actively waiting ----------
resetWatch();
for (const chat of await listChats()) await deleteChat(chat.id);
pool = [item("task-2", "task", 66), item("cleaner-2", "cleaner", 90, { native: true }), item("guest-2", "guest_waiting", 70, { native: true, guestWaiting: true }), item("followup-2", "commitment", 80, { draft })];
const night = await runWatch(NIGHT);
if (night.ranked.map((row) => row.kind).join() !== "guest_waiting") fail(`overnight surfaced ${night.ranked.map((r) => r.kind).join()}`);
if (night.deferred !== 3) fail(`overnight deferred ${night.deferred}`);
if ((await listChats()).filter((chat) => chat.needs_you_at).length) fail("something non-urgent was surfaced overnight");
if ((await watchLedger()).some((row) => row.key === "task-2")) fail("a deferred item was recorded, so it would never surface at 8 AM");
const morning = await runWatch(MORNING);
if (morning.ranked.length !== 3 || morning.delivered !== 2) fail(`at 8:30 the deferred items did not surface: ${JSON.stringify(morning.ranked.map((r) => r.kind))}`);

// ---------- Dismissals: never back, and they teach ----------
resetWatch();
resetBusinessFacts();
for (const chat of await listChats()) await deleteChat(chat.id);
pool = [item("followup-3", "commitment", 80, { draft, title: "Window cleaning for Eloise is due" }), item("task-3", "task", 66, { title: "Overdue: call the locksmith" })];
await runWatch(NOON);
const rows = (await listChats()).filter((chat) => chat.needs_you_at);
if (rows.length !== 2) fail("setup");
const commitment = rows.find((chat) => /Window cleaning/.test(chat.title))!;
const task = rows.find((chat) => /locksmith/.test(chat.title))!;
await deleteChat(commitment.id);
const taskMessage = (await listMessages(task.id)).find((message) => message.draft);
if (taskMessage) fail("a task row should carry no draft");
const synced = await syncWatchLedger(NOON);
if (synced.dismissed !== 1) fail(`dismissed ${synced.dismissed}`);
if ((await chatExists(commitment.id)) || !(await chatExists(task.id))) fail("dismissal touched the wrong chat");
const learned = (await listFacts()).filter((fact) => /^Dismissed commitment alerts/.test(fact.subject));
if (learned.length !== 1 || !/dismissed 1 commitment alert at 20 Blue Jays Way/.test(learned[0]!.fact)) fail(`the dismissal was not learned: ${JSON.stringify(learned)}`);
await runWatch(new Date(NOON.getTime() + 3_600_000));
if ((await listChats()).filter((chat) => /Window cleaning/.test(chat.title)).length) fail("a dismissed item came back");
// A second dismissal of the same kind updates the same fact, it does not add one.
pool = [item("followup-4", "commitment", 80, { draft, title: "Gate repair for Noor is due" })];
await runWatch(new Date(NOON.getTime() + 7_200_000));
const second = (await listChats()).find((chat) => /Gate repair/.test(chat.title))!;
const messageId = (await listMessages(second.id)).find((message) => message.draft)!.id;
await updateDraft(messageId, { status: "held" });
await syncWatchLedger(NOON);
const after = (await listFacts()).filter((fact) => /^Dismissed commitment alerts/.test(fact.subject));
if (after.length !== 1 || !/dismissed 2 commitment alerts/.test(after[0]!.fact)) fail(`the second dismissal: ${JSON.stringify(after)}`);
// Acting on an item is not a dismissal.
pool = [item("followup-5", "commitment", 80, { draft, title: "Paint touch-up for Sam is due" })];
await runWatch(new Date(NOON.getTime() + 10_800_000));
const third = (await listChats()).find((chat) => /Paint touch-up/.test(chat.title))!;
await updateDraft((await listMessages(third.id)).find((message) => message.draft)!.id, { status: "sent" });
const handled = await syncWatchLedger(NOON);
if (handled.handled !== 1 || handled.dismissed !== 0) fail(`sending counted as a dismissal ${JSON.stringify(handled)}`);
if ((await listFacts()).filter((fact) => /^Dismissed commitment alerts/.test(fact.subject))[0]?.fact.includes("dismissed 3")) fail("a sent item taught a dismissal");

// ---------- The judgment ----------
const cands = [item("a", "task", 66), item("b", "incident", 88), item("c", "commitment", 80)];
const keys = new Set(cands.map((row) => row.key));
if (parseJudgment("nope", keys) !== null || parseJudgment("{\"items\":\"x\"}", keys) !== null) fail("bad judgment accepted");
const parsed = parseJudgment(JSON.stringify({ items: [{ key: "b", surface: true, reason: "x" }, { key: "zzz", surface: true }, { key: "b", surface: true }, { key: "a", surface: false }] }), keys)!;
if (parsed.length !== 2) fail("an invented or repeated key was accepted");
let prompt = "";
setBrainModel(async (request: BrainRequest) => {
  prompt = request.user ?? "";
  const text = JSON.stringify({ items: [{ key: "c", surface: true, reason: "Promise due today." }, { key: "b", surface: true, reason: "Incident." }, { key: "a", surface: false, reason: "Not urgent." }, { key: "ghost", surface: true, reason: "Invented." }] });
  return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
});
const judged = await judge(cands, ["The partner dismissed 2 task alerts at Roseglor."], NOON);
if (judged.ordered.map((row) => row.key).join() !== "c,b" || !judged.usedBrain) fail(`the brain's picks: ${judged.ordered.map((r) => r.key)}`);
if (judged.ordered[0]?.why !== "Promise due today.") fail("the brain's reason was dropped");
if (!/dismissed 2 task alerts at Roseglor/.test(prompt) || /ghost/.test(prompt)) fail("the judge did not see what the partner dismissed");
setBrainModel(async () => ({ text: "I think none of these matter.", toolUses: [], blocks: [{ type: "text", text: "I think none of these matter." }], stop: "end_turn" }));
const fallback = await judge(cands, [], NOON);
if (fallback.usedBrain || fallback.ordered.length !== 3) fail("a bad brain answer should leave the candidates standing");
setBrainModel(async () => null);
if ((await judge(cands, [], NOON)).ordered.length !== 3) fail("no brain should leave the candidates standing");
setBrainModel(null);
if ((await judge([], [], NOON)).ordered.length) fail("nothing to judge");

// ---------- A failed read is named and never becomes an item ----------
resetWatch();
setWatchSource(async () => ({ candidates: [], failed: ["Guest messages"] }));
const broken = await runWatch(NOON);
if (broken.ranked.length || broken.failed[0] !== "Guest messages") fail("a failed read");

// ---------- The real look over the business ----------
const world = worldAt("2026-10-14T10:00:00-04:00");
const stay = (id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, messages: ParityReservation["messages"] = []): ParityReservation => ({ id, code: id.toUpperCase(), propertyId, status: "accepted", checkIn, checkOut, guest, adults: 2, children: 0, messages });
const WINDOWS = "Yes we can send someone to clean the windows. If it's on or after October 14th, someone from my team can take care of it.";
world.reservations = [
  stay("res-eloise", ID.charlotte, "Eloise", "2026-10-01", "2026-11-07", [
    { id: "el-1", at: "2026-10-02T12:30:00Z", role: "guest", name: "Eloise", body: "The windows are quite dirty, might it be possible for these to be cleaned?" },
    { id: "el-2", at: "2026-10-07T17:01:00Z", role: "host", name: "Shane Mosoff", body: WINDOWS },
    { id: "el-3", at: "2026-10-10T15:24:00Z", role: "guest", name: "Eloise", body: "Thank you! On or after 14th is fine." },
    { id: "el-4", at: "2026-10-10T15:25:00Z", role: "host", name: "Shane Mosoff", body: "Okay I'll see what I can do for windows." },
  ]),
  stay("res-ana", ID.blue, "Ana", "2026-10-10", "2026-10-14", [
    { id: "an-1", at: "2026-10-14T01:00:00Z", role: "guest", name: "Ana", body: "Hi, the parking pass isn't working and we need to leave for the airport. Can you help?" },
  ]),
];
world.cleaner = { turnovers: [{ propertyId: ID.blue, scheduledOn: "2026-10-14", status: "scheduled", assigned: false, done: false, issue: "" }] };
installWorld(world);
setParityClock(new Date("2026-10-14T14:00:00Z"));
setWatchSource(null);
resetWatch();
const found = await collectCandidates(new Date("2026-10-14T14:00:00Z"));
const kinds = found.candidates.map((row) => row.kind);
if (!kinds.includes("commitment")) fail(`the due window-cleaning promise was not found: ${kinds.join()} failed ${found.failed.join()}`);
const real = await runWatch(new Date("2026-10-14T14:00:00Z"));
const commitmentRow = real.ranked.find((row) => row.kind === "commitment");
if (!commitmentRow?.delivered || !commitmentRow.chatId) fail("the due promise did not reach the Decisions queue");
const realDraft = (await listMessages(commitmentRow.chatId)).find((message) => message.draft)?.draft;
if (realDraft?.channel !== "hospitable" || realDraft.hospitable?.tool !== "send-reservation-message" || realDraft.status !== "waiting" || !/Eloise/.test(realDraft.body)) fail(`the real draft: ${JSON.stringify(realDraft)}`);
if (capturedCommits().length) fail("the real pass committed something");
setParityClock(null);

// ---------- The cron route ----------
setWatchSource(async () => ({ candidates: [], failed: [] }));
let status = 0;
let payload: { ok?: boolean; watch?: { ranked: unknown[] } } = {};
await cron(
  { method: "GET", query: { job: "watch" }, headers: {} } as never,
  { status(code: number) { status = code; return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
);
if (status !== 200 || !payload.ok || !Array.isArray(payload.watch?.ranked)) fail(`cron route ${status} ${JSON.stringify(payload)}`);
setWatchSource(null);

console.log("Watch harness passed.");
