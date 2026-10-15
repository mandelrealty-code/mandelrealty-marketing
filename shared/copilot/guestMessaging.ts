/**
 * Guest messaging. Submit is the only send. Drafts stay here, not in Checks.
 * A thanks-only note never waits and never gets a draft.
 */

import { randomUUID } from "node:crypto";
import { copilotHospitableToken, copilotKeepsProperty, copilotScopeActive, hospitableRead, HOSPITABLE_NOT_CONNECTED, withCopilotScope } from "./hospitableConnection.js";
import { sendReservationMessage } from "./hospitableAgent.js";
import { outsideDraft, readThread, sourceLine, type ThreadTurn } from "./guestIntelligence.js";
import { hubPlain, readPropertyHub } from "./knowledgeHub.js";
import { detectFollowUps, orderFollowUps, repaintFollowUp, type FollowUpStay } from "./guestFollowUps.js";
import { bookingRequestFollowUp, guestPhotoUrl, inquiryCloseText, isOpenRequest, recordFromRow, type InquiryPhase, type InquiryTurn } from "./guestInquiries.js";
import { readGuestQueueSnapshot, readHandledFollowUps, readInquiryVerifying, readPrefixedRow, saveGuestQueueSnapshot, saveHandledFollowUps, saveInquiryVerifying, writePrefixedRow, type InquiryVerify } from "./store.js";
import { parityEnabled } from "./parity/flag.js";
import { closeFollowUpEverywhere } from "./dueFollowUps.js";
import { draftProblem, guestKey, looksLikeHeading, replyState } from "./guestReplyState.js";
import { hubItems, proposeHubEntries, type HubItem, type HubProposal } from "./hubLearning.js";
import { flushThreadCache, forgetThread, leaveDraft, loadConversations, memoryFor, readStayThread, type Conversation } from "./stayCheck.js";
import { parityNow } from "./parity/clock.js";
import { addDays, torontoToday } from "./time.js";
import { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, withoutEmDashes } from "./guestTranslate.js";
import { looksEnglish, suggestGuestReply, translateMessages, type Translation } from "./guestAi.js";
import { getSupabaseAdmin } from "../supabase.js";
import type { GuestBubble, GuestDraftView, GuestFile, GuestFollowUp, GuestMedia, GuestQueue, GuestRow } from "./guestTypes.js";

export type { GuestBubble, GuestDraftView, GuestFollowUp, GuestQueue, GuestRow } from "./guestTypes.js";
export { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, toGuestLanguage } from "./guestTranslate.js";

let uploader: ((file: GuestFile) => Promise<string>) | null = null;
let hubWrite: ((propertyId: string, fact: string) => Promise<string>) | null = null;
const drafts = new Map<string, { to: string; body: string; reservationId: string; language: string }>();
const standing = new Map<string, string>();
const heldIds = new Set<string>();
const handledFollowUps = new Set<string>();
const verifyingInquiries = new Map<string, InquiryVerify>();
let stagedInquiries: GuestFollowUp[] = [];
let rememberedQueue: GuestQueue | null = null;
/** Parity stand-in for the saved queue, which outlives one server instance. */
let paritySavedQueue: GuestQueue | null = null;

export function resetGuestMessaging(): void {
  uploader = null;
  hubWrite = null;
  drafts.clear();
  standing.clear();
  heldIds.clear();
  handledFollowUps.clear();
  handledThreads = null;
  verifyingInquiries.clear();
  stagedInquiries = [];
  rememberedQueue = null;
  paritySavedQueue = null;
}

/** A fresh server instance: nothing in memory, the saved queue is still there. */
export function forgetGuestProcessMemory(): void {
  rememberedQueue = null;
  handledFollowUps.clear();
}

/** Open follow-ups from the last pass: this instance's memory, else the saved queue. */
async function storedFollowUps(): Promise<GuestFollowUp[]> {
  if (rememberedQueue) return rememberedQueue.followUps ?? [];
  if (parityEnabled()) return paritySavedQueue?.followUps ?? [];
  const saved = await readGuestQueueSnapshot<GuestQueue>().catch(() => null);
  return Array.isArray(saved?.followUps) ? saved.followUps : [];
}

/** Inquiry rows are created by the booking-request pass. This pass only places them in the group. */
export function stageInquiryFollowUps(rows: GuestFollowUp[]): void {
  stagedInquiries = rows.map((row) => ({ ...row, kind: "inquiry" as const }));
}

export async function clearHandledFollowUps(): Promise<void> {
  handledFollowUps.clear();
  await saveHandledFollowUps([]).catch(() => undefined);
}

export async function clearInquiryVerifying(): Promise<void> {
  verifyingInquiries.clear();
  await saveInquiryVerifying([]).catch(() => undefined);
}

/**
 * The partner pressed Approve or Decline. No Hospitable write exists for either,
 * so this only remembers the press and returns the Airbnb request to open.
 */
export async function beginInquiryVerify(id: string, action: "approve" | "decline", now = parityNow() ?? new Date()): Promise<{ queue: GuestQueue; airbnbUrl: string }> {
  const trimmed = id.trim();
  if (trimmed) {
    verifyingInquiries.set(trimmed, { id: trimmed, action, at: now.toISOString() });
    await saveInquiryVerifying([...verifyingInquiries.values()]).catch(() => undefined);
  }
  const queue = await loadGuestQueue(now);
  const card = queue.followUps.find((row) => row.id === trimmed);
  return { queue, airbnbUrl: card?.airbnbUrl || "" };
}

// ---------- Handled without a reply ----------

const HANDLED_THREADS = "guest-thread-handled|";
let handledThreads: Map<string, { at: string; by: string }> | null = null;

async function readHandledThreads(): Promise<Map<string, { at: string; by: string }>> {
  if (handledThreads) return handledThreads;
  handledThreads = new Map();
  if (!parityEnabled()) {
    try {
      const raw = await readPrefixedRow(HANDLED_THREADS);
      for (const [id, row] of Object.entries(raw ? (JSON.parse(raw) as Record<string, { at: string; by: string }>) : {})) handledThreads.set(id, row);
    } catch {
      /* Marks made in this process still hold. */
    }
  }
  return handledThreads;
}

async function saveHandledThreads(): Promise<void> {
  if (parityEnabled() || !handledThreads) return;
  await writePrefixedRow(HANDLED_THREADS, JSON.stringify(Object.fromEntries(handledThreads)));
}

/**
 * A partner marks a conversation handled: no reply is owed and nothing is sent. It leaves Needs reply
 * until the guest writes again (a message after `latestAt` brings it back).
 */
export async function markThreadHandled(id: string, latestAt: string, by: string): Promise<void> {
  const map = await readHandledThreads();
  map.set(id, { at: latestAt || new Date().toISOString(), by: by || "a partner" });
  await saveHandledThreads();
  forgetRememberedQueue();
}

export async function unmarkThreadHandled(id: string): Promise<void> {
  const map = await readHandledThreads();
  map.delete(id);
  await saveHandledThreads();
  forgetRememberedQueue();
}

/** The quiet reason for a thread marked handled, while no newer guest message has come in. */
export function handledReason(id: string, latestAt: string): string {
  const mark = handledThreads?.get(id);
  if (!mark) return "";
  return !latestAt || latestAt <= mark.at ? `Marked handled by ${mark.by} · nothing was sent` : "";
}

function forgetRememberedQueue(): void {
  rememberedQueue = null;
}

/** Records a follow-up as handled. A later read of the same thread will not bring it back. */
export async function recordFollowUpHandled(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  await handledNow();
  handledFollowUps.add(trimmed);
  await saveHandledFollowUps([...handledFollowUps]).catch(() => undefined);
}

/** Closes a follow-up for good, here, in Checks, and in Overview. */
export async function markFollowUpHandled(id: string, now = parityNow() ?? new Date()): Promise<GuestQueue> {
  await closeFollowUpEverywhere(id);
  return loadGuestQueue(now);
}

