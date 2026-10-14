/**
 * Reminders: the partners' own to-dos, kept until someone marks them done.
 *
 * One record per reminder in Copilot's store. Every surface (chat card, Reminders view, Overview,
 * the due-now message) reads and writes that same record, so done, snooze and edit show everywhere.
 * Assignees come from the team roster, so a new team member is a choice with no code change.
 * Nothing here contacts anyone: a reminder only ever comes back to the partners inside Copilot.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityNow } from "./parity/clock.js";
import { addMessage, createChat, flagChatNeedsYou, listChats, listMessages, listPrefixedRows, updateDraft, writePrefixedRow } from "./store.js";
import { createTask, deleteTask, getTask, markDone, readTeamRoster, reopen, restoreTask, snooze, unsnooze, updateTask } from "./tasks.js";
import { readTasks, resetParityTasks, writeTask } from "./taskDb.js";
import { DEFAULT_ROSTER } from "./rosterDefaults.js";
import type { Task } from "./taskTypes.js";
import { dayKey, exactLabel, fromToronto, resolveReminderTime, torontoParts, withoutTimeWords } from "./reminderTime.js";
import { daysOutstanding, dueMessage, isDone, isLive, savedLine, unitIn, type Reminder, type ReminderCardDraft, type ReminderSource } from "./reminderView.js";
import type { CopilotMessage } from "./types.js";

const ROW = "reminder|";
const ROSTER = "team-roster|";
export { DEFAULT_ROSTER };
export const REMINDERS_CHAT = "Reminders";

let parityRoster: string[] | null = null;

export function resetParityReminders(): void {
  parityRoster = null;
  resetParityTasks();
}

function clock(): Date {
  return parityNow() ?? new Date();
}

// ---------- Roster ----------

/** Everyone a task can be for: the partners first, then the employees with OPS accounts. */
export async function readRoster(): Promise<string[]> {
  const people = await readTeamRoster().catch(() => DEFAULT_ROSTER.map((name) => ({ name, role: "Partner", partner: true })));
  const names = people.map((row) => row.name);
  if (parityEnabled() && parityRoster) for (const name of parityRoster) if (!names.includes(name)) names.push(name);
  return names.length ? names : DEFAULT_ROSTER;
}

export async function addToRoster(name: string): Promise<string[]> {
  const clean = name.trim().replace(/\s+/g, " ");
  const roster = await readRoster();
  if (!clean || roster.some((row) => row.toLowerCase() === clean.toLowerCase())) return roster;
  if (parityEnabled()) {
    parityRoster = [...(parityRoster ?? []), clean];
    return readRoster();
  }
  const partners = (await readTeamRoster()).filter((row) => row.partner).map((row) => row.name);
  await writePrefixedRow(ROSTER, JSON.stringify([...partners, clean]));
  return readRoster();
}

// ---------- Records: a reminder is a task ----------

function sourceOf(task: Task): ReminderSource {
  if (/^followup:/.test(task.source.ref) || /follow-up/i.test(task.source.label)) return "follow-up";
  if (/checks/i.test(task.source.label)) return "checks";
  return "chat";
}

/** A task as a reminder. Tasks with no due at all live on the board only. */
export function reminderOf(task: Task): Reminder | null {
  let dueAt = task.dueAt;
  if (!dueAt && task.dueDay) {
    const [y, m, d] = task.dueDay.split("-").map(Number);
    if (y && m && d) dueAt = fromToronto({ y, m, d }, 540).toISOString();
  }
  if (!dueAt) return null;
  return {
    id: task.id,
    text: task.title,
    assignee: task.assignee || "Needs an assignee",
    dueAt,
    unit: task.unit,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    source: sourceOf(task),
    sourceRef: task.source.ref,
    status: task.deletedAt ? "deleted" : task.status === "done" ? "done" : task.snoozeCount > 0 ? "snoozed" : "open",
    snoozeCount: task.snoozeCount,
    prevDueAt: task.extra.prevDueAt ?? "",
    prevStatus: task.extra.prevStatus === "done" ? "done" : undefined,
    doneBy: task.doneBy,
    doneAt: task.doneAt,
    updatedAt: task.updatedAt,
    surfacedFor: task.extra.surfacedFor ?? "",
    stillOpenOn: task.extra.stillOpenOn ?? "",
  };
}

