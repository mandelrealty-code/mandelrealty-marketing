import { DEFAULT_CHECKLIST, readGuestInbox } from "./guestInbox.js";
import {
  addMessage,
  chatExists,
  createChat,
  finishRun,
  flagChatNeedsYou,
  getJob,
  listRuns,
  saveJob,
  startRun,
} from "./store.js";
import { torontoToday } from "./time.js";
import type { CopilotJob, CopilotRun, GuestInboxResult, InboxGuest } from "./types.js";

/**
 * Runs Copilot jobs without Cursor. The site reads Hospitable and writes the report itself.
 * Nothing here sends anything to a guest.
 */

export const INBOX_TITLE = "Morning inbox";

function day(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ago(iso: string | null, now: Date): string {
  if (!iso) return "";
  const hours = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 3_600_000));
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} days`;
}

function stayLine(row: InboxGuest, today: string): string {
  if (row.checkIn && row.checkIn <= today) return `in the unit until ${day(row.checkOut)}`;
  return `checks in ${day(row.checkIn)}`;
}

function signature(result: GuestInboxResult): string {
  return JSON.stringify({
    w: result.waiting.map((r) => r.reservationId).sort(),
    u: result.unclear.map((r) => r.reservationId).sort(),
    d: result.details.map((r) => `${r.reservationId}:${r.found.map((f) => f.item).sort().join(",")}`).sort(),
  });
}

export function headline(result: GuestInboxResult): string {
  const bits: string[] = [];
  if (result.waiting.length) bits.push(`${result.waiting.length} ${result.waiting.length === 1 ? "guest is" : "guests are"} waiting on a reply`);
  if (result.details.length) bits.push(`${result.details.length} may have sent details`);
  if (!bits.length) return "Nobody is waiting on a reply.";
  return `${bits.join(" · ")}.`;
}

function report(result: GuestInboxResult, now: Date, today: string): string {
  const lines: string[] = [];
  lines.push(`${INBOX_TITLE} · ${day(today)}`);
  lines.push(`Read the messages on ${result.read} of ${result.stays} stays checked in now or arriving in the next two weeks. Nothing was sent.`);
  if (result.partial) lines.push("I ran out of time before reading every stay. Press Run now in Settings → Jobs to finish.");
  if (result.unreadable) lines.push(`Hospitable would not return messages for ${result.unreadable} ${result.unreadable === 1 ? "stay" : "stays"}.`);

  lines.push("");
  if (result.waiting.length) {
    lines.push(`Waiting on a reply (${result.waiting.length})`);
    for (const row of result.waiting) {
      lines.push(`• ${row.guest} · ${row.unit} · ${stayLine(row, today)} · waiting ${ago(row.lastAt, now)}`);
      lines.push(`  “${row.snippet}”`);
    }
  } else {
    lines.push("Nobody is waiting on a reply.");
  }

  if (result.unclear.length) {
    lines.push("");
    lines.push(`Couldn't tell who wrote last (${result.unclear.length})`);
    for (const row of result.unclear) {
      lines.push(`• ${row.guest} · ${row.unit} · ${stayLine(row, today)}. Check this thread in Hospitable.`);
    }
  }

  lines.push("");
  if (result.details.length) {
    lines.push(`May have sent details (${result.details.length})`);
    for (const row of result.details) {
      lines.push(`• ${row.guest} · ${row.unit} · ${stayLine(row, today)} · ${row.found.map((f) => f.item).join(", ")}`);
      for (const f of row.found) lines.push(`  “${f.quote}”`);
    }
    lines.push("These are matches in the guest's messages. Check the thread before you rely on them.");
  } else {
    lines.push("No guest messages matched the details checklist.");
  }
  return lines.join("\n");
}

async function ensureChat(job: CopilotJob): Promise<CopilotJob> {
  if (job.chat_id && (await chatExists(job.chat_id))) return job;
  const chat = await createChat(INBOX_TITLE);
  return saveJob({ kind: job.kind, title: job.title, enabled: job.enabled, chat_id: chat.id, settings: job.settings });
}

/** Turn the morning inbox on. The row is saved and read back before anyone is told it is on. */
export async function turnOnInbox(): Promise<CopilotJob> {
  const existing = await getJob("guest_inbox");
  const saved = await saveJob({
    kind: "guest_inbox",
    title: INBOX_TITLE,
    enabled: true,
    settings: existing?.settings.checklist.length ? existing.settings : { checklist: DEFAULT_CHECKLIST },
  });
  if (!saved.enabled) throw new Error("The morning inbox was not saved.");
  return ensureChat(saved);
}

export type RunOutcome = { job: CopilotJob; run: CopilotRun; needsYou: boolean } | { skipped: string };

export async function runGuestInbox(trigger: CopilotRun["trigger"], now = new Date()): Promise<RunOutcome> {
  const found = await getJob("guest_inbox");
  if (!found) return { skipped: "The morning inbox is not set up." };
  if (!found.enabled && trigger === "schedule") return { skipped: "The morning inbox is off." };
  const job = await ensureChat(found);
  const chatId = job.chat_id as string;

  const previous = (await listRuns(job.id, 10)).find((r) => r.status === "ok" && r.result) ?? null;
  const run = await startRun(job.id, trigger);
  const today = torontoToday(now);
  const checklist = job.settings.checklist.length ? job.settings.checklist : DEFAULT_CHECKLIST;

  let done: CopilotRun;
  let body: string;
  let needsYou: boolean;
  try {
    const result = await readGuestInbox(checklist, now);
    done = await finishRun(run, { status: "ok", result });
    body = report(result, now, today);
    const changed = !previous?.result || signature(previous.result) !== signature(result);
    needsYou = result.waiting.length > 0 || result.unclear.length > 0 || result.partial || changed;
  } catch (err) {
    const why = err instanceof Error ? err.message : "Hospitable did not answer.";
    done = await finishRun(run, { status: "failed", result: null, error: why });
    body = `${INBOX_TITLE} · ${day(today)}\nI couldn't read Hospitable this time: ${why}\nThis is not a current list of who is waiting. Nothing was sent.`;
    needsYou = true;
  }

  await addMessage({ chatId, role: "assistant", body });
  if (needsYou) await flagChatNeedsYou(chatId);
  return { job, run: done, needsYou };
}
