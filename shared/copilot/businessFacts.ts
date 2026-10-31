/**
 * Business memory v1: store, recall, correct.
 *
 * A fact is a short durable statement about the business (a client, a unit, a decision, a standing way of doing things).
 * It has a subject, so a partner's correction updates that fact instead of adding a duplicate. Before the agent answers,
 * the facts that match the question are loaded into its context; after a conversation, durable new facts are extracted.
 * Secrets (door codes, passwords, access instructions) are never kept.
 */

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import { complete } from "./brain.js";
import { withoutHubSecrets } from "./hubSecrets.js";
import { parityNow } from "./parity/clock.js";

export const FACT_CATEGORIES = ["client", "unit", "decision", "standing", "person", "process", "other"] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export type BusinessFact = {
  id: string;
  subject: string;
  fact: string;
  category: FactCategory;
  source: string;
  updatedAt: string;
  previousFact?: string;
};

const TABLE = "copilot_business_facts";
let volatile = new Map<string, BusinessFact>();

export function resetBusinessFacts(): void {
  volatile = new Map();
}

export function subjectKey(subject: string): string {
  return subject.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function category(value: unknown): FactCategory {
  const text = String(value ?? "").toLowerCase();
  return (FACT_CATEGORIES as readonly string[]).includes(text) ? (text as FactCategory) : "other";
}

type Row = { id: string; subject: string; fact: string; category: string; source: string; updated_at: string; previous_fact: string };
const fromRow = (row: Row): BusinessFact => ({ id: row.id, subject: row.subject, fact: row.fact, category: category(row.category), source: row.source, updatedAt: row.updated_at, ...(row.previous_fact ? { previousFact: row.previous_fact } : {}) });

const nowIso = () => (parityNow() ?? new Date()).toISOString();

export async function listFacts(): Promise<BusinessFact[]> {
  const client = getSupabaseAdmin();
  if (!client) return [...volatile.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { data, error } = await client.from(TABLE).select("id,subject,fact,category,source,updated_at,previous_fact").eq("active", true).order("updated_at", { ascending: false }).limit(500);
  if (error) return [];
  return ((data ?? []) as Row[]).map(fromRow);
}

export type SaveResult = { action: "added" | "updated" | "unchanged" | "refused"; fact: BusinessFact | null; previous?: string; reason?: string };

/** Keeps one fact per subject: saving the same subject again is a correction, not a second fact. */
export async function saveFact(input: { subject: string; fact: string; category?: unknown; source?: string }): Promise<SaveResult> {
  const subject = input.subject.replace(/\s+/g, " ").trim().slice(0, 120);
  const cleaned = withoutHubSecrets(input.fact.replace(/\s+/g, " ").trim().slice(0, 600));
  if (!subject || !cleaned.text) return { action: "refused", fact: null, reason: "Nothing to keep." };
  if (cleaned.removed || /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|[\w.+-]+@[\w-]+\.\w+|\b(?:password|passcode|pin code)\b/i.test(cleaned.text)) return { action: "refused", fact: null, reason: "That looks like an access detail or a secret, so it isn't kept." };
  const key = subjectKey(subject);
  const source = (input.source ?? "").slice(0, 160);
  const client = getSupabaseAdmin();
  if (!client) {
    const existing = volatile.get(key);
    if (existing && existing.fact === cleaned.text) return { action: "unchanged", fact: existing };
    const next: BusinessFact = { id: existing?.id ?? randomUUID(), subject: existing?.subject ?? subject, fact: cleaned.text, category: category(input.category), source, updatedAt: nowIso(), ...(existing ? { previousFact: existing.fact } : {}) };
    volatile.set(key, next);
    return { action: existing ? "updated" : "added", fact: next, ...(existing ? { previous: existing.fact } : {}) };
  }
  const found = await client.from(TABLE).select("id,subject,fact,category,source,updated_at,previous_fact").eq("subject_key", key).maybeSingle();
  const existing = found.data as Row | null;
  if (existing && existing.fact === cleaned.text) return { action: "unchanged", fact: fromRow(existing) };
  const now = nowIso();
  if (existing) {
    const { data } = await client.from(TABLE).update({ fact: cleaned.text, category: category(input.category), source, active: true, updated_at: now, previous_fact: existing.fact }).eq("id", existing.id).select("id,subject,fact,category,source,updated_at,previous_fact").single();
    return { action: "updated", fact: data ? fromRow(data as Row) : null, previous: existing.fact };
  }
  const { data } = await client.from(TABLE).insert({ subject, subject_key: key, fact: cleaned.text, category: category(input.category), source, updated_at: now }).select("id,subject,fact,category,source,updated_at,previous_fact").single();
  return { action: "added", fact: data ? fromRow(data as Row) : null };
}

export async function forgetFact(subject: string): Promise<boolean> {
  const key = subjectKey(subject);
  const client = getSupabaseAdmin();
  if (!client) return volatile.delete(key);
  const { data } = await client.from(TABLE).update({ active: false, updated_at: nowIso() }).eq("subject_key", key).eq("active", true).select("id");
  return Boolean(data?.length);
}

const STOP = new Set("the a an and or of to in on for with at by is are was were be it this that my our your what whats who when where how do does did can could would should please about from have has had i we you they".split(" "));
const words = (text: string) => subjectKey(text).split(" ").filter((word) => word.length > 2 && !STOP.has(word));

/** The facts that matter to this question: word overlap with the subject (heavier) and the fact, a little for recent ones. */
export function relevantFacts(facts: BusinessFact[], question: string, limit = 12): BusinessFact[] {
  const asked = new Set(words(question));
  const scored = facts.map((fact, index) => {
    const subject = new Set(words(fact.subject));
    const body = new Set(words(fact.fact));
    let score = 0;
    for (const word of asked) {
      if (subject.has(word)) score += 3;
      else if (body.has(word)) score += 1;
    }
    // Standing ways of working apply to everything, a little.
    if (fact.category === "standing") score += 0.5;
    return { fact, score: score + Math.max(0, 0.3 - index * 0.002) };
  });
  return scored.filter((item) => item.score >= 1).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.fact);
}

export async function recallFacts(question: string, limit = 12): Promise<BusinessFact[]> {
  return relevantFacts(await listFacts(), question, limit);
}

export function factsForPrompt(facts: BusinessFact[]): string {
  if (!facts.length) return "";
  return ["What you already know about this business (from earlier conversations; a partner's correction replaces a fact):", ...facts.map((fact) => `- ${fact.subject}: ${fact.fact}`)].join("\n");
}

const EXTRACT_SYSTEM = [
  "You keep a small memory of durable business facts for a short-term-rental management company (Mandel Realty Group).",
  "From the conversation, list ONLY facts worth remembering for months: who a client is and what they prefer, how a unit works, a decision the partners made, a standing way of doing things.",
  "Do not keep: one-off questions, today's schedule, guest names tied to a single stay, prices quoted once, anything private like door codes, passwords, access instructions, phone numbers or emails.",
  "Each fact has a short stable subject (for example \"Shaw Street owner\" or \"Early check-in policy\") so a later correction of the same thing reuses that subject. If the partner corrected something already known, reuse that fact's subject exactly and set correction true.",
  "Only facts the PARTNER stated or confirmed. Never keep something only the assistant said.",
  "Reply with JSON only: {\"facts\":[{\"subject\":\"\",\"fact\":\"\",\"category\":\"client|unit|decision|standing|person|process|other\",\"correction\":false}]}. Use {\"facts\":[]} when nothing is worth keeping.",
].join(" ");

export type Extracted = { subject: string; fact: string; category: FactCategory; correction: boolean };

export function parseExtracted(text: string): Extracted[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { facts?: { subject?: unknown; fact?: unknown; category?: unknown; correction?: unknown }[] };
    return (parsed.facts ?? [])
      .map((item) => ({ subject: String(item.subject ?? "").trim(), fact: String(item.fact ?? "").trim(), category: category(item.category), correction: item.correction === true }))
      .filter((item) => item.subject && item.fact)
      .slice(0, 6);
  } catch {
    return [];
  }
}

/** After a conversation: keep what is durable. Returns what was saved, so the partner can be told in one line. */
export async function extractAndSaveFacts(input: { conversation: { role: "user" | "assistant"; text: string }[]; known: BusinessFact[]; source: string }): Promise<SaveResult[]> {
  const turns = input.conversation.filter((turn) => turn.text.trim()).slice(-12);
  if (!turns.some((turn) => turn.role === "user")) return [];
  const known = input.known.slice(0, 40).map((fact) => `- ${fact.subject}: ${fact.fact}`).join("\n");
  const result = await complete({
    task: "extract",
    system: EXTRACT_SYSTEM,
    user: `${known ? `Facts already known:\n${known}\n\n` : ""}Conversation:\n${turns.map((turn) => `${turn.role === "user" ? "Partner" : "Assistant"}: ${turn.text.slice(0, 1200)}`).join("\n")}`,
    maxTokens: 700,
  });
  if (!result) return [];
  const saved: SaveResult[] = [];
  for (const item of parseExtracted(result.text)) saved.push(await saveFact({ subject: item.subject, fact: item.fact, category: item.category, source: input.source }));
  return saved.filter((item) => item.action === "added" || item.action === "updated");
}
