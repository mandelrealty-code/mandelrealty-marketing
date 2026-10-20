/**
 * A new building-registration email follows the last one the partner sent.
 * Recipients, subject format, and body structure come from that Sent message.
 * The next guest's thread supplies the vehicle details. Missing details stay blanks.
 * The draft waits in Checks until Submit.
 */

import { findPlanArrival, loadDayBoard, type StayMove } from "./dayBoard.js";
import { readMailThread, searchMail, type MailLetter } from "./mailSearch.js";
import { parityNow } from "./parity/clock.js";
import { confirmedChecksDraft, waitingChecksMessages } from "./checksClaim.js";
import { updateDraft } from "./store.js";
import { leaveDraft, loadRecentStays, type RecentStay } from "./stayCheck.js";
import { captureMailMatch } from "./parity/capture.js";
import { namesMatch, platesFrom, registrationMatchesStay, sentProof } from "./partnerStandard.js";
import { torontoToday } from "./time.js";
import { vehiclesFrom, vehiclesFromThread as vehiclesInThread, noCarFromThread, type Vehicle } from "./guestVehicle.js";
import { readFullThread } from "./guestFacts.js";
import { asksProcess } from "./processAnswer.js";
import { isRegistrationDraft } from "./checksLabel.js";
import { registrationSubjectTemplate } from "./processFacts.js";
import type { ChecksItemRef } from "./types.js";



const NAME_STOP = new Set(["has", "the", "building", "been", "about", "for", "her", "his", "their", "stay", "starting", "today", "cars", "car", "draft", "sent", "email", "emailed"]);

/** "Has it been sent?" or "Is there a draft?" about a building registration. Not a request to write one. */
export function asksRegistrationStatus(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  // "Did we send out the parking email for 20 Blue Jays Way?" is a Sent-mail question, not a reservation one.
  const aboutBuilding = /\b(building|registration|register|parking)\b/i.test(asked)
    || (/\b(cars?|vehicles?)\b/i.test(asked) && /\b(emailed|e-?mailed|sent|draft)\b/i.test(asked))
    || (/\be-?mail\b/i.test(asked) && /\b(blue jays|318)\b/i.test(asked));
  if (!aboutBuilding) return false;
  const sent = /\b(did|has|have|was|were|been|when)\b/i.test(asked) && /\b(send|sent|emailed|e-?mailed|went out|go out)\b/i.test(asked);
  const draft = /\bdraft\b/i.test(asked) && /\b(is there|there a|do we have|any|waiting)\b/i.test(asked);
  return sent || draft;
}

function guestInQuestion(text: string): string {
  const full = "([A-Z][A-Za-z'-]+(?:\\s+[A-Z][A-Za-z'-]+)*)";
  const possessive = text.match(new RegExp(`\\b${full}'s\\b`));
  const named = text.match(new RegExp(`\\b(?:about|for|named)\\s+${full}\\b`));
  const name = (possessive?.[1] || named?.[1] || "").trim();
  if (!name || NAME_STOP.has(name.toLowerCase())) return "";
  return name;
}

export function missingGuestLine(name: string): string {
  return `No guest named ${name} in the reservations starting today or nearby.`;
}

/**
 * A status question checks the plan's arrivals, then Sent.
 * An already-sent registration is reported with its date. No new draft is written.
 */
function sameGuest(guest: string, name: string): boolean {
  return namesMatch(guest, name);
}

/** The plan's arrivals when the wider name search does not already have this guest. */
async function arrivalFor(name: string, now: Date): Promise<StayMove | "unread" | null> {
  const named = await findPlanArrival(name, now);
  if (named && named !== "unread") return named;
  const board = await loadDayBoard(now);
  if (board.ok) {
    const onPlan = board.board.arrivals.find((row) => sameGuest(row.guest, name));
    if (onPlan) return onPlan;
  }
  if (named === "unread" || !board.ok) return "unread";
  return null;
}

function plainDate(iso: string): string {
  return longDate(iso).replace(/^[A-Za-z]+,\s*/, "");
}

/** The sent subject names the unit and both stay dates, and does not name the guest. */
function registrationSubject(checkIn: string, checkOut: string): string {
  return `AirBNB Rental for Unit 318 from ${plainDate(checkIn)} - ${plainDate(checkOut)}`;
}

