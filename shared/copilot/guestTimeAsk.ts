/**
 * Early check-in and late checkout asks. Copilot only notices them.
 * The partners answer and price them in Hospitable themselves.
 * Nothing here proposes a price, sends a message, or changes a reservation.
 */

export type TimeAskTurn = { at: string; role: string; name: string; body: string };

export type TimeAsk = {
  kind: "early" | "late";
  /** "7:30 AM", or "" when the guest named no time. */
  time: string;
  quote: string;
  at: string;
};

export type TimeAskRead = {
  open: TimeAsk[];
  settled: { kind: "early" | "late"; closeText: string }[];
};

const STANDARD_IN = 16 * 60;
const STANDARD_OUT = 11 * 60;

const ASKING = /\b(can (?:we|i)|could (?:we|i)|may (?:we|i)|would it be possible|is it possible|possible to|any chance|is there any way|do you allow|are we able|would you allow|wondering if|hoping to|we'?d like to|i'?d like to|we would like|i would like|okay if|ok if|alright if|request)\b|\?/i;
const EARLY_WORDS = /\bearl(?:y|ier)\s*(?:check[\s-]*in|arrival|access|entry|drop[\s-]*off)\b|\b(?:check[\s-]*in|arrive|arriving|arrival|get in|get there|come in|access the (?:unit|apartment|place|condo|house))\s+(?:a (?:bit|little) )?(?:early|earlier|sooner)\b/i;
const LATE_WORDS = /\blate(?:r)?\s*check[\s-]*out\b|\b(?:check[\s-]*out|checkout|leave|stay)\s+(?:a (?:bit|little) )?(?:late|later)\b/i;
const ARRIVE = /\b(arrive|arriving|arrival|get in|get there|be there|come in|come by|come at|come over|check[\s-]*in|checking in|drop (?:off )?(?:our |the )?(?:bags|luggage)|access)\b/i;
const DEPART = /\b(check[\s-]*out|checkout|checking out|leave|leaving|depart|departing|stay (?:until|till|til|to)|stay in the (?:unit|apartment|place) (?:until|till|til)|keep the (?:unit|apartment|place) (?:until|till|til))\b/i;

/** "an hour before", "30 minutes earlier", "a couple of hours early": how much sooner than check-in, when no clock time is given. */
const RELATIVE_EARLY = /\b(an?|one|two|three|half an?|a couple of|a few|\d+(?:\.\d+)?)\s*(?:and a half\s*)?(hours?|hrs?|minutes?|mins?)\s+(?:before|earlier|early|ahead)\b/i;
const HEDGE = /\b(likely|probably|hoping|hope to|would like|we'?d like|i'?d like|if possible|possibly|maybe|ideally|just)\b/i;

function relativeMinutes(text: string): number | null {
  const match = RELATIVE_EARLY.exec(text);
  if (!match) return null;
  const word = (match[1] ?? "").toLowerCase();
  const amount = word === "a" || word === "an" || word === "one" ? 1 : word === "two" || word === "a couple of" ? 2 : word === "three" ? 3 : word === "a few" ? 3 : word === "half a" || word === "half an" ? 0.5 : Number(word);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * (/^m/i.test(match[2] ?? "") ? 1 : 60));
}

