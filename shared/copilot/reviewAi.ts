/**
 * Review replies and low-star assessments, written by a model from the whole stay: the review, the
 * guest's private feedback, every message in the conversation, the reservation and the Knowledge Hub.
 *
 * Nothing here posts, files or sends anything. A 4 or 5-star review gets a reply draft; a review of
 * 3 stars or fewer is flagged to the team with an assessment, a checked list of evidence, a
 * retaliatory-review check against Airbnb's Reviews Policy, a removal request to file by hand, and a
 * calm public reply draft. Every word waits for a partner to edit and press Submit (or to file it).
 */

import { createHash } from "node:crypto";
import { parityEnabled } from "./parity/flag.js";
import { listPrefixedStamps, readPrefixedRow, writePrefixedRow } from "./store.js";
import { withoutEmDashes } from "./guestTranslate.js";
import type { ReviewFact } from "./reviewTypes.js";
import { checkReviewReply, composeReviewReply, critiquesIn, maxWordsFor, newVoiceMemory, praisesIn, rememberReply, reviewLanguage, tierOf, type VoiceMemory } from "./reviewVoice.js";

export type ReviewAiInput = {
  guest: string;
  stars: number;
  review: string;
  privateFeedback: string;
  property: string;
  messages: { role: "guest" | "host" | "system"; body: string }[];
  reservation: string;
  hub: string;
  /** The first words of replies already drafted, so this one opens differently. */
  /** The openings and closings already used by other replies in this queue. */
  memory?: VoiceMemory;
};

export type ReviewAssessment = {
  /** One line for the flag: what happened and what to do. */
  headline: string;
  /** The review's claims against the record, each quoting the conversation or the reservation. */
  facts: ReviewFact[];
  /** "likely", "possible" or "no", with the reason and the guest's own words when likely. */
  retaliation: { level: "likely" | "possible" | "no"; why: string; quotes: string[] };
  /** A request to Airbnb to remove the review, for a partner to file by hand. Empty when there are no grounds. */
  removalRequest: string;
  /** A calm public reply, as a draft. */
  reply: string;
};

export type ReviewAiResult = { kind: "reply"; reply: string } | { kind: "flag"; assessment: ReviewAssessment };

/**
 * "Thank you, Kahina, for the review" reads "Thank you Kahina for the review": no commas around the
 * guest's name after the thanks. Names joined by "and" or "&" are kept together.
 */
/** The first few words of a reply, to keep later replies from opening the same way. */
export function openingOf(text: string): string {
  return text.trim().split(/\s+/).slice(0, 5).join(" ");
}

export function thanksByName(text: string): string {
  return text.replace(
    /^(\s*(?:Thank you(?: so much)?|Thanks(?: so much)?|Merci(?: beaucoup)?)),\s+((?:\p{Lu}[\p{L}'\u2019-]*)(?:\s+(?:and|&|et)\s+\p{Lu}[\p{L}'\u2019-]*)?)(,\s*|(?=[.!?\s]))/u,
    (_all, thanks: string, name: string, after: string) => `${thanks} ${name}${after.startsWith(",") ? " " : ""}`,
  ).replace(/^(\s*\S.*?) {2,}/, "$1 ");
}

/** 3 stars or fewer is flagged to the team; 4 and 5 get a reply draft. */
export function reviewIsFlagged(stars: number): boolean {
  return stars >= 1 && stars <= 3;
}

type Model = (system: string, user: string, maxTokens: number) => Promise<string>;
let seam: Model | null = null;

/** Tests write without a model; null restores the live one. */
export function setReviewModel(fn: Model | null): void {
  seam = fn;
}

export function reviewAiAvailable(): boolean {
  if (seam) return true;
  return !parityEnabled() && Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const MODEL = "claude-sonnet-4-6";

const live: Model = async (system, user, maxTokens) => {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || parityEnabled()) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.3, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
};

