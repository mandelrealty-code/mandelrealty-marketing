/**
 * Reminders: the partners' own to-dos, kept until someone marks them done.
 *
 * One record per reminder in Copilot's store. Every surface (chat card, Reminders view, Overview,
 * the due-now message) reads and writes that same record, so done, snooze and edit show everywhere.
 * Assignees come from the team roster, so a new team member is a choice with no code change.
 * Nothing here contacts anyone: a reminder only ever comes back to the partners inside Copilot.
 */

import { randomUUID } from "node:crypto";
import { parityEnabled } from "./parity/flag.js";
import { parityNow } from "./parity/clock.js";
import { addMessage, createChat, flagChatNeedsYou, listChats, listMessages, listPrefixedRows, readPrefixedRow, updateDraft, writePrefixedRow } from "./store.js";
import { dayKey, exactLabel, resolveReminderTime, torontoParts, withoutTimeWords } from "./reminderTime.js";
import { daysOutstanding, dueMessage, isDone, savedLine, unitIn, type Reminder, type ReminderCardDraft, type ReminderSource } from "./reminderView.js";
import type { CopilotMessage } from "./types.js";

const ROW = "reminder|";
const ROSTER = "team-roster|";
export const DEFAULT_ROSTER = ["Shane", "Ryan"];
export const REMINDERS_CHAT = "Reminders";

const parityRows = new Map<string, Reminder>();
let parityRoster: string[] | null = null;

export function resetParityReminders(): void {
  parityRows.clear();
  parityRoster = null;
}

function clock(): Date {
  return parityNow() ?? new Date();
}

// ---------- Roster ----------

/** The team roster, partners first. Settings › Team adds to it; every chip reads it. */
export async function readRoster(): Promise<string[]> {
  if (parityEnabled()) return parityRoster ?? DEFAULT_ROSTER;
  try {
    const raw = await readPrefixedRow(ROSTER);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const names = Array.isArray(parsed) ? parsed.map((name) => String(name).trim()).filter(Boolean) : [];
    return names.length ? [...new Set(names)] : DEFAULT_ROSTER;
  } catch {
    return DEFAULT_ROSTER;
  }
}

export async function addToRoster(name: string): Promise<string[]> {
  const clean = name.trim().replace(/\s+/g, " ");
  const roster = await readRoster();
  if (!clean || roster.some((row) => row.toLowerCase() === clean.toLowerCase())) return roster;
  const next = [...roster, clean];
  if (parityEnabled()) parityRoster = next;
  else await writePrefixedRow(ROSTER, JSON.stringify(next));
  return next;
}

// ---------- Records ----------

function parse(raw: string): Reminder | null {
  const bar = raw.indexOf("|");
  if (bar < 0) return null;
  try {
    const row = JSON.parse(raw.slice(bar + 1)) as Reminder;
    return row && row.id && row.text ? row : null;
  } catch {
    return null;
  }
}

export async function listReminders(): Promise<Reminder[]> {
  if (parityEnabled()) return [...parityRows.values()].map((row) => ({ ...row }));
  const rows = await listPrefixedRows(ROW);
  return rows.map(parse).filter((row): row is Reminder => Boolean(row));
}

export async function readReminder(id: string): Promise<Reminder | null> {
  if (parityEnabled()) return parityRows.has(id) ? { ...parityRows.get(id)! } : null;
  const raw = await readPrefixedRow(`${ROW}${id}|`);
  return raw ? parse(`${id}|${raw}`) : null;
}

async function save(row: Reminder): Promise<Reminder> {
  const next = { ...row, updatedAt: clock().toISOString() };
  if (parityEnabled()) parityRows.set(next.id, next);
  else await writePrefixedRow(`${ROW}${next.id}|`, JSON.stringify(next));
  return next;
}

function capital(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  return clean ? `${clean[0]!.toUpperCase()}${clean.slice(1)}` : clean;
}

