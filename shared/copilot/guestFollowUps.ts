/**
 * Open loops inside a guest thread. Separate from who owes the next reply.
 * We owe: a host commitment the guest accepted or asked for.
 * Incident: a handoff that stays open until the guest confirms.
 * Inquiry rows are created elsewhere and only sorted here.
 */

import { addDays, torontoToday } from "./time.js";
import type { GuestFollowUp, GuestFollowUpClose } from "./guestTypes.js";

export type FollowUpTurn = {
  at: string;
  role: string;
  name: string;
  body: string;
};

export type FollowUpStay = {
  reservationId: string;
  guest: string;
  property: string;
  propertyId: string;
  propertyPhoto?: string;
  guestPhoto?: string;
  checkIn: string;
  checkOut: string;
  turns: FollowUpTurn[];
};

type Topic = {
  id: string;
  label: string;
  test: (text: string) => boolean;
};

type Owe = {
  id: string;
  topic: Topic;
  at: string;
  by: string;
  body: string;
  asked: string;
  askedAt: string;
  agreed: string;
  agreedAt: string;
  agreedBy: string;
  accepted: boolean;
  due: string;
  onOrAfter: boolean;
};

type Incident = {
  id: string;
  topic: Topic;
  at: string;
  by: string;
  body: string;
  guestBody: string;
};

