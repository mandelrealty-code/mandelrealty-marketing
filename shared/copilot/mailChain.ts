/**
 * A breakdown of an email chain is a short narrative of who said what, in order,
 * and what is still outstanding. The message bodies are not pasted.
 * Search ids and thread ids both open it. A failed message open reads the thread.
 */

import { readMailThread, searchMail, type MailHit, type MailLetter } from "./mailSearch.js";

const BREAKDOWN = /\bbreak\s*down\b/i;
const CHAIN = /\b(e-?mails?|chains?|threads?)\b/i;
const RETELL = /\b(break\s*down|breakdown|summar(?:y|ise|ize)|recap|rundown|run-down|run me through|walk me through|catch me up|go over|fill me in)\b/i;
const THREAD = /\b(chains?|threads?|conversation)\b/i;
const WITH_PERSON = /\b(?:e-?mails?|messages?|notes?)\b[^.?!]*\b(?:with|from|between|to)\s+[A-Z][\w'.-]+/;

/**
 * "Break down the email chain with Manik", "Summarize the thread with Manik", "Recap my emails with Manik".
 * Every wording goes to the same composer, and the stored reply is recomposed, so no path pastes the thread.
 * Inbox questions ("summarize today's emails") stay with the inbox answer.
 */
export function asksMailBreakdown(text: string): boolean {
  if (BREAKDOWN.test(text) && CHAIN.test(text)) return true;
  if (!RETELL.test(text)) return false;
  if (/\b(today|inbox|new e-?mails?|unread)\b/i.test(text)) return false;
  return (THREAD.test(text) && CHAIN.test(text)) || WITH_PERSON.test(text);
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

/** The message's own words: quoted history, forwarded headers, signatures, and markup removed. */
export function ownWords(text: string): string {
  const kept: string[] = [];
  for (const raw of text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^>/.test(line)) continue;
    if (/^On .{4,200} wrote:?$/i.test(line) || /^-{2,}\s*(?:Original|Forwarded) Message/i.test(line) || /^From:\s.+/i.test(line) || /^_{5,}$/.test(line)) break;
    if (/^--\s*$/.test(line) || /^Sent from my\b/i.test(line) || /^Get Outlook for\b/i.test(line)) break;
    if (/^(?:thanks|thank you|many thanks|best|best regards|kind regards|regards|cheers|sincerely|warmly)[,.!]?$/i.test(line)) break;
    kept.push(line);
  }
  return kept.join(" ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function plain(letter: MailLetter): string {
  return ownWords(letter.body || letter.snippet);
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
export function breakdownFrom(letters: MailLetter[], who = ""): string {
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
  const raw = ordered.map((letter) => letter.body || "");
  const points = pointsBreakdown(ordered, who);
  // The clause narrative works for short notes. A long business thread is told from its points.
  if (!pastedThread(shaped, sources) && !pastedThread(shaped, raw) && carries(shaped, points)) return shaped;
  if (!pastedThread(points, sources) && !pastedThread(points, raw)) return points;
  return thinned(points, [...sources, ...raw]);
}

const NUMBER = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:-|–|to)\s?\$?\d[\d,]*(?:\.\d+)?)?|\b\d+(?:\.\d+)?\s?(?:%|percent\b)|\b\d{1,3}(?:,\d{3})+\b/gi;
const AGREE = /\b(comfortable|agree|agreed|happy (?:to|with)|fine with|works for (?:me|us)|sounds good|on board|move forward|moving forward|go ahead|approve|accept)\b/i;
const ASK = /\?|^\s*(?:can|could|would|will) you\b|\bplease\b|\blet me know\b|\bneed you to\b/i;
const COMMIT = /\b(?:i|we)(?:'ll| will| can| would)\b|\bi'?ll\b|\bwe'?ll\b/i;
const DOMAIN = /\b(commission|fee|fees|tax|taxes|booking\.com|airbnb|vrbo|photo\w*|clean\w*|payout|invoice|contract|agreement|rate|rates|tier\w*|benchmark|owner|percent|revenue|deposit|insurance|furnish\w*|listing)\b/i;
const STOP = new Set(("a an the to of but so that this these those it its is are was were be been being i i'm im i'd i'll we we'd we'll we're you you'd you'll your yours our ours my me us just really also actually basically honestly would will can could should please thanks thank here's here there's there then which what one thing like let know am do does did have has had get got go going want wanted think sure okay ok hi hello hey regards cheers best ahead").split(" "));
const KEY = /\d|commission|fee|tax|occupancy|cleaning|booking\.com|airbnb|vrbo|photo|benchmark|revenue|rate|tier|payout|agreement|owner|percent/i;

function numbersIn(text: string): string[] {
  return [...new Set([...text.matchAll(NUMBER)].map((match) => match[0].replace(/\s+/g, " ").trim()))];
}

/** The content of a sentence without its filler words. Numbers and names stay exact. */
function gist(sentence: string): string {
  const words = sentence.replace(/[“”"]/g, "").replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
  const kept = words
    .filter((word) => {
      const bare = word.toLowerCase().replace(/[^a-z'.]/g, "");
      return /\d/.test(word) || !STOP.has(bare);
    })
    .map((word) => word.replace(/^myself\b/i, "themselves").replace(/^ourselves\b/i, "themselves"));
  return kept.join(" ").replace(/,\s*$/, "").replace(/\s+,/g, ",").trim();
}

type Point = { kind: "agree" | "ask" | "commit" | "state"; text: string; numbers: string[] };

function pointsOf(letter: MailLetter): Point[] {
  const points: Point[] = [];
  for (const sentence of plain(letter).split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean)) {
    const numbers = numbersIn(sentence);
    const kind: Point["kind"] = AGREE.test(sentence) ? "agree" : ASK.test(sentence) ? "ask" : COMMIT.test(sentence) ? "commit" : "state";
    if (kind === "state" && !numbers.length && !DOMAIN.test(sentence)) continue;
    const text = gist(sentence);
    if (text.split(/\s+/).length < 2) continue;
    if (!numbers.length && !DOMAIN.test(sentence) && text.split(/\s+/).length <= 3) continue;
    points.push({ kind, text, numbers });
  }
  return points;
}

function said(point: Point): string {
  if (point.kind === "agree") return `agreed: ${point.text}`;
  if (point.kind === "ask") return `asked: ${point.text}`;
  if (point.kind === "commit") return `committed: ${point.text}`;
  return point.text;
}

/**
 * What each side actually said, from the messages' content: agreements, asks, commitments,
 * and the numbers on the table, then what is still open. Never metadata alone, never pasted.
 */
export function pointsBreakdown(letters: MailLetter[], who = ""): string {
  const ordered = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return "I didn't find that email chain. I didn't guess.";
  const needle = who.trim().toLowerCase();
  const isThem = (letter: MailLetter) => needle ? `${letter.from} ${letter.email ?? ""}`.toLowerCase().includes(needle) : letter.from === first.from;
  const them = ordered.filter(isThem);
  const us = ordered.filter((letter) => !isThem(letter));
  const name = them[0]?.from || who || first.from;
  const side = (rows: MailLetter[], label: string) => {
    const points = rows.flatMap(pointsOf);
    if (!points.length) return "";
    const numbers = [...new Set(points.flatMap((point) => point.numbers))];
    const body = points.map(said).join("; ");
    return `${label} ${body}.${numbers.length ? ` Numbers on the table: ${numbers.join(", ")}.` : ""}`;
  };
  const theirs = side(them, `${name}:`);
  const ours = side(us, `${us[0]?.from || "Our side"}:`);
  const lastPoints = pointsOf(last);
  const open = lastPoints.filter((point) => point.kind === "ask" || point.kind === "commit");
  const still = open.length
    ? `Still open: ${open.map((point) => `${last.from} ${point.kind === "ask" ? "asked" : "committed"}: ${point.text}`).join("; ")}.`
    : `Nothing further is waiting in ${last.from}'s last message (${dayOf(last.date)}).`;
  return [theirs || `${name} wrote on ${dayOf(first.date)} about ${topicOf(ordered)}.`, ours, still].filter(Boolean).slice(0, 3).join("\n\n");
}

/** The clause narrative keeps every number the points found, or it is not used. */
function carries(narrative: string, points: string): boolean {
  return numbersIn(points).every((number) => narrative.includes(number));
}

/** Last resort: drop a word from any copied six-word span until nothing is pasted. Numbers stay. */
function thinned(text: string, sources: string[]): string {
  let out = text;
  for (let pass = 0; pass < 40 && pastedThread(out, sources); pass += 1) {
    const span = longFragments(out, sources)[0];
    if (!span) break;
    const words = span.split(" ");
    const plainWord = words.findIndex((word, index) => index > 0 && !KEY.test(word));
    const drop = plainWord > 0 ? plainWord : words.findIndex((word, index) => index > 0 && !/\d/.test(word));
    const cut = [...words.slice(0, Math.max(1, drop)), ...words.slice(Math.max(1, drop) + 1)].join(" ");
    out = out.replace(new RegExp(span.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), cut);
  }
  return out;
}

function topicOf(letters: MailLetter[]): string {
  const subject = letters.map((letter) => letter.subject.replace(/^(?:\s*(?:re|fwd?|fw)\s*:\s*)+/i, "").trim()).find(Boolean) ?? "";
  return subject ? `“${subject}”` : "the thread";
}

function dayOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
}

/** A breakdown built from who wrote, when, and the subject. No sentence from a body is used. */
export function factsOnly(letters: MailLetter[]): string {
  const ordered = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return "I didn't find that email chain. I didn't guess.";
  const people = [...new Set(ordered.map((letter) => letter.from).filter(Boolean))];
  const opening = `${first.from} started the thread about ${topicOf(ordered)} on ${dayOf(first.date)}.`;
  const middle = ordered.length > 2
    ? `${ordered.length - 2} ${ordered.length - 2 === 1 ? "reply" : "replies"} followed between ${people.join(" and ")}.`
    : ordered.length === 2 ? `${last.from} replied on ${dayOf(last.date)}.` : "";
  const body = plain(last);
  const ending = /\bplease\b|\?/i.test(body)
    ? `The last message is from ${last.from} on ${dayOf(last.date)}, and it is waiting on an answer.`
    : `The last message is from ${last.from} on ${dayOf(last.date)}, and nothing further is waiting in it.`;
  return [`${opening}${middle ? ` ${middle}` : ""}`, ending].join("\n\n");
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
  return (await modelBreakdown(letters, keywords).catch(() => null)) ?? breakdownFrom(letters, keywords);
}

type ChainModel = (prompt: string) => Promise<string>;
let chainModel: ChainModel | null | undefined;

/** Tests set the composer. Undefined uses Claude when the key is set. */
export function setChainModel(next: ChainModel | null | undefined): void {
  chainModel = next;
}

async function claudeCompose(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, temperature: 0, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return "";
    const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A model writes the breakdown from the messages' own words. It is used only when it is two or
 * three paragraphs, pastes nothing, names a person in the thread, and every number in it is in the thread.
 */
export async function modelBreakdown(letters: MailLetter[], who = ""): Promise<string | null> {
  const call = chainModel === undefined ? (process.env.ANTHROPIC_API_KEY?.trim() ? claudeCompose : null) : chainModel;
  if (!call) return null;
  const ordered = [...letters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const thread = ordered.map((letter) => `From ${letter.from} on ${dayOf(letter.date)}:\n${plain(letter)}`).join("\n\n");
  const prompt = [
    `Break down this email thread${who ? ` with ${who}` : ""} for a busy property manager in two or three short paragraphs.`,
    "Say what each person actually asked for, agreed to, or committed to, with every number on the table (rates, percentages, dollar amounts, dates), and end with what is still open.",
    "Write it in your own words. Do not quote or copy sentences from the emails. Do not add any number, name, or fact that is not in the emails.",
    "Plain text, no headings, no bullets.",
    "",
    thread,
  ].join("\n");
  const text = (await call(prompt)).trim();
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/).map((row) => row.trim()).filter(Boolean);
  const sources = [...ordered.flatMap((letter) => [plain(letter), letter.snippet]), ...ordered.map((letter) => letter.body || "")];
  const known = numbersIn(sources.join("\n")).map((number) => number.replace(/[\s$,]/g, ""));
  const invented = numbersIn(text).some((number) => !known.some((row) => row.includes(number.replace(/[\s$,]/g, "")) || number.replace(/[\s$,]/g, "").includes(row)));
  const named = ordered.some((letter) => letter.from && text.includes(letter.from));
  if (paragraphs.length < 2 || paragraphs.length > 3 || pastedThread(text, sources) || invented || !named) return null;
  return paragraphs.join("\n\n");
}
