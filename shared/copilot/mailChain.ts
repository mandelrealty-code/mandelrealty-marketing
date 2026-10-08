/**
 * A breakdown of an email chain is written from the messages in that chain.
 * Search ids and thread ids both open it. A failed message open reads the thread.
 */

import { readMailThread, searchMail, type MailHit, type MailLetter } from "./mailSearch.js";

const BREAKDOWN = /\bbreak\s*down\b/i;
const CHAIN = /\b(e-?mails?|chains?|threads?)\b/i;

export function asksMailBreakdown(text: string): boolean {
  return BREAKDOWN.test(text) && CHAIN.test(text);
}

function chainKeywords(text: string): string {
  const named = /\bwith\s+([A-Za-z][\w'.-]*)/.exec(text);
  if (named?.[1] && !/^(the|a|an|me|us|them|this|that)$/i.test(named[1])) return named[1];
  return text
    .replace(/\b(break|down|e-?mails?|chains?|threads?|paragraphs?|gmail|outlook|in)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plain(letter: MailLetter): string {
  return (letter.body || letter.snippet).replace(/\s+/g, " ").trim();
}

function outstanding(last: MailLetter): string {
  const body = plain(last);
  const please = /please\s+([^.?!]+)/i.exec(body);
  if (please?.[1]) return `What is still outstanding is ${last.from}'s ask to ${please[1].trim()}.`;
  if (/\?/.test(body)) return `What is still outstanding is a reply to ${last.from}.`;
  return "Nothing further is waiting in the last note.";
}

/** Two or three paragraphs: who said what, in order, then what is still open. */
export function breakdownFrom(letters: MailLetter[]): string {
  const ordered = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = ordered[0];
  if (!first) return "I didn't find that email chain. I didn't guess.";
  const last = ordered[ordered.length - 1] ?? first;
  const middle = ordered.slice(1, -1);
  const opening = `${first.from} wrote first: ${plain(first)}`;
  const between = middle.map((row) => `${row.from} replied: ${plain(row)}`).join(" ");
  const closing = last.id === first.id
    ? outstanding(last)
    : `${last.from} wrote last: ${plain(last)} ${outstanding(last)}`;
  return [opening, between, closing].filter(Boolean).join("\n\n");
}

async function openChain(hits: MailHit[]): Promise<MailLetter[]> {
  const groups = new Map<string, MailHit[]>();
  for (const hit of hits) {
    const key = `${hit.mailbox}:${hit.threadId || hit.id}`;
    const list = groups.get(key) ?? [];
    list.push(hit);
    groups.set(key, list);
  }
  const best = [...groups.values()].sort((a, b) => {
    const latest = (rows: MailHit[]) => rows.reduce((max, row) => (row.date > max ? row.date : max), "");
    return b.length - a.length || latest(b).localeCompare(latest(a));
  })[0];
  if (!best?.[0]) return [];
  const mailbox = best[0].mailbox;
  const ids = [best[0].threadId, ...best.map((row) => row.id)].filter((id): id is string => Boolean(id));
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const letters = await readMailThread({ mailbox, id });
      if (letters.length) return letters;
    } catch {
      // The message id missed. The thread id is tried next.
    }
  }
  return [];
}

export async function answerMailChain(text: string): Promise<string | null> {
  if (!asksMailBreakdown(text)) return null;
  const keywords = chainKeywords(text);
  if (keywords.length < 2) return "Say who the email chain is with.";
  const found = await searchMail({ keywords, where: "both" });
  if (!found.hits.length) {
    const note = found.notes.find((line) => /isn't connected|didn't return/i.test(line));
    return note ?? "I didn't find that email chain. I didn't guess.";
  }
  const letters = await openChain(found.hits);
  if (!letters.length) return "I didn't find that email chain. I didn't guess.";
  return breakdownFrom(letters);
}
