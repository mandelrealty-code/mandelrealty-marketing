/**
 * Reviews queue. Submit is the only write. Regenerate reads the stay for facts
 * and writes a fresh reply to the review. Message text is never copied into the draft.
 */

import { listHospitableReviews, respondToHospitableReview } from "../pm/hospitableClient.js";
import { scopedStayProperties } from "./dayBoard.js";
import { loadConversations, type Conversation } from "./stayCheck.js";
import { copilotHospitableToken, hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { checkReviewReply, composeReviewReply, newVoiceMemory, rememberReply, reviewLanguage, type VoiceMemory } from "./reviewVoice.js";
import { flagLine, thanksByName, keepReviewAi, keptReviewAi, reviewAiAvailable, reviewIsFlagged, writePublicReply, writeReviewAi, type ReviewAiResult, type ReviewAssessment } from "./reviewAi.js";
import { parityEnabled } from "./parity/flag.js";
import { readPrefixedRow, writePrefixedRow } from "./store.js";
import { guestPhotoUrl } from "./guestInquiries.js";
import { hubPlain } from "./knowledgeHub.js";
import { addDays, torontoToday } from "./time.js";
import type { PostedReviewLine, ReviewFact, ReviewQueuePayload, ReviewQueueProperty, ReviewQueueRow } from "./reviewTypes.js";

/** The first day still inside the rolling 12 months: the same date a year ago, Toronto time. */
export function reviewWindowStart(now = new Date()): string {
  const [year, month, day] = torontoToday(now).split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  return `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/** True when the review was left within the last 12 months. A review with no date is not shown. */
export function inReviewWindow(reviewedAt: string, now = new Date()): boolean {
  if (!reviewedAt) return false;
  const at = new Date(reviewedAt);
  if (Number.isNaN(at.getTime())) return false;
  return torontoToday(at) >= reviewWindowStart(now);
}

export const SOURCE_FULL = "Based on the full conversation and the stay record.";
export const SOURCE_ALONE = "Based on the review alone. No conversation found for this stay.";
export const SOURCE_REVIEW = "Based on the review.";
export const SOURCE_UNCHANGED = "Couldn't read Hospitable. Your draft is unchanged.";

export type StayMessage = { role: "guest" | "host" | "system"; body: string };

export type StayFacts = {
  messages: StayMessage[];
  reservation: string;
  hub: string;
  failed: string[];
};

export type RegeneratedReview = {
  draft: string;
  previous: string;
  sourceLine: string;
  unchanged: boolean;
  dispute: string;
  facts: ReviewFact[];
  flagged?: boolean;
  retaliation?: ReviewAssessment["retaliation"];
  removalRequest?: string;
};

const skips = new Map<string, string>();
const posted = new Map<string, PostedReviewLine>();
let poster: ((id: string, text: string) => Promise<void>) | null = null;

export function resetReviewsQueue(): void {
  skips.clear();
  posted.clear();
  poster = null;
}

export function setReviewPoster(next: ((id: string, text: string) => Promise<void>) | null): void {
  poster = next;
}

export function rankReviews<T extends { stars: number; reviewedAt: string; review: string; id: string; returned?: boolean }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.returned) !== Boolean(b.returned)) return a.returned ? -1 : 1;
    // Flagged (3 stars or fewer) first, then newest first.
    if (reviewIsFlagged(a.stars) !== reviewIsFlagged(b.stars)) return reviewIsFlagged(a.stars) ? -1 : 1;
    if (a.reviewedAt !== b.reviewedAt) return a.reviewedAt < b.reviewedAt ? 1 : -1;
    if (a.stars !== b.stars) return a.stars - b.stars;
    if (a.review.length !== b.review.length) return b.review.length - a.review.length;
    return a.id.localeCompare(b.id);
  });
}

export function reviewSummary(waiting: number, care: number, property = ""): string {
  const where = property ? ` at ${property}` : "";
  if (waiting === 0) return `No reviews waiting${where}.`;
  const nWord = waiting === 1 ? "1 review waiting" : `${waiting} reviews waiting`;
  const careWord = care === 0 ? "None need care." : care === 1 ? "1 needs care." : `${care} need care.`;
  return `${nWord}${where}. ${careWord}`;
}

/** A reply from this review's own public text alone, in its language. Empty when only a model (or you) can write that language. */
export function seedDraft(guest: string, review: string, stars = 0): string {
  return composeReviewReply({ guest, review, stars })?.reply ?? "";
}

export const SOURCE_PUBLIC = "Written from the public review only. Nothing private is used.";

/** Openings and closings already used by every OTHER reply in the queue, so each one is written to differ. */
function voiceOfOthers(rows: { id: string; draft: string; guest: string }[], exceptId: string): VoiceMemory {
  const memory = newVoiceMemory();
  for (const row of rows) if (row.id !== exceptId && row.draft.trim()) rememberReply(memory, row.draft, row.guest);
  return memory;
}

/** The queue as last built, so Regenerate on one review still knows what the others say. */
let lastQueueRows: ReviewQueueRow[] = [];

/** Every draft written one after another, newest and most urgent first, each aware of the ones before it. */
function seedQueueDrafts(rows: ReviewQueueRow[]): void {
  const memory = newVoiceMemory();
  for (const row of rankReviews(rows)) {
    const composed = composeReviewReply({ guest: row.guest, review: row.review, stars: row.stars, memory });
    row.draft = composed?.reply ?? "";
    if (!composed) {
      const language = reviewLanguage(row.review);
      row.sourceLine = `This review is in ${language.name}. Regenerate with AI to draft the reply in ${language.name}, or write it yourself.`;
    } else row.sourceLine = SOURCE_PUBLIC;
  }
}

/** A review needs care when the text complains, or when a dispute is already flagged. */
export function reviewNeedsCare(review: string, dispute = ""): boolean {
  return Boolean(dispute.trim()) || specificComplaints(review).length > 0;
}

export function regenerateDraft(input: {
  guest: string;
  review: string;
  current: string;
  stay: StayFacts | null;
  stars?: number;
}): RegeneratedReview {
  const previous = input.current;
  if (!input.stay) {
    return { draft: input.current, previous, sourceLine: SOURCE_UNCHANGED, unchanged: true, dispute: "", facts: [] };
  }
  // The public reply is built from the public review alone. The stay (messages, reservation, Hub) only feeds the partner's
  // dispute facts below; none of it can appear in text a guest or Airbnb sees.
  const composed = composeReviewReply({ guest: input.guest, review: input.review, stars: input.stars ?? 0 });
  const dispute = disputeReason(input.review, input.stay);
  return {
    draft: composed?.reply ?? input.current,
    previous,
    sourceLine: composed ? SOURCE_PUBLIC : `This review is in ${reviewLanguage(input.review).name}, so I can't write the reply without a model. Your draft is unchanged.`,
    unchanged: !composed,
    dispute: dispute.reason,
    facts: dispute.facts,
  };
}

