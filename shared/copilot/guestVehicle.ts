/**
 * Vehicle details a guest wrote, from any wording: "Make: Mazda. Model: CX-5. Plate: CKTR902", "Nissan Rogue, plate
 * CDDD 686", "we're bringing a white 2019 Honda Civic, licence plate ABCD 123", "no car, we're taking the train".
 *
 * Only what the guest wrote is returned. A make, model, colour or plate that isn't in the text stays empty: nothing here
 * guesses. Pure and browser-safe.
 */

export type Vehicle = { guest: string; make: string; model: string; plate: string; colour: string; count: string };

const MAKES: [RegExp, string][] = [
  [/toyota/i, "Toyota"], [/honda/i, "Honda"], [/nissan/i, "Nissan"], [/ford/i, "Ford"], [/chevrolet|chevy/i, "Chevrolet"],
  [/gmc/i, "GMC"], [/dodge/i, "Dodge"], [/jeep/i, "Jeep"], [/chrysler/i, "Chrysler"], [/hyundai/i, "Hyundai"],
  [/kia/i, "Kia"], [/mazda/i, "Mazda"], [/subaru/i, "Subaru"], [/volkswagen|vw/i, "Volkswagen"], [/audi/i, "Audi"],
  [/bmw/i, "BMW"], [/mercedes(?:[- ]benz)?/i, "Mercedes-Benz"], [/lexus/i, "Lexus"], [/acura/i, "Acura"], [/infiniti/i, "Infiniti"],
  [/tesla/i, "Tesla"], [/volvo/i, "Volvo"], [/mitsubishi/i, "Mitsubishi"], [/buick/i, "Buick"], [/cadillac/i, "Cadillac"],
  [/lincoln/i, "Lincoln"], [/porsche/i, "Porsche"], [/land rover|range rover/i, "Land Rover"],
  [/fiat/i, "Fiat"], [/jaguar/i, "Jaguar"], [/suzuki/i, "Suzuki"], [/pontiac/i, "Pontiac"],
  [/saturn/i, "Saturn"], [/oldsmobile/i, "Oldsmobile"],
];
const MAKE_WORD = new RegExp(`\\b(?:${MAKES.map(([pattern]) => pattern.source).join("|")})\\b`, "gi");

const COLOURS = ["black", "white", "grey", "gray", "silver", "blue", "red", "green", "brown", "beige", "tan", "gold", "orange", "yellow", "purple", "maroon", "burgundy", "navy", "charcoal", "teal", "bronze"];
const COLOUR_WORD = new RegExp(`\\b(${COLOURS.join("|")})\\b(?!\\s+jays)`, "i");

