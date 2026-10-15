/**
 * Guest messages in English, and "Suggest with AI", at the lowest cost that does the job.
 *
 * Translation: English is detected locally (free) and never sent to a model. Only the messages that
 * aren't English go out, all of a thread's in one call, to the cheapest model available (OpenAI
 * gpt-4o-mini when an OpenAI key is set, else Claude Haiku; COPILOT_TRANSLATE_MODEL overrides). Each
 * translation is stored, so no message is ever translated twice. Nothing is sent to a guest here.
 */

import { createHash } from "node:crypto";
import { parityEnabled } from "./parity/flag.js";
import { readPrefixedRow, writePrefixedRow } from "./store.js";
import { withoutEmDashes } from "./guestTranslate.js";

export type Translation = { english: string; language: string };

const ENGLISH_WORDS = new Set("the a an and or but to of in on at for with from by is are was were be been am i you we they he she it my your our their this that these those there here what when where why how can could would should will do does did have has had not no yes yes please thanks thank hi hello hey ok okay just about all any some get got go going come coming need want know see check out in into time today tomorrow night day room parking key keys door code wifi".split(" "));

/** English, by its words: free, local, and erring towards "translate" for anything doubtful. */
export function looksEnglish(text: string): boolean {
  const clean = text.replace(/https?:\/\/\S+/g, " ").trim();
  if (!clean) return true;
  // Accented Latin, or another script, is not English.
  if (/[àâäéèêëïîôöùûüçñßãõœæ]/i.test(clean) || /[^\x00-\x7F\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0\u00B0\u20AC\u00A3\s\p{Extended_Pictographic}\uFE0F\u200D]/u.test(clean)) return false;
  const words = clean.toLowerCase().match(/[a-z']+/g) ?? [];
  if (!words.length) return true;
  if (words.length <= 2) return !/\b(merci|bonjour|hola|gracias|danke|obrigad[oa]|grazie|ciao|salut|bonsoir|oui|si|nein)\b/.test(words.join(" "));
  const hits = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  return hits / words.length >= 0.2;
}

// ---------- The cheapest model ----------

type Complete = (system: string, user: string, maxTokens: number) => Promise<string>;

let translatorSeam: ((texts: string[]) => Promise<Translation[]>) | null = null;
let suggestSeam: ((input: SuggestInput) => Promise<string>) | null = null;

/** Tests translate without a model; null restores the live one. */
export function setTranslator(fn: typeof translatorSeam): void {
  translatorSeam = fn;
}

export function setSuggestModel(fn: typeof suggestSeam): void {
  suggestSeam = fn;
}

/** Which model translations use: the override, else the cheapest key that's set. */
export function translationModel(): { provider: "openai" | "anthropic" | ""; model: string } {
  const override = process.env.COPILOT_TRANSLATE_MODEL?.trim() ?? "";
  if (process.env.OPENAI_API_KEY?.trim() && (!override || /^(gpt|o\d)/.test(override))) return { provider: "openai", model: override || "gpt-4o-mini" };
  if (process.env.ANTHROPIC_API_KEY?.trim()) return { provider: "anthropic", model: override && /^claude/.test(override) ? override : "claude-haiku-4-5" };
  return { provider: "", model: "" };
}

const cheap: Complete = async (system, user, maxTokens) => {
  // Tests never reach a paid model; they install a translator or a suggester instead.
  if (parityEnabled()) return "";
  const pick = translationModel();
  if (pick.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` },
      body: JSON.stringify({ model: pick.model, temperature: 0, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }
  if (pick.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(), "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: pick.model, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
  }
  return "";
};

// ---------- Translation, stored ----------

const STORE = "guest-translations|";
const MAX_KEPT = 3000;
let kept: Map<string, Translation> | null = null;

function keyOf(text: string): string {
  return createHash("sha1").update(text.trim()).digest("base64url").slice(0, 16);
}

async function cache(): Promise<Map<string, Translation>> {
  if (kept) return kept;
  kept = new Map();
  if (!parityEnabled()) {
    try {
      const raw = await readPrefixedRow(STORE);
      for (const [key, row] of Object.entries(raw ? (JSON.parse(raw) as Record<string, Translation>) : {})) kept.set(key, row);
    } catch {
      /* An empty cache only costs a translation. */
    }
  }
  return kept;
}

async function persist(): Promise<void> {
  if (parityEnabled() || !kept) return;
  const rows = [...kept.entries()].slice(-MAX_KEPT);
  await writePrefixedRow(STORE, JSON.stringify(Object.fromEntries(rows))).catch(() => undefined);
}

export function resetTranslations(): void {
  kept = null;
}

const TRANSLATE_SYSTEM = "Translate each guest message to natural English for a short-term-rental host. Keep names, numbers, dates and times exactly. Reply with JSON only: an array of {\"i\": number, \"language\": \"French\", \"english\": \"...\"}, one per message, in order.";

/**
 * English for every message that isn't: from the store when it was translated before, else in one
 * batched call to the cheapest model. English messages come back unchanged at no cost.
 */
export async function translateMessages(texts: string[]): Promise<Map<string, Translation>> {
  const out = new Map<string, Translation>();
  const store = await cache();
  const missing: string[] = [];
  for (const text of [...new Set(texts.map((row) => row.trim()).filter(Boolean))]) {
    if (looksEnglish(text)) continue;
    const hit = store.get(keyOf(text));
    if (hit) out.set(text, hit);
    else missing.push(text);
  }
  if (!missing.length) return out;
  let rows: Translation[] = [];
  try {
    if (translatorSeam) rows = await translatorSeam(missing);
    else {
      const user = missing.map((text, i) => `${i}: ${text.slice(0, 1500)}`).join("\n\n");
      const raw = await cheap(TRANSLATE_SYSTEM, user, Math.min(2000, 120 + missing.reduce((sum, text) => sum + Math.ceil(text.length / 2), 0)));
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { i: number; language?: string; english?: string }[];
      rows = missing.map((_, i) => {
        const row = parsed.find((item) => item.i === i);
        return { english: row?.english?.trim() ?? "", language: row?.language?.trim() ?? "" };
      });
    }
  } catch {
    rows = [];
  }
  let added = false;
  missing.forEach((text, i) => {
    const row = rows[i];
    if (!row?.english || /^english$/i.test(row.language)) return;
    out.set(text, row);
    store.set(keyOf(text), row);
    added = true;
  });
  if (added) await persist();
  return out;
}

// ---------- Suggest with AI ----------

export type SuggestInput = {
  guest: string;
  property: string;
  stay: string;
  /** Oldest first, in English. */
  thread: { who: "guest" | "host"; name: string; text: string }[];
  hub: string;
  memory: string;
};

const SUGGEST_SYSTEM = [
  "You write the next reply from a short-term-rental host (Mandel Realty Group) to a guest, for the host to review before sending.",
  "Use only facts in the Knowledge Hub, the host notes, or the conversation. Never invent codes, prices, times, availability, policies or promises.",
  "If the guest asks something those don't answer (availability, price, a booking change), say you'll check and get back to them shortly; don't guess.",
  "If the latest guest message needs no answer (thanks, a goodbye, a confirmation), write a brief warm acknowledgement.",
  "Greet the guest by first name. Two to five short sentences, plain and friendly. English. No sign-off name, no subject line.",
  "Never use em dashes (—) or spaced en dashes; use commas or periods.",
].join(" ");

/** A suggested reply for any conversation. Nothing is sent; the partner edits and presses Send. */
export async function suggestGuestReply(input: SuggestInput): Promise<string> {
  return withoutEmDashes(await writeSuggestion(input)).trim();
}

async function writeSuggestion(input: SuggestInput): Promise<string> {
  if (suggestSeam) return (await suggestSeam(input)).trim();
  const thread = input.thread.slice(-14).map((row) => `${row.who === "guest" ? "Guest" : "Host"} (${row.name}): ${row.text.slice(0, 1200)}`).join("\n");
  const user = [
    `Guest: ${input.guest}`,
    `Property: ${input.property}${input.stay ? ` · ${input.stay}` : ""}`,
    `Knowledge Hub:\n${input.hub.slice(0, 6000) || "(none)"}`,
    input.memory ? `Host notes:\n${input.memory.slice(0, 2000)}` : "",
    `Conversation, oldest first:\n${thread}`,
  ].filter(Boolean).join("\n\n");
  // The suggestion is the host's words to a guest: the stronger model writes it (one call, on request only).
  const key = parityEnabled() ? "" : process.env.ANTHROPIC_API_KEY?.trim();
  if (key) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, temperature: 0.3, system: SUGGEST_SYSTEM, messages: [{ role: "user", content: user }] }),
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
      if (text) return text;
    }
  }
  return cheap(SUGGEST_SYSTEM, user, 500);
}