export function reviewDraftRejected(draft: string, guest: string, stay: StayFacts | null): boolean {
  if (repeatedScaffold(draft) || greetingCount(draft, guest) > 1) return true;
  if (STITCH.test(draft) || STAY_TEMPLATE.test(draft)) return true;
  if (!stay) return false;
  const sources = [...stay.messages.map((row) => row.body), stay.reservation, stay.hub];
  return sources.some((text) => text.trim() && copiedWindow(draft, text));
}

/** A regenerated reply that is one sentence, or that names nothing the guest wrote, is not shown. */
export function regeneratedDraftFails(draft: string, review: string): boolean {
  const sentences = draft.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  if (sentences.length < 2) return true;
  return !namesReview(draft, review);
}

const TOPIC_STOP = new Set(["the", "and", "was", "were", "for", "you", "your", "with", "that", "this", "from", "have", "been", "very", "our", "how", "easy", "simple", "place", "not", "too", "should", "les", "des", "une", "pour", "right", "felt", "amazing", "great", "good", "best", "loved", "love", "awesome", "nice", "really", "just", "when", "they", "them"]);

function namesReview(draft: string, review: string): boolean {
  const blob = words(draft);
  const keys = new Set<string>();
  for (const topic of [...specificPraises(review), ...specificComplaints(review), review]) {
    for (const word of words(topic)) {
      if (word.length > 3 && !TOPIC_STOP.has(word)) keys.add(word);
    }
  }
  for (const key of keys) {
    if (blob.includes(key) || blob.includes(`${key}s`) || blob.includes(key.replace(/s$/, ""))) return true;
    if (key.length > 4 && blob.some((word) => word.startsWith(key))) return true;
  }
  return false;
}

