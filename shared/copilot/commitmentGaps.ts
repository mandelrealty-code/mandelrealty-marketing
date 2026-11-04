/**
 * Commitment-to-outcome gaps. Recent partner emails and chats are read for what someone said would happen ("I'll create the
 * plan") or what came in that makes the next step theirs ("measurements are in"), and each is checked for its outcome: a
 * report or plan in a chat, a task marked done, a sent email. A commitment with no outcome becomes a Decisions item naming who
 * said it and what is still open. It proposes only: nothing here creates or sends anything.
 */

import { searchGmail } from "../adminApi/gmail.js";
import { searchOutlook } from "../adminApi/outlook.js";
import { ownWords } from "./buildingRegistration.js";
import { readMailThread } from "./mailSearch.js";
import { listChats, listMessages } from "./store.js";
import { boardPayload } from "./taskBoardApi.js";
import { isOpen } from "./taskTypes.js";
import { addDays, torontoToday } from "./time.js";
import type { Candidate } from "./watch.js";

export type Said = { who: string; at: string; text: string; where: string; source: "email" | "chat" };
export type Commitment = { who: string; kind: "promise" | "input-arrived"; verb: string; object: string; subject: string; at: string; quote: string; where: string };

const PROMISE = /\b(?:i['’]?ll|i will|we['’]?ll|we will|i am going to|i'm going to)\s+(create|make|build|prepare|put together|draft|write|send|book|schedule|order)\s+(?:the |a |an |your |you |up )?([a-z][a-z' -]{1,36}?)(?:\s+(?:for|to)\s+([A-Z][\w'’]+(?:\s+[A-Z][\w'’]+)?(?:'s|’s)?(?:\s+(?:place|unit|apartment|condo|home))?))?\s*(?:[.!?\n,;]|\s+(?:today|tomorrow|tonight|this|next|by|once|when|after|before|as soon)\b|$)/i;
const INPUT = /\b(?:(?:got|have|has|had|received|took|sent|confirmed (?:he|she|they|we) (?:got|has|have))\s+(?:all |the |your )?(measurements?|dimensions?)|(measurements?|dimensions?) (?:are|is|were) (?:in|done|ready|taken|received))\b(?:\s+(?:for|of|at)\s+([A-Z][\w'’]+(?:\s+[A-Z][\w'’]+)?(?:'s|’s)?(?:\s+(?:place|unit|apartment|condo|home))?))?/i;

const clean = (name: string) => name.replace(/['’]s\b/i, "").replace(/\s+(place|unit|apartment|condo|home)$/i, "").trim();
const sentence = (text: string, at: number) => {
  const start = Math.max(text.lastIndexOf(".", at) + 1, text.lastIndexOf("\n", at) + 1, 0);
  const end = text.slice(at).search(/[.!?\n]/);
  return text.slice(start, end < 0 ? text.length : at + end + 1).trim().slice(0, 240);
};

/** What each message says will happen, or what it says came in. Only a line it can quote is kept. */
export function extractCommitments(items: Said[]): Commitment[] {
  const out: Commitment[] = [];
  for (const item of items) {
    const text = item.text.replace(/\r\n?/g, "\n");
    const promise = PROMISE.exec(text);
    if (promise) out.push({ who: item.who, kind: "promise", verb: promise[1]!.toLowerCase(), object: promise[2]!.trim().toLowerCase(), subject: clean(promise[3] ?? ""), at: item.at, quote: sentence(text, promise.index), where: item.where });
    const input = INPUT.exec(text);
    if (input) {
      // Measurements in means the plan is the next thing owed, by whoever the plan belongs to: the partners.
      out.push({ who: item.who, kind: "input-arrived", verb: "create", object: "plan", subject: clean(input[3] ?? "") || clean(/\b(?:for|of)\s+([A-Z][\w'’]+)/.exec(item.where)?.[1] ?? ""), at: item.at, quote: sentence(text, input.index), where: item.where });
    }
  }
  return out;
}

export type Artifacts = {
  /** Replies and reports saved in chats: text, filename and when. */
  chats: { at: string; text: string }[];
  /** Tasks that are closed: title and when it was last touched. */
  doneTasks: { at: string; text: string }[];
  /** Sent mail: subject and snippet. */
  sent: { at: string; text: string }[];
};

const NOUN: Record<string, RegExp> = {
  plan: /\b(?:furnishing |furniture )?plan\b|furnishing|MRG-FP-/i,
  contract: /\bcontract|agreement\b/i,
  proposal: /\bproposal\b/i,
  report: /\breport\b/i,
};

/** Whether the outcome exists after the commitment was made. The subject, when known, must be in it: another unit's plan is not this one's. */
export function outcomeFound(c: Commitment, found: Artifacts): string | null {
  const word = NOUN[c.object.split(/\s+/).at(-1) ?? ""] ?? new RegExp(`\\b${c.object.split(/\s+/).at(-1)!.replace(/[^a-z]/gi, "")}\\b`, "i");
  const subject = c.subject ? new RegExp(`\\b${c.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") : null;
  const after = (rows: { at: string; text: string }[]) => rows.find((row) => row.at > c.at && word.test(row.text) && (!subject || subject.test(row.text)));
  return after(found.chats)?.text.slice(0, 80) ?? after(found.doneTasks)?.text.slice(0, 80) ?? after(found.sent)?.text.slice(0, 80) ?? null;
}

const WEEK = 7;
const GRACE_HOURS = 6;
const bodyCache = new Map<string, string>();

async function recentSaid(now: Date): Promise<{ said: Said[]; failed: string[] }> {
  const said: Said[] = [];
  const failed: string[] = [];
  const since = addDays(torontoToday(now), -WEEK);
  try {
    for (const chat of (await listChats()).filter((row) => row.updated_at.slice(0, 10) >= since).slice(0, 20)) {
      for (const message of await listMessages(chat.id, { lookup: false })) {
        if (message.role === "user" && message.created_at.slice(0, 10) >= since) said.push({ who: "a partner", at: message.created_at, text: message.body, where: chat.title, source: "chat" });
      }
    }
  } catch {
    failed.push("Chats");
  }
  const mail: { mailbox: "gmail" | "outlook"; id: string; from: string; date: string; subject: string }[] = [];
  try {
    for (const row of await searchGmail({ keywords: "", where: "both", includeAirbnb: false, after: since.replace(/-/g, "/"), limit: 25 })) mail.push({ mailbox: "gmail", id: row.id, from: row.from, date: row.date, subject: row.subject });
  } catch {
    failed.push("Gmail");
  }
  try {
    for (const row of await searchOutlook({ keywords: "", where: "both", includeAirbnb: false, limit: 25 })) mail.push({ mailbox: "outlook", id: row.id, from: row.from, date: row.date, subject: row.subject });
  } catch {
    failed.push("Outlook");
  }
  for (const row of mail.filter((item) => item.date.slice(0, 10) >= since).slice(0, 30)) {
    const cacheKey = `${row.mailbox}:${row.id}`;
    let body = bodyCache.get(cacheKey);
    if (body === undefined) {
      body = await readMailThread({ mailbox: row.mailbox, id: row.id }).then((letters) => ownWords(letters.find((letter) => letter.id === row.id)?.body ?? "")).catch(() => "");
      bodyCache.set(cacheKey, body);
    }
    if (body) said.push({ who: row.from.replace(/<.*$/, "").trim() || "Someone", at: row.date, text: body, where: row.subject, source: "email" });
  }
  return { said, failed };
}

async function artifacts(now: Date): Promise<{ found: Artifacts; failed: string[] }> {
  const found: Artifacts = { chats: [], doneTasks: [], sent: [] };
  const failed: string[] = [];
  const since = addDays(torontoToday(now), -WEEK);
  try {
    for (const chat of (await listChats()).filter((row) => row.updated_at.slice(0, 10) >= since).slice(0, 30)) {
      for (const message of await listMessages(chat.id, { lookup: false })) {
        if (message.role === "assistant" && (message.file || message.report || message.furniture)) found.chats.push({ at: message.created_at, text: `${message.body} ${message.file?.filename ?? ""} ${message.report?.title ?? ""}` });
      }
    }
  } catch {
    failed.push("Chats");
  }
  try {
    const board = await boardPayload({ name: "Shane", partner: true });
    if (board.ready) for (const task of board.tasks) if (!isOpen(task)) found.doneTasks.push({ at: task.updatedAt ?? task.createdAt ?? "", text: `${task.title} ${task.unit}` });
  } catch {
    failed.push("Tasks");
  }
  try {
    for (const row of await searchGmail({ keywords: "", where: "sent", includeAirbnb: false, after: since.replace(/-/g, "/"), limit: 25 })) found.sent.push({ at: row.date, text: `${row.subject} ${row.snippet}` });
  } catch {
    failed.push("Gmail");
  }
  return { found, failed };
}

const hash = (text: string) => [...text].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36);

/** With run false nothing is read: no new mail, chat or task means no new commitment and no new outcome. */
export async function collectCommitmentGaps(now: Date, run = true): Promise<{ candidates: Candidate[]; failed: string[]; skipped?: boolean }> {
  if (!run) return { candidates: [], failed: [], skipped: true };
  const { said, failed } = await recentSaid(now);
  const commitments = extractCommitments(said).filter((c) => (now.getTime() - Date.parse(c.at)) / 3_600_000 >= GRACE_HOURS);
  if (!commitments.length) return { candidates: [], failed };
  const { found, failed: lookedFailed } = await artifacts(now);
  // A check that couldn't read where the outcome would be says nothing: stay quiet rather than call it missing.
  if (lookedFailed.length) return { candidates: [], failed: [...new Set([...failed, ...lookedFailed])] };
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of commitments) {
    if (outcomeFound(c, found)) continue;
    const key = `gap:commit:${hash(`${c.kind}|${c.verb} ${c.object}|${c.subject}|${c.at.slice(0, 10)}`)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const days = Math.max(0, Math.floor((now.getTime() - Date.parse(c.at)) / 86_400_000));
    const what = `${c.verb} the ${c.object}${c.subject ? ` for ${c.subject}` : ""}`;
    out.push({
      key, kind: "commitment_gap", native: false, guestWaiting: false, property: c.subject, urgency: Math.min(80, 66 + days * 3),
      title: c.kind === "promise" ? `${c.who} said they'd ${what}, and it isn't done` : `${c.subject ? `${c.subject}'s` : "The"} measurements are in, but nobody has created the plan`,
      reason: c.kind === "promise"
        ? `${c.who} wrote in "${c.where}": "${c.quote}". Nothing since shows the ${c.object}: no matching report, finished task or sent email.`
        : `${c.who} wrote in "${c.where}": "${c.quote}". Still open: ${what}. No plan for ${c.subject || "it"} exists in any chat, task or sent email.`,
    });
  }
  return { candidates: out, failed };
}
