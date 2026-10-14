/**
 * When a reminder is due, from however a partner says it, in Toronto time.
 *
 * Exact times are kept exactly ("at 6:00PM", "Friday at 10:30", "in 2 hours"). Day-part words have
 * fixed defaults (morning 9:00 AM, midday 12:00 PM, afternoon 1:00 PM, evening 6:00 PM, tonight
 * 7:00 PM). Vague windows still resolve to a point inside them ("next week sometime" is Monday
 * 9:00 AM, "later this week" Thursday 9:00 AM, "in a few days" three days out at 9:00 AM, a day with
 * no time 9:00 AM). Nothing resolves into the past: a time already gone today rolls to tomorrow, and
 * the result says so. Browser-safe: the card, the view and the server all read these.
 */

export const TZ = "America/Toronto";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SMALL: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, fortyfive: 45, sixty: 60, ninety: 90, few: 3, couple: 2, several: 3 };

export type LocalDay = { y: number; m: number; d: number };

/** Toronto wall-clock parts of an instant. */
export function torontoParts(at: Date): LocalDay & { h: number; min: number; dow: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "");
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour) % 24, min: Number(parts.minute), dow };
}

/** The instant a Toronto wall-clock time names. */
export function fromToronto(day: LocalDay, minutes: number): Date {
  const guess = Date.UTC(day.y, day.m - 1, day.d, Math.floor(minutes / 60), minutes % 60);
  // Toronto is UTC-4 or UTC-5; correct the guess by the offset at that moment, twice for DST edges.
  let at = guess + 5 * 3600_000;
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = torontoParts(new Date(at));
    const seenUtc = Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.min);
    at += guess - seenUtc;
  }
  return new Date(at);
}

export function shiftDay(day: LocalDay, days: number): LocalDay {
  const at = new Date(Date.UTC(day.y, day.m - 1, day.d + days, 12));
  return { y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate() };
}

function dowOf(day: LocalDay): number {
  return new Date(Date.UTC(day.y, day.m - 1, day.d, 12)).getUTCDay();
}

