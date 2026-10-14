/**
 * Tasks: one record each, read and written the same way by the OPS board, the employee view,
 * Copilot's reminders, Copilot's own tasks and the team calendar.
 *
 * Every change appends to the activity trail and is reconciled with the "Mandel Tasks" calendar.
 * A calendar failure never blocks a save: the change queues, sync shows as paused, and it retries at
 * every check and app open. Nothing here contacts anyone outside the app.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityNow } from "./parity/clock.js";
import { readTask, readTasks, insertTask, writeTask } from "./taskDb.js";
import { CALENDAR_NAME, CalendarNotAuthorized, calendarApi, readCalendarState, writeCalendarState, type CalEvent, type CalendarMode } from "./taskCalendar.js";
import { DEFAULT_ROSTER } from "./rosterDefaults.js";
import { readPrefixedRow } from "./store.js";
import { exactLabel, fromToronto, torontoParts } from "./reminderTime.js";
import {
  blankCalendar,
  calendarReady,
  calendarWhen,
  dueText,
  isOpen,
  REMINDER_OFFSETS,
  STATUS_LABEL,
  type ReminderOffset,
  type RosterPerson,
  type Task,
  type TaskLink,
  type TaskPriority,
  type TaskSource,
  type TaskStatus,
} from "./taskTypes.js";

function clock(): Date {
  return parityNow() ?? new Date();
}

// ---------- Roster ----------

let parityStaff: string[] = [];

export function setParityStaff(names: string[]): void {
  parityStaff = names;
}

/** Partners first (the Copilot roster), then the employees who have OPS accounts. */
export async function readTeamRoster(): Promise<RosterPerson[]> {
  let partners = DEFAULT_ROSTER;
  if (!parityEnabled()) {
    try {
      const raw = await readPrefixedRow("team-roster|");
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed) && parsed.length) partners = parsed.map(String);
    } catch {
      /* The defaults stand. */
    }
  }
  let staff: string[] = parityStaff;
  if (!parityEnabled()) {
    try {
      const { listStaffUsers } = await import("../pm/staffUserStore.js");
      staff = (await listStaffUsers()).filter((row) => row.active).map((row) => row.display_name.trim()).filter(Boolean);
    } catch {
      staff = [];
    }
  }
  const people: RosterPerson[] = partners.map((name) => ({ name, role: "Partner", partner: true }));
  for (const name of staff) if (!people.some((row) => row.name.toLowerCase() === name.toLowerCase())) people.push({ name, role: "Team", partner: false });
  return people;
}

// ---------- Activity ----------

function log(task: Task, text: string, who = ""): Task {
  return { ...task, activity: [...task.activity, { at: clock().toISOString(), who, text }] };
}

function calTail(mode: CalendarMode): string {
  return mode === "paused" ? " · will sync when Google reconnects" : "";
}

// ---------- Reads ----------

export async function listTasks(): Promise<Task[]> {
  return (await readTasks()).filter((task) => !task.deletedAt);
}

export async function getTask(id: string): Promise<Task | null> {
  return readTask(id);
}

/** Only an employee's own tasks; partners see everything. */
export function visibleTo(tasks: Task[], viewer: { name: string; partner: boolean }): Task[] {
  return viewer.partner ? tasks : tasks.filter((task) => task.assignee.toLowerCase() === viewer.name.toLowerCase());
}

// ---------- Create ----------

export type NewTask = {
  title: string;
  assignee?: string;
  dueAt?: string;
  dueDay?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  waitingOn?: string;
  unit?: string;
  propertyId?: string;
  link?: Partial<TaskLink>;
  source?: Partial<TaskSource>;
  sourceKey?: string;
  calOn?: boolean;
  reminder?: ReminderOffset;
  /** Who made it ("Shane", "Maya", "Copilot", "the team calendar"). */
  by: string;
  /** The first activity line, when not "Created by …". */
  createdLine?: string;
  calendar?: Partial<Task["cal"]>;
};

