/**
 * Partner questions about Hospitable guest messages.
 * Reads the same threads Guest messaging reads. Drafts wait in that tab, not in Checks.
 */

import { composeGuestReply, sameDayDepartureFor } from "./guestReplyCompose.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { parityNow } from "./parity/clock.js";
import { draftFromHub, guestDrafts, loadGuestQueue, needsGuestReply, openGuestAnswer, rememberGuestDraft } from "./guestMessaging.js";
import { loadRecentStays, memoryFor, readStayThread, type RecentStay } from "./stayCheck.js";
import { buildingNotices, type Line } from "./outstandingAnswer.js";
import { dayWords } from "./guestBriefing.js";
import { spokenProperty } from "./dayBoard.js";
import { torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

const NAME_STOP = new Set(["the", "guest", "guests", "someone", "anyone", "they", "she", "he", "we", "i", "you", "hospitable", "our", "my"]);

type OpenThread = {
  row: RecentStay;
  ask: string;
  at: string;
  /** The whole thread, so the reply can answer everything in it. */
  thread?: { at: string; role: string; name: string; body: string }[];
};

type ThreadLine = NonNullable<OpenThread["thread"]>[number];

/** The reply for a waiting guest: the composed, every-item answer when the thread calls for it, else the Knowledge Hub's. */
function replyFor(
  guest: string,
  ask: string,
  hub: string,
  place: string,
  memory: string,
  row: RecentStay,
  thread: ThreadLine[],
  stays: RecentStay[],
): ReturnType<typeof draftFromHub> {
  const composed = composeGuestReply({
    guest,
    property: place,
    thread,
    checkIn: row.stay.checkIn,
    checkOut: row.stay.checkOut,
    sameDayDeparture: sameDayDepartureFor(stays.map((item) => ({ id: item.stay.id, propertyId: item.stay.propertyId, checkOut: item.stay.checkOut, status: item.stay.status })), { id: row.stay.id, propertyId: row.stay.propertyId, checkIn: row.stay.checkIn }),
  });
  if (composed) return { mode: "hub", draft: composed.draft, facts: composed.handled.join(", "), gap: "" };
  return draftFromHub(guest, ask, hub, { place, memory });
}

const FULL_NAME = /^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)*)$/;

function keepName(raw: string): string {
  const name = raw.trim();
  if (!FULL_NAME.test(name) || NAME_STOP.has(name.toLowerCase())) return "";
  return name;
}

function namedGuest(text: string): string {
  const ask = text.match(/\bwhat did\s+(.+?)\s+(?:ask|say|write|message|text)\b/i);
  const from = text.match(/\bmessages?\s+from\s+(.+?)(?:[?.!]|$)/i);
  return keepName(ask?.[1] || from?.[1] || "");
}

/** "Draft a reply to Isabelle ..." names one guest. A bare "draft a reply" does not. */
export function namedDraftGuest(text: string): string {
  const lead = text.match(/\b(?:draft|write)\s+(?:a\s+|an\s+)?(?:reply|message|note|response)\s+to\s+/i);
  if (!lead || lead.index == null) return "";
  const rest = text.slice(lead.index + lead[0].length);
  const name = rest.match(/^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)*)/);
  return keepName(name?.[1] ?? "");
}