export function dayKey(day: LocalDay): string {
  return `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
}

/** Calendar days from one Toronto day to another. */
export function daysBetween(from: LocalDay, to: LocalDay): number {
  return Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 86_400_000);
}

export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Monday Oct 19 at 9:00 AM": the exact resolution, as the confirmation line states it. */
export function exactLabel(at: Date): string {
  const p = torontoParts(at);
  return `${LONG_DAYS[p.dow]} ${SHORT_MONTHS[p.m - 1]} ${p.d} at ${clockLabel(p.h * 60 + p.min)}`;
}

/** "Today 9:00 AM", "Tomorrow 1:00 PM", else "Fri Oct 16, 10:00 AM", as rows and chips show a time. */
export function dueWords(at: Date, now: Date): string {
  const p = torontoParts(at);
  const gap = daysBetween(torontoParts(now), p);
  const time = clockLabel(p.h * 60 + p.min);
  if (gap === 0) return `Today ${time}`;
  if (gap === 1) return `Tomorrow ${time}`;
  return `${SHORT_DAYS[p.dow]} ${SHORT_MONTHS[p.m - 1]} ${p.d}, ${time}`;
}

/** "Thu Oct 15", "Today", "Tomorrow" for a day chip. */
export function dayChip(day: LocalDay, today: LocalDay): string {
  const gap = daysBetween(today, day);
  if (gap === 0) return "Today";
  if (gap === 1) return "Tomorrow";
  return `${SHORT_DAYS[dowOf(day)]} ${SHORT_MONTHS[day.m - 1]} ${day.d}`;
}

export type ResolvedTime = {
  at: Date;
  /** The words that said when, so they can be cut from the task. */
  phrase: string[];
  /** Set when a stated time had already passed today and moved to tomorrow. */
  rolled: string;
  /** Set when the time came from a default (a day part or a vague window), to say how it was read. */
  assumed: string;
};

const PART_MINUTES: [RegExp, number, string][] = [
  [/\b(?:first thing(?: in the morning)?|in the morning|this morning|morning)\b/i, 540, "morning is 9:00 AM"],
  [/\b(?:at )?(?:midday|mid-day|noon|lunch(?:time)?)\b/i, 720, "midday is 12:00 PM"],
  [/\b(?:in the afternoon|this afternoon|afternoon)\b/i, 780, "afternoon is 1:00 PM"],
  [/\b(?:end of (?:the )?(?:business )?day|eod|close of business|cob)\b/i, 1020, "end of day is 5:00 PM"],
  [/\b(?:in the evening|this evening|evening)\b/i, 1080, "evening is 6:00 PM"],
  [/\b(?:tonight|tonite|late tonight)\b/i, 1140, "tonight is 7:00 PM"],
  [/\bmidnight\b/i, 1439, "midnight is 11:59 PM"],
];

function numberWord(word: string): number {
  const key = word.toLowerCase().replace(/\s+/g, "");
  if (/^\d+(?:\.\d+)?$/.test(key)) return Number(key);
  return SMALL[key] ?? NaN;
}

/** An explicit clock time: "6pm", "6:00 PM", "18:00", "at 6", "10:30". */
function clockTime(text: string): { minutes: number; phrase: string; meridiem: boolean } | null {
  const withMeridiem = /\b(?:at\s+|@\s*|by\s+|around\s+|for\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)\b/i.exec(text);
  if (withMeridiem) {
    let h = Number(withMeridiem[1]) % 12;
    const min = Number(withMeridiem[2] ?? 0);
    if (/^p/i.test(withMeridiem[3]!)) h += 12;
    if (h < 24 && min < 60) return { minutes: h * 60 + min, phrase: withMeridiem[0], meridiem: true };
  }
  const twentyFour = /\b(?:at\s+|@\s*|by\s+|around\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (twentyFour) {
    const h = Number(twentyFour[1]);
    const min = Number(twentyFour[2]);
    // 13:00 and up is a 24-hour time; below that, read like a bare hour.
    return { minutes: (h >= 13 || h === 0 ? h : bareHour(h)) * 60 + min, phrase: twentyFour[0], meridiem: h >= 13 };
  }
  const bare = /\b(?:at|@|by|around)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+o'?clock)?\b(?!\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|%|\$|units?|bags?))/i.exec(text);
  if (bare) {
    const h = numberWord(bare[1]!);
    if (h >= 1 && h <= 12) return { minutes: bareHour(h) * 60, phrase: bare[0], meridiem: false };
  }
  const oclock = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+o'?clock\b/i.exec(text);
  if (oclock) {
    const h = numberWord(oclock[1]!);
    if (h >= 1 && h <= 12) return { minutes: bareHour(h) * 60, phrase: oclock[0], meridiem: false };
  }
  return null;
}

/** A bare hour reads as working hours: 7 to 11 is morning, 12 is noon, 1 to 6 is afternoon or evening. */
function bareHour(h: number): number {
  if (h >= 7 && h <= 11) return h;
  if (h === 12) return 12;
  return h + 12;
}

/** In N minutes / hours / days / weeks, from now. */
function relative(text: string, now: Date): { at: Date; phrase: string; dayOnly: boolean } | null {
  if (/\bin (?:half an|a half|30) ?(?:hour|hr)\b/i.test(text) || /\bhalf an hour\b/i.test(text)) {
    const phrase = /\b(?:in )?(?:half an|a half) ?hour\b/i.exec(text)?.[0] ?? "half an hour";
    return { at: new Date(now.getTime() + 30 * 60_000), phrase, dayOnly: false };
  }
  const match = /\b(?:in|after)\s+(?:about\s+|around\s+|like\s+)?(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty(?:-?five)?|sixty|ninety|few|couple(?: of)?|several|\d+(?:\.\d+)?)\s+(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/i.exec(text);
  if (!match) return null;
  const amount = numberWord(match[1]!.replace(/ of$/i, ""));
  if (!Number.isFinite(amount)) return null;
  const unit = match[2]!.toLowerCase();
  if (/^min/.test(unit)) return { at: new Date(now.getTime() + amount * 60_000), phrase: match[0], dayOnly: false };
  if (/^h/.test(unit)) return { at: new Date(now.getTime() + amount * 3600_000), phrase: match[0], dayOnly: false };
  const days = /^w/.test(unit) ? amount * 7 : /^mo/.test(unit) ? amount * 30 : amount;
  return { at: fromToronto(shiftDay(torontoParts(now), Math.round(days)), 540), phrase: match[0], dayOnly: true };
}

/** The day said: today, tomorrow, a weekday, a date, or a window that resolves inside itself. */
function dayFrom(text: string, today: LocalDay & { dow: number }): { day: LocalDay; phrase: string; vague: string } | null {
  const lower = text.toLowerCase();
  let match: RegExpExecArray | null;
  if ((match = /\b(?:the\s+)?day after tomorrow\b/.exec(lower))) return { day: shiftDay(today, 2), phrase: match[0], vague: "" };
  if ((match = /\b(?:tomorrow|tmrw|tmr|tomorow|tommorow|tommorrow|2morrow)\b/.exec(lower))) return { day: shiftDay(today, 1), phrase: match[0], vague: "" };
  if ((match = /\b(?:today|tonight|tonite|this (?:morning|afternoon|evening))\b/.exec(lower))) return { day: today, phrase: /^today$/.test(match[0]) ? match[0] : "", vague: "" };
  if ((match = /\b(?:sometime |some time |anytime |any time )?next week(?: sometime| some time| at some point)?\b/.exec(lower))) {
    const toMonday = ((8 - today.dow) % 7) || 7;
    return { day: shiftDay(today, toMonday), phrase: match[0], vague: "next week is read as Monday" };
  }
  if ((match = /\b(?:later|sometime|some time) this week\b|\bthis week sometime\b|\bbefore the end of the week\b/.exec(lower))) {
    const toThursday = (4 - today.dow + 7) % 7;
    const day = today.dow < 4 ? shiftDay(today, toThursday) : shiftDay(today, 1);
    return { day, phrase: match[0], vague: today.dow < 4 ? "later this week is read as Thursday" : "later this week is read as tomorrow" };
  }
  if ((match = /\b(?:end of (?:the )?week|eow|by friday)\b/.exec(lower))) {
    const toFriday = (5 - today.dow + 7) % 7;
    return { day: shiftDay(today, toFriday), phrase: match[0], vague: "end of the week is read as Friday" };
  }
  if ((match = /\b(?:this|next|on the|over the)?\s*weekend\b/.exec(lower))) {
    // The coming Saturday (today if it is Saturday); "next weekend" is the one after.
    let toSaturday = (6 - today.dow + 7) % 7;
    if (/next/.test(match[0])) toSaturday += 7;
    return { day: shiftDay(today, toSaturday), phrase: match[0].trim(), vague: "the weekend is read as Saturday" };
  }
  if ((match = /\bin (?:a )?(?:few|couple(?: of)?) days\b/.exec(lower))) {
    const n = /couple/.test(match[0]) ? 2 : 3;
    return { day: shiftDay(today, n), phrase: match[0], vague: `a ${/couple/.test(match[0]) ? "couple of" : "few"} days is read as ${n} days` };
  }
  if ((match = /\bnext month\b|\bsometime next month\b/.exec(lower))) {
    const day = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
    return { day, phrase: match[0], vague: "next month is read as the 1st" };
  }
  if ((match = /\b(?:soon|sometime|some time|at some point|when you can|whenever)\b/.exec(lower))) {
    return { day: shiftDay(today, 1), phrase: match[0], vague: `"${match[0]}" is read as tomorrow` };
  }
  // Weekday names: "Friday", "this Friday", "next Friday", "on Fri". A bare "sat" or "sun" is a word, not a day.
  match = /\b(?:(this|next|coming|on)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thurs?|thu|fri|sat)\b/.exec(lower);
  if (match && (/day$/.test(match[2]!) || match[1] || /^(?:mon|tues?|wed|thurs?|thu|fri)$/.test(match[2]!))) {
    const target = DAY_NAMES.findIndex((name) => name.startsWith(match![2]!.slice(0, 3)));
    let gap = (target - today.dow + 7) % 7;
    // "next Friday" is the Friday of next week; a plain weekday is the coming one (today counts).
    if (match[1] === "next") gap = ((8 - today.dow) % 7 || 7) + ((target + 6) % 7);
    return { day: shiftDay(today, gap), phrase: match[0], vague: "" };
  }
  // Dates: "Oct 19", "October 19th", "19 Oct", "10/19", "the 19th".
  match = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s*(\d{4}))?/.exec(lower)
    ?? null;
  if (match) {
    const month = MONTHS.findIndex((name) => name.startsWith(match![1]!.slice(0, 3))) + 1;
    return { day: futureDate(today, month, Number(match[2]), match[3] ? Number(match[3]) : null), phrase: match[0], vague: "" };
  }
  match = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/.exec(lower);
  if (match) {
    const month = MONTHS.findIndex((name) => name.startsWith(match![2]!.slice(0, 3))) + 1;
    return { day: futureDate(today, month, Number(match[1]), null), phrase: match[0], vague: "" };
  }
  match = /\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(lower);
  if (match) {
    const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : null;
    return { day: futureDate(today, Number(match[1]), Number(match[2]), year), phrase: match[0], vague: "" };
  }
  match = /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/.exec(lower);
  if (match) {
    const d = Number(match[1]);
    const month = d >= today.d ? today.m : today.m === 12 ? 1 : today.m + 1;
    const year = d >= today.d ? today.y : today.m === 12 ? today.y + 1 : today.y;
    return { day: { y: year, m: month, d }, phrase: match[0], vague: "" };
  }
  return null;
}

function futureDate(today: LocalDay, month: number, d: number, year: number | null): LocalDay {
  if (year) return { y: year, m: month, d };
  const thisYear = { y: today.y, m: month, d };
  return daysBetween(today, thisYear) >= 0 ? thisYear : { y: today.y + 1, m: month, d };
}

/**
 * When the text says the reminder is due, or null when it names no time at all.
 * Never in the past; never "be more specific".
 */
export function resolveReminderTime(text: string, now: Date): ResolvedTime | null {
  const today = torontoParts(now);
  const phrase: string[] = [];
  const rel = relative(text, now);
  if (rel && !rel.dayOnly) return { at: rel.at, phrase: [rel.phrase], rolled: "", assumed: "" };
  const clock = clockTime(text);
  let part: [RegExp, number, string] | undefined;
  if (!clock) part = PART_MINUTES.find(([pattern]) => pattern.test(text));
  const day = rel ? { day: torontoParts(rel.at), phrase: rel.phrase, vague: "" } : dayFrom(text, today);
  if (!clock && !part && !day) return null;
  if (clock) phrase.push(clock.phrase);
  if (part) phrase.push(part[0].exec(text)![0]);
  if (day?.phrase) phrase.push(day.phrase);
  let minutes = clock ? clock.minutes : part ? part[1] : 540;
  // "tonight at 8" is 8 PM even though a bare 8 would read as morning.
  if (clock && !clock.meridiem && /\b(?:tonight|tonite|evening)\b/i.test(text) && minutes < 720) minutes += 720;
  const assumedBits = [part && !clock ? part[2] : "", day?.vague ?? "", !clock && !part ? "a day with no time is 9:00 AM" : ""].filter(Boolean);
  let target = day ? day.day : today;
  let at = fromToronto(target, minutes);
  let rolled = "";
  if (at.getTime() <= now.getTime()) {
    // A stated time already gone today, or a day part already past: the next day at the same time.
    const said = clock ? clockLabel(minutes) : part ? clockLabel(minutes) : "that time";
    target = shiftDay(target, Math.max(1, daysBetween(target, today) + 1));
    at = fromToronto(target, minutes);
    rolled = `${said} had already passed today, so it's set for ${LONG_DAYS[torontoParts(at).dow]}`;
  }
  return { at, phrase, rolled, assumed: assumedBits.join("; ") };
}

/** The task with the time words cut out: "order towels Friday at 10" → "order towels". */
export function withoutTimeWords(task: string, phrases: string[]): string {
  let out = task;
  for (const bit of [...phrases].sort((a, b) => b.length - a.length)) {
    if (!bit) continue;
    out = out.replace(new RegExp(`\\s*\\b(?:on|at|by|for|around|before)?\\s*${bit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), " ");
  }
  return out.replace(/\s+(?:on|at|by|for|around|before|in)\s*$/i, "").replace(/\s{2,}/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();
}
