/**
 * Reviews queue. Submit is the only write. Regenerate reads the stay and replaces the draft.
 */

import { listHospitableReviews, respondToHospitableReview } from "../pm/hospitableClient.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { copilotHospitableToken, hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { hubPlain } from "./knowledgeHub.js";
import { isManagedUnit } from "./managedUnits.js";
import { addDays, torontoToday } from "./time.js";
import type { PostedReviewLine, ReviewFact, ReviewQueuePayload, ReviewQueueRow } from "./reviewTypes.js";

export const SOURCE_FULL = "Regenerated from the full conversation and the stay record.";
export const SOURCE_ALONE = "Regenerated from the review alone. No conversation found for this stay.";
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
    if (a.stars !== b.stars) return a.stars - b.stars;
    if (a.reviewedAt !== b.reviewedAt) return a.reviewedAt < b.reviewedAt ? 1 : -1;
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

export function seedDraft(guest: string, review: string): string {
  const name = firstName(guest);
  const topics = reviewTopics(review);
  const middle = topics
    ? `Sorry ${topics}.`
    : "We've read what you wrote.";
  return `${name}, thank you for writing. ${middle} Thank you for staying with us.`;
}

export function regenerateDraft(input: {
  guest: string;
  review: string;
  current: string;
  stay: StayFacts | null;
}): RegeneratedReview {
  const previous = input.current;
  if (!input.stay) {
    return { draft: input.current, previous, sourceLine: SOURCE_UNCHANGED, unchanged: true, dispute: "", facts: [] };
  }
  const guestMessages = input.stay.messages.filter((row) => row.role === "guest" && row.body.trim());
  const conversationFailed = input.stay.failed.some((line) => /conversation/i.test(line));
  const thin = conversationFailed || guestMessages.length < 2;
  const extras = input.stay.failed.filter((line) => !(thin && conversationFailed && /conversation/i.test(line)));
  const base = thin
    ? conversationFailed
      ? "Regenerated from the review alone. The conversation read failed."
      : SOURCE_ALONE
    : SOURCE_FULL;
  const sourceLine = extras.length && !(thin && conversationFailed && extras.every((line) => /conversation/i.test(line)))
    ? `${base.replace(/\.$/, "")}. ${extras.filter((line) => !(conversationFailed && /conversation/i.test(line))).join(" ")}`
    : base;
  const written = thin ? reviewOnlyDraft(input.guest, input.review) : threadDraft(input.guest, input.review, input.stay);
  const dispute = disputeReason(input.review, input.stay);
  return {
    draft: written,
    previous,
    sourceLine,
    unchanged: false,
    dispute: dispute.reason,
    facts: dispute.facts,
  };
}

export async function regenerateFromConnection(input: {
  guest: string;
  review: string;
  current: string;
  reservationId: string;
  propertyId: string;
}): Promise<RegeneratedReview> {
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
}

export function skipReview(id: string, now = new Date()): string {
  const until = addDays(torontoToday(now), 1);
  skips.set(id, until);
  return until;
}

export function undoSkip(id: string): void {
  skips.delete(id);
}

export async function loadReviewQueue(now = new Date()): Promise<ReviewQueuePayload> {
  const token = await copilotHospitableToken();
  if (!token) {
    return { connected: false, line: "Hospitable is not connected.", reviews: [], postedToday: [...posted.values()] };
  }
  const properties = (await listPmProperties().catch(() => [])).filter((row) => isManagedUnit(row.name, row.address));
  const reviews: ReviewQueueRow[] = [];
  for (const property of properties) {
    const propertyId = (property.hospitable_property_id || "").trim();
    if (!propertyId) continue;
    let rows: Awaited<ReturnType<typeof listHospitableReviews>> = [];
    try {
      rows = await listHospitableReviews({ pat: token, propertyId, responded: false, maxPages: 2 });
    } catch (err) {
      if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) {
        return { connected: false, line: "Hospitable is not connected.", reviews: [], postedToday: [...posted.values()] };
      }
      continue;
    }
    for (const review of rows) {
      if (review.public_response.trim()) continue;
      if (review.platform && !/airbnb/i.test(review.platform)) continue;
      if (posted.has(review.id)) continue;
      const stars = review.rating == null ? 0 : Math.round(review.rating);
      if (stars < 1 || stars > 5) continue;
      const until = skips.get(review.id);
      const today = torontoToday(now);
      if (until && until > today) continue;
      const guest = review.guest_first_name || "Guest";
      const text = review.public_review.trim();
      if (!text) continue;
      const flag = textDispute(text);
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
        when: reviewedLabel(review.reviewed_at || "", now),
        reviewedAt: review.reviewed_at || "",
        review: text,
        draft: seedDraft(guest, text),
        dispute: flag.reason,
        facts: flag.facts,
        returned: Boolean(until && until <= today),
      });
    }
  }
  return {
    connected: true,
    line: "",
    reviews: rankReviews(reviews),
    postedToday: [...posted.values()],
  };
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

