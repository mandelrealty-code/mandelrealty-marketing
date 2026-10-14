/**
 * One task record, as every surface reads it: the OPS Tasks board, the employee view, Copilot's
 * Reminders view and Overview group, and the due-now chat message. A reminder is a task.
 * Browser-safe: the board renders from these same rules the server tests.
 */

import { clockLabel, daysBetween, torontoParts, type LocalDay } from "./reminderTime.js";

export type TaskStatus = "todo" | "doing" | "waiting" | "done";
export type TaskPriority = "normal" | "arrival";
export type ReminderOffset = "None" | "At the time" | "30 minutes before" | "1 hour before" | "1 day before";
export const REMINDER_OFFSETS: ReminderOffset[] = ["None", "At the time", "30 minutes before", "1 hour before", "1 day before"];

export type TaskSourceKind = "partner" | "employee" | "chat" | "copilot" | "calendar";

export type TaskSource = {
  kind: TaskSourceKind;
  /** "Copilot · from a guest follow-up", "From the team calendar". */
  label: string;
  /** The evidence, in its own words. */
  quote: string;
  /** Who said it, where, when. */
  meta: string;
  /** The chat message, Checks card, follow-up or event it came from. */
  ref: string;
};

export type TaskLink = { kind: "" | "Guest" | "Client" | "Vendor"; name: string; note: string };

export type TaskCalendar = {
  /** On the team calendar (default on once the task has a due time). */
  on: boolean;
  eventId: string;
  reminder: ReminderOffset;
  /** The event was deleted in Google Calendar; the task stays. */
  deleted: boolean;
  /** Created in Google Calendar and added to the board. */
  fromCal: boolean;
  /** A change waits to reach the calendar (sync paused). */
  pending: boolean;
  /** The event's own `updated` stamp at the last sync, for later-change-wins. */
  eventUpdated: string;
  /** When Copilot last changed the event. */
  pushedAt: string;
};

export type TaskActivity = { at: string; who: string; text: string };

export type Task = {
  id: string;
  title: string;
  /** One name from the team roster, or "" (Needs an assignee). */
  assignee: string;
  status: TaskStatus;
  /** A due time (ISO), or "". */
  dueAt: string;
  /** A due day with no time (YYYY-MM-DD), or "". Set alone for all-day and date-only tasks. */
  dueDay: string;
  priority: TaskPriority;
  waitingOn: string;
  unit: string;
  propertyId: string;
  link: TaskLink;
  source: TaskSource;
  /** One open task per source item, ever. */
  sourceKey: string;
  cal: TaskCalendar;
  activity: TaskActivity[];
  doneBy: string;
  doneAt: string;
  /** Proof when Copilot closed it: "Ryan messaged Eloise, Oct 14, 11:02 AM". */
  closedBy: string;
  snoozeCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  /** Surfacing and undo bookkeeping. */
  extra: { surfacedFor?: string; stillOpenOn?: string; prevDueAt?: string; prevStatus?: TaskStatus };
};

export type RosterPerson = { name: string; role: string; partner: boolean };

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", doing: "Doing", waiting: "Waiting", done: "Done" };

export function blankCalendar(): TaskCalendar {
  return { on: true, eventId: "", reminder: "30 minutes before", deleted: false, fromCal: false, pending: false, eventUpdated: "", pushedAt: "" };
}

export function isOpen(task: Task): boolean {
  return task.status !== "done" && !task.deletedAt;
}

/** A task the calendar can hold: it has a due time, or it is an all-day event from the calendar. */
export function calendarReady(task: Task): boolean {
  return Boolean(task.dueAt) || (Boolean(task.dueDay) && task.cal.fromCal);
}

/** The Toronto day a task is due, or null. */
export function dueLocalDay(task: Task): LocalDay | null {
  if (task.dueAt) return torontoParts(new Date(task.dueAt));
  if (task.dueDay) {
    const [y, m, d] = task.dueDay.split("-").map(Number);
    return y && m && d ? { y, m, d } : null;
  }
  return null;
}

/** Days from today to the due day (negative = past), or null when there is no due. */
export function dueOffset(task: Task, now: Date): number | null {
  const day = dueLocalDay(task);
  return day ? daysBetween(torontoParts(now), day) : null;
}

export function daysOutstanding(task: Task, now: Date): number {
  if (!isOpen(task)) return 0;
  const off = dueOffset(task, now);
  return off != null && off < 0 ? -off : 0;
}

