/**
 * "Did Rebecca send her car details?", "does Lee have any allergies?", "what did Husson say about arriving?"
 *
 * A fact a guest supplied lives in the guest's own thread, so it is answered like this, in this order:
 *   1. Match the guest to their reservation from Hospitable's records. Never ask which property, or whether a reservation
 *      exists, when the records hold it.
 *   2. Read that reservation's FULL thread (every page, one retry).
 *   3. Answer from what that thread says. Email is never the first source for a guest fact.
 *
 * A "no" is only said after the whole thread was read. If the read fails, comes back shallow, or is behind Hospitable's own
 * record of the latest message, the answer says what could not be checked. A failed read is never turned into a "no".
 * Nothing here sends anything.
 */

import { surfaceFollowUpsFromThread } from "./guestMessaging.js";
import { describeVehicle, noCarFromThread, vehiclesFromThread, type Vehicle } from "./guestVehicle.js";
import { readTimeAsks } from "./guestTimeAsk.js";
import { parityEnabled } from "./parity/flag.js";
import { forgetThread, loadConversations, readStayThread, type Conversation } from "./stayCheck.js";
import { torontoToday } from "./time.js";

export type FactTopic = "vehicle" | "dietary" | "arrival" | "any";

const NOT_ABOUT_GUEST = /\b(building|registration|register|concierge|e-?mail(?:ed|s)?|draft)\b/i;
const VEHICLE = /\b(cars?|vehicles?|plates?|licen[cs]e|licen[cs]e plate|truck|suv|parking)\b/i;
const DIETARY = /\b(allerg\w*|diet\w*|vegan|vegetarian|gluten|halal|kosher|lactose|celiac|coeliac|food restrictions?|nut allergy|peanut)\b/i;
const ARRIVAL = /\b(early (?:check[\s-]?in|arrival)|late (?:check[\s-]?out|arrival)|arriv\w*|eta|flight|landing|lands?|early|late)\b/i;
const GUEST_DID = /\b(send|sent|sends|give|gave|share|shared|provide|provided|tell|told|say|said|mention|mentioned|ask|asked|request|requested|reply|replied|respond|responded|write|wrote|text|texted|message|messaged|list|listed|submit|submitted|forward|forwarded|bring|bringing|brought|have|has|having|drive|driving|put|let us know|let me know)\b/i;
const ANYTHING = /\b(what (?:did|has|have)\s+\S+\s+(?:say|said|send|sent|ask|asked|tell|told|write|wrote|mention|mentioned)|anything (?:from|about)|any (?:messages?|replies|reply) (?:from|by)|did \S+ (?:message|reply|respond|write|text)\b)/i;
/** Money, counts and business questions are never "what did a guest say". */
const NOT_A_GUEST_FACT = /\b(make|made|earn|earned|revenue|payout|take home|took home|income|profit|cost|price|fee|fees|paid|payment|rate|nights?|occupancy|booked|how much|how many)\b/i;
const PRONOUN = /\b(she|he|they|her|his|their|hers|them)\b/i;

const PRONOUNS_AND_FILLER = new Set([
  "she", "he", "they", "her", "his", "their", "it", "we", "you", "i", "anyone", "anybody", "someone", "somebody", "the", "a", "an",
  "our", "your", "my", "that", "this", "there", "guest", "guests", "who", "what", "any", "all", "everyone", "nobody", "partner", "partners",
]);

/** A first name that is also an ordinary word: it only counts as a name where a name would be. */
const AMBIGUOUS_NAMES = new Set(["will", "may", "mark", "don", "bill", "grace", "hope", "faith", "rose", "ruby", "ivy", "joy", "dawn", "summer", "april", "june", "august", "amber", "jade", "pat", "sue", "bob", "jack", "rob", "max", "art", "chase", "dean", "drew", "earl", "gene", "guy", "heath", "jay", "lane", "miles", "noel", "pearl", "rich", "rick", "skip", "sky", "star", "van", "ward"]);

