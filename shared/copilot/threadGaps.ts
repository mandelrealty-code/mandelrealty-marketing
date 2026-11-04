/**
 * Thread-to-action gaps. For each active reservation thread, what the thread implies someone still has to do is checked
 * against the record: sent mail for a building registration, Hospitable's own state for an early check-in or a request
 * waiting on the house rules. A missing action becomes a candidate that quotes the thread line that triggered it and carries
 * the exact draft. It proposes only: nothing here sends.
 */

import { dryRegistration } from "./buildingRegistration.js";
import { threadActions, type ThreadAction, type ThreadMsg } from "./gapDetect.js";
import { loadConversations, readStayThread, type Conversation } from "./stayCheck.js";
import { torontoToday } from "./time.js";
import type { Candidate } from "./watch.js";

const PENDING = /request|pending|inquir|awaiting|pre-?approv/i;
const ENDED = /cancel|declin|expire|denied|withdraw/i;
const MAX_THREADS = 15;

/** The check-in time Hospitable has for a reservation, as HH:MM, or "" when it shows none. */
export function reservationClock(raw: Record<string, unknown> | undefined): string {
  if (!raw) return "";
  const direct = typeof raw.checkin_time === "string" ? /(\d{1,2}):(\d{2})/.exec(raw.checkin_time) : null;
  if (direct) return `${direct[1]!.padStart(2, "0")}:${direct[2]}`;
  const stamp = typeof raw.check_in === "string" ? /T(\d{2}):(\d{2})/.exec(raw.check_in) : null;
  return stamp ? `${stamp[1]}:${stamp[2]}` : "";
}

const day = (iso: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
const when = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(iso));

function hospitableDraft(conv: Conversation, body: string): NonNullable<Candidate["draft"]> {
  return { subject: "", body, to: conv.stay.guest, status: "waiting", channel: "hospitable", hospitable: { tool: "send-reservation-message", args: { reservation_id: conv.stay.id, body } } };
}

function urgencyOf(conv: Conversation, today: string, base: number): number {
  const days = Math.round((Date.parse(`${conv.stay.checkIn.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return base + (days <= 2 ? 10 : days <= 7 ? 4 : 0);
}

async function candidateFor(conv: Conversation, action: ThreadAction, today: string, failed: string[]): Promise<Candidate | null> {
  const first = conv.stay.guest.split(/\s+/)[0] || "the guest";
  const base = { native: false, kind: "thread_gap" as const, property: conv.propertyName || conv.label, guestWaiting: false };
  const key = `gap:${action.kind}:${conv.stay.id}:${action.quote.at}`;
  const quoted = `${action.quote.who} wrote on ${when(action.quote.at)}: "${action.quote.text.replace(/\s+/g, " ").slice(0, 200)}"`;
  if (action.kind === "building_email") {
    const reg = await dryRegistration(conv.stay.guest);
    if (reg.kind === "unreadable") {
      failed.push("Sent mail");
      return null;
    }
    // Only a registration that was verifiably not sent, with a draft built from this guest's own thread, becomes an item.
    if (reg.kind !== "draft" || !reg.draft) return null;
    return {
      ...base, key, urgency: urgencyOf(conv, today, 78),
      title: `${first}'s car details were sent, but the building hasn't been told`,
      reason: `${quoted}. No registration email for ${day(conv.stay.checkIn)} to ${day(conv.stay.checkOut)} is in Sent mail.${reg.draft.warnings.length ? ` Check: ${reg.draft.warnings[0]}` : ""}`,
      draft: { subject: reg.draft.subject, body: reg.draft.body, to: reg.draft.to, status: "waiting", channel: "email" },
    };
  }
  if (action.kind === "confirm_early_checkin") {
    const [clock, label] = action.detail.split("|") as [string, string];
    if (reservationClock(conv.reservation) === clock) return null;
    const shown = reservationClock(conv.reservation);
    return {
      ...base, key, urgency: urgencyOf(conv, today, 74),
      title: `${first}'s early check-in at ${label} isn't confirmed`,
      reason: `${quoted}. The reservation still shows ${shown ? `check-in at ${shown}` : "no early check-in time"}, and nothing confirms ${label} back to ${first}.`,
      draft: hospitableDraft(conv, `Hi ${first}, just confirming that you're all set to check in at ${label} on ${day(conv.stay.checkIn)}. Let me know if your plans change.`),
    };
  }
  if (!PENDING.test(conv.stay.status)) return null;
  return {
    ...base, key, urgency: urgencyOf(conv, today, 80),
    title: `${first} hasn't confirmed the house rules`,
    reason: `${quoted}. ${first}'s request is still ${conv.stay.status || "pending"} and ${first} hasn't said they agree.`,
    draft: hospitableDraft(conv, `Hi ${first}, before I can accept your request, could you please reply to confirm you've read and agree to the house rules? Thank you!`),
  };
}

export async function collectThreadGaps(now: Date): Promise<{ candidates: Candidate[]; failed: string[] }> {
  const today = torontoToday(now);
  const out: Candidate[] = [];
  const failed: string[] = [];
  const loaded = await loadConversations(now);
  if (loaded.failed.length) failed.push("Guest threads");
  const reach = Date.parse(`${today}T12:00:00Z`) + 30 * 86_400_000;
  const active = loaded.conversations
    .filter((conv) => !ENDED.test(conv.stay.status) && conv.stay.checkOut.slice(0, 10) >= today && Date.parse(`${conv.stay.checkIn.slice(0, 10)}T12:00:00Z`) <= reach)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .slice(0, MAX_THREADS);
  for (const conv of active) {
    let messages: ThreadMsg[] | null = null;
    try {
      messages = conv.inquiry ? conv.turns ?? [] : await readStayThread(conv.stay.id, now, conv.lastMessageAt);
    } catch {
      failed.push("Guest threads");
      continue;
    }
    for (const action of threadActions({ guest: conv.stay.guest, address: `${conv.address} ${conv.label}`, messages })) {
      const found = await candidateFor(conv, action, today, failed).catch(() => {
        failed.push("Thread gaps");
        return null;
      });
      if (found) out.push(found);
    }
  }
  return { candidates: out, failed: [...new Set(failed)] };
}