const PUBLIC_REPLY_SYSTEM = [
  "You write a short-term-rental host's PUBLIC reply to an Airbnb guest review, for the host (Mandel Realty Group) to edit before posting.",
  "Use ONLY the review text you are given. You know nothing else about this stay: no messages, no private feedback, no cleaner notes, no records. Never mention anything the review does not mention, even if you think it is true.",
  "WRITE PROSE, NOT FRAMES. Write real sentences about what this guest actually said, picking up their standout points (a feeling like 'felt at home', the particular balcony, the flexible check-in) in your own words. Never use a sentence that would still work if a different review's keyword were swapped in. Banned: 'It's lovely that the X was part of your stay', 'Hope the X brings you back', 'Glad the X hit the spot', 'made a difference', 'stood out for you', 'was a highlight'.",
  "SENTIMENT MUST MATCH. Praise is thanked warmly and never answered with complaint language. 'We'll look into it', 'we hear you on', 'thanks for flagging', 'noted' belong ONLY to a real critique that is in the review. A critique (for example a sliding-door layout) is acknowledged honestly as a critique, never turned into praise.",
  "THE NAME IS USED ONCE. Open exactly like 'Thanks Henry!' (exclamation, no comma after the name). Never put the name between commas ('Thank you, James, for...' is banned). No other use of the name.",
  "Match the review's length and energy: a two-line review gets two or three short sentences; a detailed review gets a fuller reply that touches its standout points. Stay under the word limit. Grammar must be correct (subject and verb agree).",
  "Write the whole reply in the review's own language: a French review gets a fully French reply, never a French greeting with an English body.",
  "Voice examples:",
  "Henry (felt at home on arrival, loved the L-shaped balcony over King St.): \"Thanks Henry! We're thrilled you felt at home from the moment you arrived, and we love that the balcony became your spot to unwind over King St. It was a pleasure hosting you, and we'd happily welcome you back anytime.\"",
  "Zak (praise plus a layout critique): \"Thanks Zak! Really appreciate the honest, balanced review. You're right about the layout: the second room is divided by a sliding frosted-glass door, so it works best for families and close groups, and your note helps us describe it more clearly for the next guests. Glad the place itself was spotless and the downtown location worked for you. You're welcome back anytime.\"",
  "Virginie (French review): \"Merci Virginie! Nous sommes ravis que le logement ait été parfait pour votre famille et que les deux salles de bain vous aient plu. Au plaisir de vous accueillir à nouveau!\"",
  "Samuel (two-line review): \"Thanks Samuel! So glad you felt right at home. You're welcome back anytime.\"",
  "Do not repeat any opening or closing sentence listed as already used. No stock closing like 'We hope to welcome you back to Unit 606 the next time you're in Toronto'. No em dashes. Reply with the reply text only.",
].join(" ");

function publicPrompt(input: { guest: string; review: string; stars: number; property: string; memory: VoiceMemory; feedback: string }): string {
  const language = reviewLanguage(input.review);
  const details = praisesIn(input.review).slice(0, 3).map((item) => item.phrase);
  const critiques = critiquesIn(input.review).slice(0, 2).map((item) => item.phrase);
  return [
    `Reply language: ${language.name}`,
    `Guest first name: ${input.guest.trim().split(/\s+/)[0] || "the guest"}`,
    input.stars ? `Stars: ${input.stars} of 5` : "",
    input.property ? `Property: ${input.property}` : "",
    `Word limit: ${maxWordsFor(input.review)} (${tierOf(input.review)} review)`,
    details.length ? `Things the guest praised (pick one or two): ${details.join(", ")}` : "",
    critiques.length ? `Small critiques the guest actually made (acknowledge briefly): ${critiques.join(", ")}` : "No critiques in this review: do not mention any problem.",
    input.memory.openings.size ? `Opening sentences already used (use a different one):\n${[...input.memory.openings].slice(-14).map((line) => `- ${line}`).join("\n")}` : "",
    input.memory.closings.size ? `Closing sentences already used (use a different one):\n${[...input.memory.closings].slice(-14).map((line) => `- ${line}`).join("\n")}` : "",
    input.feedback ? `Your last attempt was rejected: ${input.feedback} Fix this.` : "",
    `Public review:\n${input.review}`,
  ].filter(Boolean).join("\n\n");
}

export type PublicReply = { reply: string; by: "model" | "template" };

/**
 * The public reply to one review, from that review's text alone (nothing private is ever passed in). A model writes it when
 * one is available, and its reply is accepted only if it keeps every rule (nothing the review didn't say, the review's
 * language, the right length, an opening and closing no other reply in the queue uses). Two rejected tries, then the
 * template writes it. A review in a language the template can't write, with no model, gets no reply at all.
 */