function sameGuest(guest: string, name: string): boolean {
  const left = guest.trim().toLowerCase();
  const right = name.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right} `);
}

function thankYouReply(name: string, request: string): string {
  if (/\bthank/i.test(request) && /\bstay/i.test(request)) {
    return `Hi ${name},\n\nThank you for staying with us.`;
  }
  return `Hi ${name},\n\n${oneLine(request)}`;
}

/** "Draft a message to Husson about the hot water" → "the hot water". */
function draftTopic(text: string): string {
  return (/\b(?:about|regarding|re:?|on)\s+(.+?)[.?!]*$/i.exec(text.trim())?.[1] ?? "").trim();
}

/** The draft text itself: from the building's notice when the topic is an outage, else a marked blank. */
async function writeNamedDraft(guest: string, stay: RecentStay, question: string, clock: Date): Promise<string> {
  const first = guest.trim().split(/\s+/)[0] || guest;
  const topic = draftTopic(question);
  if (!topic && /\bthank/i.test(question)) return thankYouReply(guest, question);
  const today = torontoToday(clock);
  const notices = await buildingNotices(today).catch(() => ({ lines: [] as Line[], notes: [] as string[] }));
  const notice = notices.lines.find((line) => line.place === spokenProperty(stay.propertyName, stay.address) || stay.label.includes(line.place));
  if (notice && (!topic || /hot water|heat|water|outage|shut\s?down|repair/i.test(topic))) {
    const what = notice.text.replace(/,\s*notice .*$/i, "").replace(/^./, (char) => char.toLowerCase());
    const upcoming = stay.stay.checkIn > today;
    const when = upcoming ? ` before your stay on ${dayWords(stay.stay.checkIn, today)}` : "";
    const noTime = /no restoration time/i.test(notice.text);
    return [
      `Hi ${first},`,
      "",
      `A heads-up${when}: the building at ${spokenProperty(stay.propertyName, stay.address)} has let us know that ${what} today${noTime ? ", and they haven't given a time for it to be restored yet" : ""}. We're following up with building management and will message you as soon as it's back on${upcoming ? ", well before you arrive if we can" : ""}.`,
      "",
      "We're sorry for the inconvenience.",
    ].join("\n");
  }
  return `Hi ${first},\n\n[your message${topic ? ` about ${topic}` : ""}]`;
}

export type NamedDraft = { body: string; draft?: CopilotDraft };

export async function answerNamedGuestDraft(question: string, now?: Date): Promise<NamedDraft | null> {
  const name = namedDraftGuest(question);
  if (!name) return null;
  const clock = now ?? parityNow() ?? new Date();
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return { body: "Hospitable didn't return the reservations. I didn't draft a reply." };
  }
  const matches = loaded.stays.filter((row) => sameGuest(row.stay.guest, name) && !/cancel/.test(row.stay.status));
  if (!matches.length) return { body: `I didn't find ${name} on a managed stay. Which guest should I draft for?` };
  const ranked: { row: RecentStay; at: string }[] = [];
  const unread: string[] = [];
  for (const row of matches) {
    try {
      const messages = await readStayThread(row.stay.id, clock);
      const latest = messages.map((item) => item.at).filter(Boolean).sort().at(-1) ?? "";
      ranked.push({ row, at: latest || `${row.stay.checkOut}T00:00:00Z` });
    } catch {
      unread.push(row.label);
    }
  }
  if (!ranked.length) {
    const where = unread.length ? ` ${unread.join(" and ")} didn't return a thread.` : "";
    return { body: `I couldn't read ${name}'s messages.${where} I didn't draft a reply.` };
  }
  ranked.sort((a, b) => b.at.localeCompare(a.at) || a.row.stay.id.localeCompare(b.row.stay.id));
  const newest = ranked[0];
  const tied = ranked.filter((item) => item.at === newest?.at);
  if (tied.length > 1) {
    const choices = tied.map((item) => item.row.label).join(" or ");
    return { body: `I found ${name} on more than one stay, and the threads are equally recent. Which one should I draft for? ${choices}.` };
  }
  const stay = newest?.row;
  if (!stay) return { body: `I didn't find ${name} on a managed stay. Which guest should I draft for?` };
  const guest = stay.stay.guest || name;
  const text = await writeNamedDraft(guest, stay, question, clock);
  // The draft is shown here, as exact text, and also put in the thread's reply box.
  rememberGuestDraft({ to: guest, body: text, reservationId: stay.stay.id });
  const blank = /\[[^\]\n]{1,60}\]/.test(text);
  return {
    body: `Here is the message to ${guest} at ${stay.label}${blank ? ". Fill in the part in brackets" : ""}. It's also in ${guest}'s Guest messaging reply box. Nothing is sent until you press Submit.\n\n${text}`,
    draft: { subject: "", body: text, to: guest, status: "waiting", channel: "hospitable", hospitable: { tool: "send-reservation-message", args: { reservation_id: stay.stay.id, body: text } } },
  };
}

export function asksGuestThreads(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  if (/\bHM[A-Z0-9]{8,}\b/.test(asked) && /\blast\b/i.test(asked)) return false;
  if (/\b(gmail|outlook|e-?mail)\b/i.test(asked) && !/\b(hospitable|guest)\b/i.test(asked)) return false;
  if (namedGuest(asked)) return true;
  if (/\bunread\b/i.test(asked) && /\bmessages?\b/i.test(asked)) return true;
  if (/\bunanswered\b/i.test(asked) && /\b(messages?|guests?|threads?)\b/i.test(asked)) return true;
  if (/\bany\b/i.test(asked) && /\bguest messages?\b/i.test(asked)) return true;
  if (/\bwho\b/i.test(asked) && /\bwaiting\b/i.test(asked) && /\brepl(?:y|ies)\b/i.test(asked)) return true;
  return false;
}