function subjectForStay(subject: string, checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut || !/unit\s*318/i.test(subject)) return false;
  const arrival = [longDate(checkIn), plainDate(checkIn)];
  const departure = [longDate(checkOut), plainDate(checkOut)];
  return arrival.some((form) => subject.includes(form)) && departure.some((form) => subject.includes(form));
}

/** Sent in both mailboxes. The subject pattern is first. The guest's name is only the second pass. */
async function lettersInSent(keywords: string): Promise<{ letters: MailLetter[]; note: string }> {
  const seen = new Set<string>();
  const letters: MailLetter[] = [];
  const notes: string[] = [];
  for (const mailbox of ["gmail", "outlook"] as const) {
    const found = await searchMail({ keywords, mailbox, where: "sent", includeAirbnb: false });
    notes.push(...found.notes);
    for (const hit of [...found.hits].sort((a, b) => b.date.localeCompare(a.date))) {
      const key = `${hit.mailbox}:${hit.id}`;
      if (seen.has(key)) continue;
      try {
        const thread = await readMailThread({ mailbox: hit.mailbox, id: hit.threadId || hit.id });
        const letter = thread.find((row) => row.id === hit.id) ?? thread.at(-1);
        if (!letter) continue;
        seen.add(key);
        letters.push(letter);
      } catch {
        // A message that will not open is skipped. The other mailbox can still hold the registration.
      }
    }
  }
  if (!letters.length) {
    const note = notes.find((line) => /isn't connected|didn't return/i.test(line));
    return { letters: [], note: note ?? "" };
  }
  return { letters, note: "" };
}

async function sentRegistrationLetters(guest: string, property: string, checkIn: string, checkOut: string): Promise<{ letters: MailLetter[]; note: string; keywords: string }> {
  const subject = /blue jays|\b318\b/i.test(property) && checkOut ? registrationSubject(checkIn, checkOut) : "";
  const passes = [subject, guest.trim()].filter((keywords, index, all) => keywords.length >= 2 && all.indexOf(keywords) === index);
  let note = "";
  for (const keywords of passes) {
    const found = await lettersInSent(keywords);
    note = found.note;
    const matched = found.letters
      .filter((letter) => subjectForStay(letter.subject, checkIn, checkOut) && registrationMatchesStay(letter, checkIn, checkOut))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (matched.length) return { letters: matched, note: "", keywords };
  }
  return { letters: [], note, keywords: subject || guest.trim() };
}

/** Whether the building registration for this arrival is in Sent: the proof line, or what's missing. */
export async function registrationState(arrival: StayMove): Promise<string> {
  const sent = await sentRegistrationLetters(arrival.guest, arrival.property, arrival.date, arrival.checkOut ?? "");
  const closed = sent.letters[0];
  if (closed) return sentProof(closed, platesFrom(`${closed.subject}\n${closed.body}`));
  if (/isn't connected|didn't return/i.test(sent.note)) return `${sent.note} The building registration wasn't checked.`;
  return `No building registration for ${arrival.guest}'s stay is in Sent yet.`;
}

export async function answerRegistrationStatus(text: string, now?: Date): Promise<string | null> {
  if (!asksRegistrationStatus(text)) return null;
  const name = guestInQuestion(text);
  const clock = now ?? parityNow() ?? new Date();
  let arrival: Pick<StayMove, "guest" | "property" | "date" | "checkOut"> | "unread" | null;
  if (name) arrival = await arrivalFor(name, clock);
  else {
    // "for the next guest": the reservations only say which stay is meant; the answer comes from Sent.
    arrival = await nextStayAt(/blue jays|\b318\b|parking/i.test(text) || !PLACE.test(text) ? "20 Blue Jays Way 318" : text, clock);
    if (!arrival) return "There's no upcoming guest at 20 Blue Jays Way, so there's no building registration to check. Nothing was drafted.";
  }
  if (arrival === "unread") return "I can't read today's plan, so I didn't say the guest is missing. I didn't draft an email.";
  if (!arrival) return missingGuestLine(name);
  const sent = await sentRegistrationLetters(arrival.guest, arrival.property, arrival.date, arrival.checkOut ?? "");
  const closed = sent.letters[0];
  if (!closed) {
    if (/isn't connected|didn't return/i.test(sent.note)) return `${sent.note} I didn't draft an email.`;
    const searched = [arrival.checkOut ? `“${registrationSubject(arrival.date, arrival.checkOut)}”` : "", `“${arrival.guest}”`].filter(Boolean).join(" and ");
    return [
      `Not sent. No building registration for ${arrival.guest}'s stay at ${arrival.property}${arrival.checkOut ? ` (${plainDate(arrival.date)} to ${plainDate(arrival.checkOut)})` : ""} is in Sent in Gmail or Outlook; I searched for ${searched}.`,
      await draftStateLine(arrival.date, arrival.checkOut ?? ""),
    ].join("\n");
  }
  captureMailMatch({ keywords: sent.keywords, id: closed.id, subject: closed.subject, date: closed.date, mailbox: closed.mailbox });
  return sentAnswer(closed, arrival.guest, arrival.property);
}