export async function createReminder(input: { text: string; assignee: string; dueAt: string; unit?: string; createdBy: string; source?: ReminderSource; sourceRef?: string }): Promise<Reminder> {
  const now = clock();
  const text = capital(input.text);
  if (!text) throw new Error("Say what the reminder is for.");
  if (!input.assignee) throw new Error("Pick whose it is.");
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error("Pick a time.");
  return save({
    id: randomUUID(),
    text,
    assignee: input.assignee,
    // Never in the past: a time already gone is the same time tomorrow.
    dueAt: (due.getTime() < now.getTime() - 60_000 ? new Date(due.getTime() + 86_400_000) : due).toISOString(),
    unit: input.unit ?? unitIn(text),
    createdBy: input.createdBy || input.assignee,
    createdAt: now.toISOString(),
    source: input.source ?? "chat",
    sourceRef: input.sourceRef ?? "",
    status: "open",
    snoozeCount: 0,
    prevDueAt: "",
    doneBy: "",
    doneAt: "",
    updatedAt: now.toISOString(),
    surfacedFor: "",
    stillOpenOn: "",
  });
}

async function change(id: string, edit: (row: Reminder) => Reminder): Promise<Reminder> {
  const row = await readReminder(id);
  if (!row) throw new Error("That reminder isn't in Copilot any more.");
  return save(edit(row));
}

export function updateReminder(id: string, patch: { text?: string; assignee?: string; dueAt?: string; unit?: string }): Promise<Reminder> {
  return change(id, (row) => ({
    ...row,
    ...(patch.text != null && capital(patch.text) ? { text: capital(patch.text) } : {}),
    ...(patch.assignee ? { assignee: patch.assignee } : {}),
    ...(patch.unit != null ? { unit: patch.unit } : {}),
    // A new time is a fresh due: it will be surfaced again when it comes.
    ...(patch.dueAt && !Number.isNaN(new Date(patch.dueAt).getTime()) ? { dueAt: new Date(patch.dueAt).toISOString(), surfacedFor: "", stillOpenOn: "" } : {}),
  }));
}

export function markReminderDone(id: string, by: string): Promise<Reminder> {
  return change(id, (row) => ({ ...row, status: "done", doneBy: by || row.assignee, doneAt: clock().toISOString() }));
}

export function undoReminderDone(id: string): Promise<Reminder> {
  return change(id, (row) => ({ ...row, status: row.snoozeCount > 0 ? "snoozed" : "open", doneBy: "", doneAt: "" }));
}

export function snoozeReminder(id: string, dueAt: string): Promise<Reminder> {
  return change(id, (row) => {
    const next = new Date(dueAt);
    if (Number.isNaN(next.getTime())) throw new Error("Pick a time to snooze to.");
    return { ...row, status: "snoozed", prevDueAt: row.dueAt, dueAt: next.toISOString(), snoozeCount: row.snoozeCount + 1, surfacedFor: "", stillOpenOn: "" };
  });
}

export function undoSnooze(id: string): Promise<Reminder> {
  return change(id, (row) => {
    if (!row.prevDueAt) return row;
    const count = Math.max(0, row.snoozeCount - 1);
    return { ...row, dueAt: row.prevDueAt, prevDueAt: "", snoozeCount: count, status: count > 0 ? "snoozed" : "open" };
  });
}

// ---------- Chat ----------

const NOT_A_REMINDER = /\bremind\s+(?:me|us)\s+(?:again\s+)?(?:what|who|how|where|which|of|whether|if)\b/i;

