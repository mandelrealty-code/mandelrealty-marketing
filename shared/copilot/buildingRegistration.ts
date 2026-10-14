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
import { leaveDraft, loadRecentStays, readStayThread, type RecentStay } from "./stayCheck.js";
import { captureMailMatch } from "./parity/capture.js";
import { namesMatch, platesFrom, registrationMatchesStay, sentProof } from "./partnerStandard.js";
import { torontoToday } from "./time.js";
import { asksProcess } from "./processAnswer.js";
import { isRegistrationDraft } from "./checksLabel.js";
import { registrationSubjectTemplate } from "./processFacts.js";
import type { ChecksItemRef } from "./types.js";


type Vehicle = { guest: string; make: string; model: string; plate: string; colour: string; count: string };

const NAME_STOP = new Set(["has", "the", "building", "been", "about", "for", "her", "his", "their", "stay", "starting", "today", "cars", "car", "draft", "sent", "email", "emailed"]);

/** "Has it been sent?" or "Is there a draft?" about a building registration. Not a request to write one. */
export function asksRegistrationStatus(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  const aboutBuilding = /\b(building|registration|register)\b/i.test(asked) || (/\b(cars?|vehicles?)\b/i.test(asked) && /\b(emailed|e-?mailed|sent|draft)\b/i.test(asked));
  if (!aboutBuilding) return false;
  const sent = /\b(has|have|was|were|been)\b/i.test(asked) && /\b(sent|emailed|e-?mailed)\b/i.test(asked);
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
  if (!name) return "Which guest should I check? I didn't draft an email.";
  const clock = now ?? parityNow() ?? new Date();
  const arrival = await arrivalFor(name, clock);
  if (arrival === "unread") return "I can't read today's plan, so I didn't say the guest is missing. I didn't draft an email.";
  if (!arrival) return missingGuestLine(name);
  const sent = await sentRegistrationLetters(arrival.guest, arrival.property, arrival.date, arrival.checkOut ?? "");
  const closed = sent.letters[0];
  if (!closed) {
    if (/isn't connected|didn't return/i.test(sent.note)) return `${sent.note} I didn't draft an email.`;
    return `I didn't find a sent building registration for ${arrival.guest} at ${arrival.property}. Nothing was drafted.`;
  }
  captureMailMatch({ keywords: sent.keywords, id: closed.id, subject: closed.subject, date: closed.date, mailbox: closed.mailbox });
  return sentProof(closed, platesFrom(`${closed.subject}\n${closed.body}`));
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

function clean(value: string): string {
  return value.replace(/[.,;]+$/g, "").replace(/\s+/g, " ").trim();
}

function vehiclesFromThread(messages: { at: string; role: string; body: string }[], guest: string): Vehicle[] {
  const guestLines = messages
    .filter((row) => row.role === "guest")
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  for (let index = guestLines.length - 1; index >= 0; index -= 1) {
    const found = vehiclesFrom(guestLines[index]?.body ?? "", guest);
    if (found.length) return found;
  }
  return [];
}

function vehiclesFrom(text: string, guest: string): Vehicle[] {
  const labeled = text
    .split(/(?=make\s*:)/i)
    .map((part) => part.trim())
    .filter((part) => /^make\s*:/i.test(part));
  let vehicles: Vehicle[] = [];
  if (labeled.length) {
    vehicles = labeled.map((part) => vehicleFrom(part, guest)).filter((item) => item.make || item.model || item.plate);
  }
  if (!vehicles.length) vehicles = proseVehicles(text, guest);
  if (!vehicles.length) {
    const one = vehicleFrom(text, guest);
    if (one.make || one.model || one.plate || one.colour || one.count) vehicles = [one];
  }
  if (vehicles.length > 1) {
    const count = String(vehicles.length);
    for (const item of vehicles) item.count = count;
  }
  return vehicles;
}

function proseVehicles(text: string, guest: string): Vehicle[] {
  const found: Vehicle[] = [];
  for (const line of text.split(/\n|;/)) {
    const match = /^\s*([A-Z][A-Za-z]+)\s+(.+?)\s*,\s*([A-Z0-9]{2,4}(?:\s+[A-Z0-9]{2,4})+)\s*$/.exec(line.trim());
    if (!match?.[1] || !match[2] || !match[3]) continue;
    found.push({
      guest,
      make: clean(match[1]),
      model: clean(match[2]),
      plate: clean(match[3]),
      colour: "",
      count: "",
    });
  }
  return found;
}

function vehicleFrom(text: string, guest: string): Vehicle {
  const make = clean(/make\s*:\s*([^.\n]+)/i.exec(text)?.[1] ?? "");
  const model = clean(/model\s*:\s*([^.\n]+)/i.exec(text)?.[1] ?? "");
  const plate = clean(/(?:plate|licence|license)\s*:\s*([^.\n]+)/i.exec(text)?.[1] ?? "");
  const colour = clean(/colou?r\s*:\s*([^.\n]+)/i.exec(text)?.[1] ?? "");
  let count = "";
  if (/\bone\s+(?:car|vehicle)\b|\b1\s+(?:car|vehicle)\b/i.test(text)) count = "1";
  else if (/\btwo\s+(?:cars|vehicles)\b|\b2\s+(?:cars|vehicles)\b/i.test(text)) count = "2";
  else {
    const numbered = /\b(\d+)\s+(?:cars|vehicles)\b/i.exec(text);
    if (numbered?.[1]) count = numbered[1];
  }
  return { guest, make, model, plate, colour, count };
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

function fillFromTemplate(letter: MailLetter, checkIn: string, checkOut: string, vehicles: Vehicle[]): { subject: string; body: string; warnings: string[] } {
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
  // The building comes from the question, or from the chat when the question is a follow-up.
  const text = PLACE.test(asked) ? asked : `${asked}\n${context}`;
  const clock = parityNow() ?? new Date();
  const today = torontoToday(clock);
  // The template is the most recent sent registration, read from the mailbox now; never asked for.
  const sent = await sentLetters(text);
  if (!sent.letters.length) return sent.note;
  const template = sent.letters[0];
  if (!template) return sent.note;
  let loaded: Awaited<ReturnType<typeof loadRecentStays>>;
  try {
    loaded = await loadRecentStays(clock);
  } catch {
    return "Hospitable didn't return the reservations. I didn't draft the email.";
  }
  const upcoming = loaded.stays
    .filter((row) => samePlace(text, row) && row.stay.checkIn >= today && !/cancel/.test(row.stay.status))
    .filter((row) => !alreadySent(row.stay, sent.letters))
    .sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn) || a.stay.id.localeCompare(b.stay.id));
  // A guest named in the question (or earlier in the chat) is the one drafted for; else the next arrival.
  const named = (blob: string) => upcoming.find((row) => {
    const first = (row.stay.guest || "").trim().split(/\s+/)[0] ?? "";
    return first.length >= 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob);
  });
  const next = named(asked) ?? named(context) ?? upcoming[0];
  if (!next) {
    // Proof is only for a sent message that matches one of this property's stays.
    const stays = loaded.stays.filter((row) => samePlace(text, row) && !/cancel/.test(row.stay.status));
    const closed = sent.letters.find((letter) => stays.some((row) => registrationMatchesStay(letter, row.stay.checkIn, row.stay.checkOut)));
    if (closed) return sentProof(closed, platesFrom(`${closed.subject}\n${closed.body}`));
    return "I didn't find an upcoming guest there whose registration hasn't been sent. I didn't draft one.";
  }
  let messages: Awaited<ReturnType<typeof readStayThread>> = [];
  try {
    messages = await readStayThread(next.stay.id, clock);
  } catch {
    return `I couldn't read ${next.stay.guest || "the guest"}'s messages. I didn't draft the email or fill in a vehicle.`;
  }
  const guest = next.stay.guest || "";
  const found = vehiclesFromThread(messages, guest);
  const vehicles = found.length ? found : [{ guest, make: "", model: "", plate: "", colour: "", count: "" }];
  const filled = fillFromTemplate(template, next.stay.checkIn, next.stay.checkOut, vehicles);
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
    body: `The vehicle registration email for ${who} at ${next.label} (${shortDate(next.stay.checkIn)} to ${shortDate(next.stay.checkOut)}) is in Checks, to the building's ${count} registration address${count === 1 ? "" : "es"}, subject “${stored.subject}”. Nothing is sent until you press Submit.`,
    item: { chatId: saved?.chat_id ?? "", messageId: saved?.id ?? "", label },
  };
}