export function outstandingText(days: number): string {
  return days === 1 ? "1 day outstanding" : `${days} days outstanding`;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Tomorrow", "Tue" (this past week), else "Fri Oct 16". */
export function dayWords(day: LocalDay, now: Date): string {
  const off = daysBetween(torontoParts(now), day);
  if (off === 0) return "Today";
  if (off === 1) return "Tomorrow";
  const dow = new Date(Date.UTC(day.y, day.m - 1, day.d, 12)).getUTCDay();
  if (off < 0 && off > -7) return WD[dow]!;
  return `${WD[dow]} ${MO[day.m - 1]} ${day.d}`;
}

/** The time part of a due, "6:00 PM", or "" for a date-only task. */
export function dueTime(task: Task): string {
  if (!task.dueAt) return "";
  const p = torontoParts(new Date(task.dueAt));
  return clockLabel(p.h * 60 + p.min);
}

/** "Today 6:00 PM", "Fri Oct 16, 10:00 AM", "Fri Oct 16", or "No due date". */
export function dueText(task: Task, now: Date): string {
  const day = dueLocalDay(task);
  if (!day) return "No due date";
  const words = dayWords(day, now);
  const time = dueTime(task);
  if (!time) return words;
  const off = daysBetween(torontoParts(now), day);
  return off >= -6 && off <= 1 ? `${words} ${time}` : `${words}, ${time}`;
}

/** "Fri Oct 16, 10:00 AM" or "Mon Oct 19, all day", as the calendar block names the event. */
export function calendarWhen(task: Task, now: Date): string {
  const day = dueLocalDay(task);
  if (!day) return "";
  return `${dayWords(day, now)}, ${dueTime(task) || "all day"}`;
}

function sortKey(task: Task): string {
  if (task.dueAt) return task.dueAt;
  if (task.dueDay) return `${task.dueDay}T23:59:59.999Z`;
  return "9999";
}

export function byDue(a: Task, b: Task): number {
  return sortKey(a).localeCompare(sortKey(b)) || a.createdAt.localeCompare(b.createdAt);
}

export function byDoneAt(a: Task, b: Task): number {
  return b.doneAt.localeCompare(a.doneAt);
}

/** "Today: 3 due · 1 overdue · 1 waiting on a guest · 2 waiting on other people". */
export function digestLine(tasks: Task[], now: Date, forWhom: "anyone" | "you"): string {
  const live = tasks.filter((task) => !task.deletedAt);
  if (!live.length) return "No tasks yet. Add the first one below, or Copilot will add them as work comes in.";
  const open = live.filter(isOpen);
  const due = open.filter((task) => dueOffset(task, now) === 0 && task.status !== "waiting").length;
  const overdue = open.filter((task) => (dueOffset(task, now) ?? 0) < 0).length;
  const waitingGuest = open.filter((task) => task.status === "waiting" && task.link.kind === "Guest").length;
  const waitingOther = open.filter((task) => task.status === "waiting").length - waitingGuest;
  const parts: string[] = [];
  if (due) parts.push(`${due} due`);
  if (overdue) parts.push(`${overdue} overdue`);
  if (!due && !overdue && (waitingGuest || waitingOther)) parts.push(`nothing for ${forWhom} to move`);
  if (waitingGuest) parts.push(`${waitingGuest} waiting on ${waitingGuest > 1 ? "guests" : "a guest"}`);
  if (waitingOther) parts.push(`${waitingOther} waiting on ${waitingOther > 1 ? "other people" : "someone else"}`);
  return `Today: ${parts.length ? parts.join(" · ") : "nothing due"}`;
}

/** The done line every surface shows. */
export function doneLine(task: Task, now: Date): string {
  if (task.closedBy) return `Closed by Copilot · ${task.closedBy}`;
  if (!task.doneAt) return "Done";
  const p = torontoParts(new Date(task.doneAt));
  const day = dayWords(p, now);
  return `Done · ${task.doneBy || "someone"}, ${day} ${clockLabel(p.h * 60 + p.min)}`;
}

/** The activity stamp: "Today 9:05 AM", "Tue 5:30 PM", "Oct 2, 4:00 PM". */
export function stampWords(at: string, now: Date): string {
  const p = torontoParts(new Date(at));
  const off = daysBetween(torontoParts(now), p);
  const time = clockLabel(p.h * 60 + p.min);
  if (off === 0) return `Today ${time}`;
  if (off > -7 && off < 0) return `${WD[p.dow]} ${time}`;
  return `${MO[p.m - 1]} ${p.d}, ${time}`;
}