export async function createTask(input: NewTask): Promise<Task> {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) throw new Error("Say what needs doing.");
  const now = clock().toISOString();
  const kind = input.source?.kind ?? (input.by === "Copilot" ? "copilot" : "partner");
  let task: Task = {
    id: "",
    title,
    assignee: input.assignee?.trim() ?? "",
    status: input.status ?? "todo",
    dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : "",
    dueDay: input.dueAt ? "" : input.dueDay ?? "",
    priority: input.priority ?? "normal",
    waitingOn: input.waitingOn ?? "",
    unit: input.unit ?? "",
    propertyId: input.propertyId ?? "",
    link: { kind: "", name: "", note: "", ...(input.link ?? {}) },
    source: { kind, label: "", quote: "", meta: "", ref: "", ...(input.source ?? {}) },
    sourceKey: input.sourceKey ?? "",
    cal: { ...blankCalendar(), on: input.calOn ?? true, reminder: input.reminder ?? "30 minutes before", ...(input.calendar ?? {}) },
    activity: [],
    doneBy: "",
    doneAt: "",
    closedBy: "",
    snoozeCount: 0,
    createdBy: input.by,
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    extra: {},
  };
  task = log(task, input.createdLine ?? `Created by ${input.by}`);
  const saved = await insertTask(task);
  // A task born from a calendar event already has its event; nothing to push back.
  return input.calendar?.fromCal ? saved : reconcile(saved, null, input.by);
}

// ---------- Changes ----------

export type TaskPatch = Partial<{
  title: string;
  assignee: string;
  dueAt: string | null;
  dueDay: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  waitingOn: string;
  unit: string;
  link: Partial<TaskLink>;
  calOn: boolean;
  reminder: ReminderOffset;
}>;

function whenWords(task: Task): string {
  return task.dueAt || task.dueDay ? dueText(task, clock()) : "no date";
}

/** Applies a patch with its activity lines, saves, and reconciles the calendar. */
export async function updateTask(id: string, patch: TaskPatch, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before || before.deletedAt) throw new Error("That task isn't on the board any more.");
  let task: Task = { ...before };
  if (patch.title != null && patch.title.trim() && patch.title.trim() !== task.title) task.title = patch.title.trim().replace(/\s+/g, " ");
  if (patch.assignee != null && patch.assignee !== task.assignee) {
    task = log({ ...task, assignee: patch.assignee }, patch.assignee ? `${task.assignee ? `Reassigned from ${task.assignee} to ${patch.assignee}` : `Assigned to ${patch.assignee}`} by ${by}` : `Unassigned by ${by}`);
  }
  if (patch.dueAt !== undefined || patch.dueDay !== undefined) {
    const dueAt = patch.dueAt ? new Date(patch.dueAt).toISOString() : patch.dueAt === null ? "" : task.dueAt;
    const dueDay = dueAt ? "" : patch.dueDay ?? (patch.dueAt === null ? "" : task.dueDay);
    if (dueAt !== task.dueAt || dueDay !== task.dueDay) {
      task = { ...task, dueAt, dueDay };
      task = log(task, `Due changed to ${whenWords(task)} by ${by}`);
    }
  }
  if (patch.priority && patch.priority !== task.priority) {
    task = log({ ...task, priority: patch.priority }, patch.priority === "arrival" ? `Marked Arrival-blocking by ${by}` : `Priority set to Normal by ${by}`);
  }
  if (patch.waitingOn != null) task = { ...task, waitingOn: patch.waitingOn };
  if (patch.unit != null) task = { ...task, unit: patch.unit };
  if (patch.link) task = { ...task, link: { ...task.link, ...patch.link } };
  if (patch.reminder && REMINDER_OFFSETS.includes(patch.reminder) && patch.reminder !== task.cal.reminder) {
    task = log({ ...task, cal: { ...task.cal, reminder: patch.reminder } }, `Calendar reminder set to ${patch.reminder.toLowerCase()} by ${by}`);
  }
  if (patch.calOn != null && patch.calOn !== task.cal.on) {
    task = { ...task, cal: { ...task.cal, on: patch.calOn, deleted: false } };
    task = log(task, `${patch.calOn ? "Added to" : "Removed from"} the team calendar by ${by}`);
  }
  if (patch.status && patch.status !== task.status) {
    if (patch.status === "done") return markDone(id, by, "", task);
    task = log({ ...task, status: patch.status, doneBy: "", doneAt: "", closedBy: "" }, `${before.status === "done" ? "Reopened" : `Moved to ${STATUS_LABEL[patch.status]}`} by ${by}`);
  }
  task.updatedAt = clock().toISOString();
  const saved = await writeTask(task);
  return reconcile(saved, before, by);
}