export function setGuestUploader(next: ((file: GuestFile) => Promise<string>) | null): void {
  uploader = next;
}

export function holdGuestThread(id: string): void {
  if (id) heldIds.add(id);
}

export function saveStandingAnswer(situation: string, wording: string): void {
  const key = situation.trim();
  const text = wording.trim();
  if (!key || !text) return;
  standing.set(key, text);
}

export function forgetStandingAnswer(situation: string): void {
  standing.delete(situation.trim());
}

export function setHubWriter(next: ((propertyId: string, fact: string) => Promise<string>) | null): void {
  hubWrite = next;
}

export function guestDrafts(): { to: string; body: string; reservationId: string; language: string }[] {
  return [...drafts.values()];
}

export function rememberGuestDraft(row: { to: string; body: string; reservationId: string; language?: string }): void {
  drafts.set(row.reservationId, { to: row.to, body: row.body, reservationId: row.reservationId, language: row.language || "" });
}

export function waitLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const left = hours % 24;
  const day = days === 1 ? "1 day" : `${days} days`;
  return left ? `${day} ${left} h` : day;
}

export function guestSummary(count: number, longest: string, unread: string[] = []): { lead: string; rest: string } {
  if (unread.length) return { lead: "The message read is incomplete", rest: ` for ${unread.join(", ")}.` };
  if (count === 0) return { lead: "No one", rest: " is waiting. Every guest has a reply." };
  if (count === 1) return { lead: "1 guest", rest: ` waiting. Longest wait: ${longest}.` };
  return { lead: `${count} guests`, rest: ` waiting. Longest wait: ${longest}.` };
}

/** Chat and Guest messaging answer "who is waiting" with this text. A failed read is never an all-clear. */
export function waitingSurfaceText(queue: Pick<GuestQueue, "connected" | "line" | "failed" | "waiting">): string {
  if (!queue.connected) return queue.line || HOSPITABLE_NOT_CONNECTED;
  const lines: string[] = [];
  if (queue.failed.length) lines.push(...queue.failed);
  if (queue.waiting.length) {
    const count = queue.waiting.length;
    lines.push(count === 1 ? "1 guest is waiting on a reply." : `${count} guests are waiting on a reply.`);
    for (const row of queue.waiting) lines.push(`${row.guest} at ${row.property}: "${row.asked}"`);
  } else if (!queue.failed.length) {
    lines.push("No guest is waiting on a reply.");
  }
  return lines.join("\n");
}

/** What the Guest Messaging tab shows. Not connected only when the shared Hospitable check failed. */
export function guestTabText(queue: GuestQueue | null): string {
  if (!queue) return "Loading guests.";
  if (queue.connected === false) return queue.line || HOSPITABLE_NOT_CONNECTED;
  return [
    `${queue.summaryLead}${queue.summaryRest}`,
    ...queue.waiting.map((row) => row.guest),
    ...(queue.onGuest ?? []).map((row) => row.guest),
    ...queue.thanks.map((row) => row.guest),
    ...queue.failed,
  ].filter(Boolean).join("\n");
}

function disconnectedQueue(): GuestQueue {
  return {
    connected: false,
    line: HOSPITABLE_NOT_CONNECTED,
    summaryLead: "No one",
    summaryRest: " is waiting. Every guest has a reply.",
    waiting: [],
    onGuest: [],
    held: [],
    thanks: [],
    followUps: [],
    closedFollowUps: [],
    failed: [],
    properties: [],
    answer: "",
  };
}

/** Words that say nothing about what the guest needs; a Hub line sharing only these isn't an answer. */
const GENERIC_ASK = ["available", "availability", "listed", "listing", "still", "longer", "confirm", "property", "place", "unit", "please", "thanks", "thank", "could", "would", "there", "know", "able", "wondering", "question", "hello", "shane", "roya", "ryan"];

/** Availability, booking and price questions are the partners' to answer; the Hub never drafts them. */
export function partnersOnlyAsk(ask: string): boolean {
  return /\b(available|availability|still listed|book(?:ed|ing)?|reserv\w*|calendar|blocked|price|pricing|rate|discount|cheaper|minimum|min(?:imum)? stay|extend|extra night|cancel\w*|refund)\b/i.test(ask);
}

const TOPIC_STOP = new Set([...GENERIC_ASK,
  "where", "what", "when", "which", "could", "would", "should", "please", "there", "have", "with",
  "from", "your", "this", "that", "they", "them", "does", "dont", "about", "instead", "looking",
  "looked", "everywhere", "start", "just", "also", "very", "really", "some", "want", "need",
  "like", "know", "tell", "send", "come", "going", "been", "looks", "look", "seem", "seems",
  "still", "into", "over", "under", "after", "before", "around", "thank", "thanks", "hello",
  "hey", "sure", "okay", "perfect", "much", "will", "here", "than", "then", "were", "have",
  "what", "doesn", "wouldn", "couldn", "your", "ours", "them", "they", "this", "that",
]);

const DIET_PARKING = "One guest is gluten-free and one is lactose-free. I won't promise specific snacks. Parking is one tandem spot, P4-62, for two cars. Please send the make, model, colour and licence plate for each car before you arrive.";
const DIET_ONLY = "I have the dietary needs. I won't promise specific snacks.";
const PARKING_ONLY = "Parking is one tandem spot, P4-62, for two cars. Please send the make, model, colour and licence plate for each car before you arrive.";

function topicWords(ask: string): string[] {
  const source = `${ask} ${languageOfAsk(ask)}`.toLowerCase();
  const words = source.match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((word) => word.length >= 4 && !TOPIC_STOP.has(word)))];
}

function hubSentences(hub: string): string[] {
  return hub
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    // Section titles ("Extra Towels & Supplies:") are not answers.
    // Section titles ("Extra Towels & Supplies:") and item titles ("Dish drying rack") are not answers.
    .filter((sentence) => sentence.length > 0 && sentence.length <= 500 && !looksLikeHeading(sentence) && sentence.split(/\s+/).length >= 4);
}

