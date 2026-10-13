/**
 * Does this thread need a reply from the hosts? Judged from the whole thread state, not the last
 * message alone: the reservation or inquiry status, its dates, who spoke last, and what was decided.
 *
 * Needs reply only when the guest's latest messages leave a real question or decision with the hosts
 * and the booking or inquiry is still live. A genuine question on a live booking stays, however old.
 */

import { isThanksOnly, needsGuestReply } from "./guestTranslate.js";
import { addDays } from "./time.js";

export type ReplyTurn = { at: string; role: string; body: string };

export type ReplyInput = {
  status: string;
  inquiry: boolean;
  checkIn: string;
  checkOut: string;
  today: string;
  turns: ReplyTurn[];
  guest: string;
  /** The guest holds a newer live reservation, so that thread is the one that counts. */
  superseded?: boolean;
};

/** needs: counts toward Needs reply. reason: why not, in one plain line, when it does not. */
export type ReplyState = { needs: boolean; reason: string };

const DEAD = /cancel|declin|denied|expired|not_possible|withdrawn|rejected/i;
const REQUEST = /inquiry|request|pending/i;
/** A finished stay stays live this long for lost items, refunds, and reviews. */
const AFTER_STAY_DAYS = 14;

/** The guest ends the conversation: another time, somewhere else, will rebook. These close it outright. */
const STRONG_CLOSER = new RegExp([
  String.raw`\banother time\b`,
  String.raw`\bnext time\b`,
  String.raw`\bsomewhere else\b`,
  String.raw`\belsewhere\b`,
  String.raw`\bfound (?:another|a different|other|a) (?:place|spot|unit|listing|option|rental)\b`,
  String.raw`\bre-?book(?:ed|ing)?\b`,
  String.raw`\b(?:we'?ll|i'?ll|we will|i will)\s+pass\b`,
  String.raw`\bno longer (?:need|coming|travell?ing)\b`,
  String.raw`\b(?:not|won'?t be) (?:going to )?book(?:ing)?\b`,
].join("|"), "gi");

/** Soft closers: they close it only when nothing else in the message asks or reports anything. */
const SOFT_CLOSER = new RegExp([
  String.raw`\b(?:i'?ll|we'?ll|i will|we will|will)\s+(?:let you know|get back to you|be in touch|reach out|keep you posted)\b`,
  String.raw`\bkeep you posted\b`,
  String.raw`\bno (?:problem|worries)\b`,
  String.raw`\b(?:perhaps|maybe|hopefully)\b`,
].join("|"), "gi");

const MONEY_ASK = /\b(refund|refunded|charge|charged|money back|deposit|reimburse|cancellation fee|partial)\b/i;

function first(name: string): string {
  return name.trim().split(/\s+/)[0] || "The guest";
}

function longDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** The guest's turns after the hosts last spoke, and that host turn. */
export function pendingGuestTurns(turns: ReplyTurn[]): { pending: ReplyTurn[]; lastHost: ReplyTurn | null } {
  const spoken = turns.filter((turn) => (turn.role === "guest" || turn.role === "host") && turn.body.trim()).slice().sort((a, b) => a.at.localeCompare(b.at));
  const lastHost = [...spoken].reverse().find((turn) => turn.role === "host") ?? null;
  const pending = spoken.filter((turn) => turn.role === "guest" && (!lastHost || turn.at > lastHost.at));
  return { pending, lastHost };
}

/** The last thing the guest said closes the conversation, and nothing in it asks a question. */
export function guestClosedIt(ask: string): boolean {
  if (/\?/.test(ask)) return false;
  if (isThanksOnly(ask)) return true;
  if (new RegExp(STRONG_CLOSER.source, "i").test(ask)) return true;
  if (!new RegExp(SOFT_CLOSER.source, "i").test(ask)) return false;
  const rest = ask.replace(SOFT_CLOSER, " ").replace(/\b(thanks?|thank you)\b[^.!]*[.!]?/gi, " ");
  return !needsGuestReply(rest);
}