/** Done by a person, or closed by Copilot with its proof. */
export async function markDone(id: string, by: string, proof = "", staged?: Task): Promise<Task> {
  const before = await readTask(id);
  if (!before || before.deletedAt) throw new Error("That task isn't on the board any more.");
  if (before.status === "done") return before;
  const now = clock().toISOString();
  let task: Task = { ...(staged ?? before), status: "done", doneAt: now, doneBy: proof ? "Copilot" : by, closedBy: proof, updatedAt: now };
  task = log(task, proof ? `Closed by Copilot · ${proof}` : `Marked done by ${by}`);
  const saved = await writeTask(task);
  return reconcile(saved, before, by);
}

export async function reopen(id: string, by: string): Promise<Task> {
  return updateTask(id, { status: "todo" }, by);
}

export async function snooze(id: string, dueAt: string, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before || before.deletedAt) throw new Error("That task isn't on the board any more.");
  const at = new Date(dueAt);
  if (Number.isNaN(at.getTime())) throw new Error("Pick a time to snooze to.");
  let task: Task = { ...before, dueAt: at.toISOString(), dueDay: "", snoozeCount: before.snoozeCount + 1, extra: { ...before.extra, prevDueAt: before.dueAt || before.dueDay, surfacedFor: "", stillOpenOn: "" } };
  task = log(task, `Snoozed by ${by} until ${dueText(task, clock())}`);
  task.updatedAt = clock().toISOString();
  return reconcile(await writeTask(task), before, by);
}

export async function unsnooze(id: string, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before?.extra.prevDueAt) return before ?? Promise.reject(new Error("That task isn't on the board any more."));
  const prev = before.extra.prevDueAt;
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(prev);
  let task: Task = { ...before, dueAt: isDay ? "" : prev, dueDay: isDay ? prev : "", snoozeCount: Math.max(0, before.snoozeCount - 1), extra: { ...before.extra, prevDueAt: "" } };
  task = log(task, `Snooze undone by ${by} · due ${dueText(task, clock())}`);
  task.updatedAt = clock().toISOString();
  return reconcile(await writeTask(task), before, by);
}

export async function comment(id: string, text: string, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before || before.deletedAt) throw new Error("That task isn't on the board any more.");
  const body = text.trim();
  if (!body) return before;
  return writeTask({ ...log(before, body, by), updatedAt: clock().toISOString() });
}

/** Deleted by a partner: off every list; its calendar event goes too. Kept so Undo can restore it. */
export async function deleteTask(id: string, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before) throw new Error("That task isn't on the board any more.");
  const task = log({ ...before, deletedAt: clock().toISOString(), updatedAt: clock().toISOString(), extra: { ...before.extra, prevStatus: before.status } }, `Deleted by ${by}`);
  return reconcile(await writeTask(task), before, by);
}

export async function restoreTask(id: string, by: string): Promise<Task> {
  const before = await readTask(id);
  if (!before) throw new Error("That task isn't in Copilot any more.");
  const task = log({ ...before, deletedAt: "", updatedAt: clock().toISOString() }, `Restored by ${by}`);
  return reconcile(await writeTask(task), before, by);
}

// ---------- Calendar ----------

const OFFSET_MINUTES: Record<ReminderOffset, number | null> = { None: null, "At the time": 0, "30 minutes before": 30, "1 hour before": 60, "1 day before": 1440 };