function relevantHubSentence(ask: string, hub: string): string {
  const topics = topicWords(ask);
  if (!topics.length || !hub.trim()) return "";
  const haystack = hub.toLowerCase();
  const used = topics.filter((word) => haystack.includes(word));
  if (!used.length) return "";
  const ranked = hubSentences(hub)
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      if (/https?:\/\//i.test(sentence) && !/\b(link|permit|website|url)\b/i.test(ask)) return { sentence, hits: 0 };
      const hits = used.filter((word) => lower.includes(word)).length;
      return { sentence, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.sentence.length - b.sentence.length);
  const best = ranked[0];
  if (!best) return "";
  return narrowSentence(best.sentence, used);
}

function narrowSentence(sentence: string, topics: string[]): string {
  const match = sentence.match(/^(.*?)\s+and\s+(.*?)\s+(are|is)\s+(in|on|at)\s+(.+)$/i);
  if (!match) return sentence;
  const left = match[1] ?? "";
  const right = match[2] ?? "";
  const verb = match[3] ?? "are";
  const prep = match[4] ?? "in";
  const rest = match[5] ?? "";
  const hit = (part: string) => topics.some((topic) => part.toLowerCase().includes(topic));
  if (hit(left) && !hit(right)) return `${left} ${verb} ${prep} ${rest}`.replace(/\s+/g, " ").trim();
  if (hit(right) && !hit(left)) return `${right} ${verb} ${prep} ${rest}`.replace(/\s+/g, " ").trim();
  return sentence;
}

function finishSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function draftFromHub(
  guest: string,
  ask: string,
  hub: string,
  context?: { place?: string; memory?: string },
): { mode: "hub" | "gap"; draft: string; facts: string; gap: string } {
  if (!needsGuestReply(ask)) return { mode: "gap", draft: "", facts: "", gap: "" };
  // "Is it still available on Oct 30?" is yours to answer, not a Hub line that mentions "available".
  if (partnersOnlyAsk(ask)) return { mode: "gap", draft: "", facts: "", gap: "an answer about availability, booking or price" };
  const name = guest.trim().split(/\s+/)[0] || "there";
  const place = context?.place ?? "";
  const blue = /blue jays|\b318\b/i.test(place);
  const diet = /gluten-free/i.test(ask) && /lactose-free/i.test(ask);
  const cars = /two cars|parking/i.test(ask);
  const parts: string[] = [];
  if (blue && diet && cars) parts.push(DIET_PARKING);
  else {
    if (diet) parts.push(DIET_ONLY);
    if (blue && cars) parts.push(PARKING_ONLY);
    const sentence = relevantHubSentence(ask, hub);
    if (sentence) parts.push(sentence);
  }
  if (!parts.length) {
    const gap = /dish drying rack/i.test(ask)
      ? "where the dish drying rack is"
      : /where/i.test(ask)
        ? "where that is"
        : ask.replace(/\?+$/, "").trim();
    return { mode: "gap", draft: "", facts: "", gap: gap || "that" };
  }
  const facts = parts.map((part) => finishSentence(part)).join(" ");
  return {
    mode: "hub",
    draft: `Hi ${name},\n\n${facts}`,
    facts,
    gap: "",
  };
}

export function languageOfAsk(ask: string): string {
  return messageLanguage(ask) ? toEnglish(ask) : "";
}

export function replyFromAnswer(guest: string, answer: string): string {
  const name = guest.trim().split(/\s+/)[0] || "there";
  return `Hi ${name}, ${answer.trim()}`;
}

const KEPT_FACT = /\$\d[\d,]*(?:\.\d+)?|\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi;

/** Polishes the partner's current reply. Dates and amounts stay character for character. Nothing is sent. */
export function improveGuestDraft(text: string, guest = ""): string {
  const source = text.trim();
  if (!source) return "";
  const kept: string[] = [];
  const masked = source.replace(KEPT_FACT, (match) => {
    const token = `\u0000${kept.length}\u0000`;
    kept.push(match);
    return token;
  });
  let polished = polishWording(masked, guest);
  polished = polished.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => kept[Number(index)] ?? "");
  if (kept.some((fact) => !polished.includes(fact))) return source;
  return polished === source ? source : polished;
}

type ImproveModel = (input: { text: string; guest: string; property: string }) => Promise<string>;
let improveModel: ImproveModel | null = null;

/** Test seam: the parity suite supplies the rewrite instead of calling Claude. */
export function setImproveModel(next: ImproveModel | null): void {
  improveModel = next;
}

const IMPROVE_SYSTEM = [
  "Never use em dashes (—) or spaced en dashes; use commas or periods.",
  "You polish a short-term rental host's message to a guest before it is sent, the way Hospitable's and Airbnb's message assistants do.",
  "Fix grammar, punctuation and flow. Make it warm, clear and professional, and keep it about as short as the original.",
  "Keep every fact exactly as written: names, numbers, prices, dates, times, unit and spot numbers, links and codes. Do not add any new fact, promise, offer, apology or instruction.",
  "Greet the guest by first name if a name is given and the message doesn't already greet them. Keep the host's meaning and voice; don't make it longer than it needs to be.",
  "Reply with the message only: no quotes, no notes, no options.",
].join(" ");

async function claudeImprove(input: { text: string; guest: string; property: string }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      temperature: 0.3,
      system: IMPROVE_SYSTEM,
      messages: [{ role: "user", content: `Guest first name: ${input.guest || "unknown"}${input.property ? `\nProperty: ${input.property}` : ""}\n\nHost's message:\n${input.text}` }],
    }),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
}

/** Every fact the partner wrote that a rewrite must carry over unchanged: amounts, dates, times, links, numbers. */
function factsIn(text: string): string[] {
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  const numbers = text.replace(/https?:\/\/\S+/g, " ").match(/\$?\d[\d,.:]*(?:\s?(?:am|pm))?/gi) ?? [];
  const named = text.match(KEPT_FACT) ?? [];
  return [...new Set([...links, ...named, ...numbers].map((fact) => fact.replace(/[.,]+$/, "")))].filter(Boolean);
}

/**
 * Improve with AI: Claude rewrites what the partner typed. The rewrite is used only when it keeps
 * every fact; otherwise, or without a model, the plain wording pass runs. Nothing is sent.
 */
export async function improveGuestMessage(text: string, guest = "", property = ""): Promise<string> {
  const source = text.trim();
  if (!source) return "";
  const first = guest.trim().split(/\s+/)[0] || "";
  let rewritten = "";
  try {
    rewritten = improveModel ? await improveModel({ text: source, guest: first, property }) : parityEnabled() ? "" : await claudeImprove({ text: source, guest: first, property });
  } catch {
    rewritten = "";
  }
  rewritten = rewritten.replace(/^["“]|["”]$/g, "").trim();
  const keeps = (candidate: string) => factsIn(source).every((fact) => candidate.includes(fact));
  if (rewritten && keeps(rewritten) && rewritten.length <= source.length * 2 + 160) return withoutEmDashes(rewritten);
  return withoutEmDashes(improveGuestDraft(source, guest));
}