/** The next arrival at a property, from the reservations: which stay the question means. */
async function nextStayAt(place: string, now: Date): Promise<Pick<StayMove, "guest" | "property" | "date" | "checkOut"> | null> {
  try {
    const loaded = await loadRecentStays(now);
    const today = torontoToday(now);
    const next = loaded.stays
      .filter((row) => samePlace(place, row) && row.stay.checkIn >= today && !/cancel/.test(row.stay.status))
      .sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn))[0];
    return next ? { guest: next.stay.guest || "the next guest", property: next.label, date: next.stay.checkIn, checkOut: next.stay.checkOut } : null;
  } catch {
    return null;
  }
}

/** Waiting in Checks, or never drafted: the one line after "not sent". */
async function draftStateLine(checkIn: string, checkOut: string): Promise<string> {
  const waiting = await waitingChecksMessages().catch(() => []);
  const draft = waiting.find((row) => row.draft?.channel === "email" && (row.draft.subject === registrationSubject(checkIn, checkOut) || registrationMatchesStay({ subject: row.draft.subject, body: row.draft.body, to: row.draft.to }, checkIn, checkOut)));
  return draft?.draft ? `A draft is waiting in Checks: “${draft.draft.subject}”. Nothing goes out until you press Submit.` : "No draft has been made for it yet.";
}

/** The verdict and the proof: when (Toronto), from which account, to whom, and what it said. */
export function sentAnswer(letter: Pick<MailLetter, "date" | "from" | "email" | "mailbox" | "to" | "body" | "subject">, guest: string, property: string): string {
  const at = new Date(letter.date);
  const when = Number.isNaN(at.getTime())
    ? letter.date
    : `${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" }).format(at)} at ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at)}`;
  const account = [letter.from, letter.email && letter.email !== letter.from ? `<${letter.email}>` : ""].filter(Boolean).join(" ") || "Mandel Realty";
  const to = letter.to.split(/[,;]+/).map((item) => item.trim()).filter(Boolean).join(", ") || "recipients the message doesn't list";
  const said = letter.body
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => /\b(arriv|staying|check-?in|check-?out|until|nights?|vehicles?|cars?|plates?|make:|model:|parking)\b/i.test(line))
    .slice(0, 4)
    .join(" ");
  return [
    `Yes, it's already sent: the building registration for ${guest}'s stay at ${property}.`,
    `${account} sent it by ${letter.mailbox === "outlook" ? "Outlook" : "Gmail"} on ${when} to ${to}.`,
    `Subject: “${letter.subject.trim()}”.`,
    said ? `It says: ${said}` : "",
  ].filter(Boolean).join("\n");
}

const PLACE = /\b(blue jays|\b318\b|charlotte|\b606\b|shaw|roseglor|scarborough)\b/i;
const ABOUT_REGISTRATION = /\b(registration|register|parking e-?mails?|parking|building e-?mails?|airbnb rental for unit|vehicles?|cars?|plates?)\b/i;
/** "Draft it exactly like the other emails", "make sure the spacing is correct": a redo of the registration in this chat. */
const REDO = /\b(exactly like|same (?:as|format|way)|like the (?:other|last|previous|sent)|spacing|spaced|format(?:ting)?|layout|re-?do|re-?draft|draft it|write it|try again|copy the (?:last|sent))\b/i;

/**
 * A request to write the registration email. `context` is the recent chat, so a follow-up such as
 * "draft it exactly like the other emails" is understood without naming the building again.
 */
