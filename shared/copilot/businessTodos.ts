/**
 * To-dos Copilot reads at check time from OPS, the cleaner app, and both mailboxes.
 * An item is whatever those records say right now. Nothing here is a stored status.
 */

import { loadClientChecklist, type ClientStep } from "../pm/clientChecklist.js";
import { readCleanerSetups, type CleanerSetupUnit } from "./cleanerRead.js";
import { spokenLabel } from "./propertyIdentity.js";
import { listInbox, readMailThread, searchMail, type MailHit } from "./mailSearch.js";
import { captureReport } from "./parity/capture.js";
import { deleteChecksMessage, saveChecksTodo } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import type { CopilotMessage, CopilotReport } from "./types.js";

export type BusinessTodo = {
  id: string;
  text: string;
  source: string;
};

const OUTSIDE = "A reply sent outside email would not show here.";
const ASK = /\?|\b(please|can you|could you|would you|we need|need you to|let me know|send (?:me|us|the)|confirm|kindly|action required|follow(?:ing)? up)\b/i;
const NOISE = /\b(no-?reply|mailer-daemon|unsubscribe|newsletter)\b/i;

export function todoIdFromMessage(message: CopilotMessage): string {
  const details = message.report?.sections.flatMap((section) => section.rows.flatMap((row) => row.details ?? [])) ?? [];
  const hit = details.find((detail) => detail.startsWith("todo:"));
  return hit ? hit.slice("todo:".length) : "";
}

export function missingCleanerSteps(unit: CleanerSetupUnit): string[] {
  const missing: string[] = [];
  if (!unit.unitCreated) missing.push("unit not created");
  if (!unit.addressSet) missing.push("no service address");
  if (!unit.roster) missing.push("no cleaner assigned");
  if (!unit.checklist) missing.push("checklist not configured");
  else if (!unit.photoPoints) missing.push("photo points not configured");
  if (!unit.inventory) missing.push("inventory catalog not started");
  return missing;
}

export function cleanerTodoText(unit: CleanerSetupUnit, now: Date): string | null {
  const missing = missingCleanerSteps(unit);
  if (!missing.length) return null;
  const since = unit.since ? `, since ${spokenDay(unit.since)} (${daysBetween(unit.since, now)} ${daysBetween(unit.since, now) === 1 ? "day" : "days"})` : "";
  return `${spokenLabel(unit.name, unit.address ?? "")}: cleaner app onboarding not finished, ${missing.join(", ")}${since}`;
}

function spokenDay(iso: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, date)));
}

function daysBetween(iso: string, now: Date): number {
  const fromDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const toDay = torontoToday(now);
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86400000));
}

function asksPartners(hit: MailHit): boolean {
  if (/airbnb\.com$/i.test(hit.email) || hit.email.toLowerCase().includes("airbnb")) return false;
  const text = `${hit.subject}\n${hit.snippet}`;
  if (NOISE.test(text)) return false;
  return ASK.test(text);
}

function bareSubject(subject: string): string {
  return subject.replace(/^(?:re|fw|fwd):\s*/i, "").trim();
}

async function sentReply(hit: MailHit): Promise<{ answered: boolean; note: string }> {
  const subject = bareSubject(hit.subject);
  try {
    const thread = await readMailThread({ mailbox: hit.mailbox, id: hit.threadId || hit.id });
    const answered = thread.some((letter) => letter.folder === "sent" && letter.date >= hit.date);
    if (answered) return { answered: true, note: "" };
  } catch (err) {
    const note = err instanceof Error ? err.message : "The thread didn't return.";
    const sent = await searchMail({ keywords: subject || hit.subject, where: "sent", includeAirbnb: false });
    if (sent.notes.length && !sent.hits.length) return { answered: false, note };
    if (sentHasReply(sent.hits, hit, subject)) return { answered: true, note: "" };
    return { answered: false, note };
  }
  const sent = await searchMail({ keywords: subject || hit.subject, where: "sent", includeAirbnb: false });
  const blocked = sent.notes.find((line) => /isn't connected|didn't return/i.test(line));
  if (blocked && sent.notes.filter((line) => /isn't connected|didn't return/i.test(line)).length === sent.notes.length && sent.notes.length > 0 && !sent.hits.length) {
    return { answered: false, note: blocked };
  }
  if (sentHasReply(sent.hits, hit, subject)) return { answered: true, note: "" };
  return { answered: false, note: "" };
}

function sentHasReply(hits: MailHit[], ask: MailHit, subject: string): boolean {
  const wanted = subject.toLowerCase();
  return hits.some((hit) => {
    if (hit.date < ask.date) return false;
    if (ask.threadId && hit.threadId === ask.threadId) return true;
    return bareSubject(hit.subject).toLowerCase() === wanted;
  });
}

