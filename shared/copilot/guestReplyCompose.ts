/**
 * A reply to a guest that answers EVERYTHING they just wrote, in their own terms, from three sources only: the guest's
 * thread, the property's standing practices, and the Knowledge Hub. Pure: no network, nothing sent.
 *
 * What it reads before writing:
 *  - the whole thread, including what the hosts already told the guest. At 20 Blue Jays Way the hosts tell arriving guests
 *    they leave out snacks, so a guest naming an allergy is giving an instruction about THOSE snacks, never asking about
 *    restaurants;
 *  - the property record: the parking spot, the standing snack rule ("note diet flags, promise no specific items"),
 *    the building registration the hosts handle;
 *  - the reservation: the check-in time, and whether another guest checks out that morning.
 *
 * What it will not do: deflect. No "check local menus", no "we don't have details on hand", no "feel free to reach out" in
 * place of an answer. A question it has no fact for becomes a visible [blank] the partner fills, which also blocks sending.
 */

import { readTimeAsk } from "./guestTimeAsk.js";
import { BLUE_JAYS_PROCESS } from "./processFacts.js";
import { vehiclesFrom, type Vehicle } from "./guestVehicle.js";

/** A blank the composer leaves for the partner. A message that still holds one can't be sent. */
export const GUEST_BLANK = /\[Your answer to:[^\]]*\]|\[Can [^\]]*Add your answer\.\]/;

export type ReplyThreadMessage = { at: string; role: string; name: string; body: string };

export type ReplyInput = {
  guest: string;
  /** The property's name and address, as shown. */
  property: string;
  /** The full thread, oldest first or not: it is sorted here. */
  thread: ReplyThreadMessage[];
  checkIn: string;
  checkOut: string;
  /** Minutes after midnight. Absent means 4:00 PM. */
  checkInMinutes?: number;
  /** Another guest checks out of this unit on the arrival day. */
  sameDayDeparture: "yes" | "no" | "unknown";
};

export type ReplyPlan = {
  draft: string;
  /** The same reply with only one of the arrival options, so the partner can approve either. */
  alternates: string[];
  /** What the reply answers, one phrase each. */
  handled: string[];
  /** For the partner only, never in the guest's text. */
  notes: string[];
};