export function asksBuildingRegistration(text: string, context = ""): boolean {
  const asked = text.trim();
  // "Which addresses do we normally send to?" asks about the process; it doesn't ask for a draft.
  if (asksProcess(asked)) return false;
  // "Is there a draft?" or "has it been sent?" is a status question unless they also ask for one written.
  if (asksRegistrationStatus(asked) && !/\b(write|another|re-?do|re-?draft)\b/i.test(asked)) return false;
  // "We need to send her the email for parking and her stay like the other ones we sent to the building": a request to write
  // one, with no property named. The guest and the building come from the reservations.
  const SEND_IT = /\b(?:need|want|have|got|ought|should|gotta|let'?s|going|ready|time|supposed)\s+(?:to\s+)?(?:send|write|draft|make|prepare|do)\b|\b(?:can|could|would|will)\s+you\s+(?:send|write|draft|make|prepare|do)\b|^\s*(?:please\s+)?(?:send|write|draft|make|prepare)\b/i;
  const PAST_STATUS = /\b(did|has|have|was|were|had|been)\b[^.?!]*\b(sent|send|emailed|e-?mailed)\b/i;
  if (SEND_IT.test(asked) && !PAST_STATUS.test(asked) && /\be-?mails?\b/i.test(asked) && /\b(parking|registration|register|building|car|vehicle)\b/i.test(asked)
    && (/\b(like|same as|just like|exactly like)\s+(?:the\s+)?(?:other|last|previous|usual|ones)\b|\bthe ones we (?:sent|send)\b|\bto the building\b|\bfor the building\b/i.test(asked) || PLACE.test(`${asked} ${context}`))) return true;
  const writes = /\b(write|draft|another|re-?do|re-?draft)\b/i.test(asked);
  if (writes && /\b(e-?mails?|sent)\b/i.test(asked) && /\b(guest|car|vehicle|registration|subject|body|parking)\b/i.test(asked) && PLACE.test(asked)) return true;
  if (writes && /\b(registration|parking|building)\s+e-?mail\b/i.test(asked) && PLACE.test(`${asked} ${context}`)) return true;
  return REDO.test(asked) && ABOUT_REGISTRATION.test(context) && PLACE.test(context) && /\b(registration|parking|building|airbnb rental for unit)\b/i.test(context);
}

function searchTerms(question: string): string {
  if (/blue jays|\b318\b/i.test(question)) return "Blue Jays Way";
  if (/\bshaw\b/i.test(question)) return "Shaw Street";
  if (/roseglor|scarborough/i.test(question)) return "Roseglor";
  if (/charlotte|\b606\b/i.test(question)) return "Charlotte";
  return question;
}

function samePlace(question: string, row: RecentStay): boolean {
  const blob = `${row.propertyName} ${row.address} ${row.label}`.toLowerCase();
  if (/blue jays|\b318\b/i.test(question) && /blue jays|\b318\b/.test(blob)) return true;
  if (/\bshaw\b/i.test(question) && /\bshaw\b/.test(blob)) return true;
  if (/roseglor|scarborough/i.test(question) && /roseglor|scarborough/.test(blob)) return true;
  if ((/charlotte/i.test(question) || /\b606\b/.test(question)) && /charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  return false;
}

function longDate(iso: string): string {
  const [year, month, dayNum] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !dayNum) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, dayNum)));
}

function blankFor(label: string): string {
  if (/vehicle count/i.test(label)) return "[count]";
  if (/colou?r/i.test(label)) return "[colour]";
  return `[${label.toLowerCase()}]`;
}

function valueFor(label: string, vehicle: Vehicle): string {
  if (/^guest$/i.test(label)) return vehicle.guest;
  if (/^make$/i.test(label)) return vehicle.make;
  if (/^model$/i.test(label)) return vehicle.model;
  if (/^plate$/i.test(label)) return vehicle.plate;
  if (/^colou?r$/i.test(label)) return vehicle.colour;
  if (/vehicle count/i.test(label)) return vehicle.count;
  return "";
}

function vehicleBlock(vehicle: Vehicle, warnings: string[]): string {
  return ["Make", "Model", "Plate", "Colour"].map((label) => {
    const next = valueFor(label, vehicle);
    if (next) return `${label}: ${next}`;
    const blank = blankFor(label);
    warnings.push(`${label} is still a blank: ${blank}.`);
    return `${label}: ${blank}`;
  }).join("\n");
}

