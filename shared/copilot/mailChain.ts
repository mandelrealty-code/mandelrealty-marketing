/**
 * A breakdown of an email chain is a short narrative of who said what, in order,
 * and what is still outstanding. The message bodies are not pasted.
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

function lowerFirst(value: string): string {
  if (/^[A-Z][a-z]+day\b/.test(value)) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/** What they said, in reported speech. The original wording is not copied through. */
function clause(sentence: string): string {
  let s = sentence.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const ask = /^(can|could|would|will) you (.+)$/i.exec(s);
  if (ask?.[2]) return `asked whether someone could ${lowerFirst(ask[2])}`;
  const please = /^please (.+)$/i.exec(s);
  if (please?.[1]) return `asked to ${lowerFirst(please[1])}`;
  s = s
    .replace(/^I can\b/i, "they could")
    .replace(/^I will\b/i, "they will")
    .replace(/^I am\b/i, "they are")
    .replace(/^I'm\b/i, "they are")
    .replace(/^I\b/, "they");
  return lowerFirst(s);
}

function told(letter: MailLetter): string {
  const sentences = plain(letter).split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean);
  const parts = sentences.map(clause).filter(Boolean);
  if (!parts.length) return "sent a note";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function outstanding(last: MailLetter): string {
  const body = plain(last);
  const please = /please\s+([^.?!]+)/i.exec(body);
  if (please?.[1]) return `What is still outstanding is ${last.from}'s ask to ${please[1].trim()}.`;
  if (/\?/.test(body)) return `What is still outstanding is a reply to ${last.from}.`;
  return "Nothing further is waiting in the last note.";
}

/** Two or three paragraphs: who said what, in order, then what is still open. Message bodies stay out. */
export function breakdownFrom(letters: MailLetter[]): string {
  const ordered = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = ordered[0];
  if (!first) return "I didn't find that email chain. I didn't guess.";
  const narrative = ordered.length === 1
    ? `${first.from} wrote that ${told(first)}.\n\n${outstanding(first)}`
    : chainNarrative(ordered);
  return withoutBodies(narrative, ordered);
}

function chainNarrative(ordered: MailLetter[]): string {
  const first = ordered[0];
  const last = ordered[ordered.length - 1] ?? first;
  if (!first || !last) return "I didn't find that email chain. I didn't guess.";
  const middle = ordered.slice(1, -1);
  const opening = `${first.from} wrote first that ${told(first)}.`;
  const between = middle.map((row) => `${row.from} replied that ${told(row)}.`).join(" ");
  const closing = `${last.from} wrote last that ${told(last)}. ${outstanding(last)}`;
  return [opening, between, closing].filter(Boolean).join("\n\n");
}

function withoutBodies(narrative: string, letters: MailLetter[]): string {
  let text = narrative;
  for (const letter of letters) {
    const body = plain(letter);
    if (body.length > 12 && text.includes(body)) text = text.split(body).join("a note");
  }
  const paragraphs = text.split(/\n\n/).map((row) => row.trim()).filter(Boolean).slice(0, 3);
  if (paragraphs.length >= 2) return paragraphs.join("\n\n");
  return `${text.trim()}\n\nNothing further is waiting in the last note.`;
}

async function openChain(hits: MailHit[], who: string): Promise<MailLetter[]> {
  const groups = new Map<string, MailHit[]>();
  for (const hit of hits) {
    const key = `${hit.mailbox}:${hit.threadId || hit.id}`;
    const list = groups.get(key) ?? [];
    list.push(hit);
    groups.set(key, list);
  }
  const needle = who.toLowerCase();
  const best = [...groups.values()].sort((a, b) => {
    const named = (rows: MailHit[]) => rows.some((row) => `${row.from} ${row.subject} ${row.snippet}`.toLowerCase().includes(needle)) ? 1 : 0;
    const latest = (rows: MailHit[]) => rows.reduce((max, row) => (row.date > max ? row.date : max), "");
    return named(b) - named(a) || b.length - a.length || latest(b).localeCompare(latest(a)) || (a[0]?.id ?? "").localeCompare(b[0]?.id ?? "");
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
  const letters = await openChain(found.hits, keywords);
  if (!letters.length) return "I didn't find that email chain. I didn't guess.";
  return breakdownFrom(letters);
}