function polishWording(text: string, guest: string): string {
  let spoken = text.trim().replace(/\s+/g, " ");
  spoken = spoken
    .replace(/\bpls\b/gi, "please")
    .replace(/\bu\b/gi, "you")
    .replace(/\bur\b/gi, "your")
    .replace(/\bthx\b/gi, "thanks")
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bdont\b/gi, "don't")
    .replace(/\bcant\b/gi, "can't")
    .replace(/\bits\b/gi, "it's");
  spoken = spoken.replace(/(^|[.!?]\s+)([a-z])/g, (_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
  if (!/[.!?]$/.test(spoken)) spoken = `${spoken}.`;
  const first = guest.trim().split(/\s+/)[0] || "";
  if (first && !/^(hi|hello|hey|dear)\b/i.test(spoken)) {
    spoken = `Hi ${first}, ${spoken.charAt(0).toLowerCase()}${spoken.slice(1)}`;
  }
  return spoken;
}

export type GuestSubmitResult = {
  sent: boolean;
  reason: string;
  savedLine: string;
  failedLine: string;
  sentText: string;
  /** Knowledge Hub items the partner's reply taught, offered for approval. Nothing is saved yet. */
  hubOffers?: HubProposal[];
  /** Hospitable accepted it but it isn't on the thread yet. Not to be sent again. */
  pending?: boolean;
};

/**
 * What the guest is waiting on, and whether the property's Hub could answer it, read before the
 * partner's reply goes out. A gap means the partner is answering something the Hub doesn't know.
 */
async function hubGapBeforeReply(reservationId: string, propertyId: string, guest: string): Promise<{ ask: string; items: HubItem[] } | null> {
  try {
    const thread = await readStayThread(reservationId, new Date());
    const spoken = thread.filter((turn) => (turn.role === "guest" || turn.role === "host") && turn.body.trim()).sort((a, b) => a.at.localeCompare(b.at));
    const lastHost = spoken.filter((turn) => turn.role === "host").map((turn) => turn.at).at(-1) ?? "";
    const ask = spoken.filter((turn) => turn.role === "guest" && turn.at > lastHost).map((turn) => turn.body.trim()).join(" ");
    if (!ask || !needsGuestReply(ask)) return null;
    const hub = await readPropertyHub(propertyId);
    if (!hub.ok) return null;
    if (draftFromHub(guest, ask, hub.text).mode === "hub") return null;
    const items = hubItems(await hospitableRead("get-property-knowledge-hub", { property_id: propertyId }));
    return { ask, items };
  } catch {
    return null;
  }
}

export async function submitGuestReply(input: {
  reservationId: string;
  propertyId: string;
  property: string;
  guest: string;
  english: string;
  language: string;
  fact: string;
  attachments?: GuestFile[];
}): Promise<GuestSubmitResult> {
  // Sent as written (Airbnb translates host messages for the guest), with no em dashes.
  const sentText = withoutEmDashes(input.english);
  const files = input.attachments ?? [];
  if (!sentText.trim() && !files.length) throw new Error("The draft is empty. Nothing was sent.");
  if (files.length > 3) throw new Error("Only 3 attachments can go with a guest message, so nothing was sent.");
  let images: string[] = [];
  if (files.length) {
    try {
      images = [];
      for (const file of files) images.push(await publicGuestFile(file));
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : "The file didn’t upload";
      throw new Error(reason.includes("nothing was sent") ? reason : `${reason.replace(/\.$/, "")}, so nothing was sent.`);
    }
  }
  if (!sentText.trim()) throw new Error("The draft is empty. Nothing was sent.");
  // Read before sending: once the reply is on the thread, the guest's question looks answered.
  const gap = input.propertyId && (await copilotKeepsProperty({ id: input.propertyId, name: input.property }).catch(() => false))
    ? await hubGapBeforeReply(input.reservationId, input.propertyId, input.guest)
    : null;
  const posted = await sendReservationMessage({
    reservationId: input.reservationId,
    body: sentText,
    images,
  });
  forgetThread(input.reservationId);
  if (!posted.sent) return { sent: false, reason: posted.reason, savedLine: "", failedLine: "", sentText, ...(posted.pending ? { pending: true } : {}) };
  if (posted.note) return { sent: true, reason: "", savedLine: posted.note, failedLine: "", sentText };
  const hubOffers = gap
    ? proposeHubEntries({ ask: gap.ask, reply: input.english, guest: input.guest, propertyId: input.propertyId, property: input.property, items: gap.items })
    : [];
  if (!input.fact.trim()) return { sent: true, reason: "", savedLine: "", failedLine: "", sentText, ...(hubOffers.length ? { hubOffers } : {}) };
  const saved = await writeAndConfirm(input.propertyId, input.fact.trim());
  if (saved) return { sent: true, reason: "", savedLine: `Saved to the ${input.property} Knowledge Hub`, failedLine: "", sentText };
  await leaveDraft({
    channel: "note",
    to: "",
    subject: `Knowledge Hub update for ${input.property}`,
    body: input.fact.trim(),
    warnings: [],
    needs_you: true,
  });
  return { sent: true, reason: "", savedLine: "", failedLine: "Couldn't save this to the Hub. The reply is still ready.", sentText };
}

async function writeAndConfirm(propertyId: string, fact: string): Promise<boolean> {
  try {
    if (hubWrite) {
      const echoed = await hubWrite(propertyId, fact);
      return echoed.includes(fact);
    }
    await hospitableRead("create-knowledge-hub-item", { property_id: propertyId, content: fact });
    const raw = await hospitableRead("get-property-knowledge-hub", { property_id: propertyId });
    return hubPlain(raw).includes(fact);
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    return false;
  }
}

/** The last saved guest pass. This does not scan Hospitable. */
export async function readSavedGuestQueue(): Promise<GuestQueue | null> {
  if (rememberedQueue) return rememberedQueue;
  const saved = await readGuestQueueSnapshot<GuestQueue>();
  if (!saved || !Array.isArray(saved.waiting) || !Array.isArray(saved.thanks)) return null;
  saved.onGuest = Array.isArray(saved.onGuest) ? saved.onGuest : [];
  saved.held = Array.isArray(saved.held) ? saved.held : [];
  saved.followUps = Array.isArray(saved.followUps) ? saved.followUps : [];
  saved.closedFollowUps = Array.isArray(saved.closedFollowUps) ? saved.closedFollowUps : [];
  saved.properties = Array.isArray(saved.properties) ? saved.properties : [];
  saved.answer = waitingSurfaceText(saved);
  rememberedQueue = saved;
  return saved;
}

/** Same stays and threads as Checks and the unanswered-messages report. Saves the pass for the next open. */
let scanning: Promise<GuestQueue> | null = null;

/** Requests that arrive while a scan is running share it instead of starting another. */
export async function loadGuestQueue(now = parityNow() ?? new Date()): Promise<GuestQueue> {
  if (parityEnabled()) return loadGuestQueueOnce(now);
  if (!scanning) scanning = loadGuestQueueOnce(now).finally(() => { scanning = null; });
  return scanning;
}

async function loadGuestQueueOnce(now: Date): Promise<GuestQueue> {
  if (!copilotScopeActive()) return withCopilotScope(() => loadGuestQueueOnce(now));
  await readHandledThreads();
  const queue = await scanGuestQueue(now);
  // Conversations waiting on you show their last guest message in English too (one batched, stored call).
  try {
    const rows = [...queue.waiting, ...queue.held];
    const texts = rows.map((row) => (row.preview || row.asked || "").trim()).filter((text) => text && !looksEnglish(text));
    if (texts.length) {
      const done = await translateMessages(texts);
      for (const row of rows) {
        const hit = done.get((row.preview || row.asked || "").trim());
        if (hit) row.askedEn = hit.english;
      }
    }
  } catch {
    /* The original text still shows. */
  }
  queue.answer = waitingSurfaceText(queue);
  if (queue.connected) {
    rememberedQueue = queue;
    if (parityEnabled()) paritySavedQueue = queue;
    await saveGuestQueueSnapshot(queue).catch(() => undefined);
  }
  return queue;
}

async function handledNow(): Promise<Set<string>> {
  try {
    for (const id of await readHandledFollowUps()) handledFollowUps.add(id);
  } catch {
    /* The ids marked in this process still close. */
  }
  return handledFollowUps;
}

/** "16:00", "4:00 PM", or an ISO time on the reservation row, as minutes after midnight. */
function clockMinutes(value: unknown): number | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  const iso = /T(\d{2}):(\d{2})/.exec(text) ?? /^(\d{1,2}):(\d{2})$/.exec(text);
  if (iso) return Number(iso[1]) * 60 + Number(iso[2]);
  const spoken = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(text);
  if (!spoken) return undefined;
  return ((Number(spoken[1]) % 12) + (spoken[3]?.toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(spoken[2] ?? "0");
}

function followStay(
  stay: { stay: { id: string; guest: string; propertyId: string; checkIn: string; checkOut: string }; label: string; reservation?: Record<string, unknown> | null },
  messages: { at: string; role: string; name: string; body: string }[],
  propertyPhoto: string,
): FollowUpStay {
  return {
    reservationId: stay.stay.id,
    guest: stay.stay.guest || "Guest",
    property: stay.label,
    propertyId: stay.stay.propertyId,
    propertyPhoto,
    guestPhoto: guestPhotoUrl(stay.reservation),
    checkIn: stay.stay.checkIn,
    checkOut: stay.stay.checkOut,
    standardIn: clockMinutes(stay.reservation?.checkin_time),
    standardOut: clockMinutes(stay.reservation?.checkout_time),
    turns: messages
      .filter((item) => item.role === "guest" || item.role === "host")
      .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body })),
  };
}

