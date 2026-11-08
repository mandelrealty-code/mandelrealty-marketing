/**
 * The watch loop: every 15 minutes the agent looks over the business and surfaces what needs a partner, most urgent first,
 * exactly when it should and no more. It only proposes. A surfaced item lives in the Overview's Decisions queue and nowhere
 * else (never a chat in the sidebar), with the exact draft or action ready; nothing is sent, booked or charged.
 *
 * Quiet rules: an item is surfaced once while it is open. Dismissing it snoozes it until tomorrow: it stays away for the rest
 * of that day however many cycles run, and may come back the next day if the issue is still open. Between 10 PM and 8 AM
 * Toronto time only a guest who is actively waiting on a reply is surfaced. When unsure, stay quiet.
 */

import { getSupabaseAdmin } from "../supabase.js";
import { complete, brainAvailable } from "./brain.js";
import { listFacts, saveFact, subjectKey } from "./businessFacts.js";
import { loadDayBoard } from "./dayBoard.js";
import { dueQuestion } from "./dueFollowUps.js";
import { loadGuestQueue, reverifyOpenFollowUps } from "./guestMessaging.js";
import { sendGmailReply } from "../adminApi/gmail.js";
import { parityNow } from "./parity/clock.js";
import { parityEnabled } from "./parity/flag.js";
import { loadReviewQueue } from "./reviewsQueue.js";
import { collectThreadGaps } from "./threadGaps.js";
import { collectCommitmentGaps } from "./commitmentGaps.js";
import { addSpend, costOf, describeSpend, isMetaKey, readMeta, resetWatchMeta, spendFor, writeMeta, type DaySpend } from "./watchMeta.js";
import { diffSnapshots, takeSnapshot, type Snapshot } from "./watchSnapshot.js";
import { closeFollowUpEverywhere } from "./dueFollowUps.js";
import { sendReservationMessage } from "./hospitableAgent.js";
import { deleteChat, listMessages } from "./store.js";
import { boardPayload } from "./taskBoardApi.js";
import { daysOutstanding, isOpen } from "./taskTypes.js";
import { addDays, quietHours, torontoHour, torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

export type WatchKind = "guest_waiting" | "commitment" | "incident" | "inquiry_deadline" | "cleaner" | "review" | "task" | "thread_gap" | "commitment_gap";

export type Candidate = {
  /** One item, one key: the same event never gets a second row. */
  key: string;
  kind: WatchKind;
  /** The Overview already shows this kind of item on its own, so the watch loop only ranks it. */
  native: boolean;
  title: string;
  reason: string;
  property: string;
  urgency: number;
  guestWaiting: boolean;
  draft?: CopilotDraft | null;
};

export type WatchStatus = "surfaced" | "native" | "dismissed" | "handled";
type Payload = { reason: string; urgency: number; draft?: CopilotDraft | null };
export type LedgerRow = {
  key: string;
  kind: WatchKind;
  title: string;
  property: string;
  /** Only set on rows made before items stopped being chats. Cleaned up once. */
  chatId: string;
  status: WatchStatus;
  /** The Toronto day it was dismissed (snoozed), "" otherwise. */
  dismissedOn: string;
  surfacedAt: string;
  resolvedAt: string;
  payload: Payload | null;
};

// ---------- The ledger: what was surfaced and how it ended ----------

let volatile = new Map<string, LedgerRow>();
export function resetWatch(): void {
  volatile = new Map();
  resetWatchMeta();
}

const TABLE = "copilot_watch_items";
type Row = { key: string; kind: string; title: string; property: string; chat_id: string; status: string; surfaced_at: string; resolved_at: string | null; payload?: string | null };

/** The day a dismissal belongs to is written into the status ("dismissed:2026-10-31"), so no new column is needed for it. */
function statusOf(row: Pick<LedgerRow, "status" | "dismissedOn">): string {
  return row.status === "dismissed" && row.dismissedOn ? `dismissed:${row.dismissedOn}` : row.status;
}

function fromRow(row: Row): LedgerRow {
  const [status, day] = row.status.split(":");
  let payload: Payload | null = null;
  try {
    payload = row.payload ? (JSON.parse(row.payload) as Payload) : null;
  } catch {
    payload = null;
  }
  return { key: row.key, kind: row.kind as WatchKind, title: row.title, property: row.property, chatId: row.chat_id, status: status as WatchStatus, dismissedOn: day ?? "", surfacedAt: row.surfaced_at, resolvedAt: row.resolved_at ?? "", payload };
}

async function ledger(): Promise<LedgerRow[]> {
  const client = getSupabaseAdmin();
  if (!client) return [...volatile.values()];
  const { data, error } = await client.from(TABLE).select("*").order("surfaced_at", { ascending: false }).limit(2000);
  if (error) throw new Error("The watch ledger isn't set up. Run supabase/watch_v1.sql.");
  // The loop's own memory lives in the same table under meta: keys and is never an item.
  return ((data ?? []) as Row[]).filter((row) => !isMetaKey(row.key)).map(fromRow);
}

/** Writes one ledger row. Also how the harness plants a row from before items stopped being chats. */
export async function record(row: LedgerRow): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) {
    volatile.set(row.key, row);
    return;
  }
  const base = { key: row.key, kind: row.kind, title: row.title, property: row.property, chat_id: row.chatId, status: statusOf(row), surfaced_at: row.surfacedAt, resolved_at: row.resolvedAt || null };
  const saved = await client.from(TABLE).upsert({ ...base, payload: row.payload ? JSON.stringify(row.payload) : "" });
  // Without supabase/watch_v2.sql the payload column isn't there: keep the row, and the item is rebuilt from live state when opened.
  if (saved.error) await client.from(TABLE).upsert(base);
}

