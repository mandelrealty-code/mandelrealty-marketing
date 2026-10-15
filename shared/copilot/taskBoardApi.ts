/**
 * The Tasks board's server side, for partners (OPS admin) and employees (their OPS accounts).
 * Employees see and change only their own tasks; assignee and priority are read-only for them, and
 * only partners reassign or delete. Every answer carries the whole board so every surface re-renders
 * from the same records.
 */

import { readArchivedTasks, TasksNotReady, TASKS_NOT_READY } from "./taskDb.js";
import {
  calendarStatus,
  comment,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  markDone,
  readTeamRoster,
  reopen,
  restoreTask,
  snooze,
  syncCalendar,
  unarchiveTask,
  unsnooze,
  updateTask,
  visibleTo,
  type TaskPatch,
} from "./tasks.js";
import { closeResolvedTasks } from "./taskAutomation.js";
import { UNITS } from "./reminderView.js";
import { REMINDER_OFFSETS, type ArchivedTask, type ReminderOffset, type RosterPerson, type Task, type TaskPriority, type TaskStatus } from "./taskTypes.js";

export type BoardViewer = { name: string; partner: boolean };

export type BoardPayload = {
  ready: boolean;
  line: string;
  tasks: Task[];
  roster: RosterPerson[];
  units: string[];
  viewer: BoardViewer;
  calendar: { mode: "ok" | "off" | "paused"; calendar: string; reason: string };
  /** The archived legacy list, for partners who turned on "Include archived". */
  archived?: ArchivedTask[];
};

export async function boardPayload(viewer: BoardViewer, opts: { includeArchived?: boolean } = {}): Promise<BoardPayload> {
  try {
    const [tasks, roster, calendar] = await Promise.all([listTasks(), readTeamRoster(), calendarStatus()]);
    // Chat-created due items and board tasks share one list on Tasks.
    const mine = visibleTo(tasks, viewer);
    const units = [...new Set([...UNITS, ...tasks.map((task) => task.unit).filter(Boolean)])];
    const archived = viewer.partner && opts.includeArchived ? await readArchivedTasks() : undefined;
    return { ready: true, line: "", tasks: mine, roster, units, viewer, calendar, ...(archived ? { archived } : {}) };
  } catch (err) {
    if (err instanceof TasksNotReady) return { ready: false, line: TASKS_NOT_READY, tasks: [], roster: [], units: [], viewer, calendar: { mode: "off", calendar: "Mandel Tasks", reason: "" } };
    throw err;
  }
}

/** At app open: queued calendar changes go out, calendar changes come in, resolved tasks close. */
export async function boardOpen(viewer: BoardViewer, opts: { includeArchived?: boolean } = {}): Promise<BoardPayload> {
  try {
    await syncCalendar();
    await closeResolvedTasks();
  } catch (err) {
    if (!(err instanceof TasksNotReady)) {
      /* A failed sync never blocks the board; the calendar state says paused. */
    }
  }
  return boardPayload(viewer, opts);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const STATUSES: TaskStatus[] = ["todo", "doing", "waiting", "done"];

/** One board action. Employees are held to their own tasks and their allowed fields. */
export async function boardAction(body: Record<string, unknown>, viewer: BoardViewer): Promise<BoardPayload> {
  const op = text(body.op);
  const id = text(body.id);
  const by = viewer.name;
  const opts = { includeArchived: body.includeArchived === true };
  const own = async () => {
    const task = await getTask(id);
    if (!task || task.deletedAt) throw new Error("That task isn't on the board any more.");
    if (!viewer.partner && task.assignee.toLowerCase() !== viewer.name.toLowerCase()) throw new Error("That task isn't yours.");
    return task;
  };
  if (op === "create") {
    const assignee = viewer.partner ? text(body.assignee) : viewer.name;
    await createTask({
      title: text(body.title),
      assignee,
      dueAt: text(body.dueAt) || undefined,
      dueDay: text(body.dueDay) || undefined,
      calOn: body.calOn !== false,
      unit: text(body.unit),
      by,
      source: { kind: viewer.partner ? "partner" : "employee", label: "", quote: "", meta: "", ref: "" },
    });
  } else if (op === "update") {
    await own();
    const raw = (body.patch ?? {}) as Record<string, unknown>;
    const patch: TaskPatch = {};
    if (typeof raw.title === "string") patch.title = raw.title;
    if ("dueAt" in raw) patch.dueAt = raw.dueAt ? text(raw.dueAt) : null;
    if ("dueDay" in raw) patch.dueDay = raw.dueDay ? text(raw.dueDay) : null;
    if (STATUSES.includes(raw.status as TaskStatus)) patch.status = raw.status as TaskStatus;
    if (typeof raw.waitingOn === "string") patch.waitingOn = raw.waitingOn;
    if (typeof raw.calOn === "boolean") patch.calOn = raw.calOn;
    if (REMINDER_OFFSETS.includes(raw.reminder as ReminderOffset)) patch.reminder = raw.reminder as ReminderOffset;
    if (viewer.partner) {
      // Assignee, priority and unit are set by the partners.
      if (typeof raw.assignee === "string") patch.assignee = raw.assignee;
      if (raw.priority === "normal" || raw.priority === "arrival") patch.priority = raw.priority as TaskPriority;
      if (typeof raw.unit === "string") patch.unit = raw.unit;
    }
    await updateTask(id, patch, by);
  } else if (op === "done") {
    await own();
    await markDone(id, by);
  } else if (op === "reopen") {
    await own();
    await reopen(id, by);
  } else if (op === "snooze") {
    await own();
    await snooze(id, text(body.dueAt), by);
  } else if (op === "unsnooze") {
    await own();
    await unsnooze(id, by);
  } else if (op === "comment") {
    await own();
    await comment(id, text(body.text), by);
  } else if (op === "delete" || op === "restore") {
    if (!viewer.partner) throw new Error("Only Shane or Ryan can delete a task.");
    if (op === "delete") await deleteTask(id, by);
    else await restoreTask(id, by);
  } else if (op === "unarchive") {
    if (!viewer.partner) throw new Error("Only Shane or Ryan can bring back an archived task.");
    await unarchiveTask(id, by);
  } else if (op === "archive") {
    if (!viewer.partner) throw new Error("The archive is for Shane and Ryan.");
    return boardPayload(viewer, { includeArchived: true });
  } else if (op === "sync") {
    return boardOpen(viewer, opts);
  } else {
    throw new Error("Unknown task action.");
  }
  return boardPayload(viewer, opts);
}

export { TASKS_NOT_READY, TasksNotReady };