/** Ontario-style plates and their neighbours: CDDD 686, CKTR902, ABC 1234, 123 ABC. Used only with a cue or a make beside it. */
const PLATE_SHAPE = /\b(?:[A-Z]{4}\s?\d{3}|[A-Z]{3}\s?\d{3,4}|\d{3}\s?[A-Z]{3}|[A-Z]{2}\s?\d{3,5}|[A-Z]\d{2}\s?[A-Z]{3})\b/;
const PLATE_CUE = /(?:licen[cs]e(?:\s+plate)?|plate(?:\s+(?:number|no\.?|#))?|\bplates?\b|\blp\b|\btag)\s*(?:number|no\.?|#)?\s*(?:is|are|:|-|=)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{2,9}[A-Z0-9])\b/i;

function clean(value: string): string {
  return value.replace(/[.,;:!]+$/g, "").replace(/\s+/g, " ").trim();
}

function canonicalMake(word: string): string {
  for (const [pattern, name] of MAKES) if (new RegExp(`^(?:${pattern.source})$`, "i").test(word.trim())) return name;
  return clean(word);
}

function plateFrom(text: string): string {
  const cued = PLATE_CUE.exec(text)?.[1];
  if (cued) {
    const candidate = clean(cued).toUpperCase().replace(/\s*-\s*/g, "-");
    // A cued plate must look like one: letters and digits, not a plain word ("plate details").
    if (/\d/.test(candidate) && /[A-Z]/.test(candidate) && candidate.length >= 4 && !NOT_PLATE.test(candidate)) return candidate.replace(/\s{2,}/g, " ");
  }
  for (const match of text.toUpperCase().matchAll(new RegExp(PLATE_SHAPE.source, "g"))) {
    if (NOT_PLATE.test(match[0])) continue;
    return match[0].replace(/\s{2,}/g, " ");
  }
  return "";
}

/** Letters-and-digits that are not a plate: a unit, a room, a weekday, a phone label. */
const NOT_PLATE = /^(?:UNIT|ROOM|SUITE|APT|APARTMENT|FLOOR|LEVEL|BUILDING|TOWER|PHONE|CELL|TEL|CALL|TEXT|CODE|FOB|KEY|LOCK|DOOR|WIFI|MON|TUE|WED|THU|FRI|SAT|SUN|OCT|NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|P\d)/i;

function countFrom(text: string): string {
  if (/\b(?:one|1|a|single)\s+(?:car|vehicle)\b/i.test(text)) return "1";
  if (/\b(?:two|2)\s+(?:cars|vehicles)\b/i.test(text)) return "2";
  const numbered = /\b(\d+)\s+(?:cars|vehicles)\b/i.exec(text);
  return numbered?.[1] ?? "";
}

/** One vehicle from a labelled block ("Make: Mazda. Model: CX-5. Plate: CKTR902"). */
function labelled(text: string, guest: string): Vehicle {
  // A value runs to the next label on the same line, a sentence end or a line break.
  const value = (label: string) => clean(new RegExp(`${label}\\s*:\\s*(.+?)(?=\\s+(?:make|model|plate|licen[cs]e(?: plate)?|colou?r|year)\\s*:|[.\\n;]|$)`, "i").exec(text)?.[1] ?? "");
  const make = value("make");
  const model = value("model");
  const plate = value("(?:plate|licen[cs]e(?: plate)?)");
  const colour = value("colou?r");
  return { guest, make, model, plate, colour, count: countFrom(text) };
}

/** A segment that starts at a make: "Nissan Rogue, plate CDDD 686", "Honda Civic (white) ABCD 123". */
function fromMakeSegment(segment: string, guest: string, before: string): Vehicle {
  const makeMatch = new RegExp(MAKE_WORD.source, "i").exec(segment);
  const make = makeMatch ? canonicalMake(makeMatch[0]) : "";
  const after = makeMatch ? segment.slice((makeMatch.index ?? 0) + makeMatch[0].length) : segment;
  // The model: the words straight after the make, up to punctuation, a cue word, a colour or the plate.
  const stop = /^(?:plate|plates|licen[cs]e|lp|tag|colou?r|in|with|and|for|that|which|is|are|parked|parking|number|no)$/i;
  const words: string[] = [];
  const tokens = after.trim().split(/\s+/).filter(Boolean);
  const startsPlate = new RegExp(`^(?:${PLATE_SHAPE.source})`, "i");
  for (let i = 0; i < tokens.length; i += 1) {
    const raw = tokens[i]!;
    const word = raw.replace(/^[(]+|[,.;:!)]+$/g, "");
    if (!word || stop.test(word) || /[()]/.test(word) || startsPlate.test(`${word} ${tokens[i + 1] ?? ""}`.toUpperCase()) || COLOUR_WORD.test(word) || /^\d{4}$/.test(word)) break;
    words.push(word);
    if (words.length >= 3 || /[,.;:!)]$/.test(raw)) break;
  }
  const written = clean(words.join(" "));
  // "nissan rogue" is written the way a car is: Rogue. Mixed or upper case is left as the guest wrote it (CX-5, RAV4).
  const model = written === written.toLowerCase() ? written.replace(/\b([a-z])/g, (letter) => letter.toUpperCase()) : written;
  const colour = COLOUR_WORD.exec(`${before.slice(-18)} ${segment}`)?.[1]?.toLowerCase() ?? "";
  return { guest, make, model, plate: plateFrom(segment), colour: colour ? colour[0]!.toUpperCase() + colour.slice(1) : "", count: "" };
}

export function noCarSaid(text: string): boolean {
  return /\b(no car|no vehicle|not (?:bringing|driving|taking) (?:a |any |our )?(?:car|vehicle)|don'?t have a car|do not have a car|won'?t have a car|without a car|(?:taking|coming by|arriving by) (?:the )?(?:train|bus|transit|uber|taxi|lyft|go train|plane|flight)|(?:no|not) (?:need|needing) (?:a |any )?parking|don'?t need (?:a |any )?parking|no parking needed)\b/i.test(text);
}

/** Every vehicle this text describes, with only what it says. */
export function vehiclesFrom(text: string, guest: string): Vehicle[] {
  const blocks = text.split(/(?=make\s*:)/i).map((part) => part.trim()).filter((part) => /^make\s*:/i.test(part));
  let vehicles: Vehicle[] = blocks.map((part) => labelled(part, guest)).filter((item) => item.make || item.model || item.plate);
  if (!vehicles.length) {
    // Free text: each make starts one vehicle, and runs to the next make.
    // A make is only a make when the message is about a vehicle: "Lincoln" in "this is Lincoln" is a name.
    const aboutVehicle = /\b(car|cars|vehicle|vehicles|drive|driving|driven|parking|park|plate|plates|licen[cs]e|truck|suv|sedan|van|minivan|hatchback|coupe|rental|rent)\b/i.test(text) || PLATE_SHAPE.test(text.toUpperCase());
    const starts = aboutVehicle ? [...text.matchAll(MAKE_WORD)].map((match) => match.index ?? 0) : [];
    vehicles = starts.map((start, index) => {
      const end = starts[index + 1] ?? text.length;
      return fromMakeSegment(text.slice(start, end), guest, text.slice(0, start));
    }).filter((item) => item.make);
    // A plate with no make still counts when the guest cued it: "plate CDDD 686".
    if (!vehicles.length) {
      const plate = plateFrom(text);
      const cued = PLATE_CUE.test(text);
      if (plate && (cued || /\b(car|vehicle|parking|plate)\b/i.test(text))) vehicles = [{ guest, make: "", model: "", plate, colour: COLOUR_WORD.exec(text)?.[1] ? COLOUR_WORD.exec(text)![1]![0]!.toUpperCase() + COLOUR_WORD.exec(text)![1]!.slice(1).toLowerCase() : "", count: "" }];
    }
    // A plate cued in the same message but not beside a make belongs to the only vehicle.
    if (vehicles.length === 1 && !vehicles[0]!.plate) vehicles[0]!.plate = plateFrom(text);
  }
  if (!vehicles.length) {
    const one = labelled(text, guest);
    if (one.make || one.model || one.plate || one.colour) vehicles = [one];
  }
  const count = vehicles.length > 1 ? String(vehicles.length) : countFrom(text);
  for (const item of vehicles) item.count = item.count || count;
  return vehicles;
}

export type GuestMessageLite = { at: string; role: string; body: string };

/** The newest guest message that gives vehicle details, with when it was written. */
export function vehiclesFromThread(messages: GuestMessageLite[], guest: string): { vehicles: Vehicle[]; at: string; quote: string } {
  const lines = messages.filter((row) => row.role === "guest").slice().sort((a, b) => a.at.localeCompare(b.at));
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const found = vehiclesFrom(lines[index]?.body ?? "", guest);
    if (found.length) return { vehicles: found, at: lines[index]!.at, quote: (lines[index]!.body ?? "").trim().slice(0, 240) };
  }
  return { vehicles: [], at: "", quote: "" };
}

/** What a guest said about not needing parking, newest first. Counts as an answer, not as "nothing sent". */
export function noCarFromThread(messages: GuestMessageLite[]): { at: string; quote: string } | null {
  const lines = messages.filter((row) => row.role === "guest").slice().sort((a, b) => b.at.localeCompare(a.at));
  const hit = lines.find((row) => noCarSaid(row.body));
  return hit ? { at: hit.at, quote: hit.body.trim().slice(0, 240) } : null;
}

export function describeVehicle(vehicle: Vehicle): string {
  const car = [vehicle.colour, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const parts = [car || "a vehicle (no make or model given)"];
  if (vehicle.plate) parts.push(`plate ${vehicle.plate}`);
  else parts.push("no plate given");
  return parts.join(", ");
}