function eventFor(task: Task): Omit<CalEvent, "id" | "updated" | "status"> {
  const done = task.status === "done";
  const summary = `${done ? "✓ " : ""}${task.title}`;
  // An event made in Google Calendar keeps its own description; Copilot only adds to events it made.
  const description = task.cal.fromCal ? undefined : [
    `Assignee: ${task.assignee || "Needs an assignee"}`,
    task.unit ? `Property: ${task.unit}` : "",
    task.link.name ? `${task.link.kind || "Linked"}: ${task.link.name}` : "",
    "Managed by Mandel Copilot · Tasks",
  ].filter(Boolean).join("\n");
  const minutes = OFFSET_MINUTES[task.cal.reminder] ?? null;
  const reminders = { useDefault: false, overrides: minutes == null ? [] : [{ method: "popup", minutes }] };
  if (task.dueAt) {
    const start = new Date(task.dueAt);
    const end = new Date(start.getTime() + 30 * 60_000);
    return { summary, ...(description ? { description } : {}), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, reminders, extendedProperties: { private: { taskId: task.id } } };
  }
  const [y, m, d] = task.dueDay.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  return { summary, ...(description ? { description } : {}), start: { date: task.dueDay }, end: { date: next }, reminders, extendedProperties: { private: { taskId: task.id } } };
}

async function calendarMode(): Promise<CalendarMode> {
  const api = await calendarApi();
  if (!api) return "off";
  const state = await readCalendarState();
  // Not authorized: saves don't keep asking Google; the next check or app open tries again.
  if (state.mode === "off") return state.reason ? "off" : "ok";
  return state.mode;
}

/**
 * Brings the event in line with the task and writes the calendar lines: added, moved, removed for
 * no due time, marked done, deleted with the task. On failure the task is kept and queued.
 */
async function reconcile(task: Task, before: Task | null, by: string): Promise<Task> {
  const api = await calendarApi();
  if (!api) return task;
  let mode = await calendarMode();
  if (mode === "off") return task;
  let next = { ...task, cal: { ...task.cal } };
  const ready = calendarReady(next);
  const was = Boolean(before && before.cal.on && calendarReady(before) && !before.deletedAt);
  // The calendar lines, as the design writes them.
  const lines: string[] = [];
  if (next.deletedAt) {
    // The task's own delete line says it; the event goes quietly.
  } else if (was && !ready) {
    next.cal.on = false;
    lines.push("Calendar event removed · no due time");
  } else if (!before && ready && next.cal.on && !next.cal.fromCal) {
    lines.push("Added to the team calendar");
  } else if (before && !calendarReady(before) && ready && !next.cal.fromCal) {
    next.cal = { ...next.cal, on: true, deleted: false };
    lines.push("Added to the team calendar");
  } else if (was && ready && next.cal.on && (before!.dueAt !== next.dueAt || before!.dueDay !== next.dueDay)) {
    lines.push(`Calendar event moved to ${calendarWhen(next, clock())}`);
  }
  if (before && before.status !== "done" && next.status === "done" && next.cal.on && ready) lines.push("Calendar event marked done ✓");
  const wants = next.cal.on && ready && !next.deletedAt;
  try {
    const state = await readCalendarState();
    if (wants || next.cal.eventId) {
      const calendarId = await api.ensureCalendar(state.calendarId);
      if (wants) {
        const event = await api.upsert(calendarId, eventFor(next), next.cal.eventId || undefined);
        next.cal = { ...next.cal, eventId: event.id, eventUpdated: event.updated, pushedAt: clock().toISOString(), pending: false };
      } else if (next.cal.eventId) {
        await api.remove(calendarId, next.cal.eventId);
        next.cal = { ...next.cal, eventId: "", eventUpdated: "", pending: false };
      }
      if (state.mode !== "ok" || state.calendarId !== calendarId) await writeCalendarState({ ...state, calendarId, mode: "ok", reason: "", lastOk: clock().toISOString() });
    }
    mode = "ok";
  } catch (err) {
    if (err instanceof CalendarNotAuthorized) {
      const state = await readCalendarState();
      await writeCalendarState({ ...state, mode: "off", reason: err.message });
      return task;
    }
    const state = await readCalendarState();
    await writeCalendarState({ ...state, mode: "paused", reason: err instanceof Error ? err.message : "Google didn't answer." });
    next.cal = { ...next.cal, pending: true };
    mode = "paused";
  }
  for (const line of lines) next = log(next, `${line}${calTail(mode)}`);
  void by;
  return writeTask(next);
}