const MONTH_WORDS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A written date in any of the forms a sent email uses: "Friday, October 9, 2026", "October 9, 2026", "Oct 9". */
const ANY_DATE = /\b(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/g;

type WrittenDate = { text: string; month: number; day: number; year: number | null; weekday: boolean; weekdayComma: boolean; longMonth: boolean; comma: boolean };

function writtenDates(text: string): WrittenDate[] {
  return [...text.matchAll(ANY_DATE)].map((match) => ({
    text: match[0],
    month: MONTH_WORDS.findIndex((name) => name.toLowerCase().startsWith(match[2]!.toLowerCase().slice(0, 3))),
    day: Number(match[3]),
    year: match[4] ? Number(match[4]) : null,
    weekday: Boolean(match[1]),
    weekdayComma: Boolean(match[1]) && /^[A-Za-z]+,/.test(match[0]),
    longMonth: match[2]!.length > 3 && !/^Sept$/.test(match[2]!) || match[2] === "May",
    comma: /,\s+\d{4}$/.test(match[0]),
  }));
}

/** The new date written exactly the way the template wrote the old one; the weekday is computed. */
function sameStyle(old: WrittenDate, iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = old.weekday ? `${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(at)}${old.weekdayComma ? "," : ""} ` : "";
  const monthWord = old.longMonth ? MONTH_WORDS[month - 1]! : MONTH_WORDS[month - 1]!.slice(0, 3);
  return `${weekday}${monthWord} ${day}${old.year != null ? `${old.comma ? "," : ""} ${year}` : ""}`;
}

/** Old check-in and check-out, as the template's subject (or body) wrote them. */
function templateStay(letter: MailLetter): [WrittenDate | null, WrittenDate | null] {
  const fromSubject = writtenDates(letter.subject);
  const dates = fromSubject.length >= 2 ? fromSubject : writtenDates(letter.body);
  return [dates[0] ?? null, dates[1] ?? null];
}

function swapDates(text: string, oldIn: WrittenDate | null, oldOut: WrittenDate | null, checkIn: string, checkOut: string): string {
  return text.replace(ANY_DATE, (whole) => {
    const found = writtenDates(whole)[0];
    if (!found) return whole;
    if (oldIn && found.month === oldIn.month && found.day === oldIn.day) return sameStyle(found, checkIn);
    if (oldOut && found.month === oldOut.month && found.day === oldOut.day) return sameStyle(found, checkOut);
    return whole;
  });
}

/** A line the template carries when the vehicle wasn't known yet: "We will provide the vehicle information shortly." */
const VEHICLE_LATER = /^[^\n]*\b(?:vehicle|car|plate|licen[cs]e)\b[^\n]*\b(?:shortly|soon|later|to follow|tbd|to be (?:confirmed|provided)|will (?:be )?(?:provided|sent|shared|follow)|will (?:provide|send|share|forward)|once (?:we|they|she|he) (?:have|know|receive|get))\b[^\n]*$/im;

function fillFromTemplate(letter: MailLetter, checkIn: string, checkOut: string, vehicles: Vehicle[], noVehicleNote = ""): { subject: string; body: string; warnings: string[] } {
  const vehicle = vehicles[0] ?? { guest: "", make: "", model: "", plate: "", colour: "", count: "" };
  const known = vehicles.some((item) => item.make || item.model || item.plate);
  const [oldIn, oldOut] = templateStay(letter);
  // The body is swapped by its own dates: a sent email whose body and subject disagreed must not
  // carry the old stay into either one.
  const bodyDates = writtenDates(letter.body);
  const [bodyIn, bodyOut] = bodyDates.length >= 2 ? [bodyDates[0]!, bodyDates[1]!] : [oldIn, oldOut];
  // Only the new stay's facts change; every other line, blank line and the sign-off stay as sent.
  const subject = swapDates(letter.subject, oldIn, oldOut, checkIn, checkOut);
  let body = swapDates(swapDates(letter.body, bodyIn, bodyOut, checkIn, checkOut), oldIn, oldOut, checkIn, checkOut);
  const nights = Math.round((Date.parse(`${checkOut.slice(0, 10)}T12:00:00Z`) - Date.parse(`${checkIn.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  if (nights > 0) body = body.replace(/\b(\d+)\s+nights?\b/gi, `${nights} night${nights === 1 ? "" : "s"}`);
  const oldGuest = /^Guest:\s*(.+)$/im.exec(letter.body)?.[1]?.trim() ?? "";
  if (oldGuest && vehicle.guest && oldGuest !== vehicle.guest) body = body.replaceAll(oldGuest, vehicle.guest);
  // "Their name is: Priya": the old guest's name, written the way the sent email wrote it (first name if it used one).
  const named = /\b(?:name is|guest is|guest name is|guest's name is)\s*:?\s*([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/.exec(letter.body);
  if (named && vehicle.guest) {
    const old = named[1]!.split(/\s+/).filter((word) => !/^(They|He|She|The|Will)$/.test(word));
    const next = old.length > 1 ? vehicle.guest : vehicle.guest.split(/\s+/)[0]!;
    if (old.length && old.join(" ") !== next) body = body.replace(named[0], named[0].replace(old.join(" "), next));
  }
  const warnings: string[] = [];
  // The template said the vehicle was still to come. When it is known, the facts go in; only when it is genuinely unknown
  // does the line stay, and then the draft says so plainly.
  const later = VEHICLE_LATER.exec(body);
  if (later && !/^(?:Make|Model|Plate|Colou?r)\s*:/im.test(body)) {
    if (known) body = body.replace(later[0], vehicles.map((item) => vehicleBlock(item, warnings)).join("\n\n"));
    else warnings.unshift(`${noVehicleNote || "I didn't find vehicle details in the guest's messages"}, so the draft keeps the template's line “${later[0].trim()}”.`);
  }
  body = body.split("\n").map((line) => {
    const match = /^(Guest|Make|Model|Plate|Licence plate|License plate|Colour|Color|Vehicle count|Number of vehicles):\s*(.*)$/i.exec(line.trim());
    if (!match) {
      // A vehicle count written in prose is the old guest's; an unknown stays an explicit blank.
      return line.replace(/\b(\d+|one|two|three|four)\s+(vehicles?|cars?)\b/gi, (_whole, _count: string, noun: string) => {
        const count = vehicle.count || (known ? String(vehicles.length) : "");
        if (!count) warnings.push("The vehicle count is still a blank: [count].");
        return `${count || "[count]"} ${noun}`;
      });
    }
    const label = match[1] ?? "";
    const key = /plate/i.test(label) ? "Plate" : /number of vehicles/i.test(label) ? "Vehicle count" : label;
    const next = valueFor(key, vehicle);
    if (next) return line.replace(match[0], `${label}: ${next}`);
    const blank = blankFor(key);
    warnings.push(`${label} is still a blank: ${blank}.`);
    return line.replace(match[0], `${label}: ${blank}`);
  }).join("\n");
  if (vehicles.length > 1) {
    const extra = vehicles.slice(1).map((item) => vehicleBlock(item, warnings)).join("\n\n");
    body = body.replace(/^(Colour|Color):\s*.+$/m, (line) => `${line}\n\n${extra}`);
  }
  // The previous guest's plates never carry over.
  for (const plate of platesFrom(letter.body)) {
    if (!vehicles.some((item) => item.plate.toUpperCase() === plate)) body = body.replaceAll(plate, "[plate]");
  }
  // Every date left in the subject and body must be this stay's; one that isn't is named before Submit.
  const stayDays = [checkIn, checkOut].map((iso) => iso.slice(5, 10));
  for (const [where, text] of [["subject", subject], ["body", body]] as const) {
    for (const date of writtenDates(text)) {
      const key = `${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
      if (!stayDays.includes(key)) warnings.push(`The ${where} still says ${date.text}, which isn't this stay's check-in or check-out.`);
    }
  }
  return { subject, body, warnings: [...new Set(warnings)] };
}

function alreadySent(stay: RecentStay["stay"], letters: MailLetter[]): boolean {
  return letters.some((letter) => registrationMatchesStay(letter, stay.checkIn, stay.checkOut));
}

async function sentLetters(question: string): Promise<{ letters: MailLetter[]; note: string }> {
  // The building's name, and the recorded subject stem: a real registration may only say "Unit 318".
  const terms = [searchTerms(question), ...(/blue jays|\b318\b/i.test(question) ? [registrationSubjectTemplate("").replace(/\s*from\s*\{.*$/i, "")] : [])];
  const reads = await Promise.all(terms.map((keywords) => searchMail({ keywords, where: "sent", includeAirbnb: false })));
  const found = { hits: [...new Map(reads.flatMap((read) => read.hits).map((hit) => [`${hit.mailbox}:${hit.id}`, hit])).values()], notes: reads.flatMap((read) => read.notes) };
  if (!found.hits.length) {
    const note = found.notes.find((line) => /isn't connected|didn't return/i.test(line));
    return { letters: [], note: note ?? "I didn't find a sent building email for that property. I didn't draft one." };
  }
  const letters: MailLetter[] = [];
  for (const hit of [...found.hits].sort((a, b) => b.date.localeCompare(a.date))) {
    try {
      const thread = await readMailThread({ mailbox: hit.mailbox, id: hit.threadId || hit.id });
      // Only the message that was found, and only when it is itself a registration: a reply that
      // merely mentions the building (a business email to Manik) is never the template.
      const letter = thread.find((row) => row.id === hit.id) ?? (thread.length === 1 ? thread[0] : undefined);
      if (letter && isRegistrationDraft({ to: letter.to, subject: letter.subject, body: letter.body, channel: "email" })) letters.push(letter);
    } catch {
      // A message that will not open is skipped. A later one can still be the template.
    }
  }
  if (!letters.length) return { letters: [], note: "I didn't find a sent building email for that property. I didn't draft one." };
  return { letters, note: "" };
}

export async function answerBuildingRegistration(text: string, context = ""): Promise<string | null> {
  return (await answerBuildingRegistrationItem(text, context))?.body ?? null;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

/** The answer and the one Checks item it is about, so chat opens that exact card. */
export async function answerBuildingRegistrationItem(text: string, context = ""): Promise<{ body: string; item: ChecksItemRef | null } | null> {
  const body = await registrationBody(text, context);
  if (body == null) return null;
  return typeof body === "string" ? { body, item: null } : body;
}

async function registrationBody(asked: string, context: string): Promise<string | { body: string; item: ChecksItemRef } | null> {
  if (!asksBuildingRegistration(asked, context)) return null;
  const clock = parityNow() ?? new Date();
  const today = torontoToday(clock);
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't draft the email.";
  }
  // The guest comes first, from the reservations: a guest named in the question (or earlier in the chat) is the one drafted
  // for, whatever property they are at. The building is only guessed (20 Blue Jays Way) when no guest is named.
  const firstName = (row: RecentStay) => (row.stay.guest || "").trim().split(/\s+/)[0] ?? "";
  const mentions = (row: RecentStay, blob: string) => {
    const first = firstName(row);
    return first.length >= 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob);
  };
  const live = loaded.stays
    .filter((row) => row.stay.checkIn >= today && !/cancel/.test(row.stay.status))
    .sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn) || a.stay.id.localeCompare(b.stay.id));
  const guestNamed = live.find((row) => mentions(row, asked)) ?? live.find((row) => mentions(row, context));
  const placeText = guestNamed ? guestNamed.label : PLACE.test(asked) ? asked : PLACE.test(context) ? `${asked}\n${context}` : "20 Blue Jays Way 318";
  if (guestNamed && !/blue jays|\b318\b/i.test(placeText)) {
    return `I only have a building registration process for 20 Blue Jays Way, and ${firstName(guestNamed)}'s stay is at ${guestNamed.label}. I didn't draft one.`;
  }
  // The template is the most recent sent registration, read from the mailbox now; never asked for.
  const sent = await sentLetters(placeText);
  if (!sent.letters.length) return sent.note;
  const template = sent.letters[0];
  if (!template) return sent.note;
  const upcoming = live
    .filter((row) => samePlace(placeText, row))
    .filter((row) => !alreadySent(row.stay, sent.letters));
  const next = (guestNamed && upcoming.find((row) => row.stay.id === guestNamed.stay.id)) ?? (guestNamed ? undefined : upcoming[0]);
  if (!next) {
    // Proof is only for a sent message that matches one of this property's stays.
    const stays = loaded.stays.filter((row) => samePlace(placeText, row) && !/cancel/.test(row.stay.status));
    const closed = sent.letters.find((letter) => stays.some((row) => registrationMatchesStay(letter, row.stay.checkIn, row.stay.checkOut)));
    if (closed) return sentProof(closed, platesFrom(`${closed.subject}\n${closed.body}`));
    return "I didn't find an upcoming guest there whose registration hasn't been sent. I didn't draft one.";
  }
  // The whole thread is read (every page, one retry). A failed read never turns into "she hasn't sent a car".
  const read = await readFullThread({ id: next.stay.id, reservation: next.reservation ?? null }, clock);
  if (!read.ok) return `I couldn't read ${next.stay.guest || "the guest"}'s messages (${read.reason.replace(/\.$/, "")}). I didn't draft the email or fill in a vehicle.`;
  const messages = read.messages;
  const guest = next.stay.guest || "";
  const inThread = vehiclesInThread(messages, guest).vehicles;
  // Facts already found earlier in this conversation: only what the guest-fact answer itself wrote down ("Rebecca sent her
  // vehicle in her Airbnb thread on …: Nissan Rogue, plate CDDD 686."), never any other word in the chat. No round trip.
  const firstOfGuest = guest.split(/\s+/)[0] ?? "";
  const stated = firstOfGuest
    ? new RegExp(`${firstOfGuest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} sent her vehicles? in her Airbnb thread on [^:]+:\\s*([^\\n]*?)(?:\\.\\s+Not given:|\\.\\s+Her stay:|\\s*$)`, "i").exec(context)?.[1] ?? ""
    : "";
  const fromChat = inThread.length || !stated ? [] : vehiclesFrom(stated.replace(/;\s*/g, " "), guest);
  const found = inThread.length ? inThread : fromChat;
  const vehicles = found.length ? found : [{ guest, make: "", model: "", plate: "", colour: "", count: "" }];
  const noCar = !found.length ? noCarFromThread(messages) : null;
  const readNote = read.behind
    ? `${guest || "The guest"}'s thread may be incomplete (${read.behind})`
    : `I read all ${messages.length} message${messages.length === 1 ? "" : "s"} in ${guest || "the guest"}'s thread and ${noCar ? "she said she isn't bringing a car" : "she hasn't sent vehicle details"}`;
  const filled = fillFromTemplate(template, next.stay.checkIn, next.stay.checkOut, vehicles, readNote);
  const lead = `Here is the vehicle registration email for ${guest || "the next guest"} at ${next.label} (${shortDate(next.stay.checkIn)} to ${shortDate(next.stay.checkOut)}), to the building. Nothing was sent.${filled.warnings.length ? `\n\nCheck before approving:\n${filled.warnings.map((warning) => `• ${warning}`).join("\n")}` : ""}`;
  const saved = await leaveDraft({
    channel: "email",
    to: template.to,
    subject: filled.subject,
    body: filled.body,
    warnings: filled.warnings,
    needs_you: true,
    lead,
  });
  const marks = vehicles.flatMap((item) => [item.make, item.model, item.plate].filter(Boolean));
  const stored = await confirmedChecksDraft(saved, { subject: filled.subject, includes: marks });
  if (!stored) return "The building email was not saved in Checks.";
  // The claim is checked against the saved card's own To and Subject before it is made.
  if (!isRegistrationDraft(stored)) return "The draft saved in Checks doesn't read as the building registration, so I'm not pointing you to it. Nothing was sent.";
  // A redo replaces the earlier waiting draft for the same stay, once the new one is read back.
  for (const older of await waitingChecksMessages().catch(() => [])) {
    if (older.id !== saved?.id && older.draft?.channel === "email" && older.draft.subject === stored.subject) {
      await updateDraft(older.id, { status: "held", bodyText: "Replaced by a newer draft of this registration. Nothing was sent." }).catch(() => null);
    }
  }
  const who = guest || "the next guest";
  const label = `Vehicle registration for ${who} at ${next.label}, ${shortDate(next.stay.checkIn)} to ${shortDate(next.stay.checkOut)}`;
  const count = stored.to.split(/[,;]+/).filter((item) => item.trim()).length;
  return {
    body: `The vehicle registration email for ${who} at ${next.label} (${shortDate(next.stay.checkIn)} to ${shortDate(next.stay.checkOut)}) is in Checks, to the building's ${count} registration address${count === 1 ? "" : "es"}, subject “${stored.subject}”. Nothing is sent until you press Submit.${(() => {
      // A fact that is genuinely unknown after the full thread read is said plainly, above the card.
      const unknown = filled.warnings.find((warning) => /keeps the template's line/.test(warning));
      return unknown ? `\n\n${unknown}` : "";
    })()}`,
    item: { chatId: saved?.chat_id ?? "", messageId: saved?.id ?? "", label },
  };
}