/** What kind of guest-supplied fact a question asks about, or null when it isn't that kind of question. */
export function topicOf(text: string): FactTopic | null {
  const asked = text.trim();
  if (!asked || NOT_ABOUT_GUEST.test(asked) || NOT_A_GUEST_FACT.test(asked)) return null;
  const subject = PRONOUN.test(asked) || /['’]s\b/.test(asked) || /\b(did|does|do|has|have|had|was|is|will)\s+[a-z][\w'-]+/i.test(asked);
  if (!subject) return null;
  const did = GUEST_DID.test(asked) || /\b(what|which)\b[^?]*\b(car|vehicle|plate)\b/i.test(asked);
  if (VEHICLE.test(asked) && did) return "vehicle";
  if (DIETARY.test(asked) && (did || /\bany\b/i.test(asked))) return "dietary";
  if (ARRIVAL.test(asked) && /\b(say|said|tell|told|mention|mentioned|ask|asked|request|requested|let (?:us|me) know|wants?|want(?:ed)?)\b/i.test(asked)) return "arrival";
  // "What did Diane say last?" already has its own answer: the last message, with its time.
  if (ANYTHING.test(asked) && !/\b(reservation|booking|paid|payment|check[\s-]?in|check[\s-]?out|last|latest|most recent|newest|previous)\b/i.test(asked)) return "any";
  return null;
}

/** The first name of a guest in some text, among the guests the records hold. Case does not matter. */
export function findGuestName(text: string, names: string[], options: { last?: boolean } = {}): string {
  const found: { name: string; at: number }[] = [];
  for (const name of names) {
    if (name.length < 2 || PRONOUNS_AND_FILLER.has(name.toLowerCase())) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const plain = new RegExp(`\\b${escaped}\\b`, "i").exec(text);
    if (!plain) continue;
    if (AMBIGUOUS_NAMES.has(name.toLowerCase())) {
      const where = new RegExp(`\\b(?:did|does|do|has|have|had|was|is|for|from|about|ask|tell|told|with|that)\\s+${escaped}\\b|\\b${escaped}['’]s\\b|\\b${name[0]!.toUpperCase()}${escaped.slice(1)}\\b`).exec(text);
      if (!where) continue;
    }
    found.push({ name, at: plain.index });
  }
  if (!found.length) return "";
  found.sort((a, b) => (options.last ? b.at - a.at : a.at - b.at));
  return found[0]!.name;
}