function threadDraft(guest: string, review: string, stay: StayFacts): string {
  const name = firstName(guest);
  const host = stay.messages.filter((row) => row.role === "host").map((row) => row.body.trim()).filter(Boolean);
  const bits: string[] = [`${name}, thank you for writing.`];
  const acknowledged = new Set<string>();
  for (const body of host) {
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const line = sentence.trim();
      if (!line || !overlaps(review, line) || acknowledged.has(line)) continue;
      acknowledged.add(line);
      bits.push(`You're right about this part: ${line}`);
      break;
    }
  }
  if (/never answered|did not answer|didn't answer|didn’t answer|no one answered|ignored our messages|never replied/i.test(review) && host.length) {
    bits.push(`Your messages were answered. We wrote back: ${clip(host[host.length - 1], 140)}`);
  } else if (stay.reservation && /charg|\$\d|checkout fee/i.test(review) && /no (later|extra) charge|nothing was added|security hold/i.test(`${stay.reservation} ${host.join(" ")}`)) {
    bits.push(`Nothing extra was charged at checkout. ${clip(stay.reservation, 120)}`);
  }
  if (bits.length === 1) bits.push(reviewOnlyMiddle(review));
  bits.push("Thank you for staying with us.");
  return bits.join(" ");
}

function reviewOnlyDraft(guest: string, review: string): string {
  const name = firstName(guest);
  return `${name}, thank you for writing. ${reviewOnlyMiddle(review)} Thank you for staying with us.`;
}

function reviewOnlyMiddle(review: string): string {
  const topics = reviewTopics(review);
  return topics ? `Sorry ${topics}.` : "We've read what you wrote.";
}

function reviewTopics(review: string): string {
  const found: string[] = [];
  if (/bed|mattress/i.test(review)) found.push("the bed was not what you wanted");
  if (/shower/i.test(review)) found.push("the shower pressure was weak");
  if (/dirt|stain|clean/i.test(review)) found.push("the place was not as clean as it should have been");
  if (/elevator/i.test(review)) found.push("the elevator made the arrival harder");
  if (/code|check-?in/i.test(review)) found.push("check-in was harder than it should have been");
  if (!found.length) return "";
  if (found.length === 1) return found[0];
  return `${found.slice(0, -1).join(", ")} and ${found[found.length - 1]}`;
}

function disputeReason(review: string, stay: StayFacts): { reason: string; facts: ReviewFact[] } {
  const text = textDispute(review);
  const host = stay.messages.filter((row) => row.role === "host").map((row) => row.body.trim()).filter(Boolean);
  const facts = [...text.facts];
  let reason = text.reason;
  if (/never answered|didn't answer|didn’t answer|ignored our messages/i.test(review) && host.length) {
    reason = "The review says the host never answered. The conversation shows a reply.";
    facts.unshift({
      claim: "The host never answered",
      record: `Host reply: ${clip(host[host.length - 1], 160)}`,
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

function overlaps(review: string, sentence: string): boolean {
  const words = (sentence.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => !/this|that|with|from|have|been|were|your|about|right/.test(word));
  const blob = review.toLowerCase();
  return words.some((word) => blob.includes(word.slice(0, 4)));
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

function reviewedLabel(iso: string, now: Date): string {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const today = torontoToday(now);
  if (day === today) return "Posted today";
  if (day === addDays(today, -1)) return "Posted yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

function guestPhoto(raw: Record<string, unknown>): string {
  const guest = raw.guest && typeof raw.guest === "object" ? raw.guest as Record<string, unknown> : {};
  for (const key of ["picture", "picture_url", "profile_picture", "avatar", "photo"]) {
    const value = guest[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return "";
}