const TOPICS: Topic[] = [
  { id: "windows", label: "Window cleaning", test: (text) => /window/i.test(text) },
  { id: "key", label: "Extra key", test: (text) => /\bkeys?\b/i.test(text) },
  { id: "shower", label: "Shower", test: (text) => /shower/i.test(text) },
  { id: "towels", label: "Towels", test: (text) => /towel/i.test(text) },
  { id: "crib", label: "Crib", test: (text) => /\bcrib\b/i.test(text) },
  { id: "suitcase", label: "Suitcase", test: (text) => /suitcase|luggage/i.test(text) },
  { id: "pan", label: "Frying pan", test: (text) => /frying pan|\bpan\b/i.test(text) },
  { id: "bags", label: "Garbage bags", test: (text) => /garbage bag|\bbags?\b/i.test(text) },
  { id: "check-in", label: "Early check-in", test: (text) => /check-in|early arrival|home ready/i.test(text) },
  { id: "recipe", label: "Recipe", test: (text) => /recipe/i.test(text) },
  { id: "play", label: "Pack ’n Play", test: (text) => /pack\s*'?n\s*play|playpen/i.test(text) },
];

const FUTURE = /\b(i'll|i will|we'll|we will|we're going to|we are going to)\b/i;
const CAN = /\b(we can|i can|our [a-z]+ can)\b/i;
const ACTION = /\b(bring|leave|clean|have|get|send|drop|arrange|sort|confirm|come|deliver|fix|replace|provide|schedule|book|handle|set)\b/i;
const CAN_ACTION = /\b(bring|leave|clean|have the|get|send|drop|arrange|come|deliver|set up|ready)\b/i;
const DONE = /\b(all set|taken care|have been cleaned|has been cleaned|were cleaned|is cleaned|dropped off|on the bed|brought (it|them)|delivered|it's done|it is done)\b|\b(is|are) at the front desk\b/i;
const DECLINE = /\b(no thanks|no thank you|don't need|do not need|don't want|do not want|no need|we're fine|we are fine|not necessary|never mind|won't need|will not need|don't bother)\b|\bno,? (?:we|i) (?:don't|do not)\b/i;
const ACCEPT = /\b(yes|yeah|yep|sure|okay|ok|perfect|deal|sounds good|that works|that would|that'd|is fine|great|absolutely|go ahead|on or after)\b/i;
const PICKED_UP = /\b(picked (?:it |them |that |the \w+ )?up|have the suitcase|got the suitcase|collected it|i have it)\b/i;

function accepts(body: string): boolean {
  if (DECLINE.test(body)) return false;
  if (/\b(will check|i'll check|i will check|check tonight|check later)\b/i.test(body)) return false;
  return ACCEPT.test(body);
}

export function detectFollowUps(stay: FollowUpStay, now: Date): { open: GuestFollowUp[]; settled: GuestFollowUpClose[] } {
  const turns = stay.turns.filter((turn) => (turn.role === "guest" || turn.role === "host") && turn.body.trim());
  const owes: Owe[] = [];
  const incidents: Incident[] = [];
  const settled: GuestFollowUpClose[] = [];
  const guest = stay.guest.trim() || "Guest";
  const first = guest.split(/\s+/)[0] || "Guest";

  const settleOwe = (item: Owe, closeText: string) => {
    const index = owes.indexOf(item);
    if (index < 0) return;
    owes.splice(index, 1);
    settled.push({ id: item.id, guest, closeText });
  };
  const settleIncident = (item: Incident, closeText: string) => {
    const index = incidents.indexOf(item);
    if (index < 0) return;
    incidents.splice(index, 1);
    settled.push({ id: item.id, guest, closeText });
  };

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (!turn) continue;
    if (turn.role === "guest") {
      const incident = [...incidents].reverse().find((item) => guestConfirmsIncident(turn.body, item.topic));
      if (incident) {
        const picked = incident.topic.id === "suitcase" ? "the suitcase was picked up" : `the ${incident.topic.label.toLowerCase()} is resolved`;
        settleIncident(incident, `${first} confirmed at ${clock(turn.at)} ${picked}`);
      }
      const owe = latestOwe(owes, turn.body);
      if (owe && DECLINE.test(turn.body)) {
        settleOwe(owe, `${first} declined the ${owe.topic.label.toLowerCase()}`);
      } else if (owe && guestConfirmsOwe(turn.body, owe.topic)) {
        settleOwe(owe, `${first} confirmed at ${clock(turn.at)} it is done`);
      } else if (owe && accepts(turn.body) && !owe.accepted) {
        owe.accepted = true;
        owe.agreed = turn.body.trim();
        owe.agreedAt = turn.at;
        owe.agreedBy = nameOf(turn.name, first);
        const dated = dueIn(`${owe.body}\n${turn.body}`, owe.at);
        if (dated.due) owe.due = dated.due;
        if (dated.onOrAfter) owe.onOrAfter = true;
      }
      continue;
    }

    if (isIncidentNotice(turn.body)) {
      const topic = topicsFor(turn.body, priorGuest(turns, index))[0] ?? topicFrom(turn.body, "Incident");
      const owe = [...owes].reverse().find((item) => sameTopic(item.topic, topic));
      if (owe) settleOwe(owe, `${nameOf(turn.name, "The host")} delivered the ${owe.topic.label.toLowerCase()}`);
      const existing = incidents.find((item) => item.topic.id === topic.id);
      const notice: Incident = {
        id: `incident:${stay.reservationId}:${topic.id}`,
        topic,
        at: turn.at,
        by: nameOf(turn.name, "Host"),
        body: turn.body.trim(),
        guestBody: priorGuest(turns, index),
      };
      if (existing) {
        existing.at = notice.at;
        existing.by = notice.by;
        existing.body = notice.body;
        existing.guestBody = notice.guestBody || existing.guestBody;
      } else incidents.push(notice);
      continue;
    }

    if (DONE.test(turn.body)) {
      const topic = topicsFor(turn.body, "")[0];
      const owe = topic ? [...owes].reverse().find((item) => sameTopic(item.topic, topic)) : owes[owes.length - 1];
      if (owe && delivers(turn.body, owe.topic)) settleOwe(owe, `${nameOf(turn.name, "The host")} delivered the ${owe.topic.label.toLowerCase()}`);
    }

    if (!promiseMessage(turn.body)) continue;
    if (isAnaphoric(turn.body)) continue;
    const found = topicsFor(turn.body, priorGuest(turns, index));
    const topic = combine(found) ?? topicFrom(turn.body, "Promise");
    const dated = dueIn(turn.body, turn.at);
    const existing = owes.find((item) => sameTopic(item.topic, topic));
    if (existing) {
      existing.at = turn.at;
      existing.by = nameOf(turn.name, "Host");
      existing.body = turn.body.trim();
      if (dated.due) existing.due = dated.due;
      if (dated.onOrAfter) existing.onOrAfter = true;
      continue;
    }
    const asked = priorGuest(turns, index);
    owes.push({
      id: `owe:${stay.reservationId}:${topic.id}`,
      topic,
      at: turn.at,
      by: nameOf(turn.name, "Host"),
      body: turn.body.trim(),
      asked: topic.test(asked) ? asked.trim() : "",
      askedAt: topic.test(asked) ? guestAt(turns, index) : "",
      agreed: "",
      agreedAt: "",
      agreedBy: "",
      accepted: false,
      due: dated.due,
      onOrAfter: dated.onOrAfter,
    });
  }

  const today = torontoToday(now);
  const open = [
    ...owes.filter((item) => item.accepted || item.asked).map((item) => oweCard(stay, item, today, now)),
    ...incidents.map((item) => incidentCard(stay, item, now)),
  ];
  return { open, settled };
}

export function orderFollowUps(rows: GuestFollowUp[], now: Date): GuestFollowUp[] {
  const today = torontoToday(now);
  return rows.map((row) => paint(row, today, now)).sort((a, b) => {
    const rankA = a.dueNow ? 0 : deadline(a) < Number.POSITIVE_INFINITY ? 1 : 2;
    const rankB = b.dueNow ? 0 : deadline(b) < Number.POSITIVE_INFINITY ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;
    if (rankA < 2) return deadline(a) - deadline(b) || a.sourceAt.localeCompare(b.sourceAt);
    return a.sourceAt.localeCompare(b.sourceAt);
  });
}

function oweCard(stay: FollowUpStay, item: Owe, today: string, now: Date): GuestFollowUp {
  const guest = stay.guest.trim() || "Guest";
  const first = guest.split(/\s+/)[0] || "Guest";
  const agreed = item.accepted ? item.agreed : item.asked;
  const agreedAt = item.accepted ? item.agreedAt : item.askedAt;
  const agreedBy = item.accepted ? item.agreedBy || first : first;
  let due = item.due;
  let dueFrom: GuestFollowUp["dueFrom"] = due ? "thread" : "";
  if (!due) {
    const stayDate = nextStayDate(stay.checkIn, stay.checkOut, today);
    if (stayDate) {
      due = stayDate;
      dueFrom = "stay";
    }
  }
  const monthDay = due ? monthDayLabel(due) : "";
  const line = item.accepted && item.onOrAfter && monthDay
    ? `${item.topic.label} promised, ${first} agreed to on or after ${monthDay}`
    : item.accepted
      ? `${item.topic.label} promised, ${first} agreed`
      : `${item.topic.label} promised`;
  const card = emptyFollowUp({
    id: item.id,
    kind: "owe",
    reservationId: stay.reservationId,
    guest,
    first,
    property: stay.property,
    propertyId: stay.propertyId,
    propertyPhoto: stay.propertyPhoto || "",
    guestPhoto: stay.guestPhoto || "",
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    line,
    tag: "WE OWE",
    sourceAt: item.at,
    due,
    dueFrom,
    onOrAfter: item.onOrAfter,
    topic: item.topic.label,
    promised: item.body,
    promisedBy: item.by,
    promisedAt: item.at,
    promisedWhen: item.by ? `${item.by} · ${quoteStamp(item.at)}` : quoteStamp(item.at),
    agreed,
    agreedBy,
    agreedAt,
    agreedWhen: agreed ? `${agreedBy} · ${quoteStamp(agreedAt)}` : "",
    agreedAs: item.accepted ? "agreed" : agreed ? "asked" : "",
    draft: draftFor(first, item.topic.label, due),
  });
  return paint(card, today, now);
}

function incidentCard(stay: FollowUpStay, item: Incident, now: Date): GuestFollowUp {
  const guest = stay.guest.trim() || "Guest";
  const first = guest.split(/\s+/)[0] || "Guest";
  const place = /building security/i.test(item.body) && /front desk/i.test(item.body)
    ? "building security at the front desk"
    : /front desk/i.test(item.body)
      ? "the front desk"
      : /building security/i.test(item.body)
        ? "building security"
        : "the building";
  const itemName = /black suitcase/i.test(`${item.guestBody} ${item.body}`) ? "black suitcase" : item.topic.label.toLowerCase();
  const where = /bedroom closet/i.test(item.guestBody) ? " in the bedroom closet" : "";
  const under = /under (?:your|her|his) name|under [A-Z]/i.test(item.body) ? `, under ${first}’s name` : "";
  const what = item.topic.id === "suitcase" || /front desk|building security/i.test(item.body)
    ? `${first} left ${/^[aeiou]/i.test(itemName) ? "an" : "a"} ${itemName}${where}. ${item.by} left it with ${place}${under}.`
    : `${item.by} flagged this for ${first}: ${item.body}`;
  const sent = clock(item.at);
  const card = emptyFollowUp({
    id: item.id,
    kind: "incident",
    reservationId: stay.reservationId,
    guest,
    first,
    property: stay.property,
    propertyId: stay.propertyId,
    propertyPhoto: stay.propertyPhoto || "",
    guestPhoto: stay.guestPhoto || "",
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    line: `${item.topic.label} at ${place.replace(/^the /, "").replace("building security at the front desk", "front desk · building security")} · sent ${sent}, no confirmation yet`,
    tag: "INCIDENT",
    sourceAt: item.at,
    topic: item.topic.label,
    what,
    sentBy: item.by,
    sentWhen: `${quoteStamp(item.at)}, by ${item.by}`,
    resolvesWhen: `${first} confirms in the thread that the ${item.topic.label.toLowerCase()} is resolved. Copilot closes this on its own when that message arrives.`,
    promised: item.body,
    promisedBy: item.by,
    promisedAt: item.at,
  });
  if (item.topic.id === "suitcase" && /front desk/i.test(item.body)) {
    card.line = `Suitcase at front desk · building security · sent ${sent}, no confirmation yet`;
    card.resolvesWhen = `${first} confirms in the thread that the suitcase was picked up. Copilot closes this on its own when that message arrives.`;
  }
  return paint(card, torontoToday(now), now);
}

function paint(row: GuestFollowUp, today: string, now: Date): GuestFollowUp {
  const next = { ...row };
  next.initials = initials(next.guest);
  next.dates = next.dates || shortRange(next.checkIn, next.checkOut);
  next.stay = next.stay || stayLine(next.checkIn, next.checkOut, today);
  next.sourceLine = next.sourceLine || `From the thread with ${next.guest}, message ${weekdayTime(next.sourceAt)}`;
  if (next.kind === "incident") {
    const age = Math.max(0, now.getTime() - new Date(next.sourceAt).getTime());
    const parts = ageParts(age);
    next.dueNow = false;
    next.dueLabel = "";
    next.when = parts.short;
    next.whenSub = `sent ${clock(next.sourceAt)}`;
    next.dueSub = next.whenSub;
    next.since = `no reply since, ${parts.long}`;
    next.dueText = "";
    return next;
  }
  if (next.kind === "inquiry") {
    const expires = next.expiresAt ? new Date(next.expiresAt).getTime() : NaN;
    next.dueNow = Number.isFinite(expires) && expires <= now.getTime();
    if (!next.tag) next.tag = "INQUIRY";
    return next;
  }
  const due = next.due;
  if (!due) {
    next.dueNow = false;
    next.dueLabel = "No date given";
    next.dueSub = "";
    next.when = "No date given";
    next.whenSub = "";
    next.dueText = "No date given";
    return next;
  }
  const days = daySpan(today, due);
  next.dueLabel = weekdayDate(due);
  next.dueNow = due <= today;
  if (days === 0) {
    next.when = "Today";
    next.whenSub = next.dueLabel;
    next.dueSub = "today";
    next.dueText = `Today, ${next.dueLabel}`;
  } else if (days < 0) {
    next.when = next.dueLabel;
    next.whenSub = days === -1 ? "1 day ago" : `${Math.abs(days)} days ago`;
    next.dueSub = next.whenSub;
    next.dueText = `${next.dueLabel} · ${next.whenSub}`;
  } else {
    next.when = next.dueLabel;
    next.whenSub = days === 1 ? "in 1 day" : `in ${days} days`;
    next.dueSub = next.whenSub;
    const lead = next.onOrAfter ? `On or after ${next.dueLabel}` : next.dueLabel;
    const fromStay = next.dueFrom === "stay" ? " · no date in the thread" : "";
    next.dueText = `${lead} · ${next.whenSub}${fromStay}`;
  }
  if (/morning/i.test(next.agreed)) next.dueText = `${next.dueText} · mornings`;
  return next;
}

function deadline(row: GuestFollowUp): number {
  if (row.expiresAt) {
    const at = new Date(row.expiresAt).getTime();
    if (Number.isFinite(at)) return at;
  }
  if (row.due) return Date.parse(`${row.due}T12:00:00-04:00`);
  return Number.POSITIVE_INFINITY;
}

function latestOwe(owes: Owe[], body: string): Owe | undefined {
  const named = topicsIn(body);
  if (named.length) return [...owes].reverse().find((item) => named.some((topic) => sameTopic(item.topic, topic)));
  return owes[owes.length - 1];
}

function guestConfirmsIncident(body: string, topic: Topic): boolean {
  if (PICKED_UP.test(body)) return true;
  return /\bgot it\b/i.test(body) && topic.test(body);
}

function guestConfirmsOwe(body: string, topic: Topic): boolean {
  if (!/\b(all set|it's done|it is done|have been cleaned|cleaner came|looks great)\b/i.test(body)) return false;
  const named = topicsIn(body);
  if (!named.length) return true;
  return named.some((item) => sameTopic(topic, item));
}

function delivers(body: string, topic: Topic): boolean {
  if (!DONE.test(body)) return false;
  if (topic.test(body)) return true;
  const named = topicsIn(body);
  return named.length === 0 || named.some((item) => sameTopic(topic, item));
}

function isIncidentNotice(body: string): boolean {
  if (FUTURE.test(body)) return false;
  const place = /\b(front desk|building security|concierge)\b/i.test(body);
  const item = /\b(suitcase|luggage|package|pick(?:\s+it)?\s+up|under (?:your|her|his) name)\b/i.test(body);
  return place && item;
}

function promiseMessage(body: string): boolean {
  return sentences(body).some(isPromiseSentence);
}

function isPromiseSentence(sentence: string): boolean {
  if (/\b(i've|i have|we've|we have)\b/i.test(sentence) && !FUTURE.test(sentence)) return false;
  if (/^\s*(please|could you|can you|would you)\b/i.test(sentence)) return false;
  if (FUTURE.test(sentence) && ACTION.test(sentence)) return true;
  return CAN.test(sentence) && CAN_ACTION.test(sentence) && !/\?\s*$/.test(sentence);
}

function isAnaphoric(body: string): boolean {
  return /\b(i'll|i will|we'll|we will)\s+(confirm|follow up|let you know|update you)\b/i.test(body) && topicsIn(body).length === 0;
}

function topicsFor(body: string, context: string): Topic[] {
  const direct = topicsIn(body);
  if (direct.length) return direct;
  if (/\b(it|them|that|one)\b/i.test(body)) return topicsIn(context);
  return [];
}

function topicsIn(text: string): Topic[] {
  return TOPICS.filter((topic) => topic.test(text));
}

function combine(found: Topic[]): Topic | null {
  if (!found.length) return null;
  if (found.length === 1) return found[0] ?? null;
  const ids = found.map((topic) => topic.id).join("+");
  return {
    id: ids,
    label: found.map((topic) => topic.label).join(" and "),
    test: (text) => found.some((topic) => topic.test(text)),
  };
}

function sameTopic(a: Topic, b: Topic): boolean {
  const left = new Set(a.id.split("+"));
  return b.id.split("+").some((id) => left.has(id));
}

function topicFrom(body: string, fallback: string): Topic {
  const label = clip(body.replace(/^(sorry|perfect|sure|hi|hello)[^.]*[,.]?\s*/i, ""), 48) || fallback;
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "promise";
  return { id, label, test: () => false };
}

function priorGuest(turns: FollowUpTurn[], index: number): string {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const turn = turns[cursor];
    if (turn?.role === "guest" && turn.body.trim()) return turn.body.trim();
  }
  return "";
}

function guestAt(turns: FollowUpTurn[], index: number): string {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const turn = turns[cursor];
    if (turn?.role === "guest" && turn.body.trim()) return turn.at;
  }
  return "";
}

function dueIn(text: string, anchorIso: string): { due: string; onOrAfter: boolean } {
  const dated = datesIn(text, anchorIso);
  const relative = dated.length ? "" : relativeDay(text, anchorIso);
  const due = dated[0] || relative;
  const onOrAfter = /\bon or after\b/i.test(text) || /\bfrom\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text);
  return { due, onOrAfter: Boolean(due) && onOrAfter };
}

function datesIn(text: string, anchorIso: string): string[] {
  const anchor = new Date(anchorIso);
  const found: string[] = [];
  const monthRe = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
  for (const match of text.matchAll(monthRe)) {
    const month = monthIndex(match[1] ?? "");
    const day = Number(match[2]);
    if (month < 1 || day < 1 || day > 31) continue;
    found.push(isoDate(yearFor(month, anchor), month, day));
  }
  if (found.length) return found;
  const dayRe = /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/gi;
  const anchorMonth = torontoParts(anchor).month;
  for (const match of text.matchAll(dayRe)) {
    const day = Number(match[1]);
    if (day < 1 || day > 31) continue;
    found.push(isoDate(yearFor(anchorMonth, anchor), anchorMonth, day));
  }
  return found;
}

function relativeDay(text: string, anchorIso: string): string {
  const today = torontoDay(anchorIso);
  if (/\btomorrow\b/i.test(text)) return addDays(today, 1);
  if (/\b(today|tonight|this afternoon)\b/i.test(text)) return today;
  return "";
}

function nextStayDate(checkIn: string, checkOut: string, today: string): string {
  if (checkIn && checkIn >= today) return checkIn;
  if (checkOut && checkOut > today) return checkOut;
  return "";
}

function draftFor(first: string, topic: string, due: string): string {
  const when = due ? ` for ${weekdayDate(due)}` : "";
  return `Hi ${first}, following up on the ${topic.toLowerCase()}${when}. Does that still work for you?`;
}

function emptyFollowUp(partial: Partial<GuestFollowUp> & Pick<GuestFollowUp, "id" | "kind" | "reservationId" | "guest">): GuestFollowUp {
  return {
    first: "",
    initials: "",
    guestPhoto: "",
    property: "",
    propertyId: "",
    propertyPhoto: "",
    dates: "",
    stay: "",
    checkIn: "",
    checkOut: "",
    line: "",
    tag: "",
    sourceLine: "",
    sourceAt: "",
    due: "",
    dueLabel: "",
    dueSub: "",
    dueText: "",
    dueNow: false,
    when: "",
    whenSub: "",
    dueFrom: "",
    onOrAfter: false,
    topic: "",
    promised: "",
    promisedBy: "",
    promisedAt: "",
    promisedWhen: "",
    agreed: "",
    agreedBy: "",
    agreedAt: "",
    agreedWhen: "",
    agreedAs: "",
    what: "",
    sentBy: "",
    sentWhen: "",
    since: "",
    resolvesWhen: "",
    expiresAt: "",
    draft: "",
    notes: [],
    ...partial,
  };
}

function sentences(body: string): string[] {
  return body.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function nameOf(name: string, fallback: string): string {
  return name.trim().split(/\s+/)[0] || fallback;
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] || "").join("").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "G";
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max).trimEnd()}…`;
}

function monthIndex(token: string): number {
  const key = token.slice(0, 3).toLowerCase();
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(key) + 1;
}

function torontoParts(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function torontoDay(iso: string): string {
  const parts = torontoParts(new Date(iso));
  return isoDate(parts.year, parts.month, parts.day);
}

function yearFor(month: number, anchor: Date): number {
  const parts = torontoParts(anchor);
  if (month < parts.month && parts.month - month > 6) return parts.year + 1;
  return parts.year;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daySpan(today: string, due: string): number {
  return Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));
}

function weekdayTime(iso: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Toronto" }).format(new Date(iso));
  return `${weekday} ${clock(iso)}`;
}

function quoteStamp(iso: string): string {
  if (!iso) return "";
  const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(iso));
  return `${date.replace(",", "")}, ${clock(iso)}`;
}

function weekdayDate(due: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${due}T12:00:00Z`));
}

