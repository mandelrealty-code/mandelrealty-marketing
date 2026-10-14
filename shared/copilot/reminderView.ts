/**
 * One reminder record, and how every surface reads it: the Reminders view, the Overview group,
 * the due-now chat message and the saved line. Browser-safe, so the app renders from the same rules
 * the server tests.
 */

import { clockLabel, daysBetween, dueWords, exactLabel, torontoParts } from "./reminderTime.js";

export type ReminderStatus = "open" | "snoozed" | "done";
export type ReminderSource = "chat" | "checks" | "follow-up";

export type Reminder = {
  id: string;
  /** In the partner's words, first letter capitalised. */
  text: string;
  /** A name from the team roster. */
  assignee: string;
  /** ISO instant. */
  dueAt: string;
  /** "Charlotte 606", "1065 Shaw St"; optional. */
  unit: string;
  createdBy: string;
  createdAt: string;
  source: ReminderSource;
  /** The chat message, Checks card or follow-up it came from. */
  sourceRef: string;
  status: ReminderStatus;
  snoozeCount: number;
  /** Where Undo on a snooze returns it. */
  prevDueAt: string;
  doneBy: string;
  doneAt: string;
  updatedAt: string;
  /** The dueAt the due-now message was last posted for, and the day the last "still open" went out. */
  surfacedFor: string;
  stillOpenOn: string;
};

export type ReminderCardDraft = {
  text: string;
  assignee: string;
  dueAt: string;
  unit: string;
  source: ReminderSource;
  sourceRef: string;
  /** How a vague or rolled time was read, said once before saving. */
  note: string;
  /** Set once saved; the card folds into the saved line. */
  savedId: string;
  /** "Whose task is this?" was asked on this card. */
  askedWho: boolean;
};

export const UNITS = ["Charlotte 606", "41 Roseglor", "Blue Jays Way 318", "1065 Shaw St"];

export function isDone(row: Reminder): boolean {
  return row.status === "done";
}

/** Calendar days past due, Toronto days; 0 when due today or later. */
export function daysOutstanding(row: Reminder, now: Date): number {
  if (isDone(row)) return 0;
  const gap = daysBetween(torontoParts(new Date(row.dueAt)), torontoParts(now));
  return gap > 0 ? gap : 0;
}

export function outstandingText(days: number): string {
  return days === 1 ? "1 day outstanding" : `${days} days outstanding`;
}

function times(n: number): string {
  return n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;
}

function sourceTag(row: Reminder): string {
  return row.source === "checks" ? "From Checks" : row.source === "follow-up" ? "From a follow-up" : "";
}