export async function writePublicReply(input: { guest: string; review: string; stars: number; property: string; memory?: VoiceMemory }): Promise<PublicReply | null> {
  const memory = input.memory ?? newVoiceMemory();
  const language = reviewLanguage(input.review);
  if (reviewAiAvailable()) {
    const model = seam ?? live;
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const raw = await model(PUBLIC_REPLY_SYSTEM, publicPrompt({ guest: input.guest, review: input.review, stars: input.stars, property: input.property, memory, feedback }), 500).catch(() => "");
      const reply = withoutEmDashes(raw).replace(/^["'“”]+|["'“”]+$/g, "").trim();
      if (!reply) {
        feedback = "It was empty.";
        continue;
      }
      const check = checkReviewReply({ reply, review: input.review, guest: input.guest, language, memory });
      if (check.ok) {
        rememberReply(memory, reply, input.guest);
        return { reply, by: "model" };
      }
      feedback = check.problems.join(" ");
    }
  }
  const composed = composeReviewReply({ guest: input.guest, review: input.review, stars: input.stars, language, memory });
  return composed ? { reply: composed.reply, by: "template" } : null;
}

const ASSESS_SYSTEM = [
  "You review a low Airbnb guest review for a short-term-rental host (Mandel Realty Group) before anyone replies.",
  "Read the review, the guest's private feedback, the full message conversation, the reservation and the host notes.",
  "1) Check each specific complaint in the review against the conversation and reservation: was it reported during the stay, how and when the host responded, and whether the record supports or contradicts it.",
  "2) Check whether the review may be retaliatory or coercive under Airbnb's Reviews Policy: the guest threatened a bad review to get a refund, discount, or other compensation; the review followed the host reporting damage, asking for payment, enforcing house rules, or refusing a request; the guest was removed or the stay cancelled for a rules violation; the review is about something unrelated to the stay; or the review contains discriminatory or false factual content.",
  "Rate it \"likely\" only when the guest's own words in the conversation show it, and quote those words exactly. \"possible\" when the timing or circumstances suggest it but no message proves it. Otherwise \"no\".",
  "3) When there are grounds (likely, or possible with a clear policy reason), write a factual removal request to Airbnb Support citing the Reviews Policy, the dates, and the quoted messages. Otherwise leave it empty.",
  "4) Write a calm, professional public reply draft (2 to 4 sentences): thank them, address the main point factually without arguing or disclosing private details, and say what was or will be done only if the record shows it. Future guests are the audience.",
  "Never invent facts. Never use em dashes or spaced en dashes.",
  "Reply with JSON only: {\"headline\": string, \"facts\": [{\"claim\": string, \"record\": string, \"source\": string}], \"retaliation\": {\"level\": \"likely\"|\"possible\"|\"no\", \"why\": string, \"quotes\": [string]}, \"removalRequest\": string, \"reply\": string}.",
  "headline: one sentence for the team, e.g. what the guest says, whether the record supports it, and the recommended action. source: where the record comes from (Conversation, date or Reservation).",
].join(" ");

function promptOf(input: ReviewAiInput): string {
  const thread = input.messages
    .filter((row) => row.role !== "system" && row.body.trim())
    .slice(-60)
    .map((row) => `${row.role === "guest" ? "Guest" : "Host"}: ${row.body.slice(0, 1500)}`)
    .join("\n");
  return [
    `Guest: ${input.guest}`,
    `Property: ${input.property}`,
    `Stars: ${input.stars} of 5`,
    `Public review:\n${input.review}`,
    input.privateFeedback ? `Private feedback to the host (not public):\n${input.privateFeedback}` : "",
    input.reservation ? `Reservation:\n${input.reservation.slice(0, 1500)}` : "",
    input.hub ? `Host notes (Knowledge Hub):\n${input.hub.slice(0, 4000)}` : "",
    `Conversation, oldest first:\n${thread || "(no messages found)"}`,
  ].filter(Boolean).join("\n\n");
}

const squash = (value: string) => value.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, "\"").replace(/\s+/g, " ").trim();

/** Only quotes that really appear in the guest's messages are kept; "likely" without one is "possible". */
export function checkedAssessment(raw: unknown, input: ReviewAiInput): ReviewAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const said = squash(input.messages.filter((item) => item.role === "guest").map((item) => item.body).join(" \n "));
  const r = (row.retaliation && typeof row.retaliation === "object" ? row.retaliation : {}) as Record<string, unknown>;
  const quotes = (Array.isArray(r.quotes) ? r.quotes : []).map((item) => String(item ?? "").trim()).filter((quote) => quote.length >= 6 && said.includes(squash(quote)));
  let level: ReviewAssessment["retaliation"]["level"] = r.level === "likely" || r.level === "possible" ? r.level : "no";
  if (level === "likely" && !quotes.length) level = "possible";
  const facts = (Array.isArray(row.facts) ? row.facts : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ claim: withoutEmDashes(String(item.claim ?? "")).trim(), record: withoutEmDashes(String(item.record ?? "")).trim(), source: String(item.source ?? "").trim() }))
    .filter((item) => item.claim && item.record)
    .slice(0, 8);
  const reply = withoutEmDashes(String(row.reply ?? "")).trim();
  const headline = withoutEmDashes(String(row.headline ?? "")).trim();
  if (!reply || !headline) return null;
  return {
    headline,
    facts,
    retaliation: { level, why: withoutEmDashes(String(r.why ?? "")).trim(), quotes },
    removalRequest: level === "no" ? "" : withoutEmDashes(String(row.removalRequest ?? "")).trim(),
    reply,
  };
}