export async function regenerateFromConnection(input: {
  guest: string;
  review: string;
  current: string;
  reservationId: string;
  propertyId: string;
  stars?: number;
  id?: string;
  property?: string;
  privateFeedback?: string;
}): Promise<RegeneratedReview> {
  // A 4 or 5 star reply is written from the public review alone: no conversation, no reservation, no Hospitable read, nothing
  // private to leak. It is also written aware of every other reply in the queue.
  if (!input.stars || input.stars >= 4) {
    const memory = voiceOfOthers(lastQueueRows, input.id ?? "");
    // The old draft's own wording is avoided too, so Regenerate reads differently.
    if (input.current.trim()) rememberReply(memory, input.current, input.guest);
    const pub = await writePublicReply({ guest: input.guest, review: input.review, stars: input.stars ?? 0, property: input.property ?? "", memory });
    if (!pub) {
      const language = reviewLanguage(input.review);
      return { draft: input.current, previous: input.current, sourceLine: `This review is in ${language.name}, so I can't write the reply without a model. Your draft is unchanged.`, unchanged: true, dispute: "", facts: [] };
    }
    const text = textDispute(input.review);
    if (input.id && input.stars) await keepReviewAi(input.id, { review: input.review, stars: input.stars, reservationId: input.reservationId }, { kind: "reply", reply: pub.reply });
    expireReviewQueue();
    return { draft: pub.reply, previous: input.current, sourceLine: SOURCE_PUBLIC, unchanged: false, dispute: text.reason, facts: text.facts };
  }
  const token = await copilotHospitableToken();
  if (!token) {
    return {
      draft: input.current,
      previous: input.current,
      sourceLine: "Hospitable is not connected. Your draft is unchanged.",
      unchanged: true,
      dispute: "",
      facts: [],
    };
  }
  let stay: StayFacts;
  try {
    stay = await readStay(input.reservationId, input.propertyId);
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) {
      return {
        draft: input.current,
        previous: input.current,
        sourceLine: "Hospitable is not connected. Your draft is unchanged.",
        unchanged: true,
        dispute: "",
        facts: [],
      };
    }
    throw err;
  }
  if (stay.failed.length >= 3 && !stay.messages.length && !stay.reservation && !stay.hub) {
    return { draft: input.current, previous: input.current, sourceLine: SOURCE_UNCHANGED, unchanged: true, dispute: "", facts: [] };
  }
  // Regenerate with AI writes afresh from the whole stay; the kept version is replaced.
  if (input.stars && reviewAiAvailable()) {
    const ai = await writeReviewAi({ guest: input.guest, stars: input.stars, review: input.review, privateFeedback: input.privateFeedback ?? "", property: input.property ?? "", messages: stay.messages, reservation: stay.reservation, hub: stay.hub, memory: voiceOfOthers(lastQueueRows, input.id ?? "") });
    if (ai) {
      if (input.id) await keepReviewAi(input.id, { review: input.review, stars: input.stars, reservationId: input.reservationId }, ai);
      expireReviewQueue();
      return { ...fromAi(ai, input.stars), previous: input.current, sourceLine: `${SOURCE_PUBLIC} The assessment above reads the conversation; the reply doesn't.`, unchanged: false };
    }
  }
  return regenerateDraft({ ...input, stay });
}

export async function submitReviewReply(id: string, text: string, guest: string, property: string, stars: number, now = new Date()): Promise<void> {
  const body = text.trim();
  if (!body) throw new Error("The draft is empty. Nothing was posted.");
  const token = await copilotHospitableToken();
  if (!token) throw new Error("Hospitable is not connected. Nothing was posted.");
  if (poster) await poster(id, body);
  else await respondToHospitableReview(token, id, body);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(now);
  posted.set(id, { text: `Reply to ${guest}'s ${stars}-star review, ${property}`, at: time });
  expireReviewQueue();
}

export function skipReview(id: string, now = new Date()): string {
  const until = addDays(torontoToday(now), 1);
  skips.set(id, until);
  expireReviewQueue();
  return until;
}

export function undoSkip(id: string): void {
  skips.delete(id);
  expireReviewQueue();
}

/** What a written review becomes on the row: a reply draft, or a flag with its assessment. */
function fromAi(ai: ReviewAiResult, stars: number): Pick<RegeneratedReview, "draft" | "dispute" | "facts" | "flagged" | "retaliation" | "removalRequest"> {
  if (ai.kind === "reply") return { draft: thanksByName(ai.reply), dispute: "", facts: [], flagged: false };
  return {
    draft: thanksByName(ai.assessment.reply),
    dispute: flagLine(stars, ai.assessment),
    facts: ai.assessment.facts,
    flagged: true,
    retaliation: ai.assessment.retaliation,
    removalRequest: ai.assessment.removalRequest,
  };
}

