/**
 * A new building-registration email follows the last one the partner sent.
 * Recipients, subject format, and body structure come from that Sent message.
 * The next guest's thread supplies the vehicle details. Missing details stay blanks.
 * The draft waits in Checks until Submit.
 */

import { findPlanArrival, loadDayBoard, type StayMove } from "./dayBoard.js";
import { readMailThread, searchMail, type MailLetter } from "./mailSearch.js";
import { parityNow } from "./parity/clock.js";
import { confirmedChecksDraft } from "./checksClaim.js";
import { leaveDraft, loadRecentStays, readStayThread, type RecentStay } from "./stayCheck.js";
import { platesFrom, registrationAlreadySent, sentProof } from "./partnerStandard.js";
import { torontoToday } from "./time.js";

const DATE = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/g;

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
  const possessive = text.match(/\b([A-Z][A-Za-z'-]{1,40})'s\b/);
  const named = text.match(/\b(?:about|for|named)\s+([A-Z][A-Za-z'-]{1,40})\b/);
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
  const needle = name.trim().toLowerCase();
  const full = guest.trim().toLowerCase();
  if (!needle || !full) return false;
  return full === needle || full.split(/\s+/).includes(needle);
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

/** Sent in both mailboxes: the guest's name, then the registration subject. */
async function sentRegistrationLetters(guest: string): Promise<{ letters: MailLetter[]; note: string }> {
  const queries = [guest.trim(), "AirBNB Rental for Unit 318"].filter((keywords) => keywords.length >= 2);
  const seen = new Set<string>();
  const letters: MailLetter[] = [];
  const notes: string[] = [];
  for (const mailbox of ["gmail", "outlook"] as const) {
    for (const keywords of queries) {
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
  }
  if (!letters.length) {
    const note = notes.find((line) => /isn't connected|didn't return/i.test(line));
    return { letters: [], note: note ?? "I didn't find a sent building email for that property. I didn't draft one." };
  }
  return { letters, note: "" };
}

export async function answerRegistrationStatus(text: string, now?: Date): Promise<string | null> {
  if (!asksRegistrationStatus(text)) return null;
  const name = guestInQuestion(text);
  if (!name) return "Which guest should I check? I didn't draft an email.";
  const clock = now ?? parityNow() ?? new Date();
  const arrival = await arrivalFor(name, clock);
  if (arrival === "unread") return "I can't read today's plan, so I didn't say the guest is missing. I didn't draft an email.";
  if (!arrival) return missingGuestLine(name);
  const sent = await sentRegistrationLetters(arrival.guest);
  if (!sent.letters.length) {
    if (/isn't connected|didn't return/i.test(sent.note)) return `${sent.note} I didn't draft an email.`;
    return `I didn't find a sent building registration for ${arrival.guest} at ${arrival.property}. Nothing was drafted.`;
  }
  const closed = registrationAlreadySent(sent.letters, arrival.date, []);
  if (!closed) return `I didn't find a sent building registration for ${arrival.guest}'s stay starting ${arrival.date}. Nothing was drafted.`;
  return sentProof(closed, platesFrom(`${closed.subject}\n${closed.body}`));
}

export function asksBuildingRegistration(text: string): boolean {
  const asked = text.trim();
  if (!/\b(e-?mails?|sent)\b/i.test(asked)) return false;
  if (!/\b(write|draft|another)\b/i.test(asked)) return false;
  if (!/\b(guest|car|vehicle|registration|subject|body)\b/i.test(asked)) return false;
  if (!/\b(blue jays|\b318\b|charlotte|\b606\b|shaw|roseglor|scarborough)\b/i.test(asked)) return false;
  return true;
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

function fillFromTemplate(letter: MailLetter, checkIn: string, checkOut: string, vehicles: Vehicle[]): { subject: string; body: string; warnings: string[] } {
  const vehicle = vehicles[0] ?? { guest: "", make: "", model: "", plate: "", colour: "", count: "" };
  const dates = letter.subject.match(DATE) ?? [];
  const checkInDate = longDate(checkIn);
  const checkOutDate = longDate(checkOut);
  let subject = letter.subject;
  let body = letter.body;
  if (dates[0]) {
    subject = subject.replaceAll(dates[0], checkInDate);
    body = body.replaceAll(dates[0], checkInDate);
  }
  if (dates[1]) {
    subject = subject.replaceAll(dates[1], checkOutDate);
    body = body.replaceAll(dates[1], checkOutDate);
  }
  const oldGuest = /^Guest:\s*(.+)$/im.exec(letter.body)?.[1]?.trim() ?? "";
  if (oldGuest && vehicle.guest && oldGuest !== vehicle.guest) body = body.replaceAll(oldGuest, vehicle.guest);
  const warnings: string[] = [];
  body = body.split("\n").map((line) => {
    const match = /^(Guest|Make|Model|Plate|Colour|Color|Vehicle count):\s*(.*)$/i.exec(line.trim());
    if (!match) return line;
    const label = match[1] ?? "";
    const next = valueFor(label, vehicle);
    if (next) return line.replace(match[0], `${label}: ${next}`);
    const blank = blankFor(label);
    warnings.push(`${label} is still a blank: ${blank}.`);
    return line.replace(match[0], `${label}: ${blank}`);
  }).join("\n");
  if (vehicles.length > 1) {
    const extra = vehicles.slice(1).map((item) => vehicleBlock(item, warnings)).join("\n\n");
    body = body.replace(/^(Colour|Color):\s*.+$/m, (line) => `${line}\n\n${extra}`);
  }
  return { subject, body, warnings };
}

function alreadySent(stay: RecentStay["stay"], letters: MailLetter[]): boolean {
  const arrival = longDate(stay.checkIn);
  const departure = longDate(stay.checkOut);
  return letters.some((letter) => {
    const hay = `${letter.subject}\n${letter.body}`;
    return hay.includes(arrival) || hay.includes(departure);
  });
}

async function sentLetters(question: string): Promise<{ letters: MailLetter[]; note: string }> {
  const found = await searchMail({ keywords: searchTerms(question), where: "sent", includeAirbnb: false });
  if (!found.hits.length) {
    const note = found.notes.find((line) => /isn't connected|didn't return/i.test(line));
    return { letters: [], note: note ?? "I didn't find a sent building email for that property. I didn't draft one." };
  }
  const letters: MailLetter[] = [];
  for (const hit of [...found.hits].sort((a, b) => b.date.localeCompare(a.date))) {
    try {
      const thread = await readMailThread({ mailbox: hit.mailbox, id: hit.threadId || hit.id });
      const letter = thread.find((row) => row.id === hit.id) ?? thread.at(-1);
      if (letter) letters.push(letter);
    } catch {
      // A message that will not open is skipped. A later one can still be the template.
    }
  }
  if (!letters.length) return { letters: [], note: "I didn't find a sent building email for that property. I didn't draft one." };
  return { letters, note: "" };
}

export async function answerBuildingRegistration(text: string): Promise<string | null> {
  if (!asksBuildingRegistration(text)) return null;
  const clock = parityNow() ?? new Date();
  const today = torontoToday(clock);
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
  const next = upcoming[0];
  if (!next) {
    const closed = sent.letters.find((letter) => platesFrom(`${letter.subject}\n${letter.body}`).length >= 2);
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
  const saved = await leaveDraft({
    channel: "email",
    to: template.to,
    subject: filled.subject,
    body: filled.body,
    warnings: filled.warnings,
    needs_you: true,
  });
  const marks = vehicles.flatMap((item) => [item.make, item.model, item.plate].filter(Boolean));
  const stored = await confirmedChecksDraft(saved, { subject: filled.subject, includes: marks });
  if (!stored) return "The building email was not saved in Checks.";
  const who = guest || "the next guest";
  return `The building email for ${who} at ${next.label} is in Checks. Nothing is sent until you press Submit.`;
}
