/**
 * Before an outstanding item is shown again, re-read the source that could have closed it.
 * A sent or completed item stays closed. Each item that is still open keeps its own draft.
 */

import { readMail, searchMail, type MailLetter } from "./mailSearch.js";
import { parityEnabled } from "./parity/flag.js";
import { parityChecksMessages } from "./parity/storeStub.js";
import { draftsRecorded, listChecksMessages, recordDrafts, updateDraft } from "./store.js";
import { addDays } from "./time.js";

const openKeys = new Set<string>();

/** Names and titles match in full. A first name is not the rest of the name. */
export function namesMatch(stored: string, asked: string): boolean {
  const left = stored.trim().toLowerCase().replace(/\s+/g, " ");
  const right = asked.trim().toLowerCase().replace(/\s+/g, " ");
  if (!left || !right) return false;
  return left === right;
}

export function longDate(iso: string): string {
  const [year, month, dayNum] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !dayNum) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, dayNum)));
}

export function platesFrom(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/plate:\s*([A-Za-z0-9]+)/gi)) {
    const plate = (match[1] ?? "").toUpperCase();
    if (plate && !found.includes(plate)) found.push(plate);
  }
  return found;
}

/** Weekday form and the date as it appears in a sent registration subject. */
function stayDateIn(hay: string, checkIn: string): boolean {
  const day = longDate(checkIn);
  const plain = day.replace(/^[A-Za-z]+,\s*/, "");
  return hay.includes(day) || hay.includes(plain);
}

/** A building email is resolved only when Sent has this stay's date and both plates. */
export function registrationAlreadySent(letters: MailLetter[], checkIn: string, threadPlates: string[]): MailLetter | null {
  for (const letter of letters) {
    const hay = `${letter.subject}\n${letter.body}`;
    if (!stayDateIn(hay, checkIn)) continue;
    if (!/unit\s*318|blue jays/i.test(hay)) continue;
    const plates = platesFrom(hay);
    if (plates.length < 2) continue;
    if (threadPlates.length && threadPlates.some((plate) => !plates.includes(plate))) continue;
    return letter;
  }
  return null;
}

export function sentProof(letter: Pick<MailLetter, "date" | "from" | "mailbox" | "to" | "body" | "subject">, plates: string[]): string {
  const at = new Date(letter.date);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(at);
  const who = letter.from || "The sender";
  const channel = letter.mailbox === "outlook" ? "Outlook" : "Gmail";
  const listed = plates.length >= 2 ? ` It includes both vehicles, plates ${plates.join(" and ")}.` : "";
  return `The Unit 318 building email is already sent, so that draft is closed. ${who} sent it by ${channel} on ${day} at ${time} to ${letter.to}.${listed}`;
}

/** Relative words follow the day the message would actually be sent. */
export function correctRelativeWording(text: string, eventOn: string, sendOn: string): string {
  const event = eventOn.slice(0, 10);
  const send = sendOn.slice(0, 10);
  const tomorrow = addDays(send, 1);
  const yesterday = addDays(send, -1);
  const swap = (source: string, from: RegExp, to: string) => source.replace(from, (word) => (
    word[0] === word[0]?.toUpperCase() ? to[0]?.toUpperCase() + to.slice(1) : to
  ));
  if (event === send) return swap(text, /\btomorrow\b/gi, "today");
  if (event === tomorrow) return swap(text, /\btoday\b/gi, "tomorrow");
  if (event === yesterday) return swap(text, /\btoday\b/gi, "yesterday");
  return text;
}

/** Each open item stays its own approval. One yes never covers two bodies. */
export function presentApprovals<T extends { body: string }>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

export function shutdownOverlapsArrival(text: string, checkIn: string): boolean {
  if (!/shutdown/i.test(text)) return false;
  const day = longDate(checkIn);
  if (!text.includes(day)) return false;
  return /4:00\s*(?:PM|pm)|4\s*(?:PM|pm)|16:00/.test(text);
}

export function noteStillOpen(key: string): void {
  openKeys.add(key);
}

export async function itemHandled(key: string): Promise<boolean> {
  return draftsRecorded(`handled:${key}`);
}

/** Close only after the handled mark is read back. A marked item is not raised again. */
export async function closeHandledAnswer(text: string): Promise<string | null> {
  if (!/\balready handled\b/i.test(text)) return null;
  const keys = [...openKeys];
  if (!keys.length) return null;
  for (const key of keys) {
    await recordDrafts(`handled:${key}`);
    const saved = await draftsRecorded(`handled:${key}`);
    if (!saved) return "I could not close that. It is still open.";
    openKeys.delete(key);
  }
  return "Closed as already handled. I will not bring it up again.";
}

const WITHDRAWN = "I don't have a sent record for that email. The sent claim is withdrawn.";

function proofStamp(letter: Pick<MailLetter, "date" | "from" | "mailbox" | "to">): string {
  const at = new Date(letter.date);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(at);
  const who = letter.from || "The sender";
  const channel = letter.mailbox === "outlook" ? "Outlook" : "Gmail";
  return `${who} sent it by ${channel} on ${day} at ${time} to ${letter.to}.`;
}

/**
 * A sent claim stands only when Sent still has the message.
 * An empty read-back withdraws the claim.
 */
export async function proveOutgoingMail(input: { subject: string; body: string; to: string }): Promise<{ sent: true; text: string } | { sent: false; text: string }> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  const keywords = subject || body.slice(0, 80);
  if (keywords.length < 2) return { sent: false, text: WITHDRAWN };
  const found = await searchMail({ keywords, where: "sent", includeAirbnb: false });
  if (!found.hits.length) {
    const offline = found.notes.find((line) => /isn't connected/i.test(line));
    if (offline && found.notes.every((line) => /isn't connected/i.test(line))) {
      return { sent: false, text: `${found.notes.join(" ")} The sent claim is withdrawn.` };
    }
    return { sent: false, text: WITHDRAWN };
  }
  for (const hit of found.hits) {
    try {
      const letter = await readMail({ mailbox: hit.mailbox, id: hit.id });
      const hay = `${letter.subject}\n${letter.body}`;
      const subjectOk = Boolean(subject) && letter.subject.trim() === subject;
      const slice = body.slice(0, 80);
      const bodyOk = slice.length > 12 && hay.includes(slice);
      if (!subjectOk && !bodyOk) continue;
      return { sent: true, text: `Sent. ${proofStamp(letter)}` };
    } catch {
      // A message that will not open is not proof it was sent.
    }
  }
  return { sent: false, text: WITHDRAWN };
}

/** A waiting email proven sent is closed. Overview and Checks then read the closed row. */
export async function closeResolvedSentDrafts(): Promise<void> {
  const messages = parityEnabled() ? parityChecksMessages() : await listChecksMessages();
  for (const message of messages) {
    const draft = message.draft;
    if (!draft || draft.status !== "waiting" || draft.channel !== "email" || !draft.subject.trim()) continue;
    const proof = await proveOutgoingMail({ subject: draft.subject, body: draft.body, to: draft.to });
    if (!proof.sent) continue;
    await updateDraft(message.id, { status: "held", bodyText: proof.text });
  }
}