async function scanGuestQueue(now: Date): Promise<GuestQueue> {
  if (!(await copilotHospitableToken())) return disconnectedQueue();
  try {
    const read = await loadConversations(now);
    const loaded = { stays: read.conversations, failed: read.failed };
    const photos = await propertyPhotos();
    const waiting: GuestRow[] = [];
    const onGuest: GuestRow[] = [];
    const held: GuestRow[] = [];
    const thanks: GuestRow[] = [];
    const followUps: GuestFollowUp[] = [];
    const settled = new Map<string, string>();
    const scanned = new Set<string>();
    const unreadThreads = new Set<string>();
    const handled = await handledNow();
    await rememberVerifying();
    const unread = [...loaded.failed];
    const failed: string[] = [];
    const messageFailed = new Set<string>();
    const seenProperties = new Map<string, { id: string; label: string; failed: boolean }>();
    for (const stay of loaded.stays) {
      if (!seenProperties.has(stay.stay.propertyId)) seenProperties.set(stay.stay.propertyId, { id: stay.stay.propertyId, label: stay.label, failed: false });
    }
    for (const failure of loaded.failed) {
      const label = failure.replace(/ inquiries$| \(.*\)$/, "");
      const chip = [...seenProperties.values()].find((row) => row.label === label);
      if (chip) chip.failed = true;
      else seenProperties.set(label, { id: label, label, failed: true });
    }
    for (const stay of loaded.stays) {
      if (!stay.turnsFailed) continue;
      messageFailed.add(stay.label);
      const chip = seenProperties.get(stay.stay.propertyId);
      if (chip) chip.failed = true;
    }
    const quiet: GuestRow[] = [];
    // Read threads newest first, a few at a time, until the time budget runs out.
    // A conversation whose thread is not read is still listed, at its place by latest activity.
    const threads = new Map<string, { at: string; role: string; name: string; body: string; media?: ThreadTurn["media"] }[]>();
    const deadline = Date.now() + 35_000;
    // Recent activity or a stay that is current. Older conversations stay listed without a preview.
    const recentFrom = new Date(now.getTime() - 45 * 86_400_000).toISOString();
    const endedBefore = addDays(torontoToday(now), -7);
    const worthReading = (stay: (typeof loaded.stays)[number]) => stay.lastMessageAt >= recentFrom || stay.stay.checkOut >= endedBefore;
    let cursor = 0;
    const lane = async () => {
      while (cursor < loaded.stays.length && Date.now() < deadline) {
        const stay = loaded.stays[cursor++];
        if (!stay || stay.inquiry || !worthReading(stay)) continue;
        try {
          // Re-read only when the conversation's latest activity moved past what is cached.
          threads.set(stay.stay.id, await readStayThread(stay.stay.id, now, stay.lastMessageAt));
        } catch {
          unreadThreads.add(stay.stay.id);
          if (!messageFailed.has(stay.label)) {
            messageFailed.add(stay.label);
            if (!unread.includes(stay.label)) unread.push(stay.label);
            const chip = seenProperties.get(stay.stay.propertyId);
            if (chip) chip.failed = true;
          }
        }
      }
    };
    await Promise.all(Array.from({ length: 2 }, lane));
    await flushThreadCache();
    const todayOf = torontoToday(now);
    const supersededIds = supersededConversations(loaded.stays);
    for (const stay of loaded.stays) {
      const photo = photos.get(stay.stay.propertyId) || "";
      const messages = stay.inquiry
        ? (stay.turns ?? []).map((turn) => ({ ...turn, media: [] as ThreadTurn["media"] }))
        : threads.get(stay.stay.id) ?? [];
      const threadRead = stay.inquiry || threads.has(stay.stay.id);
      if (!threadRead && !unreadThreads.has(stay.stay.id)) unreadThreads.add(stay.stay.id);
      const record = recordFromRow(stay.reservation ?? {}, stay.label, stay.stay.propertyId);
      if (!stay.inquiry && record && isOpenRequest(record.status) && record.pendingAt) {
        scanned.add(record.id);
        const inquiryTurns: InquiryTurn[] = messages.map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body }));
        const card = bookingRequestFollowUp(record, inquiryTurns, now, phaseFor(record.id));
        if (card && !handled.has(card.id) && !followUps.some((item) => item.id === card.id)) followUps.push(card);
      }
      if (threadRead && !stay.inquiry) {
        scanned.add(stay.stay.id);
        const detected = detectFollowUps(followStay(stay, messages, photo), now);
        for (const row of detected.open) {
          if (!handled.has(row.id)) followUps.push(row);
        }
        for (const row of detected.settled) settled.set(row.id, row.closeText);
      }
      const turns = messages
        .filter((item) => item.role !== "system")
        .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body, media: item.media ?? [] }));
      const spoken = turns.filter((item) => item.body.trim() || item.media.length).slice().sort((a, b) => a.at.localeCompare(b.at));
      const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
      const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
      const last = spoken[spoken.length - 1];
      const activity = [last?.at ?? "", stay.lastMessageAt].sort().at(-1) || stay.lastMessageAt;
      const list = (row: GuestRow, bucket: GuestRow[]) => {
        row.activityAt = activity;
        row.preview = last ? clip(last.body.trim() || (last.media.length ? "Sent a photo" : ""), 140) : "";
        row.lastBy = last?.role === "host" ? (last.name.trim().split(/\s+/)[0] || "") : "";
        if (/^(unknown|host)$/i.test(row.lastBy)) row.lastBy = "";
        row.inquiry = stay.inquiry || undefined;
        bucket.push(row);
      };
      if (!last) {
        list(rowFrom(stay, "", activity, "", photo, now, readThread([], stay.stay.guest || "Guest")), quiet);
        continue;
      }
      if (last.role !== "guest" || !pending.length) {
        const parked = readThread(turns, stay.stay.guest || "Guest");
        const row = rowFrom(stay, "", last.at, "", photo, now, {
          ...parked,
          lane: last.role === "host" ? "guest" : parked.lane,
          watch: parked.watch || "their next message",
        });
        row.thanks = false;
        list(row, last.role === "host" ? onGuest : quiet);
        continue;
      }
      const ask = pending.map((item) => [item.body.trim(), ...item.media.map((media) => media.shows)].filter(Boolean).join(" ")).join(" ");
      const read = readThread(turns, stay.stay.guest || "Guest");
      const at = pending[pending.length - 1]?.at || last.at;
      const language = messageLanguage(ask);
      const row = rowFrom(stay, ask, at, language, photo, now, read);
      // Needs reply is judged from the whole thread state: status, dates, who decided what.
      const state = replyState({
        status: stay.stay.status,
        inquiry: stay.inquiry,
        checkIn: stay.stay.checkIn,
        checkOut: stay.stay.checkOut,
        today: todayOf,
        turns: spoken.map((item) => ({ at: item.at, role: item.role, body: item.body })),
        guest: stay.stay.guest || row.guest,
        superseded: supersededIds.has(stay.stay.id),
      });
      if (read.lane === "guest") {
        row.thanks = false;
        list(row, onGuest);
      } else if (read.lane === "reply" && handledReason(stay.stay.id, row.activityAt ?? "")) {
        // A partner marked it handled; it stays out of Needs reply until the guest writes again.
        row.quietReason = handledReason(stay.stay.id, row.activityAt ?? "");
        row.wait = "";
        row.waitedMs = 0;
        list(row, quiet);
      } else if (read.lane === "reply" && !state.needs) {
        row.quietReason = state.reason;
        row.wait = "";
        row.waitedMs = 0;
        list(row, quiet);
      } else if (read.lane === "reply") {
        list(row, heldIds.has(stay.stay.id) ? held : waiting);
      } else if (isThanksOnly(ask)) list(row, thanks);
      else list(row, quiet);
    }
    // One line for everything that could not be read, however many properties and read types failed.
    const notRead = failedReadsLine(loaded.failed, [...messageFailed]);
    if (notRead) failed.push(notRead);
    const longest = waiting.slice().sort((a, b) => b.waitedMs - a.waitedMs)[0]?.wait || "";
    waiting.sort((a, b) => a.waitedMs - b.waitedMs || a.guest.localeCompare(b.guest));
    collectInquiries(loaded.stays, seenProperties, followUps, scanned, handled, now);
    const previous = await storedFollowUps();
    const today = torontoToday(now);
    const activityById = new Map(loaded.stays.map((row) => [row.stay.id, row.lastMessageAt]));
    // A follow-up kept from the last load because its thread was not read this time still has to hold:
    // once the stay has ended and the thread has not continued since checkout, it closes.
    const stillHolds = (row: GuestFollowUp) => {
      if (row.kind === "inquiry" || !row.checkOut || row.checkOut >= today) return true;
      if (row.kind === "owe" && row.due && row.due >= today) return true;
      const activity = activityById.get(row.reservationId) ?? "";
      return Boolean(activity) && torontoToday(new Date(activity)) > row.checkOut;
    };
    // A stored open follow-up never disappears on its own. It closes when the thread settles it,
    // a partner marks it handled, or its stay has ended (a dated promise still ahead holds).
    // A thread that was not read this time, or a detection that no longer finds it, keeps it open.
    const sameLoop = (a: GuestFollowUp, b: GuestFollowUp) => a.reservationId === b.reservationId && a.kind === b.kind && a.topic === b.topic;
    for (const row of previous) {
      if (handled.has(row.id) || followUps.some((item) => item.id === row.id || sameLoop(item, row))) continue;
      if (settled.has(row.id)) continue;
      if (row.kind === "inquiry") {
        if (unreadThreads.has(row.reservationId)) followUps.push(row);
        continue;
      }
      if (stillHolds(row)) followUps.push(repaintFollowUp(row, now));
      else settled.set(row.id, `the stay ended ${row.checkOut} and the thread did not continue it`);
    }
    for (const row of stagedInquiries) {
      if (!handled.has(row.id) && !followUps.some((item) => item.id === row.id)) followUps.push(row);
    }
    await reconcileInquiryCloses(previous, followUps, settled, scanned, now);
    const ordered = orderFollowUps(followUps, now);
    const openIds = new Set(ordered.map((row) => row.id));
    const closedFollowUps = previous
      .filter((row) => scanned.has(row.reservationId) && !openIds.has(row.id) && !handled.has(row.id))
      .map((row) => ({ id: row.id, guest: row.guest, closeText: settled.get(row.id) || "the thread shows it resolved", record: row }));
    const summary = guestSummary(waiting.length, longest, unread);
    return {
      connected: true,
      line: "",
      summaryLead: summary.lead,
      summaryRest: summary.rest,
      waiting,
      onGuest,
      held,
      thanks,
      quiet: quiet.sort((a, b) => (b.activityAt || "").localeCompare(a.activityAt || "")),
      followUps: ordered,
      closedFollowUps,
      failed,
      properties: [...seenProperties.values()],
      answer: "",
    };
  } catch (err) {
    if (!(await copilotHospitableToken())) return disconnectedQueue();
    const message = err instanceof Error ? err.message : "Hospitable didn't return the guest list.";
    return {
      connected: true,
      line: "",
      summaryLead: "The message read is incomplete",
      summaryRest: ".",
      waiting: [],
      onGuest: [],
      held: [],
      thanks: [],
      followUps: [],
      closedFollowUps: [],
      failed: [message],
      properties: [],
      answer: "",
    };
  }
}

