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
import { addMessage, createChat, deleteChat, flagChatNeedsYou, listChats } from "./store.js";
import { actOnWatchItem, collectCandidates, judge, parseJudgment, quietHours, record, resetWatch, runWatch, setWatchSource, watchDecisions, watchLedger, type Candidate } from "./watch.js";

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

// ---------- Delivery: Decisions only, never a chat ----------
const chatsBefore = (await listChats()).length;
pool = [
  item("task-1", "task", 66),
  item("followup-1", "commitment", 80, { draft }),
  item("incident-1", "incident", 88),
  item("guest-1", "guest_waiting", 70, { native: true, guestWaiting: true }),
];
const first = await runWatch(NOON);
if (first.ranked.length !== 4 || first.delivered !== 3) fail(`first pass ${JSON.stringify(first.ranked.map((r) => [r.kind, r.delivered]))}`);
if (first.ranked.find((row) => row.kind === "guest_waiting")?.delivered) fail("a guest the Overview already shows got a second row");
if ((await listChats()).length !== chatsBefore || (await listChats()).some((chat) => chat.needs_you_at)) fail("the watch loop created a chat");
const queued = await watchDecisions();
if (queued.length !== 3 || queued.map((row) => row.kind).join() !== "incident,commitment,task") fail(`Decisions: ${queued.map((row) => row.kind).join()}`);
const commitmentRow = queued.find((row) => row.kind === "commitment")!;
if (!commitmentRow.hasDraft || !/following up on the window cleaning/.test(commitmentRow.draftBody) || commitmentRow.draftTo !== "Eloise") fail("the exact draft is not ready in Decisions");
if (capturedCommits().length) fail("the watch loop committed something");
const again = await runWatch(new Date(NOON.getTime() + 15 * 60_000));
if (again.ranked.length || (await watchDecisions()).length !== 3 || (await listChats()).length !== chatsBefore) fail("an item was surfaced twice or a chat appeared");

// ---------- Quiet hours: only a guest actively waiting ----------
resetWatch();
pool = [item("task-2", "task", 66), item("cleaner-2", "cleaner", 90, { native: true }), item("guest-2", "guest_waiting", 70, { native: true, guestWaiting: true }), item("followup-2", "commitment", 80, { draft })];
const night = await runWatch(NIGHT);
if (night.ranked.map((row) => row.kind).join() !== "guest_waiting") fail(`overnight surfaced ${night.ranked.map((r) => r.kind).join()}`);
if (night.deferred !== 3 || (await watchDecisions()).length) fail(`overnight deferred ${night.deferred}`);
if ((await watchLedger()).some((row) => row.key === "task-2")) fail("a deferred item was recorded, so it would never surface at 8 AM");
const morning = await runWatch(MORNING);
if (morning.ranked.length !== 3 || morning.delivered !== 2 || (await watchDecisions()).length !== 2) fail(`at 8:30 the deferred items did not surface: ${JSON.stringify(morning.ranked.map((r) => r.kind))}`);

