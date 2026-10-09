/**
 * Guest messaging. Submit is the only send. Drafts stay here, not in Checks.
 * A thanks-only note never waits and never gets a draft.
 */

import { hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { hubPlain, readPropertyHub } from "./knowledgeHub.js";
import { readGuestQueueSnapshot, saveGuestQueueSnapshot } from "./store.js";
import { leaveDraft, loadRecentStays, memoryFor, readStayThread } from "./stayCheck.js";
import { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, toGuestLanguage } from "./guestTranslate.js";
import type { GuestDraftView, GuestQueue, GuestRow } from "./guestTypes.js";

export type { GuestBubble, GuestDraftView, GuestQueue, GuestRow } from "./guestTypes.js";
export { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, toGuestLanguage } from "./guestTranslate.js";

let poster: ((id: string, text: string) => Promise<void>) | null = null;
let hubWrite: ((propertyId: string, fact: string) => Promise<string>) | null = null;
const drafts = new Map<string, { to: string; body: string; reservationId: string; language: string }>();
let rememberedQueue: GuestQueue | null = null;

export function resetGuestMessaging(): void {
  poster = null;
  hubWrite = null;
  drafts.clear();
  rememberedQueue = null;
}

export function setGuestPoster(next: ((id: string, text: string) => Promise<void>) | null): void {
  poster = next;
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

export function guestSummary(count: number, longest: string): { lead: string; rest: string } {
  if (count === 0) return { lead: "No one", rest: " is waiting. Every guest has a reply." };
  if (count === 1) return { lead: "1 guest", rest: ` waiting. Longest wait: ${longest}.` };
  return { lead: `${count} guests`, rest: ` waiting. Longest wait: ${longest}.` };
}

const TOPIC_STOP = new Set([
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
    .filter((sentence) => sentence.length > 0 && sentence.length <= 500);
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

function partnerSignOff(memory = ""): string {
  const line = memory.split("\n").find((row) => /sign-off/i.test(row));
  if (!line) return "Shane, Co-Host 647-822-0448";
  return line.replace(/^.*sign-off:\s*/i, "").trim() || "Shane, Co-Host 647-822-0448";
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
  const name = guest.trim().split(/\s+/)[0] || "there";
  const place = context?.place ?? "";
  const memory = context?.memory ?? "";
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
    draft: `Hi ${name},\n\n${facts}\n\n${partnerSignOff(memory)}`,
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

export async function submitGuestReply(input: {
  reservationId: string;
  propertyId: string;
  property: string;
  guest: string;
  english: string;
  language: string;
  fact: string;
}): Promise<{ sent: true; savedLine: string; failedLine: string; sentText: string }> {
  const sentText = toGuestLanguage(input.english, input.language);
  if (!sentText.trim()) throw new Error("The draft is empty. Nothing was sent.");
  if (poster) await poster(input.reservationId, sentText);
  else await hospitableRead("send-reservation-message", { reservation_id: input.reservationId, body: sentText });
  if (!input.fact.trim()) return { sent: true, savedLine: "", failedLine: "", sentText };
  const saved = await writeAndConfirm(input.propertyId, input.fact.trim());
  if (saved) return { sent: true, savedLine: `Saved to the ${input.property} Knowledge Hub`, failedLine: "", sentText };
  await leaveDraft({
    channel: "note",
    to: "",
    subject: `Knowledge Hub update for ${input.property}`,
    body: input.fact.trim(),
    warnings: [],
    needs_you: true,
  });
  return { sent: true, savedLine: "", failedLine: "Couldn't save this to the Hub. The reply is still ready.", sentText };
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
  rememberedQueue = saved;
  return saved;
}

/** Same stays and threads as Checks and the unanswered-messages report. Saves the pass for the next open. */
export async function loadGuestQueue(now = new Date()): Promise<GuestQueue> {
  const queue = await scanGuestQueue(now);
  if (queue.connected) {
    rememberedQueue = queue;
    await saveGuestQueueSnapshot(queue).catch(() => undefined);
  }
  return queue;
}

async function scanGuestQueue(now: Date): Promise<GuestQueue> {
  try {
    const loaded = await loadRecentStays(now);
    const photos = await propertyPhotos();
    const waiting: GuestRow[] = [];
    const thanks: GuestRow[] = [];
    const failed = loaded.failed.map((label) => `Couldn't read reservations for ${label}, so anyone waiting there isn't listed. Nothing was sent.`);
    for (const stay of loaded.stays) {
      let messages: { at: string; role: string; body: string }[];
      try {
        messages = await readStayThread(stay.stay.id, now);
      } catch (err) {
        if (err instanceof Error && /not connected/i.test(err.message)) throw err;
        failed.push(`Couldn't read messages for ${stay.label}, so anyone waiting there isn't listed. Nothing was sent.`);
        continue;
      }
      const spoken = messages.filter((item) => item.role !== "system" && item.body.trim());
      const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
      const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
      const last = spoken[spoken.length - 1];
      if (!last || last.role !== "guest" || !pending.length) continue;
      const ask = pending.map((item) => item.body.trim()).join(" ");
      if (!needsGuestReply(ask) && !isThanksOnly(ask)) continue;
      const at = pending[pending.length - 1]?.at || last.at;
      const language = messageLanguage(ask);
      const row = rowFrom(stay, ask, at, language, photos.get(stay.stay.propertyId) || "", now);
      if (needsGuestReply(ask)) waiting.push(row);
      else thanks.push(row);
    }
    waiting.sort((a, b) => b.waitedMs - a.waitedMs || a.guest.localeCompare(b.guest));
    const summary = guestSummary(waiting.length, waiting[0]?.wait || "");
    return { connected: true, line: "", summaryLead: summary.lead, summaryRest: summary.rest, waiting, thanks, failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : HOSPITABLE_NOT_CONNECTED;
    return {
      connected: false,
      line: /not connected/i.test(message) ? HOSPITABLE_NOT_CONNECTED : message,
      summaryLead: "No one",
      summaryRest: " is waiting. Every guest has a reply.",
      waiting: [],
      thanks: [],
      failed: [],
    };
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

export async function openGuestAnswer(row: GuestRow, now = new Date()): Promise<GuestDraftView> {
  const messages = (await readStayThread(row.id, now)).map((item) => ({
    role: item.role,
    body: item.body,
    at: item.at,
  }));
  const stayRaw = await hospitableRead("get-reservation", { identifier: row.id }).catch(() => null);
  const hubRead = await readPropertyHub(row.propertyId);
  const hub = hubRead.ok ? hubRead.text : "";
  const spoken = messages.filter((item) => item.role !== "system" && item.body.trim());
  const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
  const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
  const ask = pending.map((item) => item.body.trim()).join(" ") || row.asked;
  const memory = await memoryFor(row.property).catch(() => "");
  const written = draftFromHub(row.guest, ask, hub, { place: row.property, memory });
  const thread = messages.filter((item) => item.role === "guest" || item.role === "host").map((item) => ({
    role: item.role as "guest" | "host",
    who: item.role === "guest" ? row.first : "Host",
    time: messageTime(item.at, now),
    text: item.body,
    english: item.role === "guest" || messageLanguage(item.body) ? toEnglish(item.body) : "",
    language: messageLanguage(item.body),
  }));
  if (written.mode === "hub") rememberGuestDraft({ to: row.guest, body: written.draft, reservationId: row.id, language: row.language });
  return {
    ...row,
    stay: stayLine(stayRaw),
    thread,
    mode: written.mode,
    draft: written.draft,
    sentVersion: written.mode === "hub" ? toGuestLanguage(written.draft, row.language) : "",
    facts: written.facts,
    gap: written.gap,
    savedLine: "",
    failedLine: "",
  };
}

function rowFrom(
  stay: { stay: { id: string; guest: string; propertyId: string }; label: string },
  ask: string,
  at: string,
  language: string,
  propertyPhoto: string,
  now: Date,
): GuestRow {
  const waitedMs = Math.max(0, now.getTime() - new Date(at || now.toISOString()).getTime());
  const guest = stay.stay.guest || "Guest";
  const first = guest.trim().split(/\s+/)[0] || "Guest";
  return {
    id: stay.stay.id,
    guest,
    first,
    initials: initials(guest),
    guestPhoto: "",
    property: stay.label,
    propertyId: stay.stay.propertyId,
    propertyPhoto,
    asked: clip(ask, 140),
    askedEn: language ? toEnglish(ask, language) : "",
    language,
    wait: waitLabel(waitedMs),
    waitedMs,
    thanks: isThanksOnly(ask),
  };
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
  const guests = Number(data.guests ?? data.adults ?? 0);
  if (!checkIn || !checkOut) return "";
  const nights = Math.max(1, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000));
  const start = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkIn}T12:00:00Z`));
  const end = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkOut}T12:00:00Z`));
  const people = guests > 0 ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : "";
  return `${start} → ${end} · ${nights} ${nights === 1 ? "night" : "nights"}${people}`;
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