function doneStamp(row: Reminder): string {
  const at = new Date(row.doneAt);
  const p = torontoParts(at);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][p.dow]} ${clockLabel(p.h * 60 + p.min)}`;
}

export type ReminderRow = {
  id: string;
  text: string;
  who: string;
  meta: string[];
  open: boolean;
  done: boolean;
  overdue: boolean;
  outText: string;
  dueText: string;
  snoozed: boolean;
  snText: string;
  doneText: string;
};

export function reminderRow(row: Reminder, now: Date): ReminderRow {
  const done = isDone(row);
  const days = daysOutstanding(row, now);
  return {
    id: row.id,
    text: row.text,
    who: row.assignee,
    meta: [row.unit, sourceTag(row)].filter(Boolean),
    open: !done,
    done,
    overdue: days > 0,
    outText: days > 0 ? outstandingText(days) : "",
    dueText: dueWords(new Date(row.dueAt), now),
    snoozed: !done && row.snoozeCount > 0,
    snText: `Snoozed ${times(row.snoozeCount)}`,
    doneText: done ? `Done · marked by ${row.doneBy}, ${doneStamp(row)}` : "",
  };
}

const byDue = (a: Reminder, b: Reminder) => a.dueAt.localeCompare(b.dueAt);

export type ReminderFilter = "mine" | "person" | "every";

export type ReminderGroups = {
  overdue: Reminder[];
  today: Reminder[];
  upcoming: Reminder[];
  done: Reminder[];
};

/** Overdue, Today, Upcoming, Done; each sorted by due. Nothing leaves on its own. */
export function groupReminders(rows: Reminder[], now: Date): ReminderGroups {
  const today = torontoParts(now);
  const open = rows.filter((row) => !isDone(row)).sort(byDue);
  const dayGap = (row: Reminder) => daysBetween(today, torontoParts(new Date(row.dueAt)));
  return {
    overdue: open.filter((row) => dayGap(row) < 0),
    today: open.filter((row) => dayGap(row) === 0),
    upcoming: open.filter((row) => dayGap(row) > 0),
    done: rows.filter(isDone).sort((a, b) => b.doneAt.localeCompare(a.doneAt)),
  };
}

/** The Overview group: outstanding first, then due today, then the ones done today (struck through). */
export function overviewReminders(rows: Reminder[], now: Date): { rows: Reminder[]; open: number; upcoming: number } {
  const groups = groupReminders(rows, now);
  const today = torontoParts(now);
  const doneToday = groups.done.filter((row) => row.doneAt && daysBetween(torontoParts(new Date(row.doneAt)), today) === 0);
  return {
    rows: [...groups.overdue, ...groups.today, ...doneToday],
    open: groups.overdue.length + groups.today.length,
    upcoming: groups.upcoming.length,
  };
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** The sentence Overview adds to its summary about reminders. */
export function overviewReminderLine(rows: Reminder[], now: Date): string {
  const groups = groupReminders(rows, now);
  const overdue = groups.overdue.length;
  const today = groups.today.length;
  const word = (n: number) => WORDS[n] ?? String(n);
  if (overdue) {
    const oldest = Math.max(...groups.overdue.map((row) => daysOutstanding(row, now)));
    return `${word(overdue)} ${overdue === 1 ? "reminder is" : "reminders are"} outstanding, the oldest ${outstandingText(oldest).replace(" outstanding", "")}${today ? `, and ${word(today).toLowerCase()} more ${today === 1 ? "is" : "are"} due today.` : "."}`;
  }
  if (today) return `${word(today)} ${today === 1 ? "reminder is" : "reminders are"} due today.`;
  return "";
}

/** The sidebar count: reminders outstanding or due today. */
export function sidebarCount(rows: Reminder[], now: Date): number {
  const groups = groupReminders(rows, now);
  return groups.overdue.length + groups.today.length;
}

function lowerFirst(text: string): string {
  return text ? `${text[0]!.toLowerCase()}${text.slice(1)}` : text;
}

/** "Reminder set: order towels, Ryan, Monday Oct 19 at 9:00 AM, Charlotte 606." */
export function savedLine(card: { text: string; assignee: string; dueAt: string; unit: string }, rolled = ""): string {
  const when = card.dueAt ? exactLabel(new Date(card.dueAt)) : "";
  return `Reminder set: ${lowerFirst(card.text)}, ${card.assignee}, ${when}${card.unit ? `, ${card.unit}` : ""}.${rolled ? ` ${rolled[0]!.toUpperCase()}${rolled.slice(1)}.` : ""}`;
}

/** The due-now message: "Reminder: purchase supplies for Shaw, due 9:00 AM, yours." or the "Still open" line. */
export function dueMessage(row: Reminder, now: Date, viewer: string): { a: string; hl: string; b: string } {
  const whose = row.assignee === viewer ? "yours" : `${row.assignee}'s`;
  const days = daysOutstanding(row, now);
  if (days > 0) return { a: `Still open: ${lowerFirst(row.text)}, `, hl: outstandingText(days), b: `, ${whose}.` };
  const p = torontoParts(new Date(row.dueAt));
  return { a: `Reminder: ${lowerFirst(row.text)}, due ${clockLabel(p.h * 60 + p.min)}, ${whose}.`, hl: "", b: "" };
}

/** The unit a task names, by address or by the owner's name; optional and never required. */
export function unitIn(text: string): string {
  const t = text.toLowerCase();
  if (/\bshaw\b|\broya'?s?\b|\bardakani\b/.test(t)) return "1065 Shaw St";
  if (/\bcharlotte\b|\b606\b|\bnance'?s?\b/.test(t)) return "Charlotte 606";
  if (/\broseglor\b|\bscarborough\b|\bprecilla'?s?\b|\bpriscilla'?s?\b/.test(t)) return "41 Roseglor";
  if (/\bblue jays\b|\b318\b|\braj'?s?\b|\bkhamraj\b/.test(t)) return "Blue Jays Way 318";
  return "";
}