const PRICE = /\$\s?\d|\b\d+\s?(?:dollars|cad|usd)\b|\b(fee|charge|cost|costs|extra|price)\b/i;
const DECLINE = /\b(unfortunately|sorry|can't|cannot|can not|won't be able|not able|unable|isn't possible|is not possible|not possible|not available|isn't available|no early|no late|fully booked|another guest|guests (?:arriving|checking in|checking out)|back[\s-]to[\s-]back|same[\s-]day)\b/i;
const OFFER = /\b(yes|yep|sure|of course|absolutely|no problem|not a problem|happy to|works|that's fine|that is fine|is fine|is okay|is ok|would be fine|would be great|we can|i can|you can|you're welcome to|you are welcome to|welcome to|can do|confirmed|is available|is open|we'?ll have it ready|it'?s ready|offer|go ahead)\b/i;
const MAYBE = /\b(if (?:we|i) can|see if|let (?:me|us) check|i'?ll check|we'?ll check|will check|get back to you|let you know|will confirm|i'?ll confirm|we'?ll confirm)\b/gi;
const TOPIC = /\b(early|earlier|late|later|check(?:ing)?[\s-]*(?:in|out)|checkout|arriv\w*|leav\w*|depart\w*|until|till|that morning|that afternoon)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)/i;
const DROP = /\b(never mind|nevermind|no worries|no need|don't need|do not need|won't need|will not need|not needed|forget (?:it|about it|that)|we'?re fine|we are fine|(?:standard|normal|usual|regular) (?:check[\s-]*in|check[\s-]*out|checkout|time) is (?:fine|ok|okay|great))\b|\bwe'?ll (?:just )?(?:arrive|come|check in) (?:at|around) (?:4|four)\b|\bwe'?ll (?:just )?(?:leave|check out) (?:at|by) (?:11|eleven)\b/i;

function plain(text: string): string {
  return text.replace(/[‘’′]/g, "'").replace(/\s+/g, " ").trim();
}

function label(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

type Clock = { minutes: number; index: number; meridiem: boolean };

/** Clock times in the text. A bare "7:30" or "at 2" is kept without AM/PM for the caller to place. */
function clocks(text: string): Clock[] {
  const found: Clock[] = [];
  for (const match of text.matchAll(/\b(noon|midday)\b/gi)) found.push({ minutes: 12 * 60, index: match.index ?? 0, meridiem: true });
  const re = /\b(?:at|by|until|till|til|around|about|for|before|after|from|to|~)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)?(?=\s|[.,!?)]|$)/gi;
  for (const match of text.matchAll(re)) {
    const lead = match[0].trim().toLowerCase();
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    const suffix = (match[3] ?? "").toLowerCase();
    if (hour > 12 || minute > 59) continue;
    const anchored = /^(at|by|until|till|til|around|about|before|after|from|~)\b/.test(lead) || Boolean(match[2]) || Boolean(suffix);
    if (!anchored) continue;
    const meridiem = suffix.startsWith("a") || suffix.startsWith("p");
    let minutes = (hour % 12) * 60 + minute;
    if (suffix.startsWith("p")) minutes += 12 * 60;
    found.push({ minutes, index: match.index ?? 0, meridiem });
  }
  return found;
}

/** Earliest believable reading of a bare arrival time, earlier than check-in. */
function arrivalMinutes(clock: Clock, standardIn: number): number | null {
  if (clock.meridiem) return clock.minutes < standardIn ? clock.minutes : null;
  const hour = Math.floor(clock.minutes / 60);
  const minute = clock.minutes % 60;
  if (hour >= 6 && hour <= 11) return hour * 60 + minute;
  const afternoon = (hour === 0 ? 12 : hour + 12) * 60 + minute;
  if (hour >= 1 && hour <= 5 && afternoon < standardIn) return afternoon;
  if (hour === 0 && afternoon < standardIn) return afternoon;
  return null;
}

/** Departure later than checkout. A bare "until 2" is 2 PM. */
function departureMinutes(clock: Clock, standardOut: number): number | null {
  if (clock.meridiem) return clock.minutes > standardOut ? clock.minutes : null;
  const hour = Math.floor(clock.minutes / 60);
  const minute = clock.minutes % 60;
  const reading = hour >= 1 && hour <= 9 ? (hour + 12) * 60 + minute : hour === 0 ? 12 * 60 + minute : hour * 60 + minute;
  return reading > standardOut ? reading : null;
}