export async function watchLedger(): Promise<LedgerRow[]> {
  return ledger();
}

// ---------- The clock ----------

export { quietHours, torontoHour };

// ---------- What there is to look at ----------

const HOUR = 3_600_000;

export type Collected = { candidates: Candidate[]; failed: string[]; /** The first moment an item now below its floor would count (a guest waiting two hours, an inquiry six hours from expiring). */ nextReviewAt?: string; /** Items from earlier passes that were not re-evaluated this time, so they must not be taken for resolved. */ unevaluated?: { stays: string[]; commitments: boolean; guests?: boolean } };
type Source = (now: Date) => Promise<Collected>;
let source: Source | null = null;

/** Tests hand the loop its candidates. Null restores the real look over the business. */
export function setWatchSource(next: Source | null): void {
  source = next;
}

export async function collectCandidates(now: Date, opts: { threads?: Set<string> | null; commitments?: boolean; guests?: boolean } = {}): Promise<Collected> {
  const today = torontoToday(now);
  const out: Candidate[] = [];
  const failed: string[] = [];
  let review = Infinity;
  const unevaluated = { stays: [] as string[], commitments: false, guests: false };

  if (opts.guests === false) unevaluated.guests = true;
  else try {
    const queue = await loadGuestQueue(now);
    if (!queue.connected) failed.push("Guest messages");
    else {
      const inquiries = new Set(queue.followUps.filter((row) => row.kind === "inquiry").map((row) => row.id));
      for (const row of queue.waiting) {
        if (row.thanks || row.inquiry || inquiries.has(row.id)) continue;
        const hours = row.waitedMs / HOUR;
        const arrivesSoon = Boolean(row.checkIn) && row.checkIn.slice(0, 10) <= today;
        // A reply that has waited under two hours (under 30 minutes for a guest in the house or arriving) is not yet worth a partner.
        const floor = arrivesSoon ? 0.5 : 2;
        if (hours < floor) {
          review = Math.min(review, now.getTime() + (floor - hours) * HOUR);
          continue;
        }
        out.push({
          key: `guest:${row.id}:${row.activityAt || row.asked.slice(0, 60)}`,
          kind: "guest_waiting",
          native: true,
          title: `${row.guest || "A guest"} is waiting${row.property ? ` at ${row.property}` : ""}`,
          reason: `Waiting ${row.wait || `${Math.round(hours)}h`}: ${(row.askedEn || row.asked || "").slice(0, 160)}`,
          property: row.property,
          urgency: Math.round(55 + Math.min(30, hours * 2) + (arrivesSoon ? 10 : 0)),
          guestWaiting: true,
        });
      }
      for (const row of queue.followUps) {
        const first = row.first || row.guest.split(/\s+/)[0] || "the guest";
        if (row.kind === "owe" && (row.dueNow || (row.due && row.due <= today))) {
          const question = dueQuestion({ ...row, due: row.due || today }, today);
          out.push({
            key: `followup:${row.id}`,
            kind: "commitment",
            native: false,
            title: `${row.topic || "A promise"} for ${first} is due`,
            reason: question.lead.split("\n")[0] ?? "A commitment is coming due.",
            property: row.property,
            urgency: row.due && row.due < today ? 82 : 76,
            guestWaiting: false,
            draft: { subject: "", body: question.draft, to: row.guest, status: "waiting", channel: "hospitable", hospitable: { tool: "send-reservation-message", args: { reservation_id: row.reservationId, body: question.draft } }, followUp: question.followUp },
          });
        } else if (row.kind === "incident") {
          out.push({
            key: `incident:${row.id}`,
            kind: "incident",
            native: false,
            title: `${first} reported a problem${row.property ? ` at ${row.property}` : ""}`,
            reason: (row.what || row.line || row.grounding?.quote || "An incident was raised in the thread.").slice(0, 220),
            property: row.property,
            urgency: 88,
            guestWaiting: false,
            ...(row.draft ? { draft: { subject: "", body: row.draft, to: row.guest, status: "waiting" as const, channel: "hospitable" as const, hospitable: { tool: "send-reservation-message", args: { reservation_id: row.reservationId, body: row.draft } } } } : {}),
          });
        } else if (row.kind === "inquiry" && row.expiresAt) {
          const left = (Date.parse(row.expiresAt) - now.getTime()) / HOUR;
          if (left > 6) review = Math.min(review, Date.parse(row.expiresAt) - 6 * HOUR);
          if (left > 0 && left <= 6) {
            out.push({ key: `inquiry:${row.id}`, kind: "inquiry_deadline", native: true, title: `${row.guest}'s inquiry is about to expire`, reason: `Expires in ${Math.max(1, Math.round(left))}h.`, property: row.property, urgency: 90, guestWaiting: false });
          }
        }
      }
    }
  } catch {
    failed.push("Guest messages");
  }

  try {
    const day = await loadDayBoard(now);
    if (!day.ok) failed.push("Cleaning schedule");
    else {
      for (const row of day.board.todayCleans) {
        if (row.assigned) continue;
        const arriving = day.board.arrivals.find((stay) => stay.propertyId === row.propertyId);
        out.push({
          key: `turn:${row.propertyId}:${row.date}`,
          kind: "cleaner",
          native: true,
          title: `${row.property || "A unit"} needs a cleaner today`,
          reason: [row.when, row.guest ? `${row.guest} checks out` : "", arriving ? `${arriving.guest} checks in${arriving.time ? ` at ${arriving.time}` : ""}` : ""].filter(Boolean).join(". "),
          property: row.property,
          urgency: arriving ? 92 : 78,
          guestWaiting: false,
        });
      }
    }
  } catch {
    failed.push("Cleaning schedule");
  }

  try {
    const reviews = await loadReviewQueue(now);
    if (reviews.connected) {
      for (const row of reviews.reviews) {
        if (!row.flagged) continue;
        out.push({ key: `review:${row.id}`, kind: "review", native: true, title: `${row.guest} left ${row.stars} ${row.stars === 1 ? "star" : "stars"}${row.property ? ` at ${row.property}` : ""}`, reason: (row.retaliation?.why || row.review).slice(0, 200), property: row.property, urgency: 70, guestWaiting: false });
      }
    } else failed.push("Reviews");
  } catch {
    failed.push("Reviews");
  }

  try {
    const board = await boardPayload({ name: "Shane", partner: true });
    if (board.ready) {
      for (const task of board.tasks) {
        if (!isOpen(task)) continue;
        const days = daysOutstanding(task, now);
        if (days < 1) continue;
        out.push({ key: `task:${task.id}`, kind: "task", native: false, title: `Overdue: ${task.title}`, reason: `${days === 1 ? "1 day" : `${days} days`} outstanding${task.assignee ? `, assigned to ${task.assignee}` : ", nobody assigned"}.`, property: task.unit, urgency: Math.min(80, 60 + days * 3), guestWaiting: false });
      }
    }
  } catch {
    failed.push("Tasks");
  }

  // The gaps between sources: what a thread implies that no record shows done, and what someone said would happen.
  try {
    const gaps = await collectThreadGaps(now, opts.threads ?? null);
    out.push(...gaps.candidates);
    failed.push(...gaps.failed);
    unevaluated.stays.push(...gaps.unevaluated);
  } catch {
    failed.push("Thread gaps");
  }
  try {
    const gaps = await collectCommitmentGaps(now, opts.commitments !== false);
    out.push(...gaps.candidates);
    failed.push(...gaps.failed);
    if (gaps.skipped) unevaluated.commitments = true;
  } catch {
    failed.push("Commitment gaps");
  }

  return { candidates: out.sort((a, b) => b.urgency - a.urgency), failed: [...new Set(failed)], ...(Number.isFinite(review) ? { nextReviewAt: new Date(review).toISOString() } : {}), unevaluated };
}

