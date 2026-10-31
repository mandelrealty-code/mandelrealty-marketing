/**
 * The watch loop: every 15 minutes the agent looks over the business and surfaces what needs a partner, most urgent first,
 * exactly when it should and no more. It only proposes. A surfaced item lands in the Overview's Decisions queue as a chat
 * waiting on a partner (one row per item) with the exact draft or action ready; nothing is sent, booked or charged.
 *
 * Quiet rules: an item is surfaced once, ever. A dismissed item never returns. Between 10 PM and 8 AM Toronto time only a
 * guest who is actively waiting on a reply is surfaced. When unsure, stay quiet.
 */

import { getSupabaseAdmin } from "../supabase.js";
import { complete, brainAvailable } from "./brain.js";
import { listFacts, saveFact, subjectKey } from "./businessFacts.js";
import { loadDayBoard } from "./dayBoard.js";
import { dueQuestion } from "./dueFollowUps.js";
import { loadGuestQueue } from "./guestMessaging.js";
import { parityNow } from "./parity/clock.js";
import { loadReviewQueue } from "./reviewsQueue.js";
import { addMessage, chatExists, createChat, flagChatNeedsYou, listMessages } from "./store.js";
import { boardPayload } from "./taskBoardApi.js";
import { daysOutstanding, isOpen } from "./taskTypes.js";
import { torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

export type WatchKind = "guest_waiting" | "commitment" | "incident" | "inquiry_deadline" | "cleaner" | "review" | "task";

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
type LedgerRow = { key: string; kind: WatchKind; title: string; property: string; chatId: string; status: WatchStatus; surfacedAt: string; resolvedAt: string };

// ---------- The ledger: what was surfaced and how it ended ----------

let volatile = new Map<string, LedgerRow>();
export function resetWatch(): void {
  volatile = new Map();
}

const TABLE = "copilot_watch_items";
type Row = { key: string; kind: string; title: string; property: string; chat_id: string; status: string; surfaced_at: string; resolved_at: string | null };
const fromRow = (row: Row): LedgerRow => ({ key: row.key, kind: row.kind as WatchKind, title: row.title, property: row.property, chatId: row.chat_id, status: row.status as WatchStatus, surfacedAt: row.surfaced_at, resolvedAt: row.resolved_at ?? "" });

async function ledger(): Promise<LedgerRow[]> {
  const client = getSupabaseAdmin();
  if (!client) return [...volatile.values()];
  const { data, error } = await client.from(TABLE).select("*").order("surfaced_at", { ascending: false }).limit(2000);
  if (error) throw new Error("The watch ledger isn't set up. Run supabase/watch_v1.sql.");
  return ((data ?? []) as Row[]).map(fromRow);
}

async function record(row: LedgerRow): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) {
    volatile.set(row.key, row);
    return;
  }
  await client.from(TABLE).upsert({ key: row.key, kind: row.kind, title: row.title, property: row.property, chat_id: row.chatId, status: row.status, surfaced_at: row.surfacedAt, resolved_at: row.resolvedAt || null });
}

export async function watchLedger(): Promise<LedgerRow[]> {
  return ledger();
}

// ---------- The clock ----------

/** The Toronto hour, 0 to 23. */
export function torontoHour(now: Date): number {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", hourCycle: "h23" }).format(now));
  return Number.isFinite(hour) ? hour : 12;
}

/** 10 PM to 8 AM, Toronto. */
export function quietHours(now: Date): boolean {
  const hour = torontoHour(now);
  return hour >= 22 || hour < 8;
}

// ---------- What there is to look at ----------

const HOUR = 3_600_000;

type Source = (now: Date) => Promise<{ candidates: Candidate[]; failed: string[] }>;
let source: Source | null = null;

/** Tests hand the loop its candidates. Null restores the real look over the business. */
export function setWatchSource(next: Source | null): void {
  source = next;
}