export function replyState(input: ReplyInput): ReplyState {
  const who = first(input.guest);
  const { pending, lastHost } = pendingGuestTurns(input.turns);
  if (!pending.length) return { needs: false, reason: lastHost ? "The hosts spoke last." : "" };
  const ask = pending.map((turn) => turn.body.trim()).join(" ");
  const status = input.status.toLowerCase();

  if (input.superseded) return { needs: false, reason: `${who} has a newer booking. That thread is the live one.` };

  if (DEAD.test(status)) {
    if (/cancel/.test(status)) {
      // A cancelled stay needs a reply only for an open money question nobody has answered.
      const answeringHosts = Boolean(lastHost && /\?/.test(lastHost.body));
      if (!answeringHosts && (MONEY_ASK.test(ask) && /\?|\b(when|how|will)\b/i.test(ask))) return { needs: true, reason: "" };
      return {
        needs: false,
        reason: answeringHosts ? `The stay is cancelled and ${who} answered the hosts’ question.` : `The stay is cancelled. ${who}’s last message needs no answer.`,
      };
    }
    return { needs: false, reason: `The ${input.inquiry ? "inquiry" : "booking"} is ${status.replace(/_/g, " ")}.` };
  }

  if (input.inquiry || REQUEST.test(status)) {
    if (input.checkIn && input.checkIn < input.today) return { needs: false, reason: `The inquiry dates (${longDay(input.checkIn)}) have passed and it never booked.` };
    if (guestClosedIt(ask)) return { needs: false, reason: `${who} closed the inquiry.` };
    return needsGuestReply(ask) ? { needs: true, reason: "" } : { needs: false, reason: `${who}’s last message needs no answer.` };
  }

  if (input.checkOut && input.checkOut < addDays(input.today, -AFTER_STAY_DAYS)) {
    return { needs: false, reason: `The stay ended ${longDay(input.checkOut)}.` };
  }
  if (guestClosedIt(ask)) return { needs: false, reason: `${who}’s last message closes the conversation.` };
  return needsGuestReply(ask) ? { needs: true, reason: "" } : { needs: false, reason: `${who}’s last message needs no answer.` };
}

/** Same guest across conversations: email, guest id, or full name. A first name alone is not enough. */
export function guestKey(raw: Record<string, unknown> | undefined): string {
  const guest = raw && typeof raw.guest === "object" && raw.guest ? raw.guest as Record<string, unknown> : {};
  const text = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
  const email = text(guest.email);
  if (email) return `email:${email}`;
  const id = text(guest.id) || text(guest.uuid);
  if (id) return `id:${id}`;
  const full = [text(guest.first_name), text(guest.last_name)].filter(Boolean).join(" ") || text(guest.full_name);
  return full.includes(" ") ? `name:${full}` : "";
}

/**
 * A reply draft has to be a complete answer. Never a Knowledge Hub heading, a stub ending in ":",
 * or a few words cut mid-thought. Returns the reason it is not, or "" when it is fine.
 */
export function draftProblem(draft: string): string {
  const body = draft.replace(/^hi[^,\n]*,\s*/i, "").trim();
  if (!body) return "it is empty";
  if (/:\s*\.?\s*$/m.test(body)) return "it is a Knowledge Hub heading, not an answer";
  const words = body.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word));
  if (words.length < 5) return "it is too short to answer the guest";
  if (!/[.!?)"”]$/.test(body)) return "it stops mid-sentence";
  return "";
}

/** A short Title Case line with no verb, like "Extra Towels & Supplies". Never a draft sentence. */
export function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (/:\s*$/.test(trimmed)) return true;
  const words = trimmed.replace(/[.!]$/, "").split(/\s+/);
  if (words.length > 6) return false;
  const capped = words.filter((word) => /^[A-Z&]/.test(word) || /^(and|of|the|to|for|&|in|on|at)$/.test(word));
  const verb = /\b(is|are|was|were|has|have|can|will|use|press|call|open|find|keep|leave|text|go|check|turn|take|please|be)\b/i.test(trimmed);
  return capped.length === words.length && !verb;
}