// ---------- Dismissal is a snooze until tomorrow ----------
resetWatch();
resetBusinessFacts();
pool = [item("followup-3", "commitment", 80, { draft, title: "Window cleaning for Eloise is due" }), item("task-3", "task", 66, { title: "Overdue: call the locksmith" })];
await runWatch(NOON);
if ((await watchDecisions()).length !== 2) fail("setup");
const snoozed = await actOnWatchItem({ key: "followup-3", action: "snooze" }, NOON);
if (!snoozed.ok || (await watchDecisions()).some((row) => row.key === "followup-3")) fail("the snoozed item is still in Decisions");
const learned = (await listFacts()).filter((fact) => /^Dismissed commitment alerts/.test(fact.subject));
if (learned.length !== 1 || !/dismissed 1 commitment alert at 20 Blue Jays Way/.test(learned[0]!.fact)) fail(`the dismissal was not learned: ${JSON.stringify(learned)}`);
const dismissed = (await watchLedger()).find((row) => row.key === "followup-3")!;
if (dismissed.status !== "dismissed" || dismissed.dismissedOn !== "2026-10-20") fail(`the dismissal date was not recorded: ${JSON.stringify(dismissed)}`);
// Every cycle for the rest of the day, however late: it stays away.
for (const hours of [0.25, 1, 4, 7, 9]) {
  const later = await runWatch(new Date(NOON.getTime() + hours * 3_600_000));
  if (later.ranked.some((row) => row.key === "followup-3") || (await watchDecisions()).some((row) => row.key === "followup-3")) fail(`a snoozed item came back ${hours}h later`);
}
// Tomorrow it may come back, because the issue is still open.
const TOMORROW = new Date("2026-10-21T14:00:00Z");
const next = await runWatch(TOMORROW);
const back = next.ranked.find((row) => row.key === "followup-3");
if (!back?.resurfaced || !back.delivered || !(await watchDecisions()).some((row) => row.key === "followup-3")) fail("the snoozed item did not come back the next day");
// Dismissed again: the lesson counts both times, and that day it stays away too.
await actOnWatchItem({ key: "followup-3", action: "snooze" }, TOMORROW);
const twice = (await listFacts()).filter((fact) => /^Dismissed commitment alerts/.test(fact.subject));
if (twice.length !== 1 || !/dismissed 2 commitment alerts/.test(twice[0]!.fact)) fail(`the second dismissal: ${JSON.stringify(twice)}`);
await runWatch(new Date(TOMORROW.getTime() + 3_600_000));
if ((await watchDecisions()).some((row) => row.key === "followup-3")) fail("it came back the same day it was snoozed again");
// A day later the issue is gone: nothing comes back.
const issueGone = pool.filter((row) => row.key !== "followup-3");
pool = issueGone;
await runWatch(new Date("2026-10-22T14:00:00Z"));
if ((await watchDecisions()).some((row) => row.key === "followup-3")) fail("a closed issue came back");

// ---------- An item whose issue has gone leaves Decisions by itself ----------
resetWatch();
pool = [item("gone-1", "task", 66), item("stays-1", "task", 66)];
await runWatch(NOON);
pool = [item("stays-1", "task", 66)];
const sweep = await runWatch(new Date(NOON.getTime() + 900_000));
if (sweep.resolved !== 1 || (await watchDecisions()).map((row) => row.key).join() !== "stays-1") fail("a resolved item stayed in Decisions");
// A read that failed proves nothing: the queue is left alone.
setWatchSource(async () => ({ candidates: [], failed: ["Guest messages"] }));
await runWatch(new Date(NOON.getTime() + 1_800_000));
if ((await watchDecisions()).length !== 1) fail("a failed read cleared Decisions");
setWatchSource(async () => ({ candidates: pool, failed: [] }));

// ---------- Send is a partner pressing the button ----------
resetWatch();
resetCaptures();
pool = [item("followup-4", "commitment", 80, { draft: { ...draft, hospitable: { tool: "send-reservation-message", args: { reservation_id: "res-9", body: draft.body } } } }), item("task-4", "task", 66)];
await runWatch(NOON);
const noMessage = await actOnWatchItem({ key: "task-4", action: "send" }, NOON);
if (noMessage.ok || !/no message to send/.test(noMessage.note) || capturedCommits().length) fail(`send on an item with no message: ${JSON.stringify(noMessage)}`);
const blank = await actOnWatchItem({ key: "followup-4", action: "send" }, NOON);
if (blank.ok || !/Fill in \[day and time\]/.test(blank.note) || capturedCommits().length) fail(`a draft with a blank was sent: ${JSON.stringify(blank)}`);
if (!(await watchDecisions()).some((row) => row.key === "followup-4")) fail("a refused send removed the item");
const sentNow = await actOnWatchItem({ key: "followup-4", action: "send", text: "Hi Eloise, we can take care of it on Wednesday at 2 PM. Does that work for you?" }, NOON);
if (!sentNow.ok || capturedCommits().length !== 1 || capturedCommits()[0]!.detail !== "send-reservation-message") fail(`the send: ${JSON.stringify(sentNow)} ${JSON.stringify(capturedCommits())}`);
if ((await watchDecisions()).some((row) => row.key === "followup-4") || (await watchLedger()).find((row) => row.key === "followup-4")?.status !== "handled") fail("a sent item stayed in Decisions");
if ((await actOnWatchItem({ key: "followup-4", action: "send" }, NOON)).ok) fail("a sent item was sent twice");

