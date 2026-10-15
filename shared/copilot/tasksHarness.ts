/**
 * Tasks, end to end: the board, Copilot's reminders and the team calendar share one record; Copilot's
 * own tasks are made once and close with proof; employees see only their own; a calendar outage never
 * blocks a save. Nothing is sent to anyone.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { worldAt } from "./parity/catalog.js";
import { setParityClock } from "./parity/clock.js";
import { installWorld } from "./parity/world.js";
import { boardAction, boardPayload, type BoardPayload } from "./taskBoardApi.js";
import { FakeCalendar, resetParityCalendarState, setCalendarApi } from "./taskCalendar.js";
import { closeResolvedTasks, createAutoTasks, setAutoSources } from "./taskAutomation.js";
import { insertTask, resetParityTasks } from "./taskDb.js";
import handleSession, { setStaffAccounts } from "../adminApi/session.js";
import { hashPassword } from "../portalAuth.js";
import { OPS_NAV, opsPathOpensCopilotReviews, opsPathOpensCopilotTasks } from "../opsNav.js";
import { createTask, getTask, setParityStaff, syncCalendar } from "./tasks.js";
import { taskTools } from "./hospitableAgent.js";
import { createReminder, listReminders } from "./reminders.js";
import { overviewReminders } from "./reminderView.js";
import { fromToronto, shiftDay, torontoParts } from "./reminderTime.js";
import type { GuestFollowUp } from "./guestTypes.js";
import { blankCalendar, digestLine, type Task } from "./taskTypes.js";

function fail(message: string): never {
  throw new Error(`Tasks harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

// Wednesday, October 14, 2026, 9:00 AM in Toronto.
let now = new Date("2026-10-14T13:00:00Z");
installWorld(worldAt("2026-10-14T09:00:00-04:00"));
setParityClock(now);
resetParityTasks();
resetParityCalendarState();
resetCaptures();
setParityStaff(["Maya", "Luis"]);
const calendar = new FakeCalendar(() => now);
setCalendarApi(calendar);

const shane = { name: "Shane", partner: true };
const maya = { name: "Maya", partner: false };
const today = torontoParts(now);
const at = (days: number, minutes: number) => fromToronto(shiftDay(today, days), minutes).toISOString();
const find = (board: BoardPayload, title: string) => board.tasks.find((task) => task.title === title);

async function copilot<T>(body: Record<string, unknown>): Promise<T> {
  let payload: unknown = null;
  let status = 200;
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; } } as never,
  );
  if (status >= 400) fail(`${String(body.op)} returned ${status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

// The roster: partners first, then the employees with OPS accounts.
const first = await boardPayload(shane);
if (first.roster.map((row) => row.name).join(",") !== "Shane,Ryan,Maya,Luis") fail(`roster ${first.roster.map((row) => row.name).join(",")}`);
if (first.calendar.mode !== "ok") fail(`calendar mode ${first.calendar.mode}`);

// Board tasks stay out of the old chat-reminder list; chat-created due items show on Tasks.
let board = await boardAction({ op: "create", title: "Book the furnace service", assignee: "Shane", dueAt: at(0, 1080) }, shane);
const furnace = find(board, "Book the furnace service");
if (!furnace) fail("board create");
if ((await listReminders()).some((row) => row.id === furnace.id) || overviewReminders(await listReminders(), now).rows.some((row) => row.id === furnace.id)) fail("a board task showed up in the chat-reminder list");
const chatReminder = await createReminder({ text: "Call the locksmith about the side gate", assignee: "Shane", dueAt: at(0, 1140), createdBy: "Shane" });
if (!(await listReminders()).some((row) => row.id === chatReminder.id)) fail("a chat-created due item wasn't stored");
if (!find(await boardPayload(shane), "Call the locksmith about the side gate")) fail("a chat-created due item isn't on the board");
const forMaya = await createReminder({ text: "Restock the coffee pods", assignee: "Maya", dueAt: at(1, 600), createdBy: "Shane" });
if (!(await boardPayload(maya)).tasks.some((row) => row.id === forMaya.id)) fail("an employee's due item isn't on their board");
// From Copilot, board actions travel as `action` (Copilot's request helper owns `op`).
const viaCopilot = await copilot<BoardPayload>({ op: "tasks-action", action: "update", id: furnace.id, patch: { status: "doing", assignee: "Ryan" }, viewer: "Shane" });
const moved = viaCopilot.tasks.find((row) => row.id === furnace.id);
if (moved?.status !== "doing" || moved.assignee !== "Ryan") fail(`Copilot board action ${moved?.status} ${moved?.assignee}`);
await copilot({ op: "tasks-action", action: "update", id: furnace.id, patch: { status: "todo", assignee: "Shane" }, viewer: "Shane" });

// Calendar: the event is made with the chosen reminder, moves with the due, gains ✓ when done, goes when deleted.
board = await boardAction({ op: "update", id: furnace.id, patch: { reminder: "1 hour before" } }, shane);
let task = find(board, "Book the furnace service")!;
const event = () => calendar.events.get(task.cal.eventId)!;
if (!task.cal.eventId || event().summary !== "Book the furnace service" || event().start.dateTime !== at(0, 1080) || event().reminders?.overrides?.[0]?.minutes !== 60) fail(`event ${JSON.stringify(event())}`);
if (event().description?.includes("@") || "attendees" in event()) fail("the event carries attendees");
if (!task.activity.some((row) => row.text === "Added to the team calendar")) fail(`calendar line ${task.activity.map((row) => row.text).join(" / ")}`);
board = await boardAction({ op: "update", id: furnace.id, patch: { dueAt: at(1, 600) } }, shane);
task = find(board, "Book the furnace service")!;
if (event().start.dateTime !== at(1, 600) || !task.activity.some((row) => row.text === "Calendar event moved to Tomorrow, 10:00 AM")) fail(`move ${event().start.dateTime} ${task.activity.map((row) => row.text).join(" / ")}`);
board = await boardAction({ op: "done", id: furnace.id }, shane);
task = find(board, "Book the furnace service")!;
if (event().summary !== "✓ Book the furnace service" || event().status === "cancelled") fail(`done event ${event().summary}`);
board = await boardAction({ op: "reopen", id: furnace.id }, shane);
board = await boardAction({ op: "done", id: furnace.id }, shane);
if (event().summary !== "✓ Book the furnace service") fail(`checkmark twice: ${event().summary}`);
const eventId = task.cal.eventId;
board = await boardAction({ op: "delete", id: furnace.id }, shane);
if (find(board, "Book the furnace service") || calendar.events.get(eventId)?.status !== "cancelled") fail("delete kept the task or the event");

// Removing the due time deletes the event; the task says it needs a due time.
board = await boardAction({ op: "create", title: "Check the smoke detectors", assignee: "Ryan", dueAt: at(2, 780) }, shane);
task = find(board, "Check the smoke detectors")!;
const smokeEvent = task.cal.eventId;
board = await boardAction({ op: "update", id: task.id, patch: { dueAt: null, dueDay: null } }, shane);
task = find(board, "Check the smoke detectors")!;
if (calendar.events.get(smokeEvent)?.status !== "cancelled" || task.cal.on || !task.activity.some((row) => row.text === "Calendar event removed · no due time")) fail("no-due removal");

// Calendar to task: a new event is an unassigned task; an edit updates it; a delete keeps it.
const outside = calendar.outsideAdd({ summary: "Walk-through with the insurance inspector", start: { dateTime: at(2, 600) }, end: { dateTime: at(2, 660) }, description: "Inspector will call 15 minutes ahead.", creator: { displayName: "Ryan" } });
await syncCalendar();
board = await boardPayload(shane);
task = find(board, "Walk-through with the insurance inspector")!;
if (!task || task.assignee !== "" || task.source.label !== "From the team calendar" || !task.cal.fromCal || task.dueAt !== at(2, 600) || !task.activity.some((row) => row.text === "Added from the team calendar · the event has no assignee")) fail(`calendar-born ${JSON.stringify(task)}`);
if (calendar.events.get(outside.id)?.description !== "Inspector will call 15 minutes ahead.") fail("Copilot rewrote a calendar-made event");
now = new Date(now.getTime() + 60_000);
setParityClock(now);
calendar.outsideEdit(outside.id, { summary: "Insurance walk-through", start: { dateTime: at(2, 660) } });
await syncCalendar();
task = (await boardPayload(shane)).tasks.find((row) => row.id === task.id)!;
if (task.title !== "Insurance walk-through" || task.dueAt !== at(2, 660) || !task.activity.some((row) => /^Edited in Google Calendar · title changed to “Insurance walk-through”, due moved to /.test(row.text))) fail(`calendar edit ${task.title} ${task.activity.map((row) => row.text).join(" / ")}`);
calendar.outsideEdit(outside.id, { summary: "✓ Insurance walk-through" });
await syncCalendar();
task = (await boardPayload(shane)).tasks.find((row) => row.id === task.id)!;
if (task.status !== "done" || !task.activity.some((row) => row.text === "Marked done on the team calendar ✓")) fail("a ✓ in Google Calendar didn't mark it done");
const keep = calendar.outsideAdd({ summary: "Pool and hot tub service", start: { date: shiftDayKey(5) }, end: { date: shiftDayKey(6) }, description: "Assignee: Luis" });
await syncCalendar();
let pool = (await boardPayload(shane)).tasks.find((row) => row.title === "Pool and hot tub service")!;
if (pool.assignee !== "Luis" || pool.dueAt || pool.dueDay !== shiftDayKey(5)) fail(`all-day event ${JSON.stringify(pool)}`);
calendar.outsideDelete(keep.id);
await syncCalendar();
pool = (await boardPayload(shane)).tasks.find((row) => row.id === pool.id)!;
if (!pool || pool.cal.on || !pool.cal.deleted || pool.activity.at(-1)?.text !== "Calendar event deleted · task kept here") fail("a deleted event took the task or wasn't logged");

// Sync paused: the save still happens and queues; the next sync sends it.
calendar.failing = true;
board = await boardAction({ op: "create", title: "Drop spare keys with the concierge", assignee: "Ryan", dueAt: at(0, 780) }, shane);
task = find(board, "Drop spare keys with the concierge")!;
if (!task || board.calendar.mode !== "paused" || !task.cal.pending || !task.activity.some((row) => row.text === "Added to the team calendar · will sync when Google reconnects")) fail(`paused ${board.calendar.mode} ${task?.cal.pending}`);
calendar.failing = false;
await syncCalendar();
board = await boardPayload(shane);
task = find(board, "Drop spare keys with the concierge")!;
if (board.calendar.mode !== "ok" || task.cal.pending || !calendar.events.get(task.cal.eventId)) fail("the queued change didn't sync");

// Copilot's own task: once across two checks for the same open follow-up, then closed with proof.
const followUp = { id: "fu-eloise", kind: "owe", reservationId: "res-1", guest: "Eloise Martin", first: "Eloise", property: "8 Charlotte 606", propertyId: "", checkIn: "2026-10-16", checkOut: "2026-10-19", due: "2026-10-14", line: "Confirm the window cleaning time with Eloise", promised: "I'll confirm a time for the window cleaning by Wednesday.", promisedBy: "Ryan", promisedAt: "2026-10-12T21:05:00Z", sourceLine: "" } as unknown as GuestFollowUp;
let open = [followUp];
const closed = new Map<string, string>();
setAutoSources({ followUps: async () => ({ open, closed }), turnovers: async () => [], contracts: async () => [], cleanerUnits: async () => [] });
await createAutoTasks(now);
await createAutoTasks(now);
const made = (await boardPayload(shane)).tasks.filter((row) => row.sourceKey === "followup:fu-eloise");
if (made.length !== 1 || made[0]!.assignee !== "Ryan" || made[0]!.source.label !== "Copilot · from a guest follow-up" || !made[0]!.source.quote.includes("window cleaning")) fail(`auto-create ${made.length} ${JSON.stringify(made[0])}`);
open = [];
closed.set("fu-eloise", "Ryan messaged Eloise, Oct 14, 11:02 AM");
await closeResolvedTasks(now);
const closedTask = (await boardPayload(shane)).tasks.find((row) => row.sourceKey === "followup:fu-eloise")!;
if (closedTask.status !== "done" || closedTask.closedBy !== "Ryan messaged Eloise, Oct 14, 11:02 AM" || closedTask.activity.at(-1)?.text !== "Closed by Copilot · Ryan messaged Eloise, Oct 14, 11:02 AM") fail(`auto-close ${JSON.stringify(closedTask.activity.at(-1))}`);
await createAutoTasks(now);
if ((await boardPayload(shane)).tasks.filter((row) => row.sourceKey === "followup:fu-eloise").length !== 1) fail("a closed source item got a second task");
// A source that can't be read leaves its task alone.
setAutoSources({ followUps: async () => null, turnovers: async () => [{ propertyId: "p-shaw", property: "1065 Shaw Street", date: "2026-10-15", when: "Thu Oct 15", guest: "Amir", assigned: false }], contracts: async () => null, cleanerUnits: async () => null });
await createAutoTasks(now);
const turnover = (await boardPayload(shane)).tasks.find((row) => row.sourceKey === "turnover:p-shaw:2026-10-15")!;
if (!turnover || turnover.priority !== "arrival" || turnover.assignee !== "") fail("turnover task");
setAutoSources({ turnovers: async () => null });
await closeResolvedTasks(now);
if ((await boardPayload(shane)).tasks.find((row) => row.id === turnover.id)?.status === "done") fail("an unreadable source closed a task");
setAutoSources(null);

// An employee sees only their own tasks, and can't change assignee or priority.
board = await boardAction({ op: "create", title: "Strip and remake the beds", assignee: "Maya", dueAt: at(0, 810) }, shane);
const beds = find(board, "Strip and remake the beds")!;
const mine = await boardPayload(maya);
if (!mine.tasks.length || mine.tasks.some((row) => row.assignee !== "Maya") || mine.viewer.partner) fail(`employee scope ${mine.tasks.map((row) => row.assignee).join(",")}`);
await boardAction({ op: "update", id: beds.id, patch: { assignee: "Luis", priority: "arrival", status: "doing" } }, maya);
const after = (await boardPayload(shane)).tasks.find((row) => row.id === beds.id)!;
if (after.assignee !== "Maya" || after.priority !== "normal" || after.status !== "doing") fail(`employee edits ${after.assignee} ${after.priority} ${after.status}`);
let refused = "";
await boardAction({ op: "delete", id: beds.id }, maya).catch((err) => { refused = err instanceof Error ? err.message : ""; });
if (!refused) fail("an employee deleted a task");
const others = (await boardPayload(shane)).tasks.find((row) => row.assignee === "Ryan")!;
refused = "";
await boardAction({ op: "done", id: others.id }, maya).catch((err) => { refused = err instanceof Error ? err.message : ""; });
if (refused !== "That task isn't yours.") fail("an employee changed someone else's task");

// Marked done on the board clears a chat-created due item.
setParityClock(new Date(Date.parse(at(-2, 480))));
const permit = await createReminder({ text: "Renew the Charlotte 606 parking permit", assignee: "Shane", dueAt: at(-2, 540), createdBy: "Shane" });
setParityClock(now);
if (!find(await boardPayload(shane), "Renew the Charlotte 606 parking permit")) fail("overdue chat-created item missing from the board");
await boardAction({ op: "done", id: permit.id }, shane);
// Chat-created due items live on the Tasks board with everything else.
const cleared = (await getTask(permit.id)) as Task;
if (cleared.status !== "done" || cleared.doneBy !== "Shane") fail("done on the board didn't clear it");

// Not connected: tasks still save; the calendar block says so.
setCalendarApi(null);
board = await boardAction({ op: "create", title: "Order a second set of queen linens", assignee: "Maya" }, shane);
if (board.calendar.mode !== "off" || !find(board, "Order a second set of queen linens")) fail("not connected blocked a save");

// The VA-era OPS list is archived in place: on no board, count, reminder or Overview; exportable; un-archivable.
setCalendarApi(calendar);
const beforeLegacy = await boardPayload(shane);
const legacy: { title: string; assignee: string; due: string; created: string }[] = [
  { title: "Update the Airbnb listing photos for Charlotte", assignee: "Maya", due: "2026-07-01", created: "2026-06-20T14:00:00Z" },
  { title: "Call the HVAC company about the Shaw filter", assignee: "Luis", due: "2026-08-02", created: "2026-07-28T15:00:00Z" },
  { title: "Reconcile the September owner statement", assignee: "Shane", due: "", created: "2026-09-01T12:00:00Z" },
];
for (const row of legacy) {
  await insertTask({ ...blankLegacy(), title: row.title, assignee: row.assignee, dueDay: row.due, createdAt: row.created, updatedAt: row.created });
}
const withLegacy = await boardPayload(shane);
if (withLegacy.tasks.length !== beforeLegacy.tasks.length || legacy.some((row) => withLegacy.tasks.some((task) => task.title === row.title))) fail("legacy tasks reached the board");
if (digestLine(withLegacy.tasks, now, "anyone") !== digestLine(beforeLegacy.tasks, now, "anyone")) fail("legacy tasks changed the digest");
if ((await listReminders()).some((row) => legacy.some((old) => old.title === row.text))) fail("legacy tasks reached Reminders or Overview");
if ((await boardPayload(maya)).tasks.some((task) => legacy.some((old) => old.title === task.title))) fail("legacy tasks reached an employee board");
const archive = (await boardAction({ op: "archive" }, shane)).archived ?? [];
for (const row of legacy) {
  const found = archive.find((item) => item.title === row.title);
  if (!found || found.assignee !== row.assignee || found.dueOn !== row.due || Date.parse(found.createdAt) !== Date.parse(row.created)) fail(`archive lost ${row.title}: ${JSON.stringify(found)}`);
}
refused = "";
await boardAction({ op: "archive" }, maya).catch((err) => { refused = err instanceof Error ? err.message : ""; });
if (!refused) fail("an employee read the archive");
const hvac = archive.find((item) => item.title.startsWith("Call the HVAC"))!;
board = await boardAction({ op: "unarchive", id: hvac.id }, shane);
const back = find(board, "Call the HVAC company about the Shaw filter");
if (!back || back.activity.at(-1)?.text !== "Un-archived by Shane from the old OPS list" || (board.archived ?? []).some((item) => item.id === hvac.id)) fail("un-archive");

// OPS: no Tasks entry; the old route lands on the Copilot board.
if (OPS_NAV.some(([key, label]) => (key as string) === "tasks" || /tasks/i.test(label))) fail("OPS still lists Tasks");
if (OPS_NAV.some(([key, label]) => (key as string) === "reviews" || /reviews/i.test(label))) fail("OPS still lists Reviews");
if (!opsPathOpensCopilotReviews("/ops/reviews") || !opsPathOpensCopilotReviews("/ops/reviews/job-1") || opsPathOpensCopilotReviews("/ops/sops")) fail("the old OPS reviews route didn't land on Copilot");
if (!opsPathOpensCopilotTasks("/ops/tasks") || !opsPathOpensCopilotTasks("/ops/tasks/123") || opsPathOpensCopilotTasks("/ops/reviews")) fail("the old OPS tasks route didn't land on Copilot");

// An employee signs in to the admin app with their OPS account and sees only their own board.
const mayaAccount = { id: "staff-maya", email: "maya@mandelrealtygroup.com", display_name: "Maya", password_hash: hashPassword("linen-closet-42"), active: true };
setStaffAccounts({ byEmail: async (email) => (email === mayaAccount.email ? mayaAccount : null), byId: async (id) => (id === mayaAccount.id ? mayaAccount : null) });
const session = async (op: string, body: Record<string, unknown>, cookie = "") => {
  let payload: Record<string, unknown> = {};
  let status = 200;
  let setCookie: string | string[] = "";
  await handleSession(
    { method: "POST", headers: { cookie }, body, query: { op }, url: `/api/admin/session?op=${op}` } as never,
    { setHeader(_name: string, value: string | string[]) { setCookie = value; }, status(code: number) { status = code; return this; }, json(value: Record<string, unknown>) { payload = value; return this; } } as never,
  );
  return { payload, status, cookie: (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(";")[0] ?? "" };
};
const wrong = await session("login", { email: mayaAccount.email, password: "nope" });
if (wrong.status !== 401) fail("a wrong employee password signed in");
const signed = await session("login", { email: mayaAccount.email, password: "linen-closet-42" });
if (signed.status !== 200 || !/^mrg_staff_session=/.test(signed.cookie)) fail(`employee sign-in ${signed.status} ${signed.cookie}`);
const who = await session("whoami", {}, signed.cookie);
if (who.payload.admin !== false || (who.payload.staff as { name?: string } | null)?.name !== "Maya") fail(`whoami ${JSON.stringify(who.payload)}`);
let copilotStatus = 200;
await handleCopilot(
  { method: "POST", headers: { cookie: signed.cookie }, body: { op: "tasks-board" }, query: {} } as never,
  { status(code: number) { copilotStatus = code; return this; }, json() { return this; } } as never,
);
if (copilotStatus !== 401) fail(`an employee reached the rest of Copilot (${copilotStatus})`);
setStaffAccounts(null);

// Chat reads the board: "any tasks due this week?" finds a task due in two days.
await createTask({ title: "Finish groceries flow", assignee: "Shane", dueDay: shiftDayKey(2), by: "Shane" });
const listTool = taskTools().find((tool) => tool.name === "list_tasks");
const listed = (await listTool!.run({ from_day: shiftDayKey(0), to_day: shiftDayKey(6) })) as { count: number; tasks: { title: string; for: string; due: string }[] };
const groceries = listed.tasks.find((row) => row.title === "Finish groceries flow");
if (!groceries || groceries.for !== "Shane" || groceries.due === "no due date") fail(`chat couldn't read the task board: ${JSON.stringify(listed)}`);
const notThisWeek = (await listTool!.run({ from_day: shiftDayKey(10), to_day: shiftDayKey(12) })) as { tasks: { title: string }[] };
if (notThisWeek.tasks.some((row) => row.title === "Finish groceries flow")) fail("a task outside the range was listed");

if (capturedCommits().length) fail("a task sent something");
setParityClock(null);
console.log("Tasks harness passed.");

function blankLegacy(): Omit<Task, "id" | "createdAt"> {
  return { title: "", assignee: "", status: "todo", dueAt: "", dueDay: "", priority: "normal", waitingOn: "", unit: "", propertyId: "", link: { kind: "", name: "", note: "" }, source: { kind: "partner", label: "", quote: "", meta: "", ref: "" }, sourceKey: "", cal: { ...blankCalendar(), on: false }, activity: [], doneBy: "", doneAt: "", closedBy: "", snoozeCount: 0, createdBy: "", updatedAt: "", deletedAt: "", extra: {} };
}

function shiftDayKey(days: number): string {
  const d = shiftDay(today, days);
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}