// ---------- The judgment ----------

const JUDGE_SYSTEM = [
  "You decide what deserves a partner's attention right now at Mandel Realty Group, a short-term-rental management company. You are shown candidate items the system found. You may only choose from them.",
  "A gap item (kind thread_gap or commitment_gap) says a thread or a promise implies something that no record shows done, and quotes the line that triggered it: surface it unless it is clearly handled. Surface an item only if a partner must act and acting soon matters: a guest waiting on a reply, a check-in today with no cleaner, an inquiry near its deadline, a promise coming due, an incident in a thread, a flagged review, a task that is overdue and still open.",
  "Do NOT surface FYIs, quiet threads, anything already handled, or a kind of item the partner has been dismissing (see the learned notes). A false alarm costs more trust than a missed FYI. When unsure, do not surface it.",
  "Reply with JSON only: {\"items\":[{\"key\":\"\",\"surface\":true,\"reason\":\"one short sentence\"}]} listing every candidate key once, most urgent first.",
].join(" ");

export type Judged = { key: string; surface: boolean; reason: string };

export function parseJudgment(text: string, keys: Set<string>): Judged[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { items?: { key?: unknown; surface?: unknown; reason?: unknown }[] };
    if (!Array.isArray(parsed.items)) return null;
    const seen = new Set<string>();
    const out: Judged[] = [];
    for (const item of parsed.items) {
      const key = String(item.key ?? "");
      if (!keys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, surface: item.surface === true, reason: String(item.reason ?? "").slice(0, 240) });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * The brain picks and orders from the candidates, and may drop any of them. It can never add one the system did not find.
 * Without a brain, or when it answers badly, the candidates stand in urgency order: they already passed the floors above.
 */
export async function judge(candidates: Candidate[], notes: string[], now: Date): Promise<{ ordered: (Candidate & { why: string })[]; usedBrain: boolean; usage?: { input: number; output: number; model: string }; judged?: Judged[] }> {
  if (!candidates.length) return { ordered: [], usedBrain: false };
  const keys = new Set(candidates.map((item) => item.key));
  let judged: Judged[] | null = null;
  let usage: { input: number; output: number; model: string } | undefined;
  if (brainAvailable()) {
    const result = await complete({
      task: "chat",
      system: JUDGE_SYSTEM,
      user: [
        `Now: ${now.toISOString()} (Toronto ${torontoToday(now)}, hour ${torontoHour(now)})`,
        notes.length ? `Learned from what the partner dismissed before:\n${notes.map((line) => `- ${line}`).join("\n")}` : "",
        `Candidates:\n${candidates.map((item) => `- key=${item.key} | ${item.kind} | urgency ${item.urgency} | ${item.title} | ${item.reason}`).join("\n")}`,
      ].filter(Boolean).join("\n\n"),
      maxTokens: 1200,
    });
    judged = result ? parseJudgment(result.text, keys) : null;
    if (result?.usage) usage = { ...result.usage, model: result.model };
  }
  if (!judged) return { ordered: candidates.map((item) => ({ ...item, why: item.reason })), usedBrain: false };
  const byKey = new Map(candidates.map((item) => [item.key, item]));
  const ordered = judged.filter((item) => item.surface).map((item) => ({ ...byKey.get(item.key)!, why: item.reason || byKey.get(item.key)!.reason }));
  return { ordered, usedBrain: true, ...(usage ? { usage } : {}), judged };
}

// ---------- Dismissals teach the judgment ----------

const learnedSubject = (kind: WatchKind, property: string) => `Dismissed ${kind.replace("_", " ")} alerts at ${property.trim() || "any unit"}`;
const day = (now: Date) => torontoToday(now);

/** Each dismissal is one more the judgment learns from, saved as a fact the agent loads. */
async function learnFromDismissal(row: LedgerRow): Promise<void> {
  const subject = learnedSubject(row.kind, row.property);
  const existing = (await listFacts()).find((fact) => subjectKey(fact.subject) === subjectKey(subject));
  const times = (Number(/dismissed (\d+)/i.exec(existing?.fact ?? "")?.[1]) || 0) + 1;
  await saveFact({
    subject,
    fact: `The partner dismissed ${times} ${row.kind.replace("_", " ")} alert${times === 1 ? "" : "s"} at ${row.property.trim() || "any unit"} (latest: "${row.title.slice(0, 80)}"). Surface similar items only when clearly urgent.`,
    category: "standing",
    source: "Watch loop dismissals",
  });
}

async function learnedNotes(): Promise<string[]> {
  return (await listFacts()).filter((fact) => subjectKey(fact.subject).startsWith("dismissed ")).map((fact) => fact.fact).slice(0, 12);
}

// ---------- Items live in Decisions, never in the chat list ----------

/**
 * One time: items the loop used to leave as chats become plain items, and those chats are deleted. Only chats named in the
 * ledger are touched: a chat a partner started is never one of them. A chat whose draft was sent counts as handled, one that
 * was held or deleted as dismissed today.
 */
export async function cleanupWatchChats(now: Date): Promise<number> {
  let cleaned = 0;
  for (const row of await ledger()) {
    if (!row.chatId) continue;
    const messages = await listMessages(row.chatId).catch(() => []);
    const draftMessage = [...messages].reverse().find((message) => message.draft);
    let next: LedgerRow = { ...row, chatId: "" };
    if (row.status === "surfaced") {
      const state = draftMessage?.draft?.status;
      if (!messages.length) next = { ...next, status: "dismissed", dismissedOn: day(now), resolvedAt: now.toISOString() };
      else if (state === "sent" || state === "approved_unsent") next = { ...next, status: "handled", resolvedAt: now.toISOString() };
      else if (state === "held") next = { ...next, status: "dismissed", dismissedOn: day(now), resolvedAt: now.toISOString() };
      else if (!row.payload) next = { ...next, payload: { reason: (messages[0]?.body ?? row.title).split("\n")[0] ?? row.title, urgency: 70, draft: draftMessage?.draft ?? null } };
    }
    await deleteChat(row.chatId).catch(() => undefined);
    await record(next);
    cleaned += 1;
  }
  return cleaned;
}

export type DecisionRow = { key: string; kind: WatchKind; title: string; reason: string; property: string; urgency: number; at: string; hasDraft: boolean; draftBody: string; draftTo: string; draftSubject: string; draftChannel: string };

/** What the Overview shows in Decisions for the watch loop: items surfaced and not dismissed or handled. */
export async function watchDecisions(): Promise<DecisionRow[]> {
  return (await ledger())
    .filter((row) => row.status === "surfaced")
    .map((row) => ({ key: row.key, kind: row.kind, title: row.title, reason: row.payload?.reason ?? row.title, property: row.property, urgency: row.payload?.urgency ?? 70, at: row.surfacedAt, hasDraft: Boolean(row.payload?.draft?.body), draftBody: row.payload?.draft?.body ?? "", draftTo: row.payload?.draft?.to ?? "", draftSubject: row.payload?.draft?.subject ?? "", draftChannel: row.payload?.draft?.channel ?? "" }))
    .sort((a, b) => b.urgency - a.urgency || a.at.localeCompare(b.at));
}

const BLANK = /\[[^\]]+\]/;