/** "remind me to…", "remind Ryan to…", "remind us…", "set a reminder…", "reminder: …". */
export function asksReminder(text: string, roster: string[] = DEFAULT_ROSTER): boolean {
  const t = text.trim();
  if (!t || NOT_A_REMINDER.test(t)) return false;
  if (/^(?:what|which|show|list|any)\b.*\breminders?\b/i.test(t)) return false;
  const names = roster.map((name) => name.split(" ")[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\bremind\\s+(?:me|us|him|her|them|everyone|every one|the team|both of us|${names})\\b`, "i").test(t)
    || /\b(?:set|add|create|make|put in|need)\s+(?:a\s+|me\s+a\s+)?reminder\b/i.test(t)
    || /^reminder\s*[:\-–]/i.test(t);
}

/** "remind me about this": the reminder comes from the item just above. */
export function asksAboutThis(text: string): boolean {
  return /\bremind\s+(?:me|us|\w+)\s+(?:about|of)\s+(?:this|that|it)\b/i.test(text) || /\bremind\s+(?:me|us|\w+)\s+to\s+(?:do|handle|deal with|follow up on)\s+(?:this|that|it)\b/i.test(text);
}

/** Whose it is, from the words: "me" is the viewer, a roster name is that person, "us" asks. */
export function assigneeFrom(text: string, viewer: string, roster: string[]): string {
  for (const name of roster) {
    const first = name.split(" ")[0]!;
    if (new RegExp(`\\b(?:remind|for|tell|ask|it'?s|its|that'?s)\\s+${first}\\b|\\b${first}'?s\\s+(?:task|job|reminder|to do)\\b`, "i").test(text)) return name;
  }
  if (/\bremind\s+me\b|\bfor me\b|\bmy (?:task|reminder)\b/i.test(text)) return viewer;
  return "";
}

/** The task in the partner's words, without the remind words, the person, or the time words. */
export function taskFrom(text: string, phrases: string[], roster: string[]): string {
  const names = roster.map((name) => name.split(" ")[0]!).join("|");
  let task = text
    .replace(/^\s*(?:hey\s+)?(?:copilot[,:]?\s+)?(?:can you\s+|could you\s+|please\s+|pls\s+)?/i, "")
    .replace(new RegExp(`^.*?\\bremind\\s+(?:me|us|him|her|them|everyone|every one|the team|both of us|${names})\\b\\s*(?:(?:to|about|that|of)\\b)?\\s*`, "i"), "")
    .replace(/^.*?\b(?:set|add|create|make|put in|need)\s+(?:a\s+|me\s+a\s+)?reminder\b\s*(?:for\s+(?:me|us)\s+)?(?:(?:to|about|for|that)\b)?\s*/i, "")
    .replace(/^reminder\s*[:\-–]\s*/i, "");
  task = task.replace(new RegExp(`\\s*\\b(?:for|it'?s|its)\\s+(?:${names})(?:'s)?\\b`, "i"), " ");
  task = withoutTimeWords(task, phrases).replace(/^(?:to|about|that|of)\b\s*/i, "");
  return capital(task.replace(/\s*(?:please|pls|thanks|thank you)\s*$/i, "").replace(/\s+(?:to|for)$/i, ""));
}

export type CardReply = { body: string; card: ReminderCardDraft };

export function leadFor(card: ReminderCardDraft, viewer: string): string {
  if (!card.assignee) return "Whose task is this?";
  const who = card.assignee === viewer ? "you" : card.assignee;
  if (!card.dueAt) return `For ${who}. When should it come back?`;
  return `For ${who}, ${exactLabel(new Date(card.dueAt))}.${card.note ? ` ${card.note}` : ""} Save it?`;
}

/** How the time was read, when it wasn't said exactly: "Next week is read as Monday; a day with no time is 9:00 AM." */
function noteOf(resolved: ReturnType<typeof resolveReminderTime>): string {
  if (!resolved) return "";
  const said = [resolved.rolled, resolved.assumed].filter(Boolean).join("; ");
  return said ? `${said[0]!.toUpperCase()}${said.slice(1)}.` : "";
}

/** The card a "remind…" message opens, pre-filled with whatever was said. */
export async function reminderCard(text: string, input: { viewer: string; history?: CopilotMessage[]; chatTitle?: string }): Promise<CardReply> {
  const now = clock();
  const roster = await readRoster();
  const viewer = input.viewer || roster[0]!;
  const resolved = resolveReminderTime(text, now);
  const assignee = assigneeFrom(text, viewer, roster);
  let task = taskFrom(text, resolved?.phrase ?? [], roster);
  let source: ReminderSource = "chat";
  let sourceRef = "";
  if (asksAboutThis(text) || !task) {
    // "Remind me about this": the item just above in this chat, linked to it.
    const item = [...(input.history ?? [])].reverse().find((row) => row.role === "assistant" && (row.draft || row.checksItem || row.body.trim()));
    if (item) {
      source = item.draft?.followUp ? "follow-up" : input.chatTitle === "Checks" || item.checksItem ? "checks" : "chat";
      sourceRef = item.id;
      task = capital(itemTask(item) || task);
    }
  }
  const card: ReminderCardDraft = {
    text: task,
    assignee,
    dueAt: resolved ? resolved.at.toISOString() : "",
    unit: unitIn(task),
    source,
    sourceRef,
    note: noteOf(resolved),
    savedId: "",
    askedWho: !assignee,
  };
  return { body: leadFor(card, viewer), card };
}

function itemTask(item: CopilotMessage): string {
  if (item.draft?.followUp?.headline) return `Follow up: ${item.draft.followUp.headline}`;
  if (item.checksItem?.label) return item.checksItem.label;
  if (item.draft?.channel === "email" && item.draft.subject) return `Follow up on “${item.draft.subject}”${item.draft.to ? ` to ${item.draft.to.split(/[,<]/)[0]!.trim()}` : ""}`;
  if (item.draft?.channel === "hospitable" && item.draft.to) return `Follow up with ${item.draft.to}`;
  const first = item.body.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return first.length > 90 ? `${first.slice(0, 87).trim()}…` : first;
}

/** The open card in this chat still waiting on whose it is. */
export function openCardIn(history: CopilotMessage[]): CopilotMessage | null {
  const last = [...history].reverse().find((row) => row.role === "assistant");
  const card = last?.reminder?.card;
  return card && !card.savedId && !card.superseded && !card.assignee ? last! : null;
}

/** "Ryan", "mine", "it's Ryan's", "for me": an answer to "Whose task is this?". */
export function whoAnswer(text: string, viewer: string, roster: string[]): string {
  const t = text.trim().replace(/[.!]+$/, "");
  if (t.length > 60) return "";
  if (/^(?:me|mine|myself|i am|i'?ll do it|for me|my task|it'?s mine)$/i.test(t)) return viewer;
  for (const name of roster) {
    const first = name.split(" ")[0]!;
    if (new RegExp(`^(?:it'?s\\s+|its\\s+|for\\s+|give it to\\s+|assign (?:it )?to\\s+)?(?:${first}|${name})(?:'s)?(?:\\s+(?:task|one))?$`, "i").test(t)) return name;
  }
  return "";
}

/** Saves a card: creates the record and folds the card into the saved line. */
export async function saveCard(messageId: string, card: ReminderCardDraft, viewer: string): Promise<{ reminder: Reminder; line: string }> {
  const reminder = card.savedId && card.savedId !== "superseded"
    ? await updateReminder(card.savedId, { text: card.text, assignee: card.assignee, dueAt: card.dueAt, unit: card.unit })
    : await createReminder({ text: card.text, assignee: card.assignee, dueAt: card.dueAt, unit: card.unit, createdBy: viewer, source: card.source, sourceRef: card.sourceRef });
  // Saved later than it was written and the time has gone by: it moved to tomorrow, and the line says so.
  const rolled = reminder.dueAt !== new Date(card.dueAt).toISOString()
    ? "that time had already passed, so it's set for the next day"
    : /had already passed/.test(card.note) ? card.note.split(";")[0]!.replace(/\.$/, "") : "";
  const line = savedLine(reminder, rolled);
  if (messageId) await updateDraft(messageId, { reminder: { card: { ...card, text: reminder.text, dueAt: reminder.dueAt, unit: reminder.unit, savedId: reminder.id } }, bodyText: line } as never).catch(() => null);
  return { reminder, line };
}

// ---------- Surfacing ----------

async function remindersChat(): Promise<string> {
  const chats = await listChats().catch(() => []);
  const found = chats.find((chat) => chat.title === REMINDERS_CHAT);
  return found ? found.id : (await createChat(REMINDERS_CHAT)).id;
}

/**
 * Reminders whose time has come go into chat: a due-now message once per due time, and a
 * "Still open" message once a day while one stays outstanding. Called at every app open and at
 * every scheduled check. Nobody outside Copilot is contacted.
 */
export async function surfaceDueReminders(now = clock()): Promise<{ chatId: string; posted: number }> {
  const rows = (await listReminders()).filter((row) => !isDone(row) && new Date(row.dueAt).getTime() <= now.getTime());
  const today = dayKey(torontoParts(now));
  let chatId = "";
  let posted = 0;
  for (const row of rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt))) {
    const outstanding = daysOutstanding(row, now) > 0;
    const firstTime = row.surfacedFor !== row.dueAt;
    if (!firstTime && (!outstanding || row.stillOpenOn === today)) continue;
    chatId ||= await remindersChat();
    const kind = outstanding ? "still" : "due";
    const words = dueMessage(row, now, row.assignee);
    await addMessage({ chatId, role: "assistant", body: `${words.a}${words.hl}${words.b}`, reminder: { ref: { id: row.id, kind } } });
    await save({ ...row, surfacedFor: row.dueAt, stillOpenOn: today });
    posted += 1;
  }
  if (posted && chatId) await flagChatNeedsYou(chatId).catch(() => undefined);
  return { chatId, posted };
}

/** Recent messages of a chat, for "remind me about this" and the whose-answer. */
export async function chatHistory(chatId: string): Promise<CopilotMessage[]> {
  return chatId ? (await listMessages(chatId).catch(() => [])).slice(-12) : [];
}