// ---------- One-time cleanup of the chats the loop already made: only those, never a partner's ----------
resetWatch();
const mine = await createChat("Parking registration for the new guests");
await addMessage({ chatId: mine.id, role: "user", body: "Remind me about the parking registration" });
await flagChatNeedsYou(mine.id);
const legacy = async (key: string, kind: "commitment" | "task", messages: { body: string; draft?: typeof draft }[], delete_ = false) => {
  const chat = await createChat(`Legacy ${key}`);
  for (const message of messages) await addMessage({ chatId: chat.id, role: "assistant", body: message.body, ...(message.draft ? { draft: message.draft } : {}) });
  await flagChatNeedsYou(chat.id);
  await record({ key, kind, title: `Legacy ${key}`, property: "20 Blue Jays Way", chatId: chat.id, status: "surfaced", dismissedOn: "", surfacedAt: NOON.toISOString(), resolvedAt: "", payload: null });
  if (delete_) await deleteChat(chat.id);
  return chat.id;
};
const waitingChat = await legacy("legacy-waiting", "commitment", [{ body: "Window cleaning for Eloise is due.\n\nThe draft is ready.", draft }]);
const sentChat = await legacy("legacy-sent", "commitment", [{ body: "Sent already.", draft: { ...draft, status: "sent" as never } }]);
const heldChat = await legacy("legacy-held", "commitment", [{ body: "Held.", draft: { ...draft, status: "held" as never } }]);
await legacy("legacy-gone", "task", [{ body: "Gone." }], true);
setWatchSource(async () => ({ candidates: [item("legacy-waiting", "commitment", 80, { draft }), item("legacy-sent", "commitment", 80), item("legacy-held", "commitment", 80), item("legacy-gone", "task", 60)], failed: [] }));
pool = [];
const cleanup = await runWatch(NOON);
if (cleanup.cleaned !== 4) fail(`cleaned ${cleanup.cleaned}`);
const remaining = (await listChats()).map((chat) => chat.id);
if (remaining.includes(waitingChat) || remaining.includes(sentChat) || remaining.includes(heldChat) || (await listChats()).some((chat) => /^Legacy /.test(chat.title))) fail("a chat the watch loop made was left behind");
if (!remaining.includes(mine.id) || !(await listChats()).find((chat) => chat.id === mine.id)?.needs_you_at) fail("a chat the partner started was touched");
const migrated = await watchDecisions();
if (migrated.map((row) => row.key).join() !== "legacy-waiting" || !migrated[0]!.hasDraft || !/following up on the window cleaning/.test(migrated[0]!.draftBody)) fail(`the waiting item did not survive its chat: ${JSON.stringify(migrated)}`);
const ledgerNow = await watchLedger();
if (ledgerNow.find((row) => row.key === "legacy-sent")?.status !== "handled" || ledgerNow.find((row) => row.key === "legacy-held")?.status !== "dismissed" || ledgerNow.find((row) => row.key === "legacy-gone")?.status !== "dismissed") fail("legacy items were not carried over with their outcome");
if (ledgerNow.some((row) => row.chatId)) fail("a ledger row still points at a deleted chat");
const cleanupAgain = await runWatch(new Date(NOON.getTime() + 900_000));
if (cleanupAgain.cleaned !== 0) fail("the cleanup ran twice");
await deleteChat(mine.id);
setWatchSource(async () => ({ candidates: pool, failed: [] }));

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
const realRow = (await watchDecisions()).find((row) => row.kind === "commitment");
if (!realRow || !real.ranked.some((row) => row.kind === "commitment" && row.delivered)) fail("the due promise did not reach the Decisions queue");
if (!realRow.hasDraft || !/Eloise/.test(realRow.draftBody) || realRow.draftTo !== "Eloise") fail(`the real draft: ${JSON.stringify(realRow)}`);
if ((await listChats()).some((chat) => chat.needs_you_at)) fail("the real pass created a chat");
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