/**
 * What a partner does with an item in Decisions. Snooze keeps it away until tomorrow. Send is a partner pressing the button:
 * only then does a guest message go out, exactly as shown. Done closes it.
 */
export async function actOnWatchItem(input: { key: string; action: "snooze" | "send" | "done"; text?: string }, now: Date = parityNow() ?? new Date()): Promise<{ ok: boolean; note: string }> {
  const row = (await ledger()).find((item) => item.key === input.key && item.status === "surfaced");
  if (!row) return { ok: false, note: "That item isn't waiting any more." };
  if (input.action === "snooze") {
    await record({ ...row, status: "dismissed", dismissedOn: day(now), resolvedAt: now.toISOString() });
    await learnFromDismissal(row);
    return { ok: true, note: "Snoozed until tomorrow." };
  }
  if (input.action === "done") {
    await record({ ...row, status: "handled", resolvedAt: now.toISOString() });
    return { ok: true, note: "Marked done." };
  }
  const draft = row.payload?.draft;
  // An email to a building or anyone else goes out only here, when a partner presses Send on exactly what the item shows.
  if (draft?.channel === "email" && draft.to) {
    const body = (input.text?.trim() || draft.body).trim();
    const blank = BLANK.exec(body);
    if (blank) return { ok: false, note: `Fill in ${blank[0]} in the draft first. Nothing was sent.` };
    try {
      const sentId = await sendGmailReply({ to: draft.to, subject: draft.subject, body });
      if (!sentId && !parityEnabled()) return { ok: false, note: "Gmail didn't confirm it was sent. Check Sent before trying again." };
    } catch (err) {
      return { ok: false, note: `${err instanceof Error ? err.message : "Gmail didn't send it."} Nothing went out.` };
    }
    await record({ ...row, status: "handled", resolvedAt: now.toISOString() });
    return { ok: true, note: "Sent." };
  }
  if (!draft || draft.channel !== "hospitable" || draft.hospitable?.tool !== "send-reservation-message") return { ok: false, note: "This one has no message to send. Nothing was sent." };
  const body = (input.text?.trim() || draft.body).trim();
  const blank = BLANK.exec(body);
  if (blank) return { ok: false, note: `Fill in ${blank[0]} in the draft first. Nothing was sent.` };
  const args = draft.hospitable.args;
  const proof = await sendReservationMessage({ reservationId: String(args.uuid ?? args.reservation_id ?? ""), body });
  if (!proof.sent && !proof.pending) return { ok: false, note: proof.reason };
  await record({ ...row, status: "handled", resolvedAt: now.toISOString() });
  if (draft.followUp?.id) await closeFollowUpEverywhere(draft.followUp.id).catch(() => undefined);
  return { ok: true, note: proof.sent ? proof.note ?? "Sent." : "Accepted. It will show on the thread shortly." };
}