export async function collectCandidates(now: Date): Promise<{ candidates: Candidate[]; failed: string[] }> {
  const today = torontoToday(now);
  const out: Candidate[] = [];
  const failed: string[] = [];

  try {
    const queue = await loadGuestQueue(now);
    if (!queue.connected) failed.push("Guest messages");
    else {
      const inquiries = new Set(queue.followUps.filter((row) => row.kind === "inquiry").map((row) => row.id));
      for (const row of queue.waiting) {
        if (row.thanks || row.inquiry || inquiries.has(row.id)) continue;
        const hours = row.waitedMs / HOUR;
        const arrivesSoon = Boolean(row.checkIn) && row.checkIn.slice(0, 10) <= today;
        // A reply that has waited under two hours (under 30 minutes for a guest in the house or arriving) is not yet worth a partner.
        if (hours < (arrivesSoon ? 0.5 : 2)) continue;
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

  return { candidates: out.sort((a, b) => b.urgency - a.urgency), failed };
}

// ---------- The judgment ----------

const JUDGE_SYSTEM = [
  "You decide what deserves a partner's attention right now at Mandel Realty Group, a short-term-rental management company. You are shown candidate items the system found. You may only choose from them.",
  "Surface an item only if a partner must act and acting soon matters: a guest waiting on a reply, a check-in today with no cleaner, an inquiry near its deadline, a promise coming due, an incident in a thread, a flagged review, a task that is overdue and still open.",
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
export async function judge(candidates: Candidate[], notes: string[], now: Date): Promise<{ ordered: (Candidate & { why: string })[]; usedBrain: boolean }> {
  if (!candidates.length) return { ordered: [], usedBrain: false };
  const keys = new Set(candidates.map((item) => item.key));
  let judged: Judged[] | null = null;
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
  }
  if (!judged) return { ordered: candidates.map((item) => ({ ...item, why: item.reason })), usedBrain: false };
  const byKey = new Map(candidates.map((item) => [item.key, item]));
  const ordered = judged.filter((item) => item.surface).map((item) => ({ ...byKey.get(item.key)!, why: item.reason || byKey.get(item.key)!.reason }));
  return { ordered, usedBrain: true };
}

// ---------- Dismissals teach the judgment ----------

const learnedSubject = (kind: WatchKind, property: string) => `Dismissed ${kind.replace("_", " ")} alerts at ${property.trim() || "any unit"}`;

/** Sees which surfaced items the partner dismissed or acted on, and saves what the dismissals say as facts the agent loads. */
export async function syncWatchLedger(now: Date): Promise<{ dismissed: number; handled: number }> {
  const rows = await ledger();
  let dismissed = 0;
  let handled = 0;
  for (const row of rows) {
    if (row.status !== "surfaced" || !row.chatId) continue;
    let next: WatchStatus | null = null;
    if (!(await chatExists(row.chatId))) next = "dismissed";
    else {
      const draft = [...(await listMessages(row.chatId).catch(() => []))].reverse().find((message) => message.draft)?.draft;
      if (draft?.status === "held") next = "dismissed";
      else if (draft?.status === "sent" || draft?.status === "approved_unsent") next = "handled";
    }
    if (!next) continue;
    const updated: LedgerRow = { ...row, status: next, resolvedAt: now.toISOString() };
    await record(updated);
    if (next === "handled") {
      handled += 1;
      continue;
    }
    dismissed += 1;
    const times = (await ledger()).filter((item) => item.status === "dismissed" && item.kind === row.kind && item.property === row.property).length;
    await saveFact({
      subject: learnedSubject(row.kind, row.property),
      fact: `The partner dismissed ${times} ${row.kind.replace("_", " ")} alert${times === 1 ? "" : "s"} at ${row.property.trim() || "any unit"} (latest: "${row.title.slice(0, 80)}"). Surface similar items only when clearly urgent.`,
      category: "standing",
      source: "Watch loop dismissals",
    });
  }
  return { dismissed, handled };
}

async function learnedNotes(): Promise<string[]> {
  return (await listFacts()).filter((fact) => subjectKey(fact.subject).startsWith("dismissed ")).map((fact) => fact.fact).slice(0, 12);
}

// ---------- Delivery ----------

async function deliver(item: Candidate & { why: string }): Promise<string> {
  const chat = await createChat(item.title);
  const body = [item.why || item.reason, "", item.draft ? "The draft is ready. Nothing has been sent." : "Nothing has been done yet."].join("\n");
  await addMessage({ chatId: chat.id, role: "assistant", body, ...(item.draft ? { draft: item.draft } : {}) });
  await flagChatNeedsYou(chat.id);
  return chat.id;
}

export type WatchItem = { key: string; kind: WatchKind; title: string; reason: string; urgency: number; property: string; delivered: boolean; native: boolean; chatId: string };
export type WatchResult = { at: string; ranked: WatchItem[]; delivered: number; deferred: number; skipped: number; failed: string[]; usedBrain: boolean; learned: { dismissed: number; handled: number } };

/** One pass. Safe to run every 15 minutes: an item already in the ledger is never surfaced again. */
export async function runWatch(now: Date = parityNow() ?? new Date()): Promise<WatchResult> {
  const learned = await syncWatchLedger(now);
  const seen = new Set((await ledger()).map((row) => row.key));
  const { candidates, failed } = await (source ?? collectCandidates)(now);
  const fresh = candidates.filter((item) => !seen.has(item.key));
  const { ordered, usedBrain } = await judge(fresh, await learnedNotes(), now);
  const quiet = quietHours(now);
  const ranked: WatchItem[] = [];
  let deferred = 0;
  for (const item of ordered) {
    // Overnight, only a guest actively waiting on a reply. The rest wait for 8 AM and are not recorded, so they surface then.
    if (quiet && !item.guestWaiting) {
      deferred += 1;
      continue;
    }
    let chatId = "";
    if (!item.native) chatId = await deliver(item);
    await record({ key: item.key, kind: item.kind, title: item.title, property: item.property, chatId, status: item.native ? "native" : "surfaced", surfacedAt: now.toISOString(), resolvedAt: "" });
    ranked.push({ key: item.key, kind: item.kind, title: item.title, reason: item.why || item.reason, urgency: item.urgency, property: item.property, delivered: !item.native, native: item.native, chatId });
  }
  return { at: now.toISOString(), ranked, delivered: ranked.filter((item) => item.delivered).length, deferred, skipped: candidates.length - fresh.length + (fresh.length - ordered.length), failed, usedBrain, learned };
}