async function emailTodos(now: Date): Promise<{ todos: BusinessTodo[]; notes: string[] }> {
  const notes: string[] = [];
  const after = addDays(torontoToday(now), -45).replace(/-/g, "/");
  const hits: MailHit[] = [];
  for (const box of ["gmail", "outlook"] as const) {
    const found = await listInbox(box, box === "gmail" ? after : "", 25);
    for (const note of found.notes) {
      if (!notes.includes(note)) notes.push(note);
    }
    hits.push(...found.hits.filter((hit) => hit.date.slice(0, 10) >= addDays(torontoToday(now), -45).slice(0, 10) || hit.date >= addDays(torontoToday(now), -45)));
  }
  const todos: BusinessTodo[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!asksPartners(hit)) continue;
    const key = `${hit.mailbox}:${hit.threadId || hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reply = await sentReply(hit);
    if (reply.note && !notes.includes(reply.note)) notes.push(reply.note);
    if (reply.answered || reply.note) continue;
    const who = hit.from.trim() || "Someone";
    const subject = hit.subject.trim() || "an email";
    todos.push({
      id: `mail:${key}`,
      source: hit.mailbox === "outlook" ? "Outlook" : "Gmail",
      text: `${who}: ${subject} (${spokenDay(hit.date)}), no reply in Sent`,
    });
  }
  if (todos.length) todos.push({ id: "note:outside-email", source: "Mail", text: OUTSIDE });
  return { todos, notes };
}

function stepTodo(step: ClientStep): BusinessTodo {
  return { id: `ops:${step.id}`, source: "OPS", text: step.text };
}

export async function listBusinessTodos(now = new Date()): Promise<{ todos: BusinessTodo[]; notes: string[] }> {
  const todos: BusinessTodo[] = [];
  const notes: string[] = [];
  const checklist = await loadClientChecklist("", now).catch((err: unknown) => {
    notes.push(`OPS didn't return, so the client checklist was not read. ${err instanceof Error ? err.message : ""}`.trim());
    return { steps: [] as ClientStep[], notes: [] as string[] };
  });
  notes.push(...checklist.notes);
  for (const step of checklist.steps) {
    if (!step.done) todos.push(stepTodo(step));
  }
  const setups = await readCleanerSetups();
  if (!setups.ok) notes.push(`Cleaner app didn't return, so onboarding was not read. ${setups.error}`);
  else {
    for (const unit of setups.units) {
      const text = cleanerTodoText(unit, now);
      if (!text) continue;
      todos.push({ id: `cleaner:${unit.id}`, source: "Cleaner app", text });
    }
  }
  const mail = await emailTodos(now).catch((err: unknown) => {
    notes.push(`Mail didn't return, so unanswered requests were not read. ${err instanceof Error ? err.message : ""}`.trim());
    return { todos: [] as BusinessTodo[], notes: [] as string[] };
  });
  todos.push(...mail.todos);
  for (const note of mail.notes) {
    if (!notes.includes(note)) notes.push(note);
  }
  for (const note of notes) {
    todos.push({ id: `note:${note.slice(0, 80)}`, source: "Records", text: note });
  }
  return { todos, notes };
}

function reportFor(todo: BusinessTodo): CopilotReport {
  return {
    title: todo.text,
    summary: todo.source,
    sections: [{ title: todo.source, rows: [{ who: todo.text, meta: todo.source, details: [`todo:${todo.id}`] }] }],
  };
}

/** Replaces the Checks to-dos with the set just read. A finished record drops its line. */
export async function syncBusinessTodos(chatId: string, current: CopilotMessage[], now = new Date()): Promise<void> {
  const { todos } = await listBusinessTodos(now);
  const open = new Map(todos.map((todo) => [todo.id, todo]));
  const stored = new Map<string, CopilotMessage>();
  for (const message of current) {
    const id = todoIdFromMessage(message);
    if (id) stored.set(id, message);
  }
  for (const [id, message] of stored) {
    if (!open.has(id)) await deleteChecksMessage(message.id);
  }
  for (const todo of todos) {
    const previous = stored.get(todo.id);
    const report = reportFor(todo);
    if (previous && previous.body === todo.text) continue;
    await saveChecksTodo({ chatId, messageId: previous?.id, body: todo.text, report });
    captureReport({
      headline: todo.text,
      text: todo.text,
      needs_you: true,
      title: todo.source,
      summary: todo.text,
    });
  }
}