function arrived(iso: string): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(/[\u202f\u00a0]/g, " ");
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function asksToSeeDrafts(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  if (/\b(building|contract|gmail|outlook)\b/i.test(asked) && !/\bguest\b/i.test(asked)) return false;
  if (/\b(?:draft|write)\s+(?:a\s+|an\s+)?(?:reply|message|note|response)\b/i.test(asked)) return false;
  return (/\b(show|see)\b/i.test(asked) && /\bdrafts?\b/i.test(asked)) || /\bwhat(?:'s| is| are) the drafts?\b/i.test(asked);
}

/** The full text of each waiting guest draft, the same text Guest messaging shows. */
export async function answerWaitingDrafts(question: string, now?: Date): Promise<string | null> {
  if (!asksToSeeDrafts(question)) return null;
  const clock = now ?? parityNow() ?? new Date();
  let queue: Awaited<ReturnType<typeof loadGuestQueue>>;
  try {
    queue = await loadGuestQueue(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't guess.";
  }
  if (!queue.connected) return queue.line || "Hospitable is not connected, so I can't see guest messages.";
  if (!queue.waiting.length) return "No guest is waiting on a reply, so there is no draft.";
  const blocks: string[] = [];
  for (const row of queue.waiting) {
    const saved = guestDrafts().find((item) => item.reservationId === row.id);
    let body = saved?.body ?? "";
    if (!body) {
      const view = await openGuestAnswer(row, clock).catch(() => null);
      body = view?.mode === "hub" ? view.draft : "";
    }
    if (!body) continue;
    blocks.push(`${row.guest} at ${row.property}\n${body}`);
  }
  if (!blocks.length) return "No guest is waiting on a reply, so there is no draft.";
  return blocks.join("\n\n");
}

function lineFor(row: OpenThread): string {
  const when = arrived(row.at);
  const where = when ? `${row.row.label}, ${when}` : row.row.label;
  return `${row.row.stay.guest || "A guest"} at ${where}: "${oneLine(row.ask)}"`;
}

export async function answerGuestThreads(question: string, now?: Date): Promise<string | null> {
  if (!asksGuestThreads(question)) return null;
  const clock = now ?? parityNow() ?? new Date();
  if (/\bwho\b/i.test(question) && /\bwaiting\b/i.test(question) && /\brepl(?:y|ies)\b/i.test(question)) {
    try {
      const queue = await loadGuestQueue(clock);
      return queue.answer || "No guest is waiting on a reply.";
    } catch {
      return "Hospitable didn't return the reservations. I didn't guess.";
    }
  }
  const who = namedGuest(question);
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't guess.";
  }
  if (who) return lastWordFrom(who, loaded, clock);
  const failed = new Set(loaded.failed);
  let disconnected = false;
  const open: OpenThread[] = [];
  const answered: OpenThread[] = [];
    const stays = who ? loaded.stays.filter((row) => sameGuest(row.stay.guest, who)) : loaded.stays;
  for (const row of stays) {
    let messages: { at: string; role: string; name: string; body: string }[];
    try {
      messages = await readStayThread(row.stay.id, clock);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/not connected/i.test(message)) disconnected = true;
      failed.add(row.label);
      continue;
    }
    const spoken = messages.filter((item) => item.role !== "system" && item.body.trim());
    const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
    const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
    const last = spoken[spoken.length - 1];
    if (last?.role === "guest" && pending.length) {
      const pendingText = pending.map((item) => item.body).join(" ");
      if (!needsGuestReply(pendingText)) continue;
      open.push({
        row,
        ask: pending.map((item) => item.body.trim()).join(" "),
        at: pending[pending.length - 1]?.at || last.at,
        thread: spoken,
      });
      continue;
    }
    if (!who) continue;
    const lastGuest = [...spoken].reverse().find((item) => item.role === "guest");
    if (!lastGuest) continue;
    answered.push({ row, ask: lastGuest.body.trim(), at: lastGuest.at });
  }
  open.sort((a, b) => a.at.localeCompare(b.at));
  const drafted: string[] = [];
  const missed: string[] = [];
  for (const item of open) {
    const guest = item.row.stay.guest || "A guest";
    if (guestDrafts().some((row) => row.reservationId === item.row.stay.id)) {
      drafted.push(guest);
      continue;
    }
    const place = `${item.row.label} ${item.row.propertyName} ${item.row.address}`;
    const hubRead = await readPropertyHub(item.row.stay.propertyId);
    const memory = await memoryFor(place).catch(() => "");
    const written = replyFor(guest, item.ask, hubRead.ok ? hubRead.text : "", place, memory, item.row, item.thread ?? [], loaded.stays);
    if (written.mode !== "hub" || !written.draft) continue;
    rememberGuestDraft({ to: guest, body: written.draft, reservationId: item.row.stay.id });
    drafted.push(guest);
  }
  const failedLine = [...failed].map((label) => `${label} failed read.`).join("\n");
  if (disconnected && !open.length && !answered.length) {
    return ["Hospitable is not connected, so I can't see guest messages. I didn't guess.", failedLine].filter(Boolean).join("\n");
  }
  if (who) return namedAnswer(who, open, answered, drafted, missed, failedLine);
  return inboxAnswer(open, drafted, missed, failedLine);
}