export type WatchItem = { key: string; kind: WatchKind; title: string; reason: string; urgency: number; property: string; delivered: boolean; native: boolean; resurfaced: boolean };
export type WatchResult = {
  at: string;
  ranked: WatchItem[];
  delivered: number;
  deferred: number;
  skipped: number;
  failed: string[];
  usedBrain: boolean;
  cleaned: number;
  resolved: number;
  /** What this pass did: "backoff" (not even checked), "no-change" (checked, model skipped) or "triaged" (the model ran). */
  phase?: "backoff" | "no-change" | "triaged";
  /** How long until the next check the loop is willing to do, in minutes. */
  intervalMin?: number;
  /** Why phase (a) said something changed. */
  reasons?: string[];
};

// ---------- What the loop remembers, and its log ----------

type LoopState = { snapshot: Snapshot | null; streak: number; intervalMin: number; nextDueAt: string; nextReviewAt: string; judged: Record<string, string>; /** Which version of the follow-up checks last ran, so a change to them is applied on the very next pass. */ verified?: number };
const VERIFY_VERSION = 2;
const STATE_KEY = "meta:state";
const FIRST: LoopState = { snapshot: null, streak: 0, intervalMin: 15, nextDueAt: "", nextReviewAt: "", judged: {} };

type LogLine = Record<string, string | number | boolean | string[]>;
let logger: ((line: LogLine) => void) | null = null;