/**
 * When the review was really left. Airbnb reviews are written within 14 days of checkout, so a
 * "reviewed" date long after checkout is Hospitable's record time, not the review: the checkout is used.
 */
export function reviewDate(reviewedAt: string, checkOut: string): { at: string; fromStay: boolean } {
  const day = checkOut.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const latest = addDays(day, 16);
    if (!reviewedAt || reviewedAt.slice(0, 10) > latest || reviewedAt.slice(0, 10) < day) return { at: `${day}T12:00:00Z`, fromStay: true };
  }
  return { at: reviewedAt, fromStay: false };
}

/** Writing budget per load: a review is written once and kept, so later loads are instant. */
const WRITE_BUDGET_MS = 20_000;
const QUEUE_SNAPSHOT = "review-queue|snapshot|v4|";
const QUEUE_FRESH_MS = 10 * 60 * 1000;

let reviewQueueInflight: Promise<ReviewQueuePayload> | null = null;

async function readFreshReviewQueue(now: Date): Promise<ReviewQueuePayload | null> {
  if (parityEnabled()) return null;
  try {
    const raw = await readPrefixedRow(QUEUE_SNAPSHOT);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: string; payload?: ReviewQueuePayload };
    if (!saved.at || !saved.payload?.connected) return null;
    if (now.getTime() - new Date(saved.at).getTime() > QUEUE_FRESH_MS) return null;
    return saved.payload;
  } catch {
    return null;
  }
}

async function saveReviewQueue(now: Date, payload: ReviewQueuePayload): Promise<void> {
  if (parityEnabled() || !payload.connected) return;
  await writePrefixedRow(QUEUE_SNAPSHOT, JSON.stringify({ at: now.toISOString(), payload })).catch(() => undefined);
}

function expireReviewQueue(): void {
  reviewQueueInflight = null;
  if (parityEnabled()) return;
  void writePrefixedRow(QUEUE_SNAPSHOT, JSON.stringify({ at: "" })).catch(() => undefined);
}

export function loadReviewQueue(now = new Date()): Promise<ReviewQueuePayload> {
  if (reviewQueueInflight) return reviewQueueInflight;
  const run = loadReviewQueueOnce(now).finally(() => {
    if (reviewQueueInflight === run) reviewQueueInflight = null;
  });
  reviewQueueInflight = run;
  return run;
}

