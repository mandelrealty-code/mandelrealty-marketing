/**
 * Chat answers about a follow-up or commitment ("Which stay had the window cleaning task?").
 *
 * Rule 1: the answer is built from the follow-up's stored record (guest, property, stay dates,
 * the quoted promise and the guest's agreement). The thread and the reservation are read only to
 * confirm. Property, guest and dates match the record exactly; a disagreement is said in one line.
 *
 * Rule 2: an answer about an item that is still open ends with the next step: an offer to draft
 * the guest message and the one deciding question still open. The draft is made only on yes,
 * shown as exact text for approval. Nothing is sent. A closed item gets the facts and no question.
 */

import { dueQuestion } from "./dueFollowUps.js";
import { readSavedGuestQueue } from "./guestMessaging.js";
import { hospitableRead } from "./hospitableConnection.js";
import { readStayThread } from "./stayCheck.js";
import { torontoToday } from "./time.js";
import type { GuestFollowUp } from "./guestTypes.js";
import type { CopilotDraft } from "./types.js";

const YES = /^(a\.\s*)?(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|draft it|draft)(\b|[,.!])/i;
const NO = /^(b\.\s*)?(no|nope|not now|don't|do not|skip|later)\b/i;
const OFFER = /Do you want me to draft the message to ([^?]+)\?/;

const ABOUT = /\b(follow[\s-]?ups?|task|tasks|promise[ds]?|promised|commitment|committed|owe|owed|inquiry|inquiries|request|incident|open item|still open|pending)\b/i;
const STOP = new Set(["the", "and", "for", "with", "that", "this", "was", "were", "had", "has", "have", "which", "what", "when", "where", "stay", "stays", "guest", "task", "follow", "promised", "agreed", "asked", "for", "from"]);

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((word) => word.length >= 4 && !STOP.has(word));
}

function stem(word: string): string {
  return word.replace(/(ings|ing|ed|es|s)$/, "");
}

type Found = { row: GuestFollowUp; open: boolean; closeText: string };

/** The follow-up a question is about: its topic, or its guest with a follow-up word. */
export function matchFollowUp(question: string, open: GuestFollowUp[], closed: { record?: GuestFollowUp; closeText: string }[]): Found | null {
  const asked = new Set(words(question).map(stem));
  const lower = question.toLowerCase();
  const score = (row: GuestFollowUp) => {
    const topic = words(`${row.topic} ${row.kind === "inquiry" ? "inquiry request booking" : ""} ${row.kind === "incident" ? "incident" : ""} ${row.kind === "ask" ? "early late check-in checkout" : ""}`).map(stem);
    const topicHits = topic.filter((word) => asked.has(word)).length;
    const first = (row.first || row.guest).split(/\s+/)[0]?.toLowerCase() ?? "";
    const named = first.length >= 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower);
    if (topicHits) return topicHits * 2 + (named ? 1 : 0);
    return named && ABOUT.test(question) ? 1 : 0;
  };
  const ranked = [
    ...open.map((row) => ({ row, open: true, closeText: "" })),
    ...closed.filter((item) => item.record).map((item) => ({ row: item.record as GuestFollowUp, open: false, closeText: item.closeText })),
  ]
    .map((item) => ({ ...item, score: score(item.row) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.open) - Number(a.open));
  const best = ranked[0];
  return best ? { row: best.row, open: best.open, closeText: best.closeText } : null;
}