/** Reminders saved before tasks existed move into the task table once. */
async function migrateOldReminders(): Promise<void> {
  if (parityEnabled()) return;
  const rows = await listPrefixedRows(ROW).catch(() => [] as string[]);
  for (const raw of rows) {
    const bar = raw.indexOf("|");
    let old: (Reminder & { migrated?: boolean }) | null = null;
    try {
      old = JSON.parse(raw.slice(bar + 1)) as Reminder & { migrated?: boolean };
    } catch {
      continue;
    }
    if (!old?.id || old.migrated) continue;
    if (old.status !== "deleted") {
      try {
        const made = await createTask({ title: old.text, assignee: old.assignee, dueAt: old.dueAt, unit: old.unit, by: old.createdBy || old.assignee, sourceKey: `reminder:${old.id}`, source: { kind: "chat", label: old.source === "checks" ? "From Checks" : old.source === "follow-up" ? "From a follow-up" : "Created in chat", quote: "", meta: "", ref: old.sourceRef }, createdLine: `Created by ${old.createdBy || old.assignee} in chat` });
        if (old.status === "done") await markDone(made.id, old.doneBy || old.assignee);
      } catch (err) {
        if (!/already exists|duplicate|unique/i.test(err instanceof Error ? err.message : "")) throw err;
      }
    }
    await writePrefixedRow(`${ROW}${old.id}|`, JSON.stringify({ ...old, migrated: true }));
  }
}

let migrated = false;

export async function listReminders(): Promise<Reminder[]> {
  if (!migrated) {
    await migrateOldReminders();
    migrated = true;
  }
  return (await readTasks()).map(reminderOf).filter((row): row is Reminder => Boolean(row));
}

export async function readReminder(id: string): Promise<Reminder | null> {
  const task = await getTask(id);
  return task ? reminderOf(task) : null;
}

async function asReminder(task: Task): Promise<Reminder> {
  const row = reminderOf(task);
  if (!row) throw new Error("That task has no due time, so it isn't a reminder.");
  return row;
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
  // Never in the past: a time already gone is the same time tomorrow.
  const dueAt = (due.getTime() < now.getTime() - 60_000 ? new Date(due.getTime() + 86_400_000) : due).toISOString();
  const source = input.source ?? "chat";
  const task = await createTask({
    title: text,
    assignee: input.assignee,
    dueAt,
    unit: input.unit ?? unitIn(text),
    by: input.createdBy || input.assignee,
    source: { kind: "chat", label: source === "checks" ? "From Checks" : source === "follow-up" ? "From a follow-up" : "Created in chat", quote: "", meta: "", ref: input.sourceRef ?? "" },
    createdLine: `Created by ${input.createdBy || input.assignee} in chat`,
  });
  return asReminder(task);
}

export async function updateReminder(id: string, patch: { text?: string; assignee?: string; dueAt?: string; unit?: string }, by = "Copilot"): Promise<Reminder> {
  const task = await updateTask(id, {
    ...(patch.text != null && capital(patch.text) ? { title: capital(patch.text) } : {}),
    ...(patch.assignee ? { assignee: patch.assignee } : {}),
    ...(patch.unit != null ? { unit: patch.unit } : {}),
    ...(patch.dueAt && !Number.isNaN(new Date(patch.dueAt).getTime()) ? { dueAt: new Date(patch.dueAt).toISOString() } : {}),
  }, by);
  // A new time is a fresh due: it will be surfaced again when it comes.
  if (patch.dueAt) await writeTask({ ...task, extra: { ...task.extra, surfacedFor: "", stillOpenOn: "" } });
  return asReminder((await getTask(id))!);
}

export async function markReminderDone(id: string, by: string): Promise<Reminder> {
  return asReminder(await markDone(id, by || "Copilot"));
}

export async function undoReminderDone(id: string, by = "Copilot"): Promise<Reminder> {
  return asReminder(await reopen(id, by));
}

export async function deleteReminder(id: string, by = "Copilot"): Promise<Reminder> {
  return asReminder(await deleteTask(id, by));
}

export async function restoreReminder(id: string, by = "Copilot"): Promise<Reminder> {
  return asReminder(await restoreTask(id, by));
}

export async function snoozeReminder(id: string, dueAt: string, by = "Copilot"): Promise<Reminder> {
  return asReminder(await snooze(id, dueAt, by));
}

export async function undoSnooze(id: string, by = "Copilot"): Promise<Reminder> {
  return asReminder(await unsnooze(id, by));
}

