/**
 * Before an outstanding item is shown again, re-read the source that could have closed it.
 * A sent or completed item stays closed. Each item that is still open keeps its own draft.
 */

import type { MailLetter } from "./mailSearch.js";
import { draftsRecorded, recordDrafts } from "./store.js";
import { addDays } from "./time.js";

const openKeys = new Set<string>();

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