function short(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return day;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.slice(0, 10)}T12:00:00Z`));
}

function dayOf(iso: string): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
}

function quote(text: string, max = 160): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return `“${one}”`;
  const cut = one.slice(0, max);
  return `“${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trimEnd()}…”`;
}

/** The sentence of a long promise that carries the commitment, so the quote stays readable. */
function promiseLine(row: GuestFollowUp): string {
  const topic = words(row.topic).map(stem);
  const sentences = row.promised.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const dated = sentences.find((part) => /\b(on or after|after|by|on)\b.*\d/i.test(part) && topic.some((word) => part.toLowerCase().includes(word)))
    ?? sentences.find((part) => /\b(on or after)\b/i.test(part))
    ?? sentences.find((part) => topic.some((word) => part.toLowerCase().includes(word)))
    ?? row.promised;
  return quote(dated);
}

function agreedLine(row: GuestFollowUp): string {
  const sentences = row.agreed.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const dated = sentences.find((part) => /\d|on or after/i.test(part))
    ?? sentences.find((part) => /\b(works|fine|perfect|sounds good)\b/i.test(part))
    ?? row.agreed;
  return quote(dated);
}

/** The one deciding question still open for this item. */
export function decidingQuestion(row: GuestFollowUp): string {
  const first = row.first || row.guest.split(/\s+/)[0] || "the guest";
  const topic = row.topic ? row.topic.toLowerCase() : "this";
  if (row.kind === "inquiry") return `Do you want to approve or decline ${first}’s request?`;
  if (row.kind === "incident") return `Has ${first} confirmed the ${topic} is sorted?`;
  if (row.kind === "ask") return `Have you decided whether to offer ${first} the ${/late/i.test(row.line) ? "late checkout" : "early check-in"}, and at what price?`;
  if (row.onOrAfter || !row.due) return `Have you picked the day you want to set up the ${topic}?`;
  return `Have you picked the time for the ${topic} on ${row.dueLabel || short(row.due)}?`;
}

/** What the thread and the reservation say, read only to confirm the record. */
async function confirm(row: GuestFollowUp, now: Date): Promise<{ asked: string; disagree: string }> {
  let asked = "";
  let disagree = "";
  try {
    const thread = await readStayThread(row.reservationId, now);
    const topic = words(row.topic).map(stem);
    const first = thread
      .filter((turn) => turn.role === "guest" && topic.some((word) => turn.body.toLowerCase().includes(word)))
      .map((turn) => turn.at)
      .sort()[0];
    if (first && (!row.promisedAt || first < row.promisedAt)) asked = dayOf(first);
    const said = row.promised.replace(/\s+/g, " ").trim().slice(0, 60);
    if (said && thread.length && !thread.some((turn) => turn.body.replace(/\s+/g, " ").includes(said))) {
      disagree = `The thread no longer shows the quoted promise, so check it before acting.`;
    }
  } catch {
    /* The record still answers. A failed confirmation read is not a disagreement. */
  }
  try {
    const raw = await hospitableRead("get-reservation", { identifier: row.reservationId });
    const data = raw && typeof raw === "object" ? ((raw as { data?: unknown }).data ?? raw) as Record<string, unknown> : {};
    const checkIn = String(data.arrival_date ?? data.check_in ?? "").slice(0, 10);
    const checkOut = String(data.departure_date ?? data.check_out ?? "").slice(0, 10);
    if (checkIn && checkOut && row.checkIn && row.checkOut && (checkIn !== row.checkIn || checkOut !== row.checkOut)) {
      disagree = `The reservation now shows ${short(checkIn)} – ${short(checkOut)}, not the ${short(row.checkIn)} – ${short(row.checkOut)} on this follow-up, so check the dates before acting.`;
    }
  } catch {
    /* Same: the record stands when the reservation read fails. */
  }
  return { asked, disagree };
}

function dueWords(row: GuestFollowUp, today: string): string {
  if (!row.due) return "No date has been set.";
  const days = Math.round((Date.parse(`${row.due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const when = days === 0 ? `today, ${row.dueLabel || short(row.due)}` : days === 1 ? `tomorrow, ${row.dueLabel || short(row.due)}` : days < 0 ? `${row.dueLabel || short(row.due)}, ${-days} day${days === -1 ? "" : "s"} ago` : `${row.dueLabel || short(row.due)}, in ${days} days`;
  return row.onOrAfter ? `The window opens ${when}, and no day is set in the thread yet.` : `It is due ${when}.`;
}