const PLACE_WORDS = new Set(["charlotte", "roseglor", "shaw", "blue", "jays", "toronto", "king", "unit", "airbnb", "hospitable", "copilot", "september", "october", "november", "december", "january", "february", "march", "april", "may", "june", "july", "august", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow", "yesterday"]);

/** A name-shaped word where a guest's name would be ("did zxqv send her car"), when the records don't hold it. */
function unmatchedName(text: string): string {
  const match = /\b(?:did|does|has|have|had|was|is|for|from|about)\s+([A-Za-z][\w'-]{2,})\b/i.exec(text) ?? /\b([A-Za-z][\w'-]{2,})['’]s\s+(?:car|vehicle|plate|licen[cs]e|parking|allerg)/i.exec(text);
  const word = match?.[1] ?? "";
  return word && !PRONOUNS_AND_FILLER.has(word.toLowerCase()) && !PLACE_WORDS.has(word.toLowerCase()) && !/^(the|any|anything|something|nothing|that|this|these|those|another|other)$/i.test(word) ? word : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 21-25, 2026", "Oct 30-Nov 2, 2026", "Dec 30, 2026-Jan 2, 2027". */
export function stayRange(checkIn: string, checkOut: string): string {
  const [y1, m1, d1] = checkIn.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = checkOut.slice(0, 10).split("-").map(Number);
  if (!y1 || !m1 || !d1) return "";
  if (!y2 || !m2 || !d2) return `${MONTHS[m1 - 1]} ${d1}, ${y1}`;
  if (y1 !== y2) return `${MONTHS[m1 - 1]} ${d1}, ${y1}-${MONTHS[m2 - 1]} ${d2}, ${y2}`;
  if (m1 === m2) return `${MONTHS[m1 - 1]} ${d1}-${d2}, ${y1}`;
  return `${MONTHS[m1 - 1]} ${d1}-${MONTHS[m2 - 1]} ${d2}, ${y1}`;
}

function spoken(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at);
  return `${day} at ${time}`;
}

type Msg = { at: string; role: string; name: string; body: string };

/** Best reservation for a guest name: here now or coming up first, then the most recent; cancelled last. */
function pickStays(name: string, conversations: Conversation[], today: string): { best: Conversation | null; others: Conversation[] } {
  const mine = conversations.filter((row) => row.stay.guest.toLowerCase() === name.toLowerCase());
  const rank = (row: Conversation): number => {
    const cancelled = /cancel|declin|denied|expired/i.test(row.stay.status) ? 1_000_000 : 0;
    const out = row.stay.checkOut || row.stay.checkIn;
    if (out >= today) return cancelled + Date.parse(`${row.stay.checkIn || today}T12:00:00Z`) / 86_400_000 - Date.parse(`${today}T12:00:00Z`) / 86_400_000;
    return cancelled + 100_000 + (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${out}T12:00:00Z`)) / 86_400_000;
  };
  const sorted = [...mine].sort((a, b) => rank(a) - rank(b));
  return { best: sorted[0] ?? null, others: sorted.slice(1).filter((row) => rank(row) < 100_000) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ThreadRead = { ok: true; messages: Msg[]; behind: string } | { ok: false; reason: string };

/**
 * The guest's full thread. A failed read is tried once more. A thread that is empty or older than Hospitable's own
 * "last message" stamp is read live once more; if it is still behind, that is reported, never ignored.
 */
export async function readFullThread(
  input: { id: string; reservation?: Record<string, unknown> | null; watermark?: string },
  now: Date,
): Promise<ThreadRead> {
  const raw = input.reservation ?? {};
  const stamp = typeof raw.last_message_at === "string" ? raw.last_message_at : "";
  const stampMs = Date.parse(stamp);
  const attempt = async (live: boolean): Promise<Msg[]> => {
    if (live) forgetThread(input.id);
    return readStayThread(input.id, now, live ? "" : (input.watermark ?? stamp));
  };
  let messages: Msg[];
  try {
    messages = await attempt(false);
  } catch (first) {
    if (!parityEnabled()) await sleep(700);
    try {
      messages = await attempt(true);
    } catch (second) {
      const reason = second instanceof Error ? second.message : first instanceof Error ? first.message : "Hospitable didn't return the messages.";
      return { ok: false, reason };
    }
  }
  const newest = Math.max(0, ...messages.map((row) => Date.parse(row.at)).filter(Number.isFinite));
  const behindStamp = () => Number.isFinite(stampMs) && stampMs > 0 && (!messages.length || stampMs > newest + 2 * 60_000);
  if (behindStamp()) {
    try {
      messages = await attempt(true);
    } catch {
      return { ok: false, reason: "Hospitable returned a thread that stops before its own latest message, and the second read failed." };
    }
    const again = Math.max(0, ...messages.map((row) => Date.parse(row.at)).filter(Number.isFinite));
    if (Number.isFinite(stampMs) && stampMs > 0 && (!messages.length || stampMs > again + 2 * 60_000)) {
      return { ok: true, messages, behind: `Hospitable shows a message at ${spoken(stamp)} that isn't in the messages it returned` };
    }
  }
  return { ok: true, messages, behind: "" };
}

export async function readGuestThread(conv: Conversation, now: Date): Promise<ThreadRead> {
  if (conv.inquiry) {
    if (conv.turnsFailed || !conv.turns) return { ok: false, reason: "The inquiry's messages didn't come back." };
    return { ok: true, messages: conv.turns, behind: "" };
  }
  return readFullThread({ id: conv.stay.id, reservation: conv.reservation, watermark: conv.lastMessageAt }, now);
}

function guestLines(messages: Msg[]): Msg[] {
  return messages.filter((row) => row.role === "guest" && row.body.trim()).sort((a, b) => a.at.localeCompare(b.at));
}

function quote(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return `“${one.length > 200 ? `${one.slice(0, 199).trimEnd()}…` : one}”`;
}

function sentencesMatching(messages: Msg[], test: RegExp): { at: string; text: string }[] {
  const out: { at: string; text: string }[] = [];
  for (const row of guestLines(messages)) {
    for (const sentence of row.body.split(/(?<=[.!?\n])\s+/)) {
      if (test.test(sentence) && sentence.trim().length > 3) out.push({ at: row.at, text: sentence.trim() });
    }
  }
  return out;
}

export type GuestFactAnswer = { body: string; step: string; thought: string; stayId?: string };

const THOUGHT = "Answered from the guest's reservation and her full Airbnb thread in Hospitable. Email was not searched. Nothing was sent.";

function vehicleFact(first: string, stay: string, messages: Msg[]): { found: string; none: string } {
  const read = vehiclesFromThread(messages, first);
  if (read.vehicles.length) {
    const cars = read.vehicles.map((vehicle: Vehicle) => describeVehicle(vehicle));
    const missing = read.vehicles.flatMap((vehicle) => [!vehicle.make && !vehicle.model ? "make and model" : "", !vehicle.plate ? "plate" : "", !vehicle.colour ? "colour" : ""].filter(Boolean));
    const gap = missing.length ? ` Not given: ${[...new Set(missing)].join(", ")}.` : "";
    return { found: `Yes. ${first} sent ${read.vehicles.length > 1 ? "her vehicles" : "her vehicle"} in her Airbnb thread on ${spoken(read.at)}: ${cars.join("; ")}.${gap} Her stay: ${stay}.`, none: "" };
  }
  const nocar = noCarFromThread(messages);
  if (nocar) return { found: `She hasn't given a vehicle, but she said she isn't bringing one (${spoken(nocar.at)}): ${quote(nocar.quote)}. Her stay: ${stay}.`, none: "" };
  return { found: "", none: "vehicle details" };
}

export async function answerGuestFact(text: string, prior = "", now: Date = new Date()): Promise<GuestFactAnswer | null> {
  const topic = topicOf(text);
  if (!topic) return null;
  let loaded: Awaited<ReturnType<typeof loadConversations>>;
  try {
    loaded = await loadConversations(now);
  } catch {
    return {
      body: "I couldn't load the reservations from Hospitable, so I can't look up what the guest sent. I didn't search email and I'm not saying she hasn't sent it. Try again in a moment.",
      step: "Couldn't load reservations",
      thought: "Hospitable's reservations didn't load, so nothing was checked. Nothing was sent.",
    };
  }
  const conversations = loaded.conversations;
  const names = [...new Set(conversations.map((row) => row.stay.guest.trim()).filter(Boolean))];
  const named = findGuestName(text, names) || (PRONOUN.test(text) ? findGuestName(prior, names, { last: true }) : "");
  if (!named) {
    const stranger = topic === "any" ? "" : unmatchedName(text);
    if (!stranger) return null;
    const unread = loaded.failed.length ? ` I couldn't read ${loaded.failed.slice(0, 3).join(", ")}, so the guest may be there.` : "";
    return {
      body: `I don't see a guest named ${stranger} on any reservation or inquiry Hospitable returned (${conversations.length} checked).${unread} I didn't search email, and I'm not saying anything was or wasn't sent.`,
      step: "Looked for the guest in Hospitable",
      thought: "No guest by that name in the reservations. Nothing was sent.",
    };
  }
  const { best, others } = pickStays(named, conversations, torontoToday(now));
  if (!best) return null;
  const first = best.stay.guest.split(/\s+/)[0] || named;
  const where = `${best.label || best.propertyName}, ${stayRange(best.stay.checkIn, best.stay.checkOut)}`;
  const status = /cancel|declin|denied|expired/i.test(best.stay.status) ? ` (${best.stay.status})` : "";
  const stay = `${where}${status}`;
  const alsoLine = others.length
    ? ` There is also a ${first} at ${others.slice(0, 2).map((row) => `${row.label || row.propertyName}, ${stayRange(row.stay.checkIn, row.stay.checkOut)}`).join(" and ")}: ask if you meant that one.`
    : "";
  const read = await readGuestThread(best, now);
  if (!read.ok) {
    return {
      body: `I found ${first}'s stay (${stay}) but couldn't read her messages after trying twice (${read.reason.replace(/\.$/, "")}), so I can't tell you whether she sent it. That is not a "no". I didn't search email.${alsoLine}`,
      step: "Found the reservation, couldn't read the thread",
      thought: "The thread read failed twice. Nothing was concluded. Nothing was sent.",
      stayId: best.stay.id,
    };
  }
  const messages = read.messages;
  const mine = guestLines(messages);
  const total = messages.length;
  const checked = `I read all ${total} message${total === 1 ? "" : "s"} in ${first}'s Airbnb thread`;
  let body = "";
  let found = false;
  if (topic === "vehicle") {
    const fact = vehicleFact(first, stay, messages);
    if (fact.found) {
      body = fact.found;
      found = true;
    } else if (read.behind) {
      body = `I can't confirm she hasn't sent her car details. ${read.behind}, so I may be missing it. Her stay: ${stay}.`;
    } else {
      body = `No. ${checked} (${stay}) and she hasn't given vehicle details${mine.length ? `. Her last message was ${spoken(mine.at(-1)!.at)}: ${quote(mine.at(-1)!.body)}` : `: she hasn't written yet`}.`;
    }
  } else if (topic === "dietary") {
    const hits = sentencesMatching(messages, new RegExp(`${DIETARY.source}|\\b(?:can'?t eat|cannot eat|don'?t eat|do not eat)\\b`, "i")).slice(-3);
    if (hits.length) {
      body = `Yes. ${first} mentioned it in her Airbnb thread: ${hits.map((hit) => `${quote(hit.text)} (${spoken(hit.at)})`).join("; ")}. Her stay: ${stay}.`;
      found = true;
    } else if (read.behind) body = `I can't confirm she hasn't mentioned any. ${read.behind}, so I may be missing it. Her stay: ${stay}.`;
    else body = `No. ${checked} (${stay}) and she hasn't mentioned allergies or dietary needs.`;
  } else if (topic === "arrival") {
    const asks = readTimeAsks({ turns: messages, checkIn: best.stay.checkIn, checkOut: best.stay.checkOut, today: torontoToday(now) });
    const said = sentencesMatching(messages, /\b(?:arriv\w*|get(?:ting)? in|land(?:s|ing)?|eta|flight)\b[^.?!]*(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|noon|morning|afternoon|evening|night)|\b(?:early|late)\b[^.?!]*\b(?:check[\s-]?in|check[\s-]?out|arriv\w*)/i).slice(-3);
    if (asks.open.length || said.length) {
      const lines = [...asks.open.map((ask) => ({ at: ask.at, text: ask.quote })), ...said].slice(-3);
      body = `Yes. ${first} wrote about it in her Airbnb thread: ${lines.map((line) => `${quote(line.text)} (${spoken(line.at)})`).join("; ")}. Her stay: ${stay}.`;
      found = true;
    } else if (read.behind) body = `I can't confirm she hasn't said. ${read.behind}, so I may be missing it. Her stay: ${stay}.`;
    else body = `No. ${checked} (${stay}) and she hasn't given an arrival time or asked for an early check-in or late checkout.`;
  } else {
    const recent = mine.slice(-3);
    body = recent.length
      ? `${first} has written ${mine.length} message${mine.length === 1 ? "" : "s"} in her Airbnb thread (${stay}). The latest: ${recent.map((row) => `${quote(row.body)} (${spoken(row.at)})`).join("; ")}.`
      : `${checked} (${stay}) and she hasn't written anything yet.`;
    found = Boolean(recent.length);
  }
  // Anything else the thread shows (an early check-in, a late checkout) opens in Guest Messaging, whatever was asked.
  let side = "";
  try {
    const opened = await surfaceFollowUpsFromThread(best, messages, now);
    if (opened.length) side = ` I also opened a follow-up in Guest messaging: ${opened[0]!.line}.`;
  } catch {
    /* The inbox scan finds it on its next pass. */
  }
  if (read.behind && found) body += ` (${read.behind}.)`;
  return {
    body: `${body}${alsoLine}${side}`,
    step: found ? "Read her Airbnb messages" : read.behind ? "Read her messages, which may be incomplete" : "Read her whole Airbnb thread",
    thought: THOUGHT,
    stayId: best.stay.id,
  };
}