/** Tests read the log. Null restores the server log. */
export function setWatchLogger(next: ((line: LogLine) => void) | null): void {
  logger = next;
}

function watchLog(line: LogLine): void {
  if (logger) return logger(line);
  if (parityEnabled()) return;
  console.log(`[watch] ${JSON.stringify(line)}`);
}

/** 15 minutes while things move; after two quiet passes in a row 30, after four 60. A change snaps it back to 15. */
export function intervalFor(streak: number): number {
  return streak >= 4 ? 60 : streak >= 2 ? 30 : 15;
}

const JITTER_MS = 2 * 60_000;
const sig = (item: Candidate) => `${item.title}|${item.reason}|${Math.round(item.urgency / 10)}`;

/**
 * One pass, in two phases. Phase (a) is deterministic and calls no model: it takes a cheap snapshot (reservations and their
 * newest message times, check-ins and check-outs today, task and review counts, newest mail and chat) and compares it with the
 * last pass. Phase (b), the looking over and the model's triage, runs only when (a) found a change or a time-based floor has
 * passed. Without a change the pass costs nothing. With opts.adaptive the cadence backs off while it stays quiet.
 */
export async function runWatch(now: Date = parityNow() ?? new Date(), opts: { adaptive?: boolean } = {}): Promise<WatchResult> {
  const today = day(now);
  const empty = (phase: WatchResult["phase"], extra: Partial<WatchResult> = {}): WatchResult => ({ at: now.toISOString(), ranked: [], delivered: 0, deferred: 0, skipped: 0, failed: [], usedBrain: false, cleaned: 0, resolved: 0, phase, ...extra });
  if (!opts.adaptive) return triage(now, null, empty("triaged"));
  const state = (await readMeta<LoopState>(STATE_KEY)) ?? { ...FIRST };
  if (state.nextDueAt && now.getTime() < Date.parse(state.nextDueAt)) {
    await addSpend(today, { backedOff: 1 });
    watchLog({ watch: "backoff", until: state.nextDueAt, intervalMin: state.intervalMin });
    return empty("backoff", { intervalMin: state.intervalMin });
  }
  // Phase (a). A test hands the loop its candidates, so their signature stands in for the business's state.
  let current: Snapshot | null;
  let failedA: string[] = [];
  if (source) {
    const looked = await source(now);
    current = { day: today, conv: {}, ins: [], outs: [], tasks: "", reviews: "", mail: looked.candidates.map((item) => `${item.key}|${sig(item)}`).sort().join(";"), chat: "" };
  } else {
    const taken = await takeSnapshot(now);
    current = taken.snapshot;
    failedA = taken.failed;
  }
  const change = current ? diffSnapshots(state.snapshot, current) : { changed: true, reasons: ["a source couldn't be read, so nothing can be confirmed unchanged"], threads: new Set<string>(), mailOrChat: true };
  const timeDue = Boolean(state.nextReviewAt) && now.getTime() >= Date.parse(state.nextReviewAt);
  if (timeDue) change.reasons.push("something that wasn't urgent yet has crossed its time floor");
  const recheck = state.verified !== VERIFY_VERSION;
  if (recheck) change.reasons.push("the follow-up checks were updated, so every open follow-up is checked again");
  const changed = change.changed || timeDue || recheck || failedA.length > 0;
  await addSpend(today, { checks: 1 });
  if (!changed) {
    const streak = state.streak + 1;
    const intervalMin = intervalFor(streak);
    await writeMeta(STATE_KEY, { ...state, snapshot: current, streak, intervalMin, nextDueAt: intervalMin > 15 ? new Date(now.getTime() + intervalMin * 60_000 - JITTER_MS).toISOString() : "" } satisfies LoopState);
    await addSpend(today, { skippedTriage: 1 });
    watchLog({ watch: "no change, skipped triage", streak, nextIntervalMin: intervalMin });
    return empty("no-change", { intervalMin });
  }
  watchLog({ watch: "change", reasons: change.reasons });
  // Phase (b): only the threads a change points at are read deeply; everything else keeps what earlier passes found.
  const readThreads = change.threads.size > 0 || timeDue || recheck || change.reasons.includes("a new day");
  const result = await triage(now, { threads: change.threads, commitments: change.mailOrChat || timeDue, guests: readThreads, judged: state.judged }, empty("triaged", { reasons: change.reasons }));
  const saved = await readMeta<LoopState>(STATE_KEY);
  await writeMeta(STATE_KEY, { snapshot: current, streak: 0, intervalMin: 15, nextDueAt: "", nextReviewAt: result.nextReviewAt ?? "", judged: result.judged ?? saved?.judged ?? {}, verified: VERIFY_VERSION } satisfies LoopState);
  delete result.nextReviewAt;
  delete result.judged;
  return { ...result, intervalMin: 15 };
}