function parseJson(text: string): unknown {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** A reply draft (4 or 5 stars) or an assessment (3 or fewer). Null when no model is available or it didn't answer. */
export async function writeReviewAi(input: ReviewAiInput): Promise<ReviewAiResult | null> {
  // The public reply: this review's own text only. The messages, private feedback, reservation and Knowledge Hub below are
  // for the partner's assessment of a low review and never reach any text a guest or Airbnb can see.
  const pub = await writePublicReply({ guest: input.guest, review: input.review, stars: input.stars, property: input.property, ...(input.memory ? { memory: input.memory } : {}) });
  if (!reviewIsFlagged(input.stars)) return pub ? { kind: "reply", reply: pub.reply } : null;
  if (!reviewAiAvailable() || !pub) return null;
  const model = seam ?? live;
  const text = await model(ASSESS_SYSTEM, promptOf(input), 1800).catch(() => "");
  const assessment = checkedAssessment(parseJson(text), input);
  return assessment ? { kind: "flag", assessment: { ...assessment, reply: pub.reply } } : null;
}

// ---------- Kept per review, so a review is written once unless Regenerate is pressed ----------

const STORE = "review-ai|";
const memory = new Map<string, ReviewAiResult>();

export function resetReviewAi(): void {
  memory.clear();
  seam = null;
}

type KeptKey = Pick<ReviewAiInput, "review" | "stars"> & { reservationId?: string };

/** Written against one stay: a review matched to its stay later is written again, with the conversation. */
function keyOf(id: string, input: KeptKey): string {
  return `${STORE}${id}|${createHash("sha1").update(`v5|${input.stars}|${input.review}|${input.reservationId ?? ""}`).digest("base64url").slice(0, 10)}`;
}

function parseKept(body: string): ReviewAiResult | null {
  const start = body.indexOf("{");
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(start)) as ReviewAiResult;
    if (parsed?.kind === "reply" || parsed?.kind === "flag") return parsed;
  } catch {
    return null;
  }
  return null;
}

function rememberedFor(id: string): ReviewAiResult | null {
  const prefix = `${STORE}${id}|`;
  for (const [key, value] of memory) {
    if (key.startsWith(prefix)) return value;
  }
  return null;
}

/** A draft saved for this review, even when the stay match changed the storage key. */
export async function keptReviewAi(id: string, input: KeptKey): Promise<ReviewAiResult | null> {
  const key = keyOf(id, input);
  const hit = memory.get(key) ?? rememberedFor(id);
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  if (parityEnabled()) return null;
  try {
    const exact = parseKept(await readPrefixedRow(key));
    if (exact) {
      memory.set(key, exact);
      return exact;
    }
    const rows = await listPrefixedStamps(`${STORE}${id}|`);
    const newest = rows.filter((row) => row.body.includes("{")).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const saved = newest ? parseKept(newest.body) : null;
    if (!saved) return null;
    memory.set(key, saved);
    return saved;
  } catch {
    return null;
  }
}

export async function keepReviewAi(id: string, input: KeptKey, result: ReviewAiResult): Promise<void> {
  const key = keyOf(id, input);
  memory.set(key, result);
  if (parityEnabled()) return;
  await writePrefixedRow(key, JSON.stringify(result)).catch(() => undefined);
}

/** The flag line the team sees for a low review. */
export function flagLine(stars: number, assessment: ReviewAssessment): string {
  const lead = `${stars} star${stars === 1 ? "" : "s"}. Flagged for the team.`;
  const retaliation = assessment.retaliation.level === "likely"
    ? " Likely retaliatory: you can ask Airbnb to remove it (request below)."
    : assessment.retaliation.level === "possible"
      ? " Possibly retaliatory: check the request below before filing."
      : "";
  return `${lead} ${assessment.headline}${retaliation}`;
}
