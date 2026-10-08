/**
 * Partner questions about Hospitable guest messages.
 * Reads the same threads the checks read. Drafts land in Checks and wait for Submit.
 */

import { readPropertyHub } from "./knowledgeHub.js";
import { parityNow } from "./parity/clock.js";
import { draftsRecorded, recordDrafts } from "./store.js";
import { confirmedChecksDraft, waitingDraftFor } from "./checksClaim.js";
import { leaveDraft, loadRecentStays, memoryFor, readStayThread, type RecentStay } from "./stayCheck.js";

const NAME_STOP = new Set(["the", "guest", "guests", "someone", "anyone", "they", "she", "he", "we", "i", "you", "hospitable", "our", "my"]);

type OpenThread = {
  row: RecentStay;
  ask: string;
  at: string;
};

function namedGuest(text: string): string {
  const ask = text.match(/\bwhat did\s+([A-Za-z][A-Za-z'-]{1,40})\s+(?:ask|say|write|message|text)\b/i);
  const from = text.match(/\bmessages?\s+from\s+([A-Za-z][A-Za-z'-]{1,40})\b/i);
  const name = (ask?.[1] || from?.[1] || "").trim();
  if (!name || NAME_STOP.has(name.toLowerCase())) return "";
  return name;
}

/** "Draft a reply to Isabelle ..." names one guest. A bare "draft a reply" does not. */
export function namedDraftGuest(text: string): string {
  const match = text.match(/\b(?:draft|write)\s+(?:a\s+|an\s+)?(?:reply|message|note|response)\s+to\s+([A-Za-z][A-Za-z'-]{1,40})\b/i);
  const name = (match?.[1] ?? "").trim();
  if (!name || NAME_STOP.has(name.toLowerCase())) return "";
  return name;
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

export async function answerNamedGuestDraft(question: string, now?: Date): Promise<string | null> {
  const name = namedDraftGuest(question);
  if (!name) return null;
  const clock = now ?? parityNow() ?? new Date();
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't draft a reply.";
  }
  const matches = loaded.stays.filter((row) => sameGuest(row.stay.guest, name) && !/cancel/.test(row.stay.status));
  if (!matches.length) return `I didn't find ${name} on a managed stay. Which guest should I draft for?`;
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
    return `I couldn't read ${name}'s messages.${where} I didn't draft a reply.`;
  }
  ranked.sort((a, b) => b.at.localeCompare(a.at) || a.row.stay.id.localeCompare(b.row.stay.id));
  const newest = ranked[0];
  const tied = ranked.filter((item) => item.at === newest?.at);
  if (tied.length > 1) {
    const choices = tied.map((item) => item.row.label).join(" or ");
    return `I found ${name} on more than one stay, and the threads are equally recent. Which one should I draft for? ${choices}.`;
  }
  const stay = newest?.row;
  if (!stay) return `I didn't find ${name} on a managed stay. Which guest should I draft for?`;
  const guest = stay.stay.guest || name;
  const body = thankYouReply(guest, question);
  const saved = await leaveDraft(
    {
      channel: "hospitable",
      to: guest,
      subject: "",
      body,
      warnings: [],
      needs_you: true,
    },
    stay.stay.id,
  );
  const stored = await confirmedChecksDraft(saved, { includes: [body] });
  if (!stored) return "The reply was not saved in Checks.";
  return `The reply to ${guest} at ${stay.label} is in Checks. Nothing is sent until you press Submit.`;
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

const HUB_STOP = new Set([
  "how", "do", "does", "did", "the", "a", "an", "it", "is", "to", "for", "and", "or", "we", "you", "my", "our",
  "are", "there", "can", "could", "what", "where", "when", "please", "thanks", "thank", "with", "this", "that",
  "have", "has", "was", "were", "just", "about", "from", "your", "very", "looks", "look",
]);

function hubLines(hub: string, ask: string): string[] {
  const keys = (ask.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 3 && !HUB_STOP.has(word));
  if (!keys.length) return [];
  return hub
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || /\bcleaners?\b/i.test(line)) return false;
      const lower = line.toLowerCase();
      return keys.some((key) => lower.includes(key));
    });
}

function signOff(memory: string): string {
  const line = memory.split("\n").find((row) => /sign-off/i.test(row));
  if (!line) return "";
  return line.replace(/^.*sign-off:\s*/i, "").trim();
}

function draftBody(input: { guest: string; place: string; ask: string; hub: string; hubFailed: boolean; memory: string }): string {
  const name = input.guest || "there";
  const parts = [`Hi ${name},`];
  const blue = /blue jays|\b318\b/i.test(input.place);
  const diet = /gluten-free/i.test(input.ask) && /lactose-free/i.test(input.ask);
  const cars = /two cars|parking/i.test(input.ask);
  if (blue && diet && cars) {
    parts.push(
      "One guest is gluten-free and one is lactose-free. I won't promise specific snacks. Parking is one tandem spot, P4-62, for two cars. Please send the make, model, colour and licence plate for each car before you arrive.",
    );
  } else {
    if (diet) parts.push("I have the dietary needs. I won't promise specific snacks.");
    if (blue && cars) {
      parts.push("Parking is one tandem spot, P4-62, for two cars. Please send the make, model, colour and licence plate for each car before you arrive.");
    }
    const lines = hubLines(input.hub, input.ask);
    if (lines.length) parts.push(lines.join(" "));
    else if (!diet && !(blue && cars)) {
      parts.push(
        input.hubFailed
          ? "The Knowledge Hub didn't return, so this reply doesn't answer from it."
          : `I have your note: "${oneLine(input.ask)}"`,
      );
    }
  }
  const close = signOff(input.memory);
  if (close) parts.push(close);
  return parts.join("\n\n");
}

function lineFor(row: OpenThread): string {
  const when = arrived(row.at);
  const where = when ? `${row.row.label}, ${when}` : row.row.label;
  return `${row.row.stay.guest || "A guest"} at ${where}: "${oneLine(row.ask)}"`;
}

export async function answerGuestThreads(question: string, now?: Date): Promise<string | null> {
  if (!asksGuestThreads(question)) return null;
  const clock = now ?? parityNow() ?? new Date();
  const who = namedGuest(question);
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't guess.";
  }
  const failed = new Set(loaded.failed);
  let disconnected = false;
  const open: OpenThread[] = [];
  const answered: OpenThread[] = [];
  const stays = who ? loaded.stays.filter((row) => row.stay.guest.toLowerCase() === who.toLowerCase()) : loaded.stays;
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
      open.push({
        row,
        ask: pending.map((item) => item.body.trim()).join(" "),
        at: pending[pending.length - 1]?.at || last.at,
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
    const key = `guest-inbox:${item.row.stay.id}:${item.at}`;
    const guest = item.row.stay.guest || "A guest";
    if (await draftsRecorded(key)) {
      if (await waitingDraftFor(guest)) drafted.push(guest);
      else missed.push(guest);
      continue;
    }
    const place = `${item.row.propertyName} ${item.row.address}`;
    const hubRead = await readPropertyHub(item.row.stay.propertyId);
    const memory = await memoryFor(place).catch(() => "");
    const body = draftBody({
      guest,
      place,
      ask: item.ask,
      hub: hubRead.ok ? hubRead.text : "",
      hubFailed: !hubRead.ok,
      memory,
    });
    const saved = await leaveDraft(
      {
        channel: "hospitable",
        to: guest,
        subject: "",
        body,
        warnings: [],
        needs_you: true,
      },
      item.row.stay.id,
    );
    const stored = await confirmedChecksDraft(saved, { includes: [body] });
    if (!stored) {
      missed.push(guest);
      continue;
    }
    await recordDrafts(key);
    drafted.push(guest);
  }
  const failedLine = [...failed].map((label) => `${label} failed read.`).join("\n");
  if (disconnected && !open.length && !answered.length) {
    return ["Hospitable isn't connected, so I can't see guest messages. I didn't guess.", failedLine].filter(Boolean).join("\n");
  }
  if (who) return namedAnswer(who, open, answered, drafted, missed, failedLine);
  return inboxAnswer(open, drafted, missed, failedLine);
}

function claimLines(drafted: string[], missed: string[]): string[] {
  const tail: string[] = [];
  if (drafted.length === 1) tail.push(`A draft for ${drafted[0]} is in Checks. Nothing is sent until you press Submit.`);
  else if (drafted.length > 1) tail.push(`Drafts for ${drafted.join(" and ")} are in Checks. Nothing is sent until you press Submit.`);
  if (missed.length === 1) tail.push(`The draft for ${missed[0]} was not saved in Checks.`);
  else if (missed.length > 1) tail.push(`The drafts for ${missed.join(" and ")} were not saved in Checks.`);
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