type Phase = { threads: Set<string> | null; commitments: boolean; guests: boolean; judged: Record<string, string> };

/**
 * Phase (b): the full look over the business and the judgment. An item already waiting in Decisions isn't surfaced again, one
 * dismissed today stays away until tomorrow, one that is no longer an issue leaves the queue on its own, and a candidate the
 * judgment already decided against isn't judged again until it changes.
 */
async function triage(now: Date, phase: Phase | null, base: WatchResult): Promise<WatchResult & { nextReviewAt?: string; judged?: Record<string, string> }> {
  const cleaned = await cleanupWatchChats(now);
  // Every open follow-up is checked against its own thread again: a quote that is no longer there closes it, and the log says why.
  await reverifyOpenFollowUps(now).catch(() => undefined);
  const today = day(now);
  const collected = await (source ?? ((at: Date) => collectCandidates(at, phase ? { threads: phase.threads, commitments: phase.commitments, guests: phase.guests } : {})))(now);
  const { candidates, failed } = collected;
  const open = new Set(candidates.map((item) => item.key));
  const rows = new Map((await ledger()).map((row) => [row.key, row]));
  const skippedWork = collected.unevaluated;
  const kept = (key: string) => Boolean(skippedWork) && (
    (key.startsWith("gap:commit:") && skippedWork!.commitments)
    || (key.startsWith("gap:") && skippedWork!.stays.some((id) => key.includes(`:${id}:`)))
    || (Boolean(skippedWork!.guests) && /^(guest|followup|incident|inquiry):/.test(key))
  );
  // An item whose issue has gone (the guest was answered, the task done) leaves Decisions. Only trusted when every read worked,
  // and never for an item whose source wasn't looked at this pass.
  let resolved = 0;
  if (!failed.length) {
    for (const row of rows.values()) {
      if (row.status === "surfaced" && !open.has(row.key) && !kept(row.key)) {
        await record({ ...row, status: "handled", resolvedAt: now.toISOString() });
        resolved += 1;
      }
    }
  }
  // New items, plus ones dismissed on an earlier day whose issue is still open: a new day is a new chance, not nagging.
  const fresh = candidates.filter((item) => {
    const row = rows.get(item.key);
    if (!row) return !phase || phase.judged[item.key] !== sig(item);
    return row.status === "dismissed" && row.dismissedOn < today;
  });
  const quiet = quietHours(now);
  // Overnight, only a guest actively waiting on a reply is worth the model; the rest wait for 8 AM unjudged.
  const toJudge = phase && quiet ? fresh.filter((item) => item.guestWaiting) : fresh;
  const { ordered, usedBrain, usage, judged: verdicts } = await judge(toJudge, await learnedNotes(), now);
  if (usage) {
    const cost = costOf(usage.model, usage.input, usage.output);
    await addSpend(today, { triages: 1, modelCalls: 1, inputTokens: usage.input, outputTokens: usage.output, costUsd: cost.usd, unpricedTokens: cost.priced ? 0 : usage.input + usage.output });
  } else if (usedBrain) await addSpend(today, { triages: 1, modelCalls: 1 });
  else if (phase) await addSpend(today, { triages: 1 });
  const ranked: WatchItem[] = [];
  let deferred = fresh.length - toJudge.length;
  for (const item of ordered) {
    // Overnight, only a guest actively waiting on a reply. The rest wait for 8 AM and are not recorded, so they surface then.
    if (quiet && !item.guestWaiting) {
      deferred += 1;
      continue;
    }
    const before = rows.get(item.key);
    const payload: Payload = { reason: item.why || item.reason, urgency: item.urgency, draft: item.draft ?? null };
    await record({ key: item.key, kind: item.kind, title: item.title, property: item.property, chatId: "", status: item.native ? "native" : "surfaced", dismissedOn: "", surfacedAt: now.toISOString(), resolvedAt: "", payload: item.native ? null : payload });
    ranked.push({ key: item.key, kind: item.kind, title: item.title, reason: payload.reason, urgency: item.urgency, property: item.property, delivered: !item.native, native: item.native, resurfaced: before?.status === "dismissed" });
  }
  // What the judgment turned down is remembered by its content, so the same candidate costs nothing next pass.
  const decided: Record<string, string> = {};
  if (phase) {
    for (const item of candidates) if (phase.judged[item.key] === sig(item)) decided[item.key] = sig(item);
    for (const row of verdicts ?? []) {
      const item = candidates.find((candidate) => candidate.key === row.key);
      if (item && !row.surface) decided[item.key] = sig(item);
    }
  }
  return {
    ...base, at: now.toISOString(), ranked, delivered: ranked.filter((item) => item.delivered).length, deferred, skipped: candidates.length - fresh.length + (fresh.length - ordered.length), failed, usedBrain, cleaned, resolved,
    ...(collected.nextReviewAt ? { nextReviewAt: collected.nextReviewAt } : {}), ...(phase ? { judged: decided } : {}),
  };
}

/** The watch loop's spend for the last few days, split by phase: what the empty checks cost (nothing) and what the model passes cost. */
export async function watchSpendReport(now: Date = parityNow() ?? new Date(), days = 7): Promise<{ rows: DaySpend[]; text: string }> {
  const rows: DaySpend[] = [];
  for (let back = 0; back < days; back += 1) rows.push(await spendFor(addDays(day(now), -back)));
  const used = rows.filter((row) => row.checks || row.backedOff || row.triages);
  return { rows: used, text: used.length ? describeSpend(used) : "The watch loop hasn't run in that time." };
}

/** Today's check-ins and check-outs as the last pass saw them. */
export async function watchTodayCounts(): Promise<{ ins: number; outs: number } | null> {
  const state = await readMeta<LoopState>(STATE_KEY);
  const snapshot = state?.snapshot;
  return snapshot ? { ins: snapshot.ins.length, outs: snapshot.outs.length } : null;
}