/**
 * "What did Diane say last?": the latest guest message across all of that guest's threads, by time,
 * quoted with its date, then what happened after it. An old inquiry is never "last" when a newer
 * thread exists.
 */
async function lastWordFrom(who: string, loaded: Awaited<ReturnType<typeof loadRecentStays>>, clock: Date): Promise<string> {
  const stays = loaded.stays.filter((row) => sameGuest(row.stay.guest, who));
  const failed: string[] = [];
  let best: { row: RecentStay; guestAt: string; body: string; hostAt: string; hostName: string; spoken: ThreadLine[] } | null = null;
  for (const row of stays) {
    let messages: { at: string; role: string; name: string; body: string }[];
    try {
      messages = await readStayThread(row.stay.id, clock);
    } catch {
      failed.push(row.label);
      continue;
    }
    const spoken = messages.filter((item) => item.role !== "system" && item.body.trim()).sort((a, b) => a.at.localeCompare(b.at));
    const lastGuest = [...spoken].reverse().find((item) => item.role === "guest");
    if (!lastGuest) continue;
    const after = spoken.filter((item) => item.role === "host" && item.at > lastGuest.at).at(-1);
    if (!best || lastGuest.at > best.guestAt) best = { row, guestAt: lastGuest.at, body: lastGuest.body.trim(), hostAt: after?.at ?? "", hostName: after?.name ?? "", spoken };
  }
  const failedLine = failed.length ? `${failed.join(" and ")} didn't return a thread, so a later message there wasn't read.` : "";
  if (!best) return [`I didn't find a message from ${who} on a Hospitable thread for a managed stay.`, failedLine].filter(Boolean).join("\n");
  const guest = best.row.stay.guest || who;
  const lines = [`${guest}'s last message, ${arrived(best.guestAt)} (${best.row.label}): "${oneLine(best.body)}"`];
  if (best.hostAt) {
    lines.push(`${best.hostName && !/^(unknown|host)$/i.test(best.hostName) ? best.hostName.split(" ")[0] : "The host"} already replied ${arrived(best.hostAt)}, so no draft is owed.`);
  } else if (needsGuestReply(best.body)) {
    const place = `${best.row.label} ${best.row.propertyName} ${best.row.address}`;
    const hubRead = await readPropertyHub(best.row.stay.propertyId);
    const memory = await memoryFor(place).catch(() => "");
    const written = replyFor(guest, best.body, hubRead.ok ? hubRead.text : "", place, memory, best.row, best.spoken, loaded.stays);
    if (written.mode === "hub" && written.draft) {
      rememberGuestDraft({ to: guest, body: written.draft, reservationId: best.row.stay.id });
      lines.push(`No one has replied yet. Here is the draft, also in ${guest}'s Guest messaging reply box (nothing is sent until you press Submit):`, written.draft);
    } else lines.push("No one has replied yet, and the Knowledge Hub doesn't answer it, so this reply needs you.");
  } else lines.push("No one has replied since, and it doesn't need a reply.");
  if (failedLine) lines.push(failedLine);
  return lines.join("\n");
}

function claimLines(drafted: string[], missed: string[]): string[] {
  const tail: string[] = [];
  if (drafted.length === 1) tail.push(`A draft for ${drafted[0]} is in Guest messaging. Nothing is sent until you press Submit.`);
  else if (drafted.length > 1) tail.push(`Drafts for ${drafted.join(" and ")} are in Guest messaging. Nothing is sent until you press Submit.`);
  if (missed.length === 1) tail.push(`The draft for ${missed[0]} was not saved in Guest messaging.`);
  else if (missed.length > 1) tail.push(`The drafts for ${missed.join(" and ")} were not saved in Guest messaging.`);
  return tail;
}

function namedAnswer(who: string, open: OpenThread[], answered: OpenThread[], drafted: string[], missed: string[], failedLine: string): string {
  if (!open.length && !answered.length) {
    return [`I didn't find ${who} on a Hospitable thread for a managed stay.`, failedLine].filter(Boolean).join("\n");
  }
  const lines = [...open, ...answered].map(lineFor);
  const tail = open.length ? claimLines(drafted, missed) : [];
  if (!open.length && answered.length) tail.push("The host already replied in that thread, so there is no draft.");
  if (failedLine) tail.push(failedLine);
  return [...lines, ...tail].join("\n");
}

function inboxAnswer(open: OpenThread[], drafted: string[], missed: string[], failedLine: string): string {
  const head = open.length === 0
    ? "No guest is waiting on a reply."
    : `${open.length} ${open.length === 1 ? "guest is" : "guests are"} waiting on a reply.`;
  const lines = open.map(lineFor);
  const tail = [...claimLines(drafted, missed)];
  if (failedLine) tail.push(failedLine);
  return [head, ...lines, ...tail].filter(Boolean).join("\n");
}