/** Surfacing bookkeeping, stored on the task. */
async function save(row: Reminder): Promise<void> {
  const task = await getTask(row.id);
  if (task) await writeTask({ ...task, extra: { ...task.extra, surfacedFor: row.surfacedFor, stillOpenOn: row.stillOpenOn } });
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
    ? await updateReminder(card.savedId, { text: card.text, assignee: card.assignee, dueAt: card.dueAt, unit: card.unit }, viewer)
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
  const rows = (await listReminders()).filter((row) => !isDone(row) && isLive(row) && new Date(row.dueAt).getTime() <= now.getTime());
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

// ---------- Changing a reminder from chat ----------

export type ReminderChange = { kind: "delete" | "done" | "move" | "undo"; dueAt: string };

/**
 * "cancel that one", "delete the towels reminder", "mark it done", "move it to Friday at 3".
 * Only when the chat is about a reminder (the last Copilot message is one) or the words say "reminder".
 */
export function reminderChange(text: string, history: CopilotMessage[], now = clock()): ReminderChange | null {
  const t = text.trim();
  const last = [...history].reverse().find((row) => row.role === "assistant");
  const aboutReminder = Boolean(last?.reminder) || /\breminders?\b/i.test(t);
  if (!aboutReminder || t.length > 160) return null;
  // "set a reminder…", "remind me to…" make a new one; they never change an old one.
  if (asksReminder(t) && !/^(?:cancel|delete|remove|scrap|drop|undo)\b/i.test(t)) return null;
  if (/^(?:undo|undo (?:that|it)|bring it back|restore it|put it back)[.!]*$/i.test(t)) return { kind: "undo", dueAt: "" };
  if (/\b(?:cancel|delete|remove|scrap|drop|get rid of|forget|never ?mind|kill|clear)\b/i.test(t) && !/\bremind (?:me|us|\w+) to\b/i.test(t)) return { kind: "delete", dueAt: "" };
  if (/\b(?:mark(?:ed)? (?:it|that|this|the \w+(?: \w+)? reminder)? ?(?:as )?(?:done|complete)|it'?s done|that'?s done|i did it|done with (?:it|that)|completed?)\b/i.test(t)) return { kind: "done", dueAt: "" };
  if (/\b(?:move|push|change|reschedule|snooze|make|set)\b/i.test(t)) {
    const resolved = resolveReminderTime(t, now);
    if (resolved) return { kind: "move", dueAt: resolved.at.toISOString() };
  }
  return null;
}

const STOP = new Set(["the", "a", "an", "to", "for", "of", "and", "that", "this", "one", "reminder", "reminders", "cancel", "delete", "remove", "it", "my", "me", "about", "please", "move", "mark", "done", "change"]);

/** The reminder meant: one named by its words, else the last one in this chat. */
export async function reminderMeant(text: string, history: CopilotMessage[]): Promise<Reminder | null> {
  const all = (await listReminders()).filter((row) => row.status !== "deleted" || /^undo|bring it back|restore|put it back/i.test(text.trim()));
  const words = text.toLowerCase().match(/[a-z0-9']+/g)?.filter((word) => word.length > 2 && !STOP.has(word)) ?? [];
  if (words.length) {
    const scored = all
      .map((row) => ({ row, hits: words.filter((word) => row.text.toLowerCase().includes(word)).length }))
      .filter((item) => item.hits >= Math.min(2, words.length))
      .sort((a, b) => b.hits - a.hits);
    if (scored[0] && (scored.length === 1 || scored[0].hits > scored[1]!.hits)) return scored[0].row;
  }
  for (const row of [...history].reverse()) {
    const id = row.reminder?.card?.savedId || row.reminder?.ref?.id;
    if (id && id !== "superseded") return all.find((item) => item.id === id) ?? (await readReminder(id));
  }
  return null;
}

/** Applies a chat change to the reminder meant and says exactly what happened. */
export async function changeFromChat(text: string, history: CopilotMessage[], viewer: string): Promise<{ body: string; id: string } | null> {
  const change = reminderChange(text, history);
  if (!change) return null;
  const target = await reminderMeant(text, history);
  if (!target) {
    const open = (await listReminders()).filter((row) => isLive(row) && !isDone(row)).slice(0, 5);
    return { body: open.length ? `Which reminder? Open ones: ${open.map((row) => `${row.text} (${row.assignee}, ${exactLabel(new Date(row.dueAt))})`).join("; ")}.` : "There are no open reminders.", id: "" };
  }
  const what = `${target.text}, ${target.assignee}, ${exactLabel(new Date(target.dueAt))}`;
  if (change.kind === "delete") {
    await deleteReminder(target.id, viewer);
    return { body: `Deleted the reminder: ${what}. Say “undo” to bring it back.`, id: target.id };
  }
  if (change.kind === "undo") {
    const back = target.status === "deleted" ? await restoreReminder(target.id, viewer) : target.status === "done" ? await undoReminderDone(target.id, viewer) : target;
    return { body: `It's back: ${back.text}, ${back.assignee}, ${exactLabel(new Date(back.dueAt))}.`, id: back.id };
  }
  if (change.kind === "done") {
    await markReminderDone(target.id, viewer);
    return { body: `Marked done: ${target.text}.`, id: target.id };
  }
  const moved = await updateReminder(target.id, { dueAt: change.dueAt }, viewer);
  return { body: `Moved: ${moved.text}, ${moved.assignee}, now ${exactLabel(new Date(moved.dueAt))}.`, id: moved.id };
}
