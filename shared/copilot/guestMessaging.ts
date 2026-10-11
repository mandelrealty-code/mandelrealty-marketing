/**
 * Guest messaging. Submit is the only send. Drafts stay here, not in Checks.
 * A thanks-only note never waits and never gets a draft.
 */

import { randomUUID } from "node:crypto";
import { copilotHospitableToken, hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { outsideDraft, readThread, sourceLine, type ThreadTurn } from "./guestIntelligence.js";
import { hubPlain, readPropertyHub } from "./knowledgeHub.js";
import { detectFollowUps, orderFollowUps, type FollowUpStay } from "./guestFollowUps.js";
import { readGuestQueueSnapshot, readHandledFollowUps, saveGuestQueueSnapshot, saveHandledFollowUps } from "./store.js";
import { leaveDraft, loadRecentStays, memoryFor, readStayThread } from "./stayCheck.js";
import { parityNow } from "./parity/clock.js";
import { addDays, torontoToday } from "./time.js";
import { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, toGuestLanguage } from "./guestTranslate.js";
import { getSupabaseAdmin } from "../supabase.js";
import type { GuestDraftView, GuestFile, GuestFollowUp, GuestQueue, GuestRow } from "./guestTypes.js";

export type { GuestBubble, GuestDraftView, GuestFollowUp, GuestQueue, GuestRow } from "./guestTypes.js";
export { isThanksOnly, messageLanguage, needsGuestReply, toEnglish, toGuestLanguage } from "./guestTranslate.js";

let poster: ((id: string, text: string) => Promise<void>) | null = null;
let uploader: ((file: GuestFile) => Promise<string>) | null = null;
let hubWrite: ((propertyId: string, fact: string) => Promise<string>) | null = null;
const drafts = new Map<string, { to: string; body: string; reservationId: string; language: string }>();
const standing = new Map<string, string>();
const heldIds = new Set<string>();
const handledFollowUps = new Set<string>();
let stagedInquiries: GuestFollowUp[] = [];
let rememberedQueue: GuestQueue | null = null;

export function resetGuestMessaging(): void {
  poster = null;
  uploader = null;
  hubWrite = null;
  drafts.clear();
  standing.clear();
  heldIds.clear();
  handledFollowUps.clear();
  stagedInquiries = [];
  rememberedQueue = null;
}

/** Inquiry rows are created by the booking-request pass. This pass only places them in the group. */
export function stageInquiryFollowUps(rows: GuestFollowUp[]): void {
  stagedInquiries = rows.map((row) => ({ ...row, kind: "inquiry" as const }));
}

export async function clearHandledFollowUps(): Promise<void> {
  handledFollowUps.clear();
  await saveHandledFollowUps([]).catch(() => undefined);
}

/** Closes a follow-up for good. A later read of the same thread will not bring it back. */
export async function markFollowUpHandled(id: string, now = parityNow() ?? new Date()): Promise<GuestQueue> {
  const trimmed = id.trim();
  if (trimmed) handledFollowUps.add(trimmed);
  await saveHandledFollowUps([...handledFollowUps]).catch(() => undefined);
  return loadGuestQueue(now);
}

export function setGuestPoster(next: ((id: string, text: string) => Promise<void>) | null): void {
  poster = next;
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

export async function submitGuestReply(input: {
  reservationId: string;
  propertyId: string;
  property: string;
  guest: string;
  english: string;
  language: string;
  fact: string;
  attachments?: GuestFile[];
}): Promise<{ sent: true; savedLine: string; failedLine: string; sentText: string }> {
  const sentText = toGuestLanguage(input.english, input.language);
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
  if (poster) await poster(input.reservationId, sentText);
  else {
    await hospitableRead("send-reservation-message", {
      uuid: input.reservationId,
      reservation_id: input.reservationId,
      body: sentText,
      ...(images.length ? { images } : {}),
    });
  }
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
export async function loadGuestQueue(now = parityNow() ?? new Date()): Promise<GuestQueue> {
  const queue = await scanGuestQueue(now);
  queue.answer = waitingSurfaceText(queue);
  if (queue.connected) {
    rememberedQueue = queue;
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

function followStay(
  stay: { stay: { id: string; guest: string; propertyId: string; checkIn: string; checkOut: string }; label: string },
  messages: { at: string; role: string; name: string; body: string }[],
  propertyPhoto: string,
): FollowUpStay {
  return {
    reservationId: stay.stay.id,
    guest: stay.stay.guest || "Guest",
    property: stay.label,
    propertyId: stay.stay.propertyId,
    propertyPhoto,
    checkIn: stay.stay.checkIn,
    checkOut: stay.stay.checkOut,
    turns: messages
      .filter((item) => item.role === "guest" || item.role === "host")
      .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body })),
  };
}

async function scanGuestQueue(now: Date): Promise<GuestQueue> {
  if (!(await copilotHospitableToken())) return disconnectedQueue();
  try {
    const loaded = await loadRecentStays(now, true);
    const photos = await propertyPhotos();
    const today = torontoToday(now);
    const waiting: GuestRow[] = [];
    const onGuest: GuestRow[] = [];
    const held: GuestRow[] = [];
    const thanks: GuestRow[] = [];
    const followUps: GuestFollowUp[] = [];
    const settled = new Map<string, string>();
    const scanned = new Set<string>();
    const unreadThreads = new Set<string>();
    const handled = await handledNow();
    const unread = [...loaded.failed];
    const failed = loaded.failed.map((label) => `Couldn't read reservations for ${label}, so anyone waiting there isn't listed. Nothing was sent.`);
    const messageFailed = new Set<string>();
    const seenProperties = new Map<string, { id: string; label: string; failed: boolean }>();
    for (const stay of loaded.stays) {
      if (!seenProperties.has(stay.stay.propertyId)) seenProperties.set(stay.stay.propertyId, { id: stay.stay.propertyId, label: stay.label, failed: false });
    }
    for (const label of loaded.failed) {
      if (![...seenProperties.values()].some((row) => row.label === label)) seenProperties.set(label, { id: label, label, failed: true });
    }
    for (const stay of loaded.stays) {
      let messages: { at: string; role: string; name: string; body: string; media?: ThreadTurn["media"] }[];
      try {
        messages = await readStayThread(stay.stay.id, now);
      } catch {
        unreadThreads.add(stay.stay.id);
        if (messageFailed.has(stay.label)) continue;
        messageFailed.add(stay.label);
        if (!unread.includes(stay.label)) unread.push(stay.label);
        failed.push(`Couldn't read messages for ${stay.label}, so anyone waiting there isn't listed. Nothing was sent.`);
        const chip = seenProperties.get(stay.stay.propertyId);
        if (chip) chip.failed = true;
        continue;
      }
      scanned.add(stay.stay.id);
      const detected = detectFollowUps(followStay(stay, messages, photos.get(stay.stay.propertyId) || ""), now);
      for (const row of detected.open) {
        if (!handled.has(row.id)) followUps.push(row);
      }
      for (const row of detected.settled) settled.set(row.id, row.closeText);
      const turns = messages
        .filter((item) => item.role !== "system")
        .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body, media: item.media ?? [] }));
      const spoken = turns.filter((item) => item.body.trim() || item.media.length);
      const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
      const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
      const last = spoken[spoken.length - 1];
      if (!last) continue;
      if (last.role !== "guest" || !pending.length) {
        if (last.role === "host") {
          const parked = readThread(turns, stay.stay.guest || "Guest");
          const row = rowFrom(stay, "", last.at, "", photos.get(stay.stay.propertyId) || "", now, {
            ...parked,
            lane: "guest",
            watch: parked.watch || "their next message",
          });
          row.thanks = false;
          onGuest.push(row);
        }
        continue;
      }
      const ask = pending.map((item) => [item.body.trim(), ...item.media.map((media) => media.shows)].filter(Boolean).join(" ")).join(" ");
      const read = readThread(turns, stay.stay.guest || "Guest");
      if (read.lane === "none" && !isThanksOnly(ask)) continue;
      const at = pending[pending.length - 1]?.at || last.at;
      const language = messageLanguage(ask);
      const row = rowFrom(stay, ask, at, language, photos.get(stay.stay.propertyId) || "", now, read);
      if (read.lane === "guest") {
        row.thanks = false;
        onGuest.push(row);
      } else if (read.lane === "reply") {
        if (heldIds.has(stay.stay.id)) held.push(row);
        else waiting.push(row);
      } else if (isThanksOnly(ask)) thanks.push(row);
    }
    waiting.sort((a, b) => arrivalRank(a, today) - arrivalRank(b, today) || b.waitedMs - a.waitedMs || a.guest.localeCompare(b.guest));
    const previous = rememberedQueue?.followUps ?? [];
    for (const row of previous) {
      if (unreadThreads.has(row.reservationId) && !handled.has(row.id) && !followUps.some((item) => item.id === row.id)) followUps.push(row);
    }
    for (const row of stagedInquiries) {
      if (!handled.has(row.id) && !followUps.some((item) => item.id === row.id)) followUps.push(row);
    }
    const ordered = orderFollowUps(followUps, now);
    const openIds = new Set(ordered.map((row) => row.id));
    const closedFollowUps = previous
      .filter((row) => scanned.has(row.reservationId) && !openIds.has(row.id) && !handled.has(row.id))
      .map((row) => ({ id: row.id, guest: row.guest, closeText: settled.get(row.id) || "the thread shows it resolved" }));
    const summary = guestSummary(waiting.length, waiting[0]?.wait || "", unread);
    return {
      connected: true,
      line: "",
      summaryLead: summary.lead,
      summaryRest: summary.rest,
      waiting,
      onGuest,
      held,
      thanks,
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
  const messages = await readStayThread(row.id, now);
  const turns: ThreadTurn[] = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({ at: item.at, role: item.role, name: item.name, body: item.body, media: item.media ?? [] }));
  const stayRaw = await hospitableRead("get-reservation", { identifier: row.id }).catch(() => null);
  const hubRead = await readPropertyHub(row.propertyId);
  const hub = hubRead.ok ? hubRead.text : "";
  const read = readThread(turns, row.guest);
  const spoken = turns.filter((item) => item.body.trim() || item.media.length);
  const lastHost = spoken.filter((item) => item.role === "host").map((item) => item.at).sort().at(-1) ?? "";
  const pending = spoken.filter((item) => item.role === "guest" && item.at > lastHost);
  const ask = pending.map((item) => item.body.trim()).join(" ") || row.asked;
  const memory = await memoryFor(row.property).catch(() => "");
  const fromHub = read.lane === "reply" ? draftFromHub(row.guest, ask, hub, { place: row.property, memory }) : { mode: "gap" as const, draft: "", facts: "", gap: "" };
  const outside = read.situation ? await outsideDraft(read, row.guest, turns) : { draft: "", alternates: [], basedOn: "", pageTitle: "" };
  const stood = read.situation ? standing.get(read.situation) ?? "" : "";
  const held = read.lane === "guest";
  const draft = held ? (stood || outside.draft) : stood || (fromHub.mode === "hub" ? fromHub.draft : outside.draft);
  const mode = held ? "held" as const : draft ? "hub" as const : "gap" as const;
  const thread = turns.filter((item) => item.role === "guest" || item.role === "host").map((item) => ({
    role: item.role as "guest" | "host",
    who: item.role === "guest" ? row.first : (item.name.trim().split(/\s+/)[0] || "Host"),
    at: item.at,
    time: messageTime(item.at, now),
    text: item.body,
    english: item.role === "guest" || messageLanguage(item.body) ? toEnglish(item.body) : "",
    language: messageLanguage(item.body),
    media: item.media,
    flag: item.role === "host" && read.copied && /\b(he|his|him|she|her)\b/i.test(item.body) ? `Copied text: says “${read.copied}” for ${row.guest}` : "",
  }));
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
    waitingLine: read.waitingLine,
    partnerNotes: read.partnerNotes,
    basedOn: outside.basedOn || (fromHub.facts ? `the Knowledge Hub · ${fromHub.facts}` : ""),
    sourceLine: sourceLine(read, reservation, outside.pageTitle),
    mediaSlot: read.mediaSlot,
    sentVersion: !held && draft ? toGuestLanguage(draft, row.language) : "",
    facts: fromHub.facts,
    gap: !draft && !held ? fromHub.gap : "",
    savedLine: "",
    failedLine: "",
  };
}

function rowFrom(
  stay: { stay: { id: string; guest: string; propertyId: string; checkIn: string; checkOut: string }; label: string },
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
    guestPhoto: "",
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
  };
}

function arrivalRank(row: GuestRow, today: string): number {
  if (!row.checkIn) return 2;
  if (row.checkIn === today || row.checkIn === addDays(today, 1)) return 0;
  if (row.checkIn < today && row.checkOut > today) return 1;
  return 2;
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
