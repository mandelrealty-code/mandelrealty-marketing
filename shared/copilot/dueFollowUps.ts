/**
 * A promise to a guest that comes due today or tomorrow becomes a question to the partners.
 * The scheduled checks leave it in Checks, and Overview shows it: what was promised and agreed,
 * in their own words, why it is due now, and a draft to the guest with the one missing choice marked.
 * The checks send nothing. A partner fills the blank and approves the exact text, or marks it already handled.
 */

import { loadGuestQueue, recordFollowUpHandled } from "./guestMessaging.js";
import { checksOverviewMessages, leaveDraft } from "./stayCheck.js";
import { updateDraft } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import type { GuestFollowUp } from "./guestTypes.js";
import type { DraftFollowUp } from "./types.js";

/** The blank a partner fills before approving. Approve refuses while one is left. */
export const BLANK = /\[[^\]\n]{1,40}\]/;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function quoted(text: string): string {
  return `“${text.trim().replace(/\s*\n+\s*/g, " ")}”`;
}

export function dueQuestion(row: GuestFollowUp, today: string): { lead: string; draft: string; followUp: DraftFollowUp } {
  const first = row.first || row.guest.split(/\s+/)[0] || "the guest";
  const topic = row.topic || "follow-up";
  const days = daysBetween(today, row.due);
  const day = row.dueLabel || row.due;
  const when = days === 0 ? `today, ${day}` : days === 1 ? `tomorrow, ${day}` : `${day}, ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  const headline = days < 0
    ? `${topic} for ${first} was due ${when}`
    : row.onOrAfter
      ? `${topic} for ${first} can happen from ${when}`
      : `${topic} for ${first} is due ${when}`;
  const blank = row.onOrAfter ? "[day and time]" : "[time]";
  const why = days < 0
    ? `It was promised for ${day}, and the thread does not show it done or a time set.`
    : row.onOrAfter
      ? `${first} agreed to on or after ${day}, which is ${days === 0 ? "today" : "tomorrow"}, and no day or time has been set in the thread yet.`
      : `It was promised for ${day}, which is ${days === 0 ? "today" : "tomorrow"}, and no time has been set in the thread yet.`;
  const on = row.onOrAfter ? blank : `${day} at ${blank}`;
  const draft = `Hi ${first}, following up on the ${topic.toLowerCase()}. We can take care of it on ${on}. Does that work for you?`;
  const agreedLabel = row.agreedAs === "asked" ? `What ${first} asked` : `What ${first} agreed`;
  const lead = [
    `${headline}.`,
    "",
    `What was promised${row.promisedWhen ? ` (${row.promisedWhen})` : ""}:`,
    quoted(row.promised),
    ...(row.agreed ? ["", `${agreedLabel}${row.agreedWhen ? ` (${row.agreedWhen})` : ""}:`, quoted(row.agreed)] : []),
    "",
    `Why now: ${why}`,
    "",
    `The draft to ${first} is below. Fill in ${blank}, then approve the exact text. Nothing has been sent. If this is already taken care of, mark it Already handled and it closes here, in Overview, and in Guest messaging.`,
  ].join("\n");
  return {
    lead,
    draft,
    followUp: { id: row.id, reservationId: row.reservationId, due: row.due, guest: row.guest, property: row.property, headline, why },
  };
}

/** Promises due today or tomorrow, or past due and still open. */
export function dueNowOrTomorrow(rows: GuestFollowUp[], today: string): GuestFollowUp[] {
  const tomorrow = addDays(today, 1);
  return rows.filter((row) => row.kind === "owe" && Boolean(row.due) && row.due <= tomorrow && Boolean(row.promised.trim()));
}

/**
 * Leaves one question per due follow-up in Checks. A question already waiting is not repeated;
 * it stays until the follow-up closes. A question for a follow-up that has closed is closed with it.
 */
export async function raiseDueFollowUps(now: Date): Promise<void> {
  const today = torontoToday(now);
  let open: GuestFollowUp[];
  try {
    const queue = await loadGuestQueue(now);
    if (!queue.connected) return;
    open = queue.followUps ?? [];
  } catch {
    return;
  }
  const openIds = new Set(open.map((row) => row.id));
  const raised = (await checksOverviewMessages().catch(() => [])).filter((message) => message.draft?.followUp);
  for (const message of raised) {
    const draft = message.draft;
    if (!draft?.followUp || draft.status !== "waiting" || openIds.has(draft.followUp.id)) continue;
    await updateDraft(message.id, {
      status: "held",
      bodyText: `Closed. ${draft.followUp.headline} is no longer open in Guest messaging. Nothing was sent.`,
    });
  }
  for (const row of dueNowOrTomorrow(open, today)) {
    const mine = raised.filter((message) => message.draft?.followUp?.id === row.id);
    if (mine.some((message) => message.draft?.status !== "held")) continue;
    if (mine.some((message) => torontoToday(new Date(message.created_at)) === today)) continue;
    const question = dueQuestion(row, today);
    await leaveDraft({
      channel: "hospitable",
      to: row.guest,
      subject: "",
      body: question.draft,
      warnings: [],
      needs_you: true,
      followUp: question.followUp,
      lead: question.lead,
    }, row.reservationId);
  }
}

/** Already handled: the follow-up closes for good and every question about it closes. */
export async function closeFollowUpEverywhere(id: string): Promise<void> {
  await recordFollowUpHandled(id);
  const raised = (await checksOverviewMessages().catch(() => [])).filter((message) => message.draft?.followUp?.id === id && message.draft.status === "waiting");
  for (const message of raised) {
    await updateDraft(message.id, { status: "held", bodyText: "Marked already handled. Nothing was sent." });
  }
}