function monthDayLabel(due: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${due}T12:00:00Z`));
}

function shortRange(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return "";
  const start = monthDayLabel(checkIn);
  const end = monthDayLabel(checkOut);
  const [startMonth, startDay] = start.split(" ");
  const [endMonth, endDay] = end.split(" ");
  if (startMonth === endMonth) return `${startMonth} ${startDay}–${endDay}`;
  return `${start}–${end}`;
}

function stayLine(checkIn: string, checkOut: string, today: string): string {
  if (!checkIn || !checkOut) return "";
  const nights = Math.max(1, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000));
  const place = checkIn <= today && checkOut > today ? " · in stay now" : checkOut <= today ? " · checked out" : "";
  return `${weekdayDate(checkIn)} → ${weekdayDate(checkOut)} · ${nights} ${nights === 1 ? "night" : "nights"}${place}`;
}

function ageParts(ms: number): { short: string; long: string } {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) {
    const n = Math.max(1, minutes);
    return { short: `${n} min ago`, long: `${n} min` };
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return { short: `${hours} h ago`, long: rest ? `${hours} h ${rest} m` : `${hours} h` };
  const days = Math.floor(hours / 24);
  const label = days === 1 ? "1 day" : `${days} days`;
  return { short: `${label} ago`, long: label };
}