async function loadReviewQueueOnce(now = new Date()): Promise<ReviewQueuePayload> {
  const cached = await readFreshReviewQueue(now);
  if (cached) return cached;
  const token = await copilotHospitableToken();
  if (!token) {
    return { connected: false, line: "Hospitable is not connected.", reviews: [], postedToday: [...posted.values()] };
  }
  // The same properties as the guest inbox: the Hospitable selection saved in Settings.
  const properties = await scopedStayProperties().catch(() => []);
  const reviews: ReviewQueueRow[] = [];
  const listed: ReviewQueueProperty[] = properties.map((property) => ({ id: property.id, name: property.name, synced: true }));
  const unreadable: string[] = [];
  let closed = 0;
  let disconnected = false;
  const stayOf = new Map<string, string>();
  const today = torontoToday(now);
  const readProperty = async (property: (typeof properties)[number], index: number) => {
    const propertyId = property.id.trim();
    if (!propertyId) return;
    let rows: Awaited<ReturnType<typeof listHospitableReviews>> = [];
    try {
      // Every page: two pages cut a property's newest reviews off when Hospitable lists oldest first.
      rows = await listHospitableReviews({ pat: token, propertyId, responded: false, maxPages: 30 });
    } catch (err) {
      if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) disconnected = true;
      else unreadable.push(property.name);
      return;
    }
    // No unanswered review at any age: ask whether Hospitable holds any review for it at all.
    let synced = rows.length > 0;
    if (!synced) {
      try {
        synced = (await listHospitableReviews({ pat: token, propertyId, maxPages: 1 })).length > 0;
      } catch {
        synced = true;
      }
    }
    listed[index] = { id: propertyId, name: property.name, synced };
    for (const review of rows) {
      if (review.public_response.trim()) continue;
      if (review.platform && !/airbnb/i.test(review.platform)) continue;
      if (posted.has(review.id)) continue;
      // Airbnb takes a reply only for a while after a review posts; past that, Submit could only fail.
      if (review.raw.can_respond === false || review.raw.canRespond === false) {
        closed += 1;
        continue;
      }
      const stars = review.rating == null ? 0 : Math.round(review.rating);
      if (stars < 1 || stars > 5) continue;
      const until = skips.get(review.id);
      if (until && until > today) continue;
      const guest = review.guest_first_name || "Guest";
      const text = review.public_review.trim();
      if (!text) continue;
      const flag = textDispute(text);
      const flagged = reviewIsFlagged(stars);
      reviews.push({
        id: review.id,
        reservationId: review.reservation_id,
        propertyId,
        guest,
        initials: initials(guest),
        guestPhoto: guestPhoto(review.raw),
        property: property.name,
        propertyPhoto: "",
        stars,
        when: "",
        reviewedAt: review.reviewed_at || "",
        review: text,
        draft: "",
        dispute: flagged ? `${stars} star${stars === 1 ? "" : "s"}. Flagged for the team.${flag.reason ? ` ${flag.reason}` : ""}` : flag.reason,
        needsCare: flagged || reviewNeedsCare(text, flag.reason),
        facts: flag.facts,
        returned: Boolean(until && until <= today),
        flagged,
        privateFeedback: review.private_feedback || "",
      });
      stayOf.set(review.id, review.check_out || "");
    }
  };
  const queue = properties.map((property, index) => ({ property, index }));
  const lane = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await readProperty(next.property, next.index);
  };
  await Promise.all([lane(), lane(), lane()]);
  if (disconnected) return { connected: false, line: "Hospitable is not connected.", reviews: [], postedToday: [...posted.values()] };
  await matchStays(reviews, stayOf, now);
  // Only the last 12 months, by when the review was really left. Older reviews stay in Hospitable, untouched.
  for (let i = reviews.length - 1; i >= 0; i -= 1) {
    const row = reviews[i]!;
    const when = reviewDate(row.reviewedAt, stayOf.get(row.id) ?? "");
    if (!inReviewWindow(when.at, now)) {
      reviews.splice(i, 1);
      continue;
    }
    row.reviewedAt = when.at;
    row.when = reviewedLabel(when.at, now, when.fromStay);
  }
  seedQueueDrafts(reviews);
  await writeDrafts(reviews, now);
  lastQueueRows = reviews;
  const notes = [
    unreadable.length ? `Couldn't read reviews for ${unreadable.join(", ")}. Open Reviews again in a moment.` : "",
    closed ? `${closed} older review${closed === 1 ? "" : "s"} can no longer be answered on Airbnb, so ${closed === 1 ? "it is" : "they are"} not listed.` : "",
  ].filter(Boolean);
  const payload: ReviewQueuePayload = {
    connected: true,
    line: "",
    reviews: rankReviews(reviews),
    postedToday: [...posted.values()],
    properties: listed,
    ...(notes.length ? { note: notes.join(" ") } : {}),
  };
  await saveReviewQueue(now, payload);
  return payload;
}

/**
 * Each review's stay, from the reservations the guest inbox reads: by its reservation id when Hospitable
 * gave one, else by property, guest first name and the latest checkout before the review. The stay gives
 * the real dates, the conversation to read, and the guest's photo; the listing photo comes from Hospitable.
 */
async function matchStays(rows: ReviewQueueRow[], stayOf: Map<string, string>, now: Date): Promise<void> {
  if (!rows.length) return;
  const [listed, photos] = await Promise.all([
    loadConversations(now).then((result) => result.conversations).catch(() => [] as Conversation[]),
    import("./guestMessaging.js").then((mod) => mod.propertyPhotos()).catch(() => new Map<string, string>()),
  ]);
  const byId = new Map<string, Conversation>();
  const byProperty = new Map<string, Conversation[]>();
  for (const row of listed) {
    if (row.inquiry) continue;
    byId.set(row.stay.id, row);
    const list = byProperty.get(row.stay.propertyId) ?? [];
    list.push(row);
    byProperty.set(row.stay.propertyId, list);
  }
  const first = (name: string) => name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  for (const row of rows) {
    row.propertyPhoto ||= photos.get(row.propertyId) ?? "";
    const direct = row.reservationId ? byId.get(row.reservationId) : undefined;
    let stay = direct;
    if (!stay) {
      const latest = row.reviewedAt ? addDays(row.reviewedAt.slice(0, 10), 1) : "9999-12-31";
      stay = (byProperty.get(row.propertyId) ?? [])
        .filter((item) => first(item.stay.guest) === first(row.guest) && item.stay.checkOut && item.stay.checkOut <= latest && !/cancel|declin|denied|expired/i.test(item.stay.status))
        .sort((a, b) => b.stay.checkOut.localeCompare(a.stay.checkOut))[0];
    }
    if (!stay) continue;
    // A reservation id Hospitable gave that matches no stay is not the stay: the matched one is used.
    if (!direct) row.reservationId = stay.stay.id;
    if (!stayOf.get(row.id)) stayOf.set(row.id, stay.stay.checkOut);
    if (!row.guestPhoto && stay.reservation) row.guestPhoto = guestPhotoUrl(stay.reservation);
  }
}