/** Calendar sync state for the board: healthy, paused (queued changes), or not connected. */
export async function calendarStatus(): Promise<{ mode: CalendarMode; calendar: string; reason: string }> {
  const api = await calendarApi();
  if (!api) return { mode: "off", calendar: CALENDAR_NAME, reason: "Google isn't connected." };
  const state = await readCalendarState();
  return { mode: state.mode === "off" && !state.reason ? "ok" : state.mode, calendar: CALENDAR_NAME, reason: state.reason };
}

function stripCheck(summary: string): { title: string; checked: boolean } {
  const match = /^\s*(?:✓|✔|☑|\[x\])\s*/i.exec(summary);
  return { title: summary.slice(match?.[0].length ?? 0).trim(), checked: Boolean(match) };
}

function dueFromEvent(event: CalEvent): { dueAt: string; dueDay: string } {
  if (event.start.dateTime) return { dueAt: new Date(event.start.dateTime).toISOString(), dueDay: "" };
  return { dueAt: "", dueDay: (event.start.date ?? "").slice(0, 10) };
}

function eventWhen(event: CalEvent): string {
  const short = (at: Date) => exactLabel(at).replace(/^(\w{3})\w*/, "$1");
  if (event.start.dateTime) {
    const start = short(new Date(event.start.dateTime)).replace(" at ", ", ");
    if (!event.end.dateTime) return start;
    const e = torontoParts(new Date(event.end.dateTime));
    return `${start.replace(/ (AM|PM)$/, "")}–${e.h % 12 || 12}:${String(e.min).padStart(2, "0")} ${e.h >= 12 ? "PM" : "AM"}`;
  }
  const [y, m, d] = (event.start.date ?? "").split("-").map(Number);
  return `${short(fromToronto({ y: y!, m: m!, d: d! }, 720)).replace(/ at .*$/, "")}, all day`;
}

/**
 * The calendar's changes since the last read: new events become tasks, edited events update theirs,
 * a deleted event leaves its task, a ✓ added outside Copilot marks the task done. The later change wins
 * when both sides moved; the activity line names where it came from.
 */
