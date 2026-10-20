/**
 * Adjusting a review reply: length and tone only, applied to the draft as it stands (partner edits included).
 * Pure text work with no model and no stay data, so nothing can be added that the draft or the public review
 * did not already say. Applying the same adjustment twice returns the same text.
 */

import { composeReviewReply, groupsIn, norm, reviewLanguage, sentencesOf, withoutName, checkReviewReply } from "./reviewVoice.js";

export type AdjustKind = "shorter" | "personal" | "friendlier" | "casual" | "professional";
export const ADJUST_KINDS: AdjustKind[] = ["shorter", "personal", "friendlier", "casual", "professional"];
export const ADJUST_LABEL: Record<AdjustKind, string> = {
  shorter: "Shorter",
  personal: "More personal",
  friendlier: "Friendlier",
  casual: "More casual",
  professional: "More professional",
};

export type AdjustResult = { draft: string; changed: boolean; note: string };

const STOP = new Set("that this with have were your what they them then than from about very just also been into over some more when which their there would could should while these those only each".split(" "));

function contentWords(text: string): Set<string> {
  return new Set(norm(text).split(" ").filter((word) => word.length >= 4 && !STOP.has(word)));
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- Shorter ----------

function shorter(draft: string, review: string, name: string): string {
  const sentences = sentencesOf(draft);
  // Already a line or two: shorter would only cut the thank-you or the detail.
  if (sentences.length <= 2 || words(draft) <= 18 || (sentences.length <= 3 && words(draft) <= 45)) return draft;
  const target = Math.max(14, Math.ceil(words(draft) / 2));
  const reviewWords = contentWords(review);
  const opening = sentences[0]!;
  const rest = sentences.slice(1);
  const body = rest.length > 1 ? rest.slice(0, -1) : rest;
  const covered = contentWords(opening);
  const score = (sentence: string) => {
    const mine = contentWords(sentence);
    let fresh = 0;
    for (const word of mine) if (reviewWords.has(word) && !covered.has(word)) fresh += 1;
    return fresh + groupsIn(sentence).size;
  };
  const chosen = new Set<number>();
  let budget = words(opening);
  for (let round = 0; round < 3; round += 1) {
    let best = -1;
    let bestScore = 0;
    body.forEach((sentence, index) => {
      if (chosen.has(index)) return;
      const value = score(sentence);
      if (value > bestScore) {
        best = index;
        bestScore = value;
      }
    });
    if (best < 0) break;
    const length = words(body[best]!);
    // The first detail is always kept; more only while the reply stays near half length.
    if (chosen.size && budget + length > target + 6) break;
    chosen.add(best);
    budget += length;
    for (const word of contentWords(body[best]!)) covered.add(word);
    if (chosen.size >= 2) break;
  }
  if (!chosen.size) chosen.add(0);
  const kept = [opening, ...body.filter((_, index) => chosen.has(index))];
  const text = kept.join(" ");
  // Never lose the guest's name or the thank-you with the opening.
  return withoutName(text, name) ? text : draft;
}

// ---------- Tone ----------

type Swap = [RegExp, string | ((match: string, ...groups: string[]) => string)];

function swapAll(text: string, table: Swap[]): string {
  return table.reduce((out, [pattern, to]) => out.replace(pattern, to as string), text);
}

function keepCase(to: string): (match: string) => string {
  return (match) => (/^[A-Z]/.test(match) ? cap(to) : to);
}

const CASUAL: Swap[] = [
  [/\bThank you so much\b/g, "Thanks so much"],
  [/\bThank you\b(?! for staying)/g, "Thanks"],
  [/\b(We|we) are\b/g, (_m, w) => `${w}'re`],
  [/\b(We|we) would\b/g, (_m, w) => `${w}'d`],
  [/\b(We|we) have\b/g, (_m, w) => `${w}'ve`],
  [/\b(We|we) will\b/g, (_m, w) => `${w}'ll`],
  [/\b(It|it) is\b/g, (_m, w) => `${w}'s`],
  [/\b(That|that) is\b/g, (_m, w) => `${w}'s`],
  [/\b(do|did|does|was|were|would|could|have) not\b/g, (_m, w) => `${w === "will" ? "won" : w}n't`],
  [/\bdelighted\b/gi, keepCase("happy")],
  [/\bthrilled\b/gi, keepCase("happy")],
  [/\bpleased\b/gi, keepCase("glad")],
  [/\bwonderful\b/gi, keepCase("great")],
  [/\bappreciate\b/gi, keepCase("love")],
  [/\bWe look forward to\b/g, "Can't wait for"],
  [/\bPlease let us know\b/g, "Let us know"],
];

const PROFESSIONAL: Swap[] = [
  [/!/g, "."],
  [/ ([!?:;])/g, (_m, mark) => (mark === "!" ? "." : ` ${mark}`)],
  [/\bThanks so much\b/g, "Thank you very much"],
  [/\bThanks\b(?= (?:for|again|Name))/g, "Thank you"],
  [/\bThanks ([A-ZÀ-Ý][\p{L}'’-]+)\b/gu, "Thank you $1"],
  [/\bThanks\b(?=\.|,)/g, "Thank you"],
  [/\b(We|we)'re\b/g, (_m, w) => `${w} are`],
  [/\b(We|we)'d\b/g, (_m, w) => `${w} would`],
  [/\b(We|we)'ve\b/g, (_m, w) => `${w} have`],
  [/\b(We|we)'ll\b/g, (_m, w) => `${w} will`],
  [/\b(It|it)'s\b/g, (_m, w) => `${w} is`],
  [/\b(That|that)'s\b/g, (_m, w) => `${w} is`],
  [/\b(do|did|does|was|were|would|could|have)n't\b/g, (_m, w) => `${w} not`],
  [/\bso glad\b/gi, keepCase("pleased")],
  [/\bdelighted\b/gi, keepCase("pleased")],
  [/\bthrilled\b/gi, keepCase("pleased")],
  [/\bLovely to hear\b/g, "Good to hear"],
  [/\bso happy\b/gi, keepCase("pleased")],
];

const FRIENDLIER_WORDS: Swap[] = [
  [/\b(We're|we're|We are|we are) (?!so |really |truly )(glad|happy|delighted|pleased)\b/g, (_m, lead, adj) => `${lead} so ${adj}`],
  [/\b(Glad|Happy|Pleased)\b(?= (?:the|that|you|to)\b)/g, (_m, adj) => `So ${adj.toLowerCase()}`],
];

function friendlier(draft: string): string {
  let sentences = sentencesOf(draft);
  if (!sentences.length) return draft;
  // Warmer words, then an exclamation on the opening and the closing (never every sentence).
  sentences = sentences.map((sentence) => swapAll(sentence, FRIENDLIER_WORDS));
  const mark = (index: number) => {
    const sentence = sentences[index];
    if (sentence && /[.]$/.test(sentence) && !/\bsorry|désol/i.test(sentence)) sentences[index] = `${sentence.slice(0, -1)}!`;
  };
  mark(0);
  if (sentences.length > 2) mark(sentences.length - 1);
  return sentences.join(" ");
}

const FRENCH_TONE: Record<string, (text: string) => string> = {
  friendlier: (text) => text.replace(/^([^!?]*?) ?\.(\s|$)/, "$1 !$2"),
  professional: (text) => text.replace(/ !/g, "."),
};

// ---------- More personal ----------

function personal(draft: string, review: string, guest: string, stars: number, french: boolean): string {
  const name = guest.trim().split(/\s+/)[0] || "";
  if (!name) return draft;
  const thanks = french ? "Merci" : "Thanks";
  const excl = french ? " !" : "!";
  const sentences = sentencesOf(draft);
  if (!sentences.length) return draft;
  const first = sentences[0]!;
  const n = escape(name);
  const warm = new RegExp(`^(?:Thanks|Merci|Thank you|Un grand merci|Merci beaucoup)[ ,]+(?:so much |beaucoup )?${n}\\s*(?:!|\\u00a0!)`, "i");
  let opening = first;
  if (warm.test(first) || new RegExp(`^(?:Thanks|Merci)\\s+${n}\\b`, "i").test(first) && /[!]$/.test(first)) {
    opening = first;
  } else {
    const stiff = new RegExp(`^${n},\\s*(.+)$`, "i").exec(first);
    const thankName = new RegExp(`^(?:Thank you|Thanks|Merci)(?: so much| beaucoup)?,?\\s+${n}[,.!]?\\s*(.*)$`, "i").exec(first);
    const rest = stiff?.[1] ?? thankName?.[1] ?? "";
    if (stiff || thankName) {
      if (/^(for|pour|d')/i.test(rest)) opening = `${thanks} ${name} ${rest}`;
      else opening = rest ? `${thanks} ${name}${excl} ${cap(rest)}` : `${thanks} ${name}${excl}`;
    } else if (!new RegExp(`\\b${n}\\b`, "i").test(draft)) {
      opening = `${thanks} ${name}${excl} ${first}`;
    }
  }
  const out = [opening, ...sentences.slice(1)];
  // Lean on what this guest said: if nothing in the reply echoes the review, add one line made from the review's own words.
  const reviewWords = contentWords(review);
  const echoes = [...contentWords(out.join(" "))].filter((word) => reviewWords.has(word)).length;
  if (!echoes && stars >= 4) {
    const composed = composeReviewReply({ guest, review, stars, language: french ? { code: "fr", name: "French" } : { code: "en", name: "English" } });
    const detail = composed ? sentencesOf(composed.reply).find((sentence, index) => index > 0 && composed.details.some((item) => sentence.includes(item))) : "";
    if (detail) out.splice(1, 0, detail);
  }
  return out.join(" ");
}

// ---------- Entry ----------

/** The draft after one adjustment, or the draft itself, with a note, when the adjustment can't be applied safely. */
export function adjustDraft(input: { draft: string; review: string; guest: string; stars: number; kind: AdjustKind }): AdjustResult {
  const draft = input.draft.replace(/\s+/g, " ").trim();
  if (!draft) return { draft: input.draft, changed: false, note: "There is no draft to adjust." };
  const language = reviewLanguage(input.review);
  const french = language.code === "fr";
  if (language.code === "other") return { draft: input.draft, changed: false, note: `This review is in ${language.name}. Adjust the reply by hand.` };
  const name = input.guest.trim().split(/\s+/)[0] ?? "";
  let next = draft;
  switch (input.kind) {
    case "shorter": next = shorter(draft, input.review, name); break;
    case "personal": next = personal(draft, input.review, input.guest, input.stars, french); break;
    case "friendlier": next = french ? FRENCH_TONE.friendlier!(draft) : friendlier(draft); break;
    case "casual": next = french ? draft : swapAll(draft, CASUAL); break;
    case "professional": next = french ? FRENCH_TONE.professional!(draft) : swapAll(draft, PROFESSIONAL); break;
  }
  next = next.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, french ? "$1" : "$1").trim();
  if (next === draft) return { draft: input.draft, changed: false, note: input.kind === "shorter" ? "Already short. Nothing to cut." : "Already reads that way." };
  // The grounding rules still hold: nothing the current draft didn't already say, no private word, no em dash, one name.
  const before = groupsIn(draft);
  for (const group of groupsIn(next)) if (!before.has(group) && !groupsIn(input.review).has(group)) return { draft: input.draft, changed: false, note: "That change would add a detail. Draft unchanged." };
  const after = checkReviewReply({ reply: next, review: input.review, guest: input.guest });
  const was = checkReviewReply({ reply: draft, review: input.review, guest: input.guest });
  if (was.ok && !after.ok) return { draft: input.draft, changed: false, note: `Draft unchanged. ${after.problems[0] ?? ""}`.trim() };
  if (input.kind === "shorter" && words(next) >= words(draft)) return { draft: input.draft, changed: false, note: "Already short. Nothing to cut." };
  return { draft: next, changed: true, note: `Adjusted: ${ADJUST_LABEL[input.kind]}.` };
}