/** Each review's AI draft or assessment: kept ones at once, new ones written (three at a time) within the budget. */
async function writeDrafts(rows: ReviewQueueRow[], now: Date): Promise<void> {
  const started = Date.now();
  const keep = (row: ReviewQueueRow) => ({ review: row.review, stars: row.stars, reservationId: row.reservationId });
  /** Put a model's reply on the row, but only if it still keeps the rules next to the other replies as they stand now. */
  const apply = (row: ReviewQueueRow, ai: ReviewAiResult): boolean => {
    const candidate = Object.assign({}, row, fromAi(ai, row.stars));
    const check = checkReviewReply({ reply: candidate.draft, review: row.review, guest: row.guest, memory: voiceOfOthers(rows, row.id) });
    if (!check.ok) return false;
    Object.assign(row, fromAi(ai, row.stars), { needsCare: row.flagged || row.needsCare });
    return true;
  };
  const pending: ReviewQueueRow[] = [];
  for (const row of rows) {
    // A kept draft is used only if it still keeps today's rules (an older draft that named a private detail never survives).
    const kept = await keptReviewAi(row.id, keep(row));
    if (kept && apply(row, kept)) continue;
    pending.push(row);
  }
  if (!reviewAiAvailable()) return;
  // Newest first, flagged first: the ones the team will read first are written first.
  const queue = rankReviews(pending);
  const lane = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (Date.now() - started > WRITE_BUDGET_MS) return;
      try {
        // A 4 or 5 star reply needs no stay: it is written from the public review alone. A low review's assessment reads the
        // stay for the partner; the reply it carries is still written from the public review alone.
        const stay = row.stars <= 3 ? await readStay(row.reservationId, row.propertyId) : null;
        const ai = await writeReviewAi({
          guest: row.guest, stars: row.stars, review: row.review, privateFeedback: row.privateFeedback ?? "", property: row.property,
          messages: stay?.messages ?? [], reservation: stay?.reservation ?? "", hub: stay?.hub ?? "", memory: voiceOfOthers(rows, row.id),
        });
        if (!ai) continue;
        if (!apply(row, ai)) {
          // Another lane took this opening or closing while this one was being written: the template writes it differently.
          const again = composeReviewReply({ guest: row.guest, review: row.review, stars: row.stars, memory: voiceOfOthers(rows, row.id) });
          if (!again) continue;
          row.draft = again.reply;
          row.sourceLine = SOURCE_PUBLIC;
          continue;
        }
        await keepReviewAi(row.id, keep(row), ai);
        row.sourceLine = stay ? `${SOURCE_PUBLIC} The assessment reads the conversation; the reply doesn't.` : SOURCE_PUBLIC;
      } catch {
        /* The template draft stays; Regenerate with AI tries again. */
      }
    }
  };
  void now;
  await Promise.all([lane(), lane(), lane()]);
}

async function readStay(reservationId: string, propertyId: string): Promise<StayFacts> {
  const failed: string[] = [];
  let messages: StayMessage[] = [];
  let reservation = "";
  let hub = "";
  try {
    messages = messagesOf(await hospitableRead("get-reservation-messages", { uuid: reservationId }));
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    failed.push("The conversation read failed.");
  }
  try {
    reservation = reservationNote(await hospitableRead("get-reservation", { identifier: reservationId }));
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    failed.push("The reservation read failed.");
  }
  try {
    const raw = await hospitableRead("get-property-knowledge-hub", { property_id: propertyId });
    hub = hubPlain(raw);
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    failed.push("The Knowledge Hub read failed.");
  }
  return { messages, reservation, hub, failed };
}

function messagesOf(raw: unknown): StayMessage[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  const out: StayMessage[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const body = String(row.body ?? row.message ?? "").trim();
    if (!body) continue;
    const roleRaw = String(row.sender_role ?? row.sender_type ?? row.role ?? "").toLowerCase();
    const role = roleRaw.includes("host") ? "host" : roleRaw.includes("guest") ? "guest" : "system";
    out.push({ role, body });
  }
  return out;
}