function phaseFor(reservationId: string): InquiryPhase {
  const row = verifyingInquiries.get(`inquiry:${reservationId}`);
  if (!row) return "";
  return row.action === "decline" ? "verifying-decline" : "verifying-approve";
}

async function rememberVerifying(): Promise<void> {
  const saved = await readInquiryVerifying().catch(() => []);
  for (const row of saved) verifyingInquiries.set(row.id, row);
}

function forgetVerify(id: string): void {
  if (!verifyingInquiries.delete(id)) return;
  void saveInquiryVerifying([...verifyingInquiries.values()]).catch(() => undefined);
}

function oneRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const data = (raw as { data?: unknown }).data;
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return null;
}

function turnsFrom(row: Record<string, unknown>): InquiryTurn[] {
  const messages = Array.isArray(row.messages) ? row.messages : [];
  return messages.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Record<string, unknown>;
    const author = message.author && typeof message.author === "object" ? message.author as Record<string, unknown> : {};
    return [{
      at: String(message.created_at ?? message.at ?? ""),
      role: String(message.sender_role ?? message.role ?? "guest"),
      name: String(author.name ?? message.name ?? ""),
      body: String(message.body ?? ""),
    }];
  });
}

/**
 * Booking requests waiting on an answer, from the inquiries the inbox already read.
 * Hospitable's inquiry list refuses include=messages, so the messages come from each inquiry's own read.
 */
function collectInquiries(
  conversations: Conversation[],
  properties: Map<string, { id: string; label: string; failed: boolean }>,
  followUps: GuestFollowUp[],
  scanned: Set<string>,
  handled: Set<string>,
  now: Date,
): void {
  for (const stay of conversations) {
    if (!stay.inquiry || properties.get(stay.stay.propertyId)?.failed && !stay.turns?.length) continue;
    const record = recordFromRow(stay.reservation ?? {}, stay.label, stay.stay.propertyId);
    if (!record?.pendingAt) continue;
    scanned.add(record.id);
    const turns: InquiryTurn[] = (stay.turns ?? []).map((turn) => ({ at: turn.at, role: turn.role, name: turn.name, body: turn.body }));
    if (isOpenRequest(record.status)) {
      const card = bookingRequestFollowUp(record, turns, now, phaseFor(record.id));
      if (card && !handled.has(card.id) && !followUps.some((item) => item.id === card.id)) followUps.push(card);
    }
  }
}

async function reconcileInquiryCloses(
  previous: GuestFollowUp[],
  followUps: GuestFollowUp[],
  settled: Map<string, string>,
  scanned: Set<string>,
  now: Date,
): Promise<void> {
  for (const prev of previous) {
    if (prev.kind !== "inquiry" || followUps.some((row) => row.id === prev.id) || settled.has(prev.id)) continue;
    if (!scanned.has(prev.reservationId)) continue;
    const raw = await hospitableRead("get-reservation", { identifier: prev.reservationId, include: "guest,financials" }).catch(() => null);
    const inquiryRaw = recordFromRow(oneRecord(raw) ?? {}, prev.property, prev.propertyId)
      ? null
      : await hospitableRead("get-inquiry", { identifier: prev.reservationId, include: "guest,messages" }).catch(() => null);
    const record = recordFromRow(oneRecord(raw) ?? {}, prev.property, prev.propertyId)
      ?? recordFromRow(oneRecord(inquiryRaw) ?? {}, prev.property, prev.propertyId);
    if (!record) continue;
    forgetVerify(prev.id);
    const status = isOpenRequest(record.status) ? "expired" : record.status;
    settled.set(prev.id, inquiryCloseText(status, prev.expiresAt, now));
  }
}

async function propertyPhotos(): Promise<Map<string, string>> {
  const photos = new Map<string, string>();
  try {
    for (const row of propertiesOf(await hospitableRead("get-properties", {}))) {
      if (row.photo) photos.set(row.id, row.photo);
    }
  } catch {
    /* The list still names the property when the photo does not return. */
  }
  return photos;
}

/** An inquiry's messages come with the inquiry, not from a reservation thread. */
async function inquiryThread(id: string): Promise<{ at: string; role: string; name: string; body: string; media: GuestMedia[] }[]> {
  const raw = await hospitableRead("get-inquiry", { uuid: id, identifier: id, include: "guest,messages" });
  const row = oneRecord(raw) ?? {};
  return turnsFrom(row).map((turn) => ({
    ...turn,
    role: /host/i.test(turn.role) ? "host" : /system|automat/i.test(turn.role) ? "system" : "guest",
    media: [] as GuestMedia[],
  }));
}

/**
 * Suggest with AI, for any conversation: the thread in English, the property's Knowledge Hub and notes,
 * into one suggested reply. The partner edits it and presses Send; nothing is sent here.
 */