/** Wording that hands the guest a non-answer. Banned in every guest draft, written by a template or a model. */
const DEFLECTIONS: [RegExp, string][] = [
  [/\b(local|nearby)\s+(menus?|restaurants?|options|eateries|cafes?)\b/i, "sends the guest to local menus or restaurants"],
  [/\b(restaurants?|menus?)\b/i, "talks about restaurants or menus"],
  [/\b(?:don'?t|do not|doesn'?t|does not)\s+have\s+(?:any\s+)?(?:specific\s+)?(?:details|information|info)(?:\s+on\s+hand)?\b/i, "says there are no details on hand"],
  [/\bfeel free to (?:reach out|contact|ask|message|let)\b/i, "uses 'feel free to reach out' in place of an answer"],
  [/\bdon'?t hesitate to\b/i, "uses 'don't hesitate to' in place of an answer"],
  [/\blet (?:me|us) know if you (?:have|need) (?:any )?(?:other |further |more |additional )?(?:questions|anything|assistance)\b/i, "ends with a generic offer of more help"],
  [/\b(?:happy|glad) to help with anything else\b/i, "ends with a generic offer of more help"],
];

export function deflectionProblems(text: string): string[] {
  return DEFLECTIONS.filter(([pattern]) => pattern.test(text)).map(([, why]) => `The reply ${why}.`);
}

const RELATIVE = /\b(an?|one|two|three|half an?|\d+(?:\.\d+)?)\s*(?:and a half\s*)?(hours?|hrs?|minutes?|mins?)\s+(?:before|earlier|early|ahead)\b/i;
const ALLERGY_TERM = /\b([a-z]+(?:[- ][a-z]+)?)\s+(allerg(?:y|ies)|intolerance)\b|\ballergic to ([a-z ,&-]{3,40}?)(?=[.,!?]|$| and i\b| but\b)|\b(celiac|coeliac)\b/gi;
/** Words that come before the thing someone is allergic to: "I have a severe gluten allergy". */
const ALLERGY_LEAD = new Set(["i", "we", "she", "he", "they", "have", "has", "had", "a", "an", "the", "my", "our", "his", "her", "their", "is", "are", "am", "with", "no", "any", "food", "severe", "serious", "mild", "bad", "small", "slight", "real", "very", "also", "and", "or", "of", "to", "got", "get", "gets"]);
const PARKING_USE = /\b(?:use|using|park(?:ing)?(?: in)?|wait in|sit in)\b[^.!?]*\bparking (?:spot|space|stall)\b[^.!?]*|\bparking (?:spot|space|stall)\b[^.!?]*\b(?:feed|nurse|rest|change|wait|sit)\b[^.!?]*/i;
const PARKING_PURPOSE = /\bto ((?:feed|nurse|change|settle|put down)(?: the| our| my)? [a-z]+)\b/i;

function first(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function label(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${hour24 % 12 || 12}:${String(minute).padStart(2, "0")} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/** The newest run of guest messages after the last host message: what the reply has to answer. */
export function pendingGuestText(thread: ReplyThreadMessage[]): { text: string; at: string; messages: ReplyThreadMessage[] } {
  const spoken = thread.filter((row) => row.role !== "system" && row.body.trim()).slice().sort((a, b) => a.at.localeCompare(b.at));
  const lastHost = spoken.filter((row) => row.role === "host").at(-1)?.at ?? "";
  const pending = spoken.filter((row) => row.role === "guest" && row.at > lastHost);
  return { text: pending.map((row) => row.body.trim()).join("\n"), at: pending.at(-1)?.at ?? "", messages: pending };
}

/** "gluten allergy", "peanut allergy": the guest's own words, from the message. */
function allergyTerms(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(ALLERGY_TERM)) {
    let term = "";
    if (match[1] && match[2]) {
      const words = match[1].toLowerCase().split(/[\s]+/).filter(Boolean);
      while (words.length && ALLERGY_LEAD.has(words[0]!)) words.shift();
      while (words.length && ALLERGY_LEAD.has(words[words.length - 1]!)) words.pop();
      if (words.length) term = `${words.join(" ")} ${/intolerance/i.test(match[2]) ? "intolerance" : "allergy"}`;
    } else if (match[3]) term = `${match[3].trim().toLowerCase()} allergy`;
    else if (match[4]) term = "celiac disease";
    if (term && !found.includes(term)) found.push(term);
  }
  return found.slice(0, 3);
}

function describe(vehicles: Vehicle[]): string {
  return vehicles.map((item) => {
    const car = [item.colour.toLowerCase(), item.make, item.model].filter(Boolean).join(" ");
    return `${car || "vehicle"}${item.plate ? ` (${item.plate})` : ""}`;
  }).join(" and ");
}

export function composeGuestReply(input: ReplyInput): ReplyPlan | null {
  const pending = pendingGuestText(input.thread);
  if (!pending.text) return null;
  const name = first(input.guest);
  const blueJays = /blue jays|\b318\b/i.test(input.property);
  const spot = blueJays ? /P\d-\d+/i.exec(BLUE_JAYS_PROCESS)?.[0] ?? "" : "";
  const checkIn = label(input.checkInMinutes ?? 16 * 60);
  const handled: string[] = [];
  const notes: string[] = [];
  const paragraphs: string[] = [];

  // What the guest named in this message.
  const vehicles = vehiclesFrom(pending.text, input.guest);
  const allergies = allergyTerms(pending.text);
  const asks = readTimeAsk(pending.text, pending.at, input.checkInMinutes ?? 16 * 60);
  const early = asks.find((ask) => ask.kind === "early");
  const parking = PARKING_USE.exec(pending.text)?.[0] ?? "";
  // Only the shapes the old hub reply gets wrong: details already given, an allergy stated, an early arrival or the spot.
  if (!vehicles.length && !allergies.length && !early && !parking) return null;

  // What the hosts already told this guest. "We like to leave a few welcome snacks" makes an allergy a snack instruction.
  const hostSaidSnacks = input.thread.some((row) => row.role === "host" && /\bsnacks?\b/i.test(row.body));
  const snackPractice = hostSaidSnacks || (blueJays && /snack/i.test(BLUE_JAYS_PROCESS));

  if (vehicles.length) {
    const cars = describe(vehicles);
    paragraphs.push(blueJays
      ? `Thank you for the car details. I'm handling the parking registration with the building for your ${cars}.`
      : `Thank you for the car details. I've noted your ${cars}.`);
    handled.push("the car details");
    const lacking = vehicles.flatMap((item) => [!item.make && !item.model ? "make and model" : "", !item.plate ? "licence plate" : "", !item.colour ? "colour" : ""].filter(Boolean));
    if (lacking.length && blueJays) notes.push(`The building registration needs the car's ${[...new Set(lacking)].join(", ")}; ${name} didn't give it.`);
  }

  if (allergies.length) {
    const terms = allergies.map((term) => `your ${term}`).join(" and ");
    paragraphs.push(snackPractice
      ? `Thank you for letting me know about ${terms}. We leave a few snacks out for arriving guests, so I've recorded it for your arrival, though I can't promise specific items.`
      : `Thank you for letting me know about ${terms}. I've recorded it for your arrival.`);
    handled.push(snackPractice ? "the allergy against the snacks the hosts leave out" : "the allergy");
    if (!snackPractice) notes.push("The thread and the property record don't say whether snacks are left out, so the reply only records the allergy.");
  }

  // The arrival ask: an hour early, or the parking spot. Each option is a complete answer; the partner approves one or both.
  const options: { early: string; spot: string } = { early: "", spot: "" };
  if (early || RELATIVE.test(pending.text)) {
    const relative = RELATIVE.exec(pending.text);
    const phrase = relative ? `${relative[0].replace(/\b(before|earlier|ahead)\b/i, "early")}` : "";
    const arriving = `arriving ${phrase || "early"}${early?.time ? `, at ${early.time},` : ""}`;
    if (input.sameDayDeparture === "no") {
      options.early = `${arriving[0]!.toUpperCase()}${arriving.slice(1)} works: no one is checking out of the unit that day.`;
    } else if (input.sameDayDeparture === "yes") {
      options.early = `Check-in is at ${checkIn}, and a guest checks out of the unit that morning, so ${arriving} depends on the clean finishing. I'll confirm that on the day.`;
    } else {
      options.early = `Check-in is at ${checkIn}, so I'll confirm whether ${arriving} works.`;
    }
    handled.push(phrase ? `arriving ${phrase}` : "the early arrival");
  }
  if (parking) {
    const purpose = PARKING_PURPOSE.exec(pending.text)?.[1]?.replace(/\b(?:the|our|my)\s+(?:babe|bub|bubba|babies)\b/i, "the baby").replace(/\bbabe\b/i, "baby") ?? "";
    const toDo = purpose ? ` ${/^to /.test(purpose) ? purpose : `to ${purpose}`} in the car` : "";
    if (spot) options.spot = `${options.early ? "And if you get there before that" : "If you get there before check-in"}, you're welcome to use the parking spot (${spot})${toDo}.`;
    else {
      options.spot = `[Can ${name} use the parking spot before check-in${purpose ? ` to ${purpose.replace(/^to /, "")}` : ""}? Add your answer.]`;
      notes.push(`There is no parking-spot record for ${input.property || "this property"}, so that sentence is left for you.`);
    }
    handled.push("the parking spot");
  }
  const arrival = [options.early, options.spot].filter(Boolean).join(" ");
  if (arrival) paragraphs.push(arrival);

  // Anything else the guest asked that nothing above answered stays a visible blank, never a pleasantry.
  const answered = new RegExp([vehicles.length ? "car|plate|nissan|vehicle" : "", allergies.length ? "allerg|gluten|intoleran|celiac" : "", early || parking ? "hour|early|parking|spot|before|arriv|feed" : "", "thank"].filter(Boolean).join("|"), "i");
  const open = pending.text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter((part) => part && /\?\s*$|\b(?:could you|can you|can we|could we|would you|do you|is there|are there|please)\b/i.test(part) && !answered.test(part));
  for (const question of open.slice(0, 3)) {
    paragraphs.push(`[Your answer to: ${question.replace(/\s+/g, " ").slice(0, 120)}]`);
    notes.push(`${name} also asked "${question.slice(0, 120)}", which nothing in the thread or the property record answers.`);
  }

  const greet = `Hi ${name},`;
  const draft = [greet, ...paragraphs].join("\n\n");
  const alternates: string[] = [];
  if (options.early && options.spot) {
    const lead = paragraphs.slice(0, paragraphs.length - (open.length + 1));
    const tail = paragraphs.slice(paragraphs.length - open.length);
    const only = (text: string) => [greet, ...lead, text.replace(/^And if you get there before that/, "If you get there before check-in"), ...(open.length ? tail : [])].join("\n\n");
    alternates.push(only(options.early), only(options.spot));
  }
  // Self-check: nothing that was just written may be a deflection.
  if (deflectionProblems(draft).length) return null;
  return { draft, alternates, handled, notes };
}

/** Another guest checks out of the same unit on the arrival day. Unknown when the stays can't be read. */
export function sameDayDepartureFor(
  stays: { id: string; propertyId: string; checkOut: string; status: string }[] | null,
  arriving: { id: string; propertyId: string; checkIn: string },
): "yes" | "no" | "unknown" {
  if (!stays || !arriving.checkIn) return "unknown";
  return stays.some((row) => row.id !== arriving.id && row.propertyId === arriving.propertyId && row.checkOut === arriving.checkIn && !/cancel|declin|denied|expired/i.test(row.status)) ? "yes" : "no";
}