function reservationNote(raw: unknown): string {
  const data = raw && typeof raw === "object" && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
    ? (raw as { data: Record<string, unknown> }).data
    : {};
  const status = String(data.status ?? "").trim();
  const checkIn = String(data.arrival_date ?? data.check_in ?? "").slice(0, 10);
  const parts = [status && `Status ${status}`, checkIn && `check-in ${checkIn}`].filter(Boolean);
  return parts.join(", ");
}


const STITCH = /you're right about this part/i;
const STAY_TEMPLATE = /\b(door codes?|access codes?|lockbox|wi-?fi passwords?|check-?in instructions|check-?out reminders?|please check out by|leave the keys|hope you'?re enjoying|keypad|code is)\b/i;
const SCAFFOLDS = [
  "you're right about this part",
  "you're right that",
  "thank you for writing",
  "thank you for the kind words",
  "thank you for staying with us",
  "we've read what you wrote",
];

function repeatedScaffold(draft: string): boolean {
  const lower = draft.toLowerCase();
  if (SCAFFOLDS.some((phrase) => lower.split(phrase).length - 1 > 1)) return true;
  const sentences = draft.split(/(?<=[.!?])\s+/).map((line) => line.trim().toLowerCase()).filter(Boolean);
  return new Set(sentences).size !== sentences.length;
}

function greetingCount(draft: string, guest: string): number {
  const name = firstName(guest).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return draft.split(/(?<=[.!?])\s+/).filter((line) => new RegExp(`^(?:hi |hello |dear )?${name}\\b`, "i").test(line.trim())).length;
}

function copiedWindow(draft: string, source: string): boolean {
  const hay = ` ${words(draft).join(" ")} `;
  const seq = words(source);
  for (let i = 0; i <= seq.length - 5; i += 1) {
    if (hay.includes(` ${seq.slice(i, i + 5).join(" ")} `)) return true;
  }
  return false;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((word) => word.length > 1);
}

function isStayTemplate(text: string): boolean {
  return STAY_TEMPLATE.test(text);
}

function specificComplaints(review: string): string[] {
  const found: string[] = [];
  const add = (label: string) => {
    if (!found.includes(label) && found.length < 2) found.push(label);
  };
  for (const clause of splitClauses(review)) {
    if (/too soft/i.test(clause) && /bed|mattress|matelas|lit/i.test(clause)) add(isFrenchReview(review) ? "le lit trop mou" : "the bed was too soft");
    else if (/too hard|trop dur/i.test(clause) && /bed|mattress|matelas|lit/i.test(clause)) add(isFrenchReview(review) ? "le lit trop dur" : "the bed was too hard");
    if (/shower|douche/i.test(clause) && /weak|low pressure|faible/i.test(clause)) add(isFrenchReview(review) ? "la pression de la douche" : "the shower pressure was weak");
    if (/\b(dirty|stained|stains?|not clean|wasn'?t clean|wasn'?t as clean|unclean)\b/i.test(clause) || (isFrenchReview(review) && /\bsale\b/i.test(clause))) {
      add(isFrenchReview(review) ? "la propreté" : "the place was not as clean as it should have been");
    }
    if (/check[\s-]*in|arrivée/i.test(clause) && /(hard|difficult|problem|couldn'?t|didn'?t work|difficile)/i.test(clause) && !/easy|simple|smooth|facile/i.test(clause)) {
      add(isFrenchReview(review) ? "l'arrivée difficile" : "check-in was harder than it should have been");
    }
    if (/never answered|didn't answer|didn’t answer|ignor/i.test(clause)) add(isFrenchReview(review) ? "l'absence de réponse" : "not hearing back from us");
    if (/\b(terrible|awful|worst|disappoint|horrible)\b/i.test(clause)) add(isFrenchReview(review) ? "le séjour" : "the stay fell short");
  }
  return found;
}

function specificPraises(review: string, french = isFrenchReview(review)): string[] {
  const found: string[] = [];
  const add = (label: string) => {
    if (!found.includes(label) && found.length < 2) found.push(label);
  };
  for (const clause of splitClauses(review)) {
    if (clauseComplains(clause)) continue;
    if (french) {
      if (/matelas/i.test(clause)) add("les matelas");
      else if (/\blit\b/i.test(clause)) add("le lit");
      if (/propre|propreté|impeccable/i.test(clause)) add("la propreté");
      if (/arrivée/i.test(clause) && /facile|simple/i.test(clause)) add("l'arrivée facile");
      if (/emplacement|quartier/i.test(clause)) add("l'emplacement");
      continue;
    }
    if (/mattress/i.test(clause)) add("the mattresses");
    else if (/\bbeds?\b/i.test(clause)) add("the bed");
    if (/\b(spotless|clean|cleanliness|immaculate)\b/i.test(clause)) add("the cleanliness");
    if (/check[\s-]*in/i.test(clause) && /easy|simple|smooth|great|perfect|loved|love/i.test(clause)) add("the easy check-in");
    if (/\blocation\b/i.test(clause)) add("the location");
    if (/\bhosts?\b/i.test(clause)) add("the hosts");
    if (/\bresponsive\b/i.test(clause)) add("how responsive we were");
  }
  if (!found.length && !splitClauses(review).some((clause) => clauseComplains(clause))) {
    const short = review.replace(/[.!?…]+/g, " ").replace(/\s+/g, " ").trim();
    add(short ? short.toLowerCase() : french ? "le séjour" : "the stay");
  }
  return found;
}

function clauseComplains(clause: string): boolean {
  if (/too soft|too hard|uncomfortable|not comfortable|trop mou|trop dur/i.test(clause) && /bed|mattress|matelas|\blit\b/i.test(clause)) return true;
  if (/shower|douche/i.test(clause) && /weak|low pressure|faible/i.test(clause)) return true;
  if (/\b(dirty|stained|stains?|not clean|wasn'?t clean|wasn'?t as clean|unclean|sale)\b/i.test(clause)) return true;
  if (/check[\s-]*in|arrivée/i.test(clause) && /(hard|difficult|problem|couldn'?t|didn'?t work|difficile)/i.test(clause) && !/easy|simple|smooth|facile/i.test(clause)) return true;
  if (/never answered|didn't answer|didn’t answer|ignor/i.test(clause)) return true;
  if (/\b(terrible|awful|worst|disappoint|horrible)\b/i.test(clause)) return true;
  return false;
}

function splitClauses(review: string): string[] {
  return review
    .split(/[.!?;]+|\s+\b(?:and|but|et|mais)\b\s+/i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1);
}

function isFrenchReview(text: string): boolean {
  if (/[àâäéèêëïîôùûüçœ]/i.test(text)) return true;
  const hits = text.match(/\b(le|la|les|un|une|des|est|très|tres|séjour|sejour|merci|nous|était|etait|adoré|adore|propre|propreté|arrivée|facile|avons|votre|vous|impeccable|confortable|matelas)\b/gi);
  return (hits?.length ?? 0) >= 2;
}

function disputeReason(review: string, stay: StayFacts): { reason: string; facts: ReviewFact[] } {
  const text = textDispute(review);
  const host = stay.messages.filter((row) => row.role === "host").map((row) => row.body.trim()).filter(Boolean);
  const spoken = host.filter((body) => !isStayTemplate(body));
  const facts = [...text.facts];
  let reason = text.reason;
  if (/never answered|didn't answer|didn’t answer|ignored our messages/i.test(review) && host.length) {
    reason = "The review says the host never answered. The conversation shows a reply.";
    facts.unshift({
      claim: "The host never answered",
      record: `Host reply: ${clip(spoken[spoken.length - 1] ?? host[host.length - 1], 160)}`,
      source: "Hospitable thread",
    });
  }
  return { reason, facts };
}

function textDispute(review: string): { reason: string; facts: ReviewFact[] } {
  const phone = review.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phone) {
    return {
      reason: "Includes a personal phone number.",
      facts: [{
        claim: `Phone number ${phone[0]}`,
        record: "The review includes a personal phone number.",
        source: "Airbnb content policy",
      }],
    };
  }
  return { reason: "", facts: [] };
}

function firstName(guest: string): string {
  return guest.trim().split(/\s+/)[0] || "Guest";
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] || "").join("").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "G";
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}

function reviewedLabel(iso: string, now: Date, fromStay = false): string {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const today = torontoToday(now);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  if (fromStay) return `Stay ended ${date}`;
  if (day === today) return "Posted today";
  if (day === addDays(today, -1)) return "Posted yesterday";
  return `Posted ${date}`;
}

function guestPhoto(raw: Record<string, unknown>): string {
  const guest = raw.guest && typeof raw.guest === "object" ? raw.guest as Record<string, unknown> : null;
  return guest ? guestPhotoUrl(guest) : "";
}