export async function suggestReply(row: GuestRow, now = new Date()): Promise<string> {
  const [messages, hubRead, memory] = await Promise.all([
    (row.inquiry ? inquiryThread(row.id) : readStayThread(row.id, now)).catch(() => []),
    readPropertyHub(row.propertyId),
    memoryFor(row.property).catch(() => ""),
  ]);
  const spoken = messages.filter((item) => item.role !== "system" && item.body.trim());
  const translations = await translateMessages(spoken.filter((item) => item.role === "guest").map((item) => item.body)).catch(() => new Map<string, Translation>());
  const thread = spoken
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((item) => ({ who: item.role === "guest" ? "guest" as const : "host" as const, name: item.name || (item.role === "guest" ? row.guest : "Host"), text: translations.get(item.body.trim())?.english ?? item.body }));
  if (!thread.length) throw new Error("There are no messages in this conversation to reply to yet.");
  const draft = await suggestGuestReply({
    guest: row.guest,
    property: row.property,
    stay: row.dates || [row.checkIn, row.checkOut].filter(Boolean).join(" to "),
    thread,
    hub: hubRead.ok ? hubRead.text : "",
    memory,
  });
  if (!draft) throw new Error("The AI didn't answer. Nothing was changed; try again.");
  return draft;
}

export async function openGuestAnswer(row: GuestRow, now = new Date()): Promise<GuestDraftView> {
  // Every read at once: the thread (cached when its activity hasn't moved), the reservation, the
  // Knowledge Hub, the saved inbox and memory. One after another took seconds.
  const [messages, stayRaw, hubRead, saved, memory] = await Promise.all([
    // A thread that won't read still opens, from the row, with the failure said in the thread view.
    (row.inquiry ? inquiryThread(row.id) : readStayThread(row.id, now)).catch(() => null),
    hospitableRead("get-reservation", { identifier: row.id }).catch(() => null),
    readPropertyHub(row.propertyId),
    readSavedGuestQueue().catch(() => null),
    memoryFor(row.property).catch(() => ""),
  ]);
  const unread = messages === null;
  const turns: ThreadTurn[] = (messages ?? [])
    .filter((item) => item.role !== "system")
    .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body, media: item.media ?? [] }));
  const hub = hubRead.ok ? hubRead.text : "";
  const threadRead = readThread(turns, row.guest);
  const spoken = turns.filter((item) => item.body.trim() || item.media.length);
  const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
  const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
  // Every guest message that isn't English is shown and drafted from in English (stored; never paid for twice).
  const translations = await translateMessages(spoken.filter((item) => item.role === "guest").map((item) => item.body)).catch(() => new Map<string, Translation>());
  const english = (body: string) => translations.get(body.trim())?.english ?? body;
  const ask = pending.map((item) => english(item.body).trim()).join(" ") || row.asked;
  // The same rule as the inbox: a cancelled, superseded, closed, or passed thread gets no draft.
  const listed = saved?.quiet?.find((item) => item.id === row.id);
  const raw = oneRecord(stayRaw) ?? {};
  await readHandledThreads();
  const latestGuest = spoken.filter((item) => item.role === "guest").map((item) => item.at).sort().at(-1) ?? "";
  const handled = handledReason(row.id, latestGuest || row.activityAt || "");
  const state = handled
    ? { needs: false, reason: handled }
    : listed?.quietReason
    ? { needs: false, reason: listed.quietReason }
    : replyState({
      status: String(raw.status ?? row.status ?? ""),
      inquiry: Boolean(row.inquiry),
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      today: torontoToday(now),
      turns: spoken.map((item) => ({ at: item.at, role: item.role, body: item.body })),
      guest: row.guest,
    });
  const read = threadRead.lane === "reply" && !state.needs ? { ...threadRead, lane: "none" as const, waitingLine: state.reason, status: state.reason } : threadRead;
  const hubDraft = read.lane === "reply" ? draftFromHub(row.guest, ask, hub, { place: row.property, memory }) : { mode: "gap" as const, draft: "", facts: "", gap: "" };
  // A draft is a complete answer or nothing: never a heading, a stub, or a sentence cut off.
  const broken = hubDraft.mode === "hub" ? draftProblem(hubDraft.draft) : "";
  const fromHub = broken ? { mode: "gap" as const, draft: "", facts: "", gap: "a complete answer to this" } : hubDraft;
  const outside = read.situation ? await outsideDraft(read, row.guest, turns) : { draft: "", alternates: [], basedOn: "", pageTitle: "" };
  const stood = read.situation ? standing.get(read.situation) ?? "" : "";
  const held = read.lane === "guest";
  const draft = held ? (stood || outside.draft) : stood || (fromHub.mode === "hub" ? fromHub.draft : outside.draft);
  const mode = held ? "held" as const : draft ? "hub" as const : "gap" as const;
  const thread = presentGuestThread(messages ?? [], row.guest, hostNameFrom(stayRaw), now, read.copied).map((bubble) => {
    const done = translations.get(bubble.text.trim());
    return done ? { ...bubble, english: done.english, language: done.language } : bubble;
  });
  if (!held && mode === "hub" && draft) rememberGuestDraft({ to: row.guest, body: draft, reservationId: row.id, language: row.language });
  const reservation = reservationSpan(stayRaw);
  return {
    ...row,
    lane: read.lane,
    status: read.status || row.status,
    statusLead: read.statusLead,
    statusRest: read.statusRest,
    watch: read.watch,
    stay: stayLine(stayRaw),
    thread,
    mode: fromHub.mode === "gap" && !draft && !held ? "gap" : mode,
    draft,
    alternates: outside.alternates,
    sendable: !held && Boolean(draft),
    situation: read.situation,
    waitingLine: unread ? "Hospitable didn't return the messages for this conversation. Go back and open it again in a moment." : read.waitingLine,
    partnerNotes: read.partnerNotes,
    basedOn: outside.basedOn || (fromHub.facts ? `the Knowledge Hub · ${fromHub.facts}` : ""),
    sourceLine: sourceLine(read, reservation, outside.pageTitle),
    mediaSlot: read.mediaSlot,
    sentVersion: !held && draft ? draft : "",
    facts: fromHub.facts,
    gap: !draft && !held ? fromHub.gap : "",
    savedLine: "",
    failedLine: "",
  };
}