function sentences(body: string): string[] {
  return body.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

/** The guest's own ask in one turn, if there is one. */
export function readTimeAsk(body: string, at: string, standardIn = STANDARD_IN, standardOut = STANDARD_OUT): TimeAsk[] {
  const asks: TimeAsk[] = [];
  for (const sentence of sentences(body)) {
    const text = plain(sentence);
    const asking = ASKING.test(text);
    const times = clocks(text);
    if (!asks.some((row) => row.kind === "early")) {
      const early = EARLY_WORDS.test(text);
      const near = ARRIVE.test(text);
      const minutes = near ? times.map((clock) => arrivalMinutes(clock, standardIn)).find((value): value is number => value != null) : undefined;
      const sooner = relativeMinutes(text);
      if (minutes != null && (asking || early)) asks.push({ kind: "early", time: label(minutes), quote: sentence.trim(), at });
      else if (early && asking) asks.push({ kind: "early", time: "", quote: sentence.trim(), at });
      // "Likely just an hour before": sooner than check-in by that much. Not a checkout ("an hour before we leave").
      else if (sooner != null && !DEPART.test(text) && (asking || HEDGE.test(text) || near || early)) {
        asks.push({ kind: "early", time: standardIn - sooner > 0 ? label(standardIn - sooner) : "", quote: sentence.trim(), at });
      }
    }
    if (!asks.some((row) => row.kind === "late")) {
      const late = LATE_WORDS.test(text);
      const near = DEPART.test(text);
      const minutes = near ? times.map((clock) => departureMinutes(clock, standardOut)).find((value): value is number => value != null) : undefined;
      if (minutes != null && (asking || late)) asks.push({ kind: "late", time: label(minutes), quote: sentence.trim(), at });
      else if (late && asking) asks.push({ kind: "late", time: "", quote: sentence.trim(), at });
    }
  }
  return asks;
}

/** A host turn that offers, prices, or declines the ask. "I'll check and get back to you" does not count. */
function hostAnswers(body: string, kind: "early" | "late"): boolean {
  const text = plain(body).replace(MAYBE, " ");
  const named = TOPIC.test(text) || (kind === "early" ? /\b(early|arriv)/i.test(text) : /\b(late|checkout|check[\s-]*out)/i.test(text));
  if (!named) return false;
  return PRICE.test(text) || DECLINE.test(text) || OFFER.test(text);
}

function guestDrops(body: string, kind: "early" | "late"): boolean {
  const text = plain(body);
  if (!DROP.test(text)) return false;
  if (/\b(early|late|check[\s-]*in|check[\s-]*out|checkout|arriv|leav|time)\b/i.test(text)) return true;
  return kind === "early" ? !/\blate\b/i.test(text) : !/\bearly\b/i.test(text);
}

/**
 * Open asks after reading the whole thread, oldest first.
 * Each ask closes when a host answers it, the guest drops it, or its moment has come:
 * an early check-in once check-in day arrives, a late checkout once checkout day has passed.
 */
export function readTimeAsks(input: {
  turns: TimeAskTurn[];
  checkIn: string;
  checkOut: string;
  today: string;
  standardIn?: number;
  standardOut?: number;
}): TimeAskRead {
  const turns = input.turns
    .filter((turn) => (turn.role === "guest" || turn.role === "host") && turn.body.trim())
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const open = new Map<"early" | "late", TimeAsk>();
  const settled: TimeAskRead["settled"] = [];
  for (const turn of turns) {
    if (turn.role === "guest") {
      for (const kind of ["early", "late"] as const) {
        const current = open.get(kind);
        if (current && guestDrops(turn.body, kind)) {
          open.delete(kind);
          settled.push({ kind, closeText: `${first(turn.name, "The guest")} dropped the ask` });
        }
      }
      for (const ask of readTimeAsk(turn.body, turn.at, input.standardIn, input.standardOut)) open.set(ask.kind, ask);
      continue;
    }
    for (const [kind] of [...open]) {
      if (!hostAnswers(turn.body, kind)) continue;
      open.delete(kind);
      settled.push({ kind, closeText: `${first(turn.name, "A host")} answered it in the thread` });
    }
  }
  for (const [kind] of [...open]) {
    const started = kind === "early"
      ? Boolean(input.checkIn) && input.today >= input.checkIn
      : Boolean(input.checkOut) && input.today > input.checkOut;
    if (!started) continue;
    open.delete(kind);
    settled.push({ kind, closeText: kind === "early" ? "the stay has started" : "the stay has ended" });
  }
  return { open: [...open.values()], settled };
}

/** "Ruzaina asked for early check-in at 7:30 AM" or "Eloise asked for late checkout until 2 PM". */
export function timeAskLine(guestFirst: string, ask: TimeAsk): string {
  const time = ask.time.replace(/:00 /, " ");
  if (ask.kind === "early") return `${guestFirst} asked for early check-in${time ? ` at ${time}` : ""}`;
  return `${guestFirst} asked for late checkout${time ? ` until ${time}` : ""}`;
}

function first(name: string, fallback: string): string {
  return name.trim().split(/\s+/)[0] || fallback;
}
