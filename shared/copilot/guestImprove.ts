/**
 * "Improve" on a partner's own guest reply: a rewrite for quality, not a proofread.
 *
 * Clearer, warmer, complete sentences, well structured, the guest's points answered in the order the guest raised them.
 *
 * Hard limits, enforced here and checked against any model's rewrite too:
 *  - every fact, date, time, price, number, code and decision in the partner's text is kept exactly;
 *  - nothing new is added: no commitment, offer, fact or apology the partner didn't write, and no softening or hedging;
 *  - if the partner's text leaves part of the guest's message unanswered, nothing is invented; one plain line names it;
 *  - a draft that is already clean and complete comes back near-identical, never padded.
 *
 * Pure and browser-safe. Nothing here sends anything.
 */

import { isThanksOnly, needsGuestReply } from "./guestTranslate.js";

const SHORTHAND: [RegExp, string][] = [
  [/\b(?:pls|plz|pleaze)\b/gi, "please"],
  [/\bu\b/gi, "you"],
  [/\bur\b/gi, "your"],
  [/\b(?:thx|thnx|tnx|ty)\b/gi, "thanks"],
  [/\bim\b/gi, "I'm"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bisnt\b/gi, "isn't"],
  [/\bya\b/gi, "you"],
  [/\br\b/gi, "are"],
  [/\bb4\b/gi, "before"],
  [/\b(?:cuz|cos)\b/gi, "because"],
  [/\b(?:tmrw|tmr)\b/gi, "tomorrow"],
  [/\brn\b/gi, "right now"],
  [/\bgonna\b/gi, "going to"],
  [/\bwanna\b/gi, "want to"],
  [/\bw\/\s?/gi, "with "],
  [/\bok\b/gi, "okay"],
  [/\bwi-?fi\b/gi, "Wi-Fi"],
  [/\bi\b/g, "I"],
  // A parking spot or locker code: p4 is P4.
  [/\b[pP](\d{1,2})\b/g, "P$1"],
];

/** Words that begin a new point inside a run-on ("unit ready at 4 parking is the p4 spot code comes by email"). */
const STARTERS = /\b(parking|door code|lockbox code|the code|code|wi-?fi|password|check-?in|check in|check-?out|check out|checkout|keys?|lockbox|towels|elevator|garbage|trash|laundry|let me know|please|also|thanks|thank you|see you|enjoy|welcome|you can|you will|you'll|we can|we will|we'll|reach out|text me|call me)\b/gi;
const DETERMINERS = new Set(["the", "a", "an", "your", "my", "our", "his", "her", "their", "door", "entry", "front", "lock", "building", "main", "unit", "parking", "this", "that", "and", "or", "to", "at", "in", "on", "for", "of", "is", "are", "by", "with", "early", "late", "do", "did", "have", "get", "need", "want", "can", "will", "but", "no", "yes"]);
const CLOSING = /^(?:please )?(?:let me know|reach out|text me|call me)|^(?:thanks|thank you|see you|enjoy|welcome)\b/i;

/** Words that would make a message sound different: commitments, offers, apologies, hedges. A rewrite may not introduce any. */
const COMMITMENT = /\b(sorry|apolog\w*|unfortunately|we'?ll|we will|i'?ll|i will|happy to|glad to|offer|offering|free of charge|complimentary|refund|discount|guarantee|promise|definitely|certainly|absolutely|of course|rest assured|don'?t worry)\b/gi;
const HEDGE = /\b(maybe|perhaps|hopefully|might|possibly|try to|should be|i think|i believe|if possible|if we can|we'?ll try|subject to|as long as|depending)\b/gi;
const NEGATION = /\b(no|not|never|cannot|without|none|nothing)\b|n't\b/gi;

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9$']+/g) ?? [];
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

/**
 * The facts a rewrite must keep exactly: anything with a digit as one whole token ("4", "p4", "2pm", "$50", "1234"), a month
 * written before a day, and the words that name a day or moment (tomorrow, Friday, noon).
 */
const FACT_TOKEN = /[A-Za-z$]*\d[\w:.,$%-]*|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?=\.?\s*\d)|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|noon|midnight)\b/gi;