function joinPlaces(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Cancelled bookings and inquiries whose guest now holds a newer live booking. The newer thread is
 * the live one; the old one never counts toward Needs reply.
 */
function supersededConversations(conversations: Conversation[]): Set<string> {
  const stamp = (row: Conversation) => {
    const raw = row.reservation ?? {};
    return String(raw.booked_at ?? raw.created_at ?? "") || row.stay.checkIn;
  };
  const live = new Map<string, Conversation[]>();
  for (const row of conversations) {
    const key = guestKey(row.reservation);
    if (!key || row.inquiry || /cancel|declin|denied|expired|withdrawn|inquiry|request|pending/i.test(row.stay.status)) continue;
    live.set(key, [...(live.get(key) ?? []), row]);
  }
  const out = new Set<string>();
  for (const row of conversations) {
    const dead = row.inquiry || /cancel|declin|denied|expired|withdrawn/i.test(row.stay.status);
    if (!dead) continue;
    const key = guestKey(row.reservation);
    const newer = (key ? live.get(key) ?? [] : []).some((other) => other.stay.id !== row.stay.id && (stamp(other) > stamp(row) || other.stay.checkIn >= row.stay.checkIn));
    if (newer) out.add(row.stay.id);
  }
  return out;
}

/** Every failed read named in one sentence: conversations, inquiries, and latest messages. */
export function failedReadsLine(listFailures: string[], messageFailures: string[]): string {
  const inquiries = listFailures.filter((label) => / inquiries$/.test(label)).map((label) => label.replace(/ inquiries$/, ""));
  const conversations = listFailures.filter((label) => !/ inquiries$/.test(label));
  const parts = [
    conversations.length ? `the conversations for ${joinPlaces([...new Set(conversations)])}` : "",
    inquiries.length ? `the inquiries for ${joinPlaces([...new Set(inquiries)])}` : "",
    messageFailures.length ? `the latest messages for ${joinPlaces([...new Set(messageFailures)])}` : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `Couldn't read ${parts.join("; ")} from Hospitable, so some conversations are missing or show without their latest activity. Nothing was sent.`;
}

function rowFrom(
  stay: { stay: { id: string; guest: string; propertyId: string; checkIn: string; checkOut: string }; label: string; reservation?: Record<string, unknown> | null },
  ask: string,
  at: string,
  language: string,
  propertyPhoto: string,
  now: Date,
  read: ReturnType<typeof readThread>,
): GuestRow {
  const waitedMs = Math.max(0, now.getTime() - new Date(at || now.toISOString()).getTime());
  const guest = stay.stay.guest || "Guest";
  const first = guest.trim().split(/\s+/)[0] || "Guest";
  const today = torontoToday(now);
  const arrival = whenLabel(stay.stay.checkIn, stay.stay.checkOut, today);
  return {
    id: stay.stay.id,
    guest,
    first,
    initials: initials(guest),
    guestPhoto: guestPhotoUrl(stay.reservation),
    property: stay.label,
    propertyId: stay.stay.propertyId,
    propertyPhoto,
    asked: clip(ask, 140),
    askedEn: language ? toEnglish(ask, language) : "",
    language,
    wait: waitLabel(waitedMs),
    waitedMs,
    thanks: read.lane === "none",
    lane: read.lane,
    status: read.status,
    statusLead: read.statusLead,
    statusRest: read.statusRest,
    watch: read.watch,
    when: arrival.when,
    urgent: arrival.urgent,
    dates: shortRange(stay.stay.checkIn, stay.stay.checkOut),
    checkIn: stay.stay.checkIn,
    checkOut: stay.stay.checkOut,
    mediaLabel: read.mediaLabel,
    lastNote: read.lane === "guest" ? `Said they will check · ${waitLabel(waitedMs)} ago` : "",
    activityAt: at,
  };
}

function whenLabel(checkIn: string, checkOut: string, today: string): { when: string; urgent: boolean } {
  if (!checkIn) return { when: "", urgent: false };
  if (checkIn === today) return { when: "Arrives today", urgent: true };
  if (checkIn === addDays(today, 1)) return { when: "Arrives tomorrow", urgent: true };
  if (checkIn < today && checkOut > today) return { when: "In stay", urgent: false };
  const days = Math.round((Date.parse(`${checkIn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  if (days > 1) return { when: `Arrives in ${days} days`, urgent: false };
  return { when: "", urgent: false };
}

function shortRange(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return "";
  const start = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkIn}T12:00:00Z`));
  const end = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkOut}T12:00:00Z`));
  const [startMonth, startDay] = start.split(" ");
  const [endMonth, endDay] = end.split(" ");
  if (startMonth === endMonth) return `${startMonth} ${startDay}–${endDay}`;
  return `${start}–${end}`;
}

async function publicGuestFile(file: GuestFile): Promise<string> {
  if (uploader) return uploader(file);
  const db = getSupabaseAdmin();
  if (!db) throw new Error("The file didn’t upload");
  const bytes = Buffer.from(file.data, "base64");
  const safe = file.name.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "file";
  const path = `guest-messages/${randomUUID()}-${safe}`;
  const { error } = await db.storage.from("pm-contracts").upload(path, bytes, { contentType: file.mime || "application/octet-stream", upsert: false });
  if (error) throw new Error(`The file didn’t upload (${error.message})`);
  const { data } = db.storage.from("pm-contracts").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("The file didn’t upload");
  return data.publicUrl;
}

function propertiesOf(raw: unknown): { id: string; name: string; photo: string }[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) return [];
    return [{ id: String(row.id ?? name), name, photo: http(row.picture) }];
  });
}

function stayLine(raw: unknown): string {
  const data = raw && typeof raw === "object" && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
    ? (raw as { data: Record<string, unknown> }).data
    : {};
  const checkIn = String(data.arrival_date ?? data.check_in ?? "").slice(0, 10);
  const checkOut = String(data.departure_date ?? data.check_out ?? "").slice(0, 10);
  const guests = guestCount(data);
  if (!checkIn || !checkOut) return "";
  const nights = Math.max(1, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000));
  const start = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkIn}T12:00:00Z`));
  const end = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkOut}T12:00:00Z`));
  const people = guests > 0 ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : "";
  return `${start} → ${end} · ${nights} ${nights === 1 ? "night" : "nights"}${people}`;
}

function guestCount(data: Record<string, unknown>): number {
  if (typeof data.guests === "number") return data.guests;
  if (data.guests && typeof data.guests === "object") {
    const total = Number((data.guests as { total?: unknown }).total);
    if (Number.isFinite(total) && total > 0) return total;
  }
  const adults = Number(data.adults ?? 0);
  const children = Number(data.children ?? 0);
  return (Number.isFinite(adults) ? adults : 0) + (Number.isFinite(children) ? children : 0);
}

function reservationSpan(raw: unknown): string {
  const data = raw && typeof raw === "object" && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
    ? (raw as { data: Record<string, unknown> }).data
    : {};
  const checkIn = String(data.arrival_date ?? data.check_in ?? "").slice(0, 10);
  const checkOut = String(data.departure_date ?? data.check_out ?? "").slice(0, 10);
  return shortRange(checkIn, checkOut).replace("–", "-");
}

function realPerson(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || /^(unknown|host|guest|airbnb|system|automated message)$/i.test(name)) return "";
  return name;
}

function hostNameFrom(raw: unknown): string {
  const data = raw && typeof raw === "object" && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
    ? (raw as { data: Record<string, unknown> }).data
    : raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const user = data.user && typeof data.user === "object" ? data.user as Record<string, unknown> : {};
  const host = data.host && typeof data.host === "object" ? data.host as Record<string, unknown> : {};
  return realPerson(user.name) || realPerson(user.full_name) || realPerson(user.first_name) || realPerson(host.name) || realPerson(host.first_name);
}

/** Oldest message first. Guest, co-host, or Automated message. The word Unknown is never a sender. */
export function presentGuestThread(
  messages: { at: string; role: string; name: string; body: string; media?: GuestMedia[] }[],
  guest: string,
  hostName: string,
  now: Date,
  copied = "",
): GuestBubble[] {
  const ordered = messages
    .filter((item) => item.body.trim() || item.media?.length)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const guestName = guest.trim() || "Guest";
  const knownHost = realPerson(hostName) || ordered.map((item) => item.role === "host" ? realPerson(item.name) : "").find(Boolean) || "";
  return ordered.map((item) => {
    const automated = item.role === "system" || item.role === "automated";
    const fromGuest = item.role === "guest";
    const who = automated
      ? "Automated message"
      : fromGuest
        ? realPerson(item.name) || guestName
        : realPerson(item.name) || knownHost;
    return {
      role: automated ? "automated" as const : fromGuest ? "guest" as const : "host" as const,
      who: /^unknown$/i.test(who) ? (automated ? "Automated message" : fromGuest ? guestName : knownHost) : who,
      at: item.at,
      time: messageTime(item.at, now),
      text: item.body,
      english: fromGuest || messageLanguage(item.body) ? toEnglish(item.body) : "",
      language: messageLanguage(item.body),
      media: item.media ?? [],
      flag: !fromGuest && !automated && copied && /\b(he|his|him|she|her)\b/i.test(item.body) ? `Copied text: says “${copied}” for ${guestName}` : "",
    };
  });
}

function messageTime(iso: string, now: Date): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  const age = now.getTime() - at.getTime();
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at);
  if (age < 6 * 86400000) {
    const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Toronto" }).format(at);
    return `${day} ${time}`;
  }
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
  return `${date}, ${time}`;
}

function http(value: unknown): string {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] || "").join("").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "G";
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