export async function pullCalendar(): Promise<{ created: number; updated: number; mode: CalendarMode }> {
  const api = await calendarApi();
  if (!api) return { created: 0, updated: 0, mode: "off" };
  const state = await readCalendarState();
  let created = 0;
  let updated = 0;
  try {
    const calendarId = await api.ensureCalendar(state.calendarId);
    let changes: Awaited<ReturnType<typeof api.changes>>;
    try {
      changes = await api.changes(calendarId, state.syncToken);
    } catch (err) {
      // An expired sync token means read everything again.
      if ((err as { status?: number }).status !== 410) throw err;
      changes = await api.changes(calendarId, "");
    }
    const tasks = await readTasks();
    const roster = await readTeamRoster();
    const now = clock();
    for (const event of changes.events) {
      const byId = event.extendedProperties?.private?.taskId;
      const task = tasks.find((row) => (byId && row.id === byId) || (row.cal.eventId && row.cal.eventId === event.id));
      if (event.status === "cancelled") {
        if (task && task.cal.eventId === event.id && !task.deletedAt) {
          await writeTask(log({ ...task, cal: { ...task.cal, on: false, deleted: true, eventId: "", eventUpdated: event.updated }, updatedAt: now.toISOString() }, "Calendar event deleted · task kept here"));
          updated += 1;
        }
        continue;
      }
      const { title, checked } = stripCheck(event.summary ?? "");
      const due = dueFromEvent(event);
      if (!task) {
        const named = /Assignee:\s*([^\n]+)/i.exec(event.description ?? "")?.[1]?.trim() ?? "";
        const person = roster.find((row) => row.name.toLowerCase() === named.toLowerCase()) ?? roster.find((row) => new RegExp(`^${row.name}\\b|\\(${row.name}\\)`, "i").test(title));
        const unit = (/Property:\s*([^\n]+)/i.exec(event.description ?? "")?.[1] ?? event.location ?? "").trim();
        const minutes = event.reminders?.overrides?.[0]?.minutes;
        const reminder: ReminderOffset = minutes == null ? "30 minutes before" : minutes === 0 ? "At the time" : minutes <= 30 ? "30 minutes before" : minutes <= 60 ? "1 hour before" : "1 day before";
        const who = event.creator?.displayName || event.creator?.email || "someone";
        const note = (event.description ?? "").replace(/^(Assignee|Property):.*$/gim, "").trim();
        const made = await createTask({
          title: title || "Untitled calendar event",
          assignee: person?.name ?? "",
          ...due,
          unit,
          by: "the team calendar",
          createdLine: `Added from the team calendar · ${person ? `assigned to ${person.name} from the event` : "the event has no assignee"}`,
          source: { kind: "calendar", label: "From the team calendar", quote: [title, eventWhen(event), unit, note ? `“${note}”` : ""].filter(Boolean).join(" · "), meta: `Created by ${who} in Google Calendar on ${CALENDAR_NAME}`, ref: event.id },
          calendar: { on: true, fromCal: true, eventId: event.id, eventUpdated: event.updated, reminder },
        });
        if (checked) await markDone(made.id, "the team calendar", "", { ...made, doneBy: "the team calendar" });
        created += 1;
        continue;
      }
      if (task.cal.eventUpdated && event.updated <= task.cal.eventUpdated) continue;
      // Both sides changed: the later change wins, and the line says which side.
      if (task.cal.pending && task.updatedAt > event.updated) {
        await writeTask(log({ ...task, cal: { ...task.cal, eventUpdated: event.updated } }, "Calendar and board both changed · the board's later change was kept"));
        continue;
      }
      let next: Task = { ...task, cal: { ...task.cal, eventUpdated: event.updated, on: true, deleted: false } };
      const changes: string[] = [];
      if (title && title !== task.title) {
        next.title = title;
        changes.push(`title changed to “${title}”`);
      }
      if (due.dueAt !== task.dueAt || due.dueDay !== task.dueDay) {
        next = { ...next, ...due };
        changes.push(`due moved to ${dueText(next, now)}`);
      }
      if (changes.length) next = log(next, `Edited in Google Calendar · ${changes.join(", ")}`);
      next.updatedAt = now.toISOString();
      const saved = await writeTask(next);
      if (checked && isOpen(saved)) {
        const doneTask = log({ ...saved, status: "done", doneAt: now.toISOString(), doneBy: "Google Calendar" }, "Marked done on the team calendar ✓");
        await writeTask(doneTask);
      }
      if (changes.length || checked) updated += 1;
    }
    await writeCalendarState({ ...state, calendarId, syncToken: changes.nextSyncToken || state.syncToken, mode: "ok", reason: "", lastOk: now.toISOString() });
    return { created, updated, mode: "ok" };
  } catch (err) {
    if (err instanceof CalendarNotAuthorized) {
      await writeCalendarState({ ...state, mode: "off", reason: err.message });
      return { created, updated, mode: "off" };
    }
    await writeCalendarState({ ...state, mode: "paused", reason: err instanceof Error ? err.message : "Google didn't answer." });
    return { created, updated, mode: "paused" };
  }
}

/** Queued changes go out; then the calendar's own changes come in. Every check and app open. */
export async function syncCalendar(): Promise<{ mode: CalendarMode; pushed: number; created: number; updated: number }> {
  const api = await calendarApi();
  if (!api) return { mode: "off", pushed: 0, created: 0, updated: 0 };
  let pushed = 0;
  // Queued changes, and tasks made while the calendar wasn't connected that belong on it.
  const waiting = (await readTasks()).filter((row) => row.cal.pending || (!row.deletedAt && isOpen(row) && row.cal.on && calendarReady(row) && !row.cal.eventId && !row.cal.deleted));
  if (waiting.length) {
    const state = await readCalendarState();
    if (state.mode === "off" && state.reason) await writeCalendarState({ ...state, reason: "" });
  }
  for (const task of waiting) {
    const saved = await reconcile({ ...task, cal: { ...task.cal, pending: false } }, task, "Copilot");
    if (saved.cal.pending) return { mode: "paused", pushed, created: 0, updated: 0 };
    pushed += 1;
  }
  const pulled = await pullCalendar();
  return { pushed, ...pulled };
}