export function followUpAnswerText(found: Found, today: string, confirmation: { asked: string; disagree: string }): string {
  const row = found.row;
  const first = row.first || row.guest.split(/\s+/)[0] || "The guest";
  const topic = row.topic || "This follow-up";
  const stay = `${row.guest}’s stay at ${row.property}, ${short(row.checkIn)} – ${short(row.checkOut)}`;
  const lines: string[] = [];
  if (row.kind === "owe") {
    const asked = confirmation.asked ? `${first} asked on ${confirmation.asked}. ` : "";
    const promised = `The hosts promised it${row.promisedAt ? ` on ${dayOf(row.promisedAt)}` : ""}: ${promiseLine(row)}`;
    const agreed = row.agreed ? ` ${first} ${row.agreedAs === "asked" ? "asked" : "agreed"}${row.agreedAt ? ` on ${dayOf(row.agreedAt)}` : ""}: ${agreedLine(row)}` : "";
    lines.push(`The ${topic.toLowerCase()} is for ${stay}.`);
    lines.push(`${asked}${promised}.${agreed}`.replace(/([.!?])”\./g, "$1”"));
  } else if (row.kind === "inquiry") {
    lines.push(`${first}’s ${row.tag === "INQUIRY" ? "inquiry" : "request"} is for ${row.property}, ${short(row.checkIn)} – ${short(row.checkOut)}.${row.dueText ? ` ${row.dueText}.` : ""}`);
  } else {
    lines.push(`The ${topic.toLowerCase()} is for ${stay}.`);
    if (row.what || row.promised) lines.push(row.what || quote(row.promised));
  }
  if (confirmation.disagree) lines.push(confirmation.disagree);
  if (!found.open) {
    lines.push(`It is closed: ${found.closeText}.`);
    return lines.join("\n\n");
  }
  if (row.kind === "owe") lines.push(dueWords(row, today));
  lines.push(`Do you want me to draft the message to ${first}? ${decidingQuestion(row)}`);
  return lines.join("\n\n");
}

export type FollowUpTurn = { body: string; draft?: CopilotDraft; step: string };

/**
 * A chat turn about a follow-up: the answer to a question about one, or the draft after
 * the partner says yes to the offer. Returns null when the turn is about something else.
 */
export async function answerFollowUpTurn(text: string, prior: string, now = new Date()): Promise<FollowUpTurn | null> {
  const queue = await readSavedGuestQueue().catch(() => null);
  if (!queue) return null;
  const open = queue.followUps ?? [];
  const closed = queue.closedFollowUps ?? [];
  const today = torontoToday(now);
  const offered = OFFER.exec(prior);
  if (offered) {
    const line = text.trim();
    const target = matchFollowUp(prior, open, [])?.row;
    if (target && NO.test(line)) return { body: "Okay. Nothing was drafted and nothing was sent.", step: "Left the follow-up open" };
    if (target && YES.test(line)) {
      const question = dueQuestion({ ...target, due: target.due || today }, today);
      const draft = target.kind === "owe"
        ? question.draft
        : `Hi ${target.first || target.guest}, following up on ${target.topic ? `the ${target.topic.toLowerCase()}` : "your message"}. [your answer]`;
      return {
        body: `Here is the message to ${target.first || target.guest}. Fill in the part in brackets, then submit the exact text. Nothing has been sent.`,
        step: "Drafted the guest message",
        draft: {
          subject: "",
          body: draft,
          to: target.guest,
          status: "waiting",
          channel: "hospitable",
          hospitable: { tool: "send-reservation-message", args: { reservation_id: target.reservationId, body: draft } },
          followUp: question.followUp,
        },
      };
    }
  }
  // Without a follow-up word, only the full topic ("window cleaning") or the guest's name with a
  // topic word counts, so a plain question like "When is checkout?" never lands here.
  const lower = text.toLowerCase();
  const specific = (row: GuestFollowUp) => {
    const phrase = row.topic.trim().toLowerCase();
    const first = (row.first || row.guest).split(/\s+/)[0]?.toLowerCase() ?? "";
    const named = first.length >= 2 && lower.includes(first);
    return (phrase.length >= 5 && lower.includes(phrase)) || (named && Boolean(matchFollowUp(text, [row], [])));
  };
  const pool = [...open, ...closed.map((item) => item.record).filter((row): row is GuestFollowUp => Boolean(row))];
  if (!ABOUT.test(text) && !pool.some(specific)) return null;
  const found = matchFollowUp(text, open, closed);
  if (!found) return null;
  const confirmation = await confirm(found.row, now);
  return { body: followUpAnswerText(found, today, confirmation), step: found.open ? "Read the follow-up record, then the thread" : "Read the closed follow-up record" };
}