function numbersIn(text: string): string[] {
  return (text.match(FACT_TOKEN) ?? []).map((value) => value.toLowerCase().replace(/[.,:;]+$/, ""));
}

function matches(text: string, pattern: RegExp): string[] {
  return (text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) ?? []).map((value) => value.toLowerCase());
}

// ---------- What a draft is already ----------

const SHORT_TOKEN = /(?:^|[\s,.;:!?])(?:u|ur|pls|plz|thx|thnx|ty|im|dont|cant|wont|r|b4|cuz|rn|gonna|wanna|ya)(?=[\s,.;:!?]|$)/i;
const LOWER_I = /(?:^|\s)i(?=\s|'|$)/;
const LOWER_CODE = /\b[p]\d{1,2}\b/;

/**
 * Already clean and complete: a greeting set off by punctuation, every sentence capitalised and finished, no shorthand,
 * no run-on. Such a draft is returned as it is.
 */
export function isCleanDraft(text: string): boolean {
  const source = text.trim();
  if (!source) return false;
  if (SHORT_TOKEN.test(source) || LOWER_I.test(source) || LOWER_CODE.test(source) || /\bwifi\b/i.test(source)) return false;
  const greeting = /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b/i.exec(source);
  // "Hi Rebecca," is a greeting; "Hey Husson quick reminder ..." is a name running into the message.
  if (greeting && !/^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))(?:\s+[A-Za-z][\w'-]*)?\s*[,!:\n]/i.test(source) && !/^(?:hi|hello|hey)\s*[!.,]/i.test(source)) return false;
  for (const sentence of sentencesOf(source)) {
    if (/^[a-z]/.test(sentence)) return false;
    if (!/[.!?:,)"”']$/.test(sentence)) return false;
    if (sentence.split(/\s+/).length > 32) return false;
  }
  return true;
}

// ---------- The rewrite, with no model ----------

function splitRunOn(sentence: string): string[] {
  const bare = sentence.trim().replace(/[.!]+$/, "");
  if (/[,;:?.!]/.test(bare) || bare.split(/\s+/).length < 9) return [sentence.trim()];
  const parts: string[] = [];
  let start = 0;
  const found = [...bare.matchAll(new RegExp(STARTERS.source, "gi"))];
  for (const match of found) {
    const at = match.index ?? 0;
    if (at === 0) continue;
    const before = bare.slice(start, at).trim();
    const beforeWords = before.split(/\s+/).filter(Boolean);
    if (beforeWords.length < 2) continue;
    const lastWord = (beforeWords[beforeWords.length - 1] ?? "").toLowerCase();
    // Not after a determiner, a verb waiting for its object, or a time ("2pm check in" is one phrase).
    if (DETERMINERS.has(lastWord)) continue;
    // "2pm check in" is one phrase, but "ready at 4 parking is..." is two points.
    if (/^check/i.test(match[0]) && /^\d/.test(lastWord)) continue;
    parts.push(before);
    start = at;
  }
  parts.push(bare.slice(start).trim());
  return parts.filter(Boolean);
}

function expand(text: string): string {
  let spoken = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SHORTHAND) spoken = spoken.replace(pattern, replacement as string);
  // "2pm check in", "the check in", "early check in" are nouns: check-in, check-out.
  spoken = spoken
    .replace(/\b((?:early|late|the|a|your|our|\d{1,2}(?::\d{2})?\s?(?:am|pm))\s)check in\b/gi, "$1check-in")
    .replace(/\b((?:early|late|the|a|your|our|\d{1,2}(?::\d{2})?\s?(?:am|pm))\s)check out\b/gi, "$1check-out");
  return spoken;
}

/** One clause as a finished sentence, repairing only what is plainly missing (an article, an "is") and adding no facts. */
function sentenceFrom(clause: string): string {
  let text = clause.trim().replace(/[,;]+$/, "");
  const unit = /^(unit|apartment|apt|place|condo|room|house)\s+(ready|clean|set|good|available)\b(.*)$/i.exec(text);
  if (unit) text = `Your ${unit[1]!.toLowerCase()} is ${unit[2]!.toLowerCase()}${unit[3]}`;
  else if (/^(?:door |lockbox |entry |building )?code\s+(?:comes?|is|are|will|gets?)\b/i.test(text) || /^(?:wi-?fi )?password\s+(?:is|are)\b/i.test(text)) text = `The ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  else if (/^let me know\b/i.test(text)) text = `Please ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  // "yes we can do 2pm" is "Yes, we can do 2pm"; a long clause with "but" in it gets its comma.
  text = text.replace(/^(yes|yep|yeah|sure|okay)\s+(?=[a-z])/i, (_m, word: string) => `${word}, `).replace(/(\w)\s+(but)\s+(?=\w)/i, "$1, $2 ");
  text = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

const TOPICS: [string, RegExp][] = [
  ["arrival", /\b(arriv\w*|early|hour before|check-?in|get in|land\w*|flight|\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i],
  ["checkout", /\b(check-?out|leave|leaving|late)\b/i],
  ["parking", /\b(park\w*|spot|garage|vehicle|plate|car)\b/i],
  ["allergy", /\b(allerg\w*|gluten|diet\w*|snacks?|vegan|vegetarian|lactose|intoleran\w*)\b/i],
  ["wifi", /\b(wi-?fi|internet|password)\b/i],
  ["code", /\b(code|keys?|lockbox|fob|access)\b/i],
  ["towels", /\b(towels?|linens?|sheets?|pillows?|blankets?)\b/i],
  ["groceries", /\b(groceries|grocery|food|fridge)\b/i],
];
const TOPIC_NAMES: Record<string, string> = {
  arrival: "the arrival time", checkout: "the checkout", parking: "the parking", allergy: "the allergy", wifi: "the Wi-Fi", code: "the code or keys", towels: "the towels or linens", groceries: "the groceries",
};

function topicsOf(text: string): Set<string> {
  return new Set(TOPICS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id));
}

/** The guest's own points, in the order they raised them: only sentences that ask, request, report or inform. */
function guestPoints(message: string): string[] {
  return sentencesOf(message).filter((sentence) => !isThanksOnly(sentence) && needsGuestReply(sentence));
}

/** Answers in the order the guest raised the points. Only matched sentences move, and only among their own places. */
function inGuestOrder(sentences: string[], guestMessage: string): string[] {
  const points = guestPoints(guestMessage).map(topicsOf);
  if (points.length < 2) return sentences;
  const rank = sentences.map((sentence) => {
    const mine = topicsOf(sentence);
    return points.findIndex((point) => [...mine].some((topic) => point.has(topic)));
  });
  const matched = rank.map((value, index) => ({ value, index })).filter((row) => row.value >= 0);
  if (matched.length < 2 || new Set(matched.map((row) => row.value)).size !== matched.length) return sentences;
  const order = [...matched].sort((a, b) => a.value - b.value);
  const out = [...sentences];
  matched.forEach((slot, i) => { out[slot.index] = sentences[order[i]!.index]!; });
  return out;
}

export function rewriteDraft(text: string, options: { first?: string; guestMessage?: string } = {}): string {
  const source = text.trim();
  if (!source) return "";
  if (isCleanDraft(source)) return source;
  let body = source;
  // The greeting: kept if the partner wrote one, a name added if there is one, otherwise "Hi there".
  let name = options.first?.trim().split(/\s+/)[0] ?? "";
  const greet = /^\s*(?:hi|hello|hey|hiya|dear|good (?:morning|afternoon|evening))\b[\s,!.:-]*/i.exec(body);
  if (greet) {
    body = body.slice(greet[0].length);
    const named = /^(ya|there|guys|everyone|all)\b[\s,!.:-]*/i.exec(body);
    if (named) body = body.slice(named[0].length);
    else if (name && new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s,!.:-]*`, "i").test(body)) {
      body = body.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s,!.:-]*`, "i"), "");
    } else {
      const proper = /^([A-Z][a-z'-]{1,20})\b(?=[\s,!.:-]|$)[\s,!.:-]*/.exec(body);
      const second = body.slice(proper?.[0].length ?? 0).trim();
      // "Hey Husson quick reminder ...": a capitalised first word before more words is the guest's name.
      if (proper && !name && second) {
        name = proper[1]!;
        body = body.slice(proper[0].length);
      } else if (proper && name && proper[1]!.toLowerCase() === name.toLowerCase()) body = body.slice(proper[0].length);
    }
  }
  const sentences: string[] = [];
  for (const raw of sentencesOf(expand(body))) for (const clause of splitRunOn(raw)) sentences.push(sentenceFrom(clause));
  const ordered = options.guestMessage ? inGuestOrder(sentences, options.guestMessage) : sentences;
  const closing = ordered.filter((sentence) => CLOSING.test(sentence));
  const main = ordered.filter((sentence) => !CLOSING.test(sentence));
  const paragraphs = [`Hi ${name || "there"},`, main.join(" "), closing.join(" ")].filter(Boolean);
  return paragraphs.join("\n\n");
}

// ---------- What is still unanswered ----------

const STOP = new Set(["about", "would", "could", "there", "their", "which", "where", "thanks", "thank", "please", "really", "other", "these", "those", "while", "after", "before", "should", "still", "think", "going", "have", "that", "this", "with", "your", "from", "what", "when", "will", "does", "been", "they", "them", "some", "also", "more", "very", "just", "like", "want", "need", "know", "tell", "come", "here", "much", "many", "able", "once", "does", "were", "then"]);

/**
 * One plain line naming what the guest raised that the draft doesn't address, or "". Nothing is answered for the partner.
 */
export function unansweredLine(guestMessage: string, draft: string): string {
  if (!guestMessage.trim()) return "";
  const covered = topicsOf(draft);
  const draftWords = new Set(words(draft));
  const missing: string[] = [];
  for (const point of guestPoints(guestMessage)) {
    const topics = topicsOf(point);
    if (topics.size) {
      if ([...topics].some((topic) => covered.has(topic))) continue;
      const name = TOPIC_NAMES[[...topics][0]!] ?? "that";
      if (!missing.includes(name)) missing.push(name);
      continue;
    }
    const key = words(point).filter((word) => word.length >= 4 && !STOP.has(word));
    if (!key.length || key.some((word) => draftWords.has(word))) continue;
    missing.push(`“${point.replace(/\s+/g, " ").slice(0, 60)}${point.length > 60 ? "…" : ""}”`);
  }
  if (!missing.length) return "";
  const shown = missing.slice(0, 3).join(", ");
  return `Still unanswered: ${shown}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}.`;
}

// ---------- Checking a model's rewrite ----------

/** Reasons a rewrite may not replace the partner's text. Empty means it keeps every fact and adds nothing. */
export function improvementProblems(original: string, candidate: string): string[] {
  const problems: string[] = [];
  const had = new Set(numbersIn(original));
  const has = new Set(numbersIn(candidate));
  for (const fact of had) if (!has.has(fact)) problems.push(`dropped "${fact}"`);
  for (const fact of has) if (!had.has(fact)) problems.push(`added "${fact}"`);
  for (const link of original.match(/https?:\/\/\S+/g) ?? []) if (!candidate.includes(link)) problems.push("dropped a link");
  const before = new Set(matches(original, COMMITMENT));
  for (const word of matches(candidate, COMMITMENT)) if (!before.has(word)) problems.push(`added "${word}", a commitment, offer or apology the partner didn't write`);
  const hedged = new Set(matches(original, HEDGE));
  for (const word of matches(candidate, HEDGE)) if (!hedged.has(word)) problems.push(`added "${word}", which softens what the partner decided`);
  if (matches(candidate, NEGATION).length < matches(original, NEGATION).length) problems.push("dropped a no, a not or a can't");
  // A run-on holds several points: count them by length, not by full stops, so a proper rewrite isn't called padding.
  const points = Math.max(sentencesOf(original).length, Math.ceil(words(original).length / 5));
  if (sentencesOf(candidate).length > points + 1 || words(candidate).length > words(original).length * 1.8 + 14) problems.push("padded the message");
  return problems;
}
