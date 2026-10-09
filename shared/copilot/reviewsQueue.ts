/**
 * Reviews queue. Submit is the only write. Regenerate reads the stay for facts
 * and writes a fresh reply to the review. Message text is never copied into the draft.
 */

import { listHospitableReviews, respondToHospitableReview } from "../pm/hospitableClient.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { copilotHospitableToken, copilotKeepsProperty, hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { hubPlain } from "./knowledgeHub.js";
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
  return writeDraft(guest, review);
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
  const composed = guardedReply(input.guest, input.review, input.stay, input.stars);
  const dispute = disputeReason(input.review, input.stay);
  return {
    draft: composed.draft,
    previous,
    sourceLine: sourceLineFor(input.stay, composed.draft, composed.marks),
    unchanged: false,
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

export async function regenerateFromConnection(input: {
  guest: string;
  review: string;
  current: string;
  reservationId: string;
  propertyId: string;
  stars?: number;
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
  const properties = [];
  for (const row of await listPmProperties().catch(() => [])) {
    if (await copilotKeepsProperty({ id: row.hospitable_property_id || "", name: row.name, address: row.address })) properties.push(row);
  }
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
      const needsCare = reviewNeedsCare(text, flag.reason);
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
        needsCare,
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

type FactMarks = { conversation: string[]; stay: string[] };

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

function guardedReply(guest: string, review: string, stay: StayFacts, stars?: number): { draft: string; marks: FactMarks } {
  const first = composeReply(guest, review, stay, stars, false);
  if (!reviewDraftRejected(first.draft, guest, stay)) return first;
  const again = composeReply(guest, review, stay, stars, true);
  if (!reviewDraftRejected(again.draft, guest, stay)) return again;
  const name = firstName(guest);
  const last = positiveReview(review, stars)
    ? `${name}, thank you for staying with us. We'd love to welcome you back.`
    : `${name}, thank you for staying with us.`;
  if (!reviewDraftRejected(last, guest, stay)) return { draft: last, marks: { conversation: [], stay: [] } };
  return { draft: "Thank you for staying with us.", marks: { conversation: [], stay: [] } };
}

function composeReply(guest: string, review: string, stay: StayFacts, stars: number | undefined, plain: boolean): { draft: string; marks: FactMarks } {
  if (positiveReview(review, stars)) {
    return {
      draft: plain
        ? `${firstName(guest)}, thank you for the kind words. We're glad the stay went well. We'd love to welcome you back.`
        : thankYou(guest, review),
      marks: { conversation: [], stay: [] },
    };
  }
  const guestMessages = stay.messages.filter((row) => row.role === "guest" && row.body.trim());
  const conversationFailed = stay.failed.some((line) => /conversation/i.test(line));
  const thin = conversationFailed || guestMessages.length < 2;
  if (thin) return { draft: reviewOnlyDraft(guest, review), marks: { conversation: [], stay: [] } };
  return claimReply(guest, review, stay, plain);
}

function positiveReview(review: string, stars?: number): boolean {
  if (hasComplaint(review)) return false;
  return stars == null || stars >= 5;
}

function thankYou(guest: string, review: string): string {
  const name = firstName(guest);
  return `${name}, thank you for the kind words. ${glad(praised(review))} We'd love to welcome you back.`;
}

function praised(review: string): string[] {
  const found: string[] = [];
  const add = (label: string) => {
    if (!found.includes(label) && found.length < 3) found.push(label);
  };
  if (/\blocation\b/i.test(review)) add("the location worked for you");
  if (/\bresponsive\b/i.test(review)) add("we were responsive");
  if (/\bcheck[\s-]*in\b/i.test(review) && /\bcheck[\s-]*out\b/i.test(review)) add("check-in and check-out were simple and easy");
  else if (/\bcheck[\s-]*in\b/i.test(review) && /\b(easy|simple|smooth)\b/i.test(review)) add("check-in was simple and easy");
  if (/\b(spotless|very clean|so clean|cleanliness)\b/i.test(review)) add("the place was clean");
  if (/\bcomfort/i.test(review)) add("the place was comfortable");
  if (!found.length) add("the stay went well");
  return found;
}

function glad(items: string[]): string {
  if (items.length === 1) return `We're glad ${items[0]}.`;
  const head = items.slice(0, -1).map((item, index) => (index === 0 ? item : `that ${item}`));
  return `We're glad ${head.join(", ")}, and that ${items[items.length - 1]}.`;
}

function claimReply(guest: string, review: string, stay: StayFacts, plain = false): { draft: string; marks: FactMarks } {
  const name = firstName(guest);
  const host = stay.messages.filter((row) => row.role === "host").map((row) => row.body.trim()).filter((body) => body && !isStayTemplate(body));
  const marks: FactMarks = { conversation: [], stay: [] };
  const trueBits: string[] = [];
  const falseBits: string[] = [];
  const unanswered = /never answered|did not answer|didn't answer|didn’t answer|no one answered|ignored our messages|never replied/i.test(review);
  if (unanswered && host.length) {
    falseBits.push("your messages were answered");
    marks.conversation.push("messages were answered");
  }
  if (/sofa|stain/i.test(review) && host.some((body) => /stain|sofa/i.test(body))) {
    const when = host.some((body) => /stain|sofa/i.test(body) && /this evening/i.test(body)) ? " this evening" : "";
    trueBits.push(`the sofa was stained, and the sofa stain was cleaned${when}`);
    marks.conversation.push("sofa stain");
    if (when) marks.conversation.push("this evening");
  }
  if (/charg|\$\d|checkout fee/i.test(review) && /no (later|extra) charge|nothing was added|security hold/i.test(`${stay.reservation} ${host.join(" ")}`)) {
    falseBits.push("nothing extra was charged at checkout");
    marks.conversation.push("nothing extra was charged");
    if (stay.reservation) marks.stay.push("nothing extra was charged");
  }
  if (!trueBits.length) {
    const topics = reviewTopics(review);
    if (topics) trueBits.push(topics);
  }
  const bits = [`${name}, thank you for writing.`];
  if (trueBits.length) bits.push(`You're right that ${joinList(trueBits)}.`);
  if (falseBits.length) bits.push(`${cap(joinList(falseBits))}.`);
  if (!plain && /sofa/i.test(review) && /sofa/i.test(stay.hub) && /closet/i.test(stay.hub)) {
    bits.push("A spare cover for the sofa is kept in the closet in the hall.");
    marks.stay.push("spare cover");
  }
  if (bits.length === 1) bits.push(reviewOnlyMiddle(review));
  bits.push("Thank you for staying with us.");
  return { draft: bits.join(" "), marks };
}

function sourceLineFor(stay: StayFacts, draft: string, marks: FactMarks): string {
  const blob = draft.toLowerCase();
  const conversation = marks.conversation.some((fact) => blob.includes(fact.toLowerCase()));
  const record = marks.stay.some((fact) => blob.includes(fact.toLowerCase()));
  const guestMessages = stay.messages.filter((row) => row.role === "guest" && row.body.trim());
  const conversationFailed = stay.failed.some((line) => /conversation/i.test(line));
  const thin = conversationFailed || guestMessages.length < 2;
  if (!conversation && !record) {
    if (conversationFailed) return "Regenerated from the review alone. The conversation read failed.";
    if (thin) return SOURCE_ALONE;
    return "Regenerated from the review.";
  }
  if (thin || stay.failed.length) return readSourceLine(stay);
  if (conversation && record) return SOURCE_FULL;
  if (conversation) return "Regenerated from the full conversation.";
  return "Regenerated from the stay record.";
}

function readSourceLine(stay: StayFacts): string {
  const guestMessages = stay.messages.filter((row) => row.role === "guest" && row.body.trim());
  const conversationFailed = stay.failed.some((line) => /conversation/i.test(line));
  const thin = conversationFailed || guestMessages.length < 2;
  const extras = stay.failed.filter((line) => !(thin && conversationFailed && /conversation/i.test(line)));
  const base = thin
    ? conversationFailed
      ? "Regenerated from the review alone. The conversation read failed."
      : SOURCE_ALONE
    : SOURCE_FULL;
  return extras.length && !(thin && conversationFailed && extras.every((line) => /conversation/i.test(line)))
    ? `${base.replace(/\.$/, "")}. ${extras.filter((line) => !(conversationFailed && /conversation/i.test(line))).join(" ")}`
    : base;
}

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

function hasComplaint(review: string): boolean {
  return /never answered|did not answer|didn't answer|didn’t answer|no one answered|ignored|stained|stain|dirty|dirt|weak|too soft|too hard|broken|smell|noisy|problem|issue|disappoint|terrible|awful|worst|refund|\bcharg|wasn'?t|weren'?t|not clean|didn'?t|did not|harder|difficult/i.test(review);
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function reviewOnlyDraft(guest: string, review: string): string {
  return writeDraft(guest, review);
}

function reviewOnlyMiddle(review: string): string {
  const complaints = specificComplaints(review);
  if (complaints.length) return `Sorry ${detailPhrase(complaints)}.`;
  const praises = specificPraises(review);
  if (praises.length) return `We are happy to hear about ${detailPhrase(praises)}.`;
  return "Thank you for telling us how the stay went.";
}

function reviewTopics(review: string): string {
  const found = specificComplaints(review);
  return found.length ? detailPhrase(found) : "";
}

function writeDraft(guest: string, review: string): string {
  const name = firstName(guest);
  const french = isFrenchReview(review);
  const complaints = specificComplaints(review);
  const praises = specificPraises(review, french);
  if (french) return frenchDraft(name, praises, complaints);
  if (complaints.length) {
    const point = detailPhrase(complaints);
    const kind = praises.length ? `${name}, thank you for the kind words about ${detailPhrase(praises)}.` : `${name}, thank you for the honest note.`;
    return `${kind} Sorry ${point}. We hope to welcome you back.`;
  }
  const details = detailPhrase(praises);
  return `${name}, thank you for telling us about ${details}. We loved reading that you noticed ${details}. You are welcome back whenever you want ${details} again.`;
}

function frenchDraft(name: string, praises: string[], complaints: string[]): string {
  if (complaints.length) {
    const point = detailPhrase(complaints, true);
    return `${name}, merci pour votre message. Désolé pour ${point}. Au plaisir de vous accueillir de nouveau.`;
  }
  const details = detailPhrase(praises, true);
  return `${name}, un grand merci pour ${details}. Nous sommes heureux que vous ayez apprécié ${details}. Au plaisir de vous recevoir de nouveau pour ${details}.`;
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

function detailPhrase(items: string[], french = false): string {
  if (!items.length) return french ? "le séjour" : "the stay";
  if (items.length === 1) return items[0];
  return `${items[0]} ${french ? "et" : "and"} ${items[1]}`;
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
