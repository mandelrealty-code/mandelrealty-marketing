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
  const sources = ordered.flatMap((letter) => [plain(letter), letter.snippet]);
  const drafted = ordered.length === 1
    ? `${first.from} wrote that ${told(first)}.\n\n${outstanding(first)}`
    : chainNarrative(ordered, (letter) => told(letter));
  const quotes = { used: false };
  const synthesized = ordered.length === 1
    ? `${first.from} wrote that ${speak(first, quotes)}.\n\n${outstandingSafe(first)}`
    : chainNarrative(ordered, (letter) => speak(letter, quotes));
  let narrative = pastedThread(drafted, sources) ? synthesized : drafted;
  if (pastedThread(narrative, sources)) {
    const quiet = { used: true };
    narrative = ordered.length === 1
      ? `${first.from} wrote that ${speak(first, quiet)}.\n\n${outstandingSafe(first)}`
      : chainNarrative(ordered, (letter) => speak(letter, quiet));
  }
  const shaped = withoutBodies(narrative, ordered);
  return pastedThread(shaped, sources) ? stripSpans(shaped, sources) : shaped;
}

/**
 * The text a chat may show for an email-chain question.
 * The candidate is the answer a path already wrote. It is not shown until the
 * shared composer has built the narrative, and a draft that still pastes the
 * thread is replaced.
 */
export async function shownBreakdown(question: string, candidate: string): Promise<string> {
  if (!asksMailBreakdown(question)) return candidate;
  return (await answerMailChain(question)) ?? "I didn't find that email chain. I didn't guess.";
}

/** More than one quoted passage, a long quote, or more than one long verbatim fragment. */
export function pastedThread(answer: string, sources: string[]): boolean {
  const quotes = quotedPassages(answer);
  if (quotes.length > 1) return true;
  if (quotes.some((quote) => quote.split(/\s+/).length > 8 || quote.length > 80)) return true;
  return longFragments(answer, sources).length > 1;
}

function chainNarrative(ordered: MailLetter[], speakOf: (letter: MailLetter) => string): string {
  const first = ordered[0];
  const last = ordered[ordered.length - 1] ?? first;
  if (!first || !last) return "I didn't find that email chain. I didn't guess.";
  const middle = ordered.slice(1, -1);
  const opening = `${first.from} wrote first that ${speakOf(first)}.`;
  const between = middle.map((row) => `${row.from} replied that ${speakOf(row)}.`).join(" ");
  const closing = `${last.from} wrote last that ${speakOf(last)}. ${outstandingSafe(last)}`;
  return [opening, between, closing].filter(Boolean).join("\n\n");
}

const WHEN = /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+(?:morning|afternoon|evening|night))?)\b/;

function speak(letter: MailLetter, quotes: { used: boolean }): string {
  const sentences = plain(letter).split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean);
  const parts = sentences.map((sentence) => oneFact(sentence, quotes)).filter(Boolean);
  if (!parts.length) return "sent a note";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function oneFact(sentence: string, quotes: { used: boolean }): string {
  const s = sentence.trim().replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const ask = /^(can|could|would|will) you (.+)$/i.exec(s);
  if (ask?.[2]) return `asked for ${clipPhrase(ask[2].replace(/^send\s+/i, ""), s)}`;
  const please = /^please (.+)$/i.exec(s);
  if (please?.[1]) return `asked to ${clipPhrase(please[1], s)}`;
  const when = WHEN.exec(s);
  if (/^I (?:can|will)\b/i.test(s) && when?.[1]) return `they could do that ${quoteOnce(when[1], quotes)}`;
  const topic = /\b(the\s+\w+)\b.*\bat\s+(.+?)\s+is\s+(\w+)$/i.exec(s);
  if (topic?.[1] && topic[2] && topic[3]) return `${topic[1].toLowerCase()} was ${topic[3].toLowerCase()} at ${topic[2]}`;
  if (s.split(/\s+/).length >= 6) return clipPhrase(pronounSwap(s), s);
  return lowerFirst(pronounSwap(s));
}

function quoteOnce(when: string, quotes: { used: boolean }): string {
  if (quotes.used || when.split(/\s+/).length > 4) return when;
  quotes.used = true;
  return `"${when}"`;
}

function pronounSwap(sentence: string): string {
  return sentence
    .replace(/^I can\b/i, "they could")
    .replace(/^I will\b/i, "they will")
    .replace(/^I am\b/i, "they are")
    .replace(/^I'm\b/i, "they are")
    .replace(/^I\b/, "they");
}

function clipPhrase(phrase: string, source: string): string {
  const windows = sixGrams(source);
  const words = phrase.split(/\s+/).filter(Boolean);
  const stops = new Set(["once", "just", "really", "please", "that", "the", "a", "an", "to"]);
  const copies = (list: string[]) => windows.some((span) => ` ${list.join(" ").toLowerCase()} `.includes(` ${span} `));
  while (words.length >= 6 && copies(words)) {
    const drop = words.findIndex((word, index) => index > 0 && index < words.length - 1 && stops.has(word.toLowerCase()));
    words.splice(drop > 0 ? drop : Math.floor(words.length / 2), 1);
  }
  return words.join(" ");
}

function outstandingSafe(last: MailLetter): string {
  const body = plain(last);
  const please = /please\s+([^.?!]+)/i.exec(body);
  if (please?.[1]) return `What is still outstanding is ${last.from}'s ask to ${clipPhrase(please[1].trim(), body)}.`;
  if (/\?/.test(body)) return `What is still outstanding is a reply to ${last.from}.`;
  return "Nothing further is waiting in the last note.";
}

function quotedPassages(answer: string): string[] {
  return [...answer.matchAll(/["“]([^"”]+)["”]/g)].map((match) => (match[1] ?? "").trim()).filter(Boolean);
}

function longFragments(answer: string, sources: string[]): string[] {
  const hay = ` ${answer.toLowerCase().replace(/\s+/g, " ")} `;
  const found = new Set<string>();
  for (const source of sources) {
    for (const span of sixGrams(source)) {
      if (hay.includes(` ${span} `)) found.add(span);
    }
  }
  return [...found];
}

function sixGrams(source: string): string[] {
  const words = source.toLowerCase().replace(/[.!?]+/g, " ").split(/\s+/).filter(Boolean);
  const spans: string[] = [];
  for (let i = 0; i + 6 <= words.length; i += 1) spans.push(words.slice(i, i + 6).join(" "));
  return spans;
}

function stripSpans(text: string, sources: string[]): string {
  let out = text;
  for (let pass = 0; pass < 8 && pastedThread(out, sources); pass += 1) {
    const quotes = quotedPassages(out);
    if (quotes.length > 1 || quotes.some((quote) => quote.split(/\s+/).length > 8 || quote.length > 80)) {
      let kept = false;
      out = out.replace(/["“]([^"”]+)["”]/g, (_all, inner: string) => {
        if (kept) return inner;
        const quote = String(inner).trim();
        if (quote.split(/\s+/).length > 8 || quote.length > 80) return quote;
        kept = true;
        return `"${quote}"`;
      });
    }
    const span = longFragments(out, sources)[0];
    if (!span) break;
    const words = span.split(" ");
    const broken = [...words.slice(0, 3), ...words.slice(4)].join(" ");
    out = out.replace(new RegExp(span.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), broken);
  }
  return out;
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
