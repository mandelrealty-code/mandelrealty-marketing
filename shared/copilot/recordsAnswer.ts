/**
 * Company counts and reads that must come from records, never from a model.
 * Read only. Nothing is sent to a guest.
 */

import { getHospitablePat } from "../pm/clientStore.js";
import { listAllHospitableProperties, listHospitableReservations, listReservationMessages } from "../pm/hospitableClient.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { getSupabaseAdmin } from "../supabase.js";
import { unitsAnswer } from "./memoryFiles.js";
import { addDays, torontoToday } from "./time.js";

const UNITS =
  /\b(how many|number of|count of|what|which|list|name|show|tell)\b[\s\S]{0,60}\b(units?|properties|listings|homes)\b|\b(units?|properties) (do|did|are) (we|they|ours)\b/i;
const ABOUT_UNITS = /Hospitable lists|from Hospitable/i;
const UNIT_FOLLOW = /\b(what|which)\b[\s\S]{0,40}\b(they|them|those|names?|addresses|ones)\b|\b(their|the) (names?|addresses)\b/i;
const MESSAGE =
  /\b(who sent|last)\b[\s\S]{0,48}\b(guest )?messages?\b|\bwho (sent|messaged|texted)\b/i;
const REVIEWS =
  /\b(any|new|recent|latest|unanswered)\b[\s\S]{0,32}\breviews?\b|\breviews?\b[\s\S]{0,24}\b(new|today|lately|this week)\b/i;

const DEAD = /cancel|declin|denied|expired|not_possible|withdrawn|inquiry/i;

export function asksRecords(input: string, prior = ""): boolean {
  const text = input.replace(/\n?Attached:.*$/is, "").trim();
  return UNITS.test(text) || (ABOUT_UNITS.test(prior) && UNIT_FOLLOW.test(text)) || MESSAGE.test(text) || REVIEWS.test(text);
}

/** A spoken answer, or null when this is not one of the record questions. */
export async function answerRecords(input: string, prior = ""): Promise<string | null> {
  const text = input.replace(/\n?Attached:.*$/is, "").trim();
  if (!text) return null;
  try {
    if (MESSAGE.test(text) && !/\bHM[A-Z0-9]{8,}\b|charlotte|roseglor|blue jays|\bshaw\b|markham|\b(606|1103|1104|2104)\b|this reservation/i.test(text)) {
      return await lastMessage();
    }
    if (REVIEWS.test(text)) return await newReviews();
    if (UNITS.test(text) || (ABOUT_UNITS.test(prior) && UNIT_FOLLOW.test(text))) return await unitList(text);
  } catch {
    return "Hospitable didn't return that. I didn't guess a number or a name.";
  }
  return null;
}

async function unitList(question: string): Promise<string> {
  const hospitableAsk = /\bhospitable\b/i.test(question) && !/\b(we manage|we track|only tracks|mrg)\b/i.test(question);
  if (!hospitableAsk) {
    const properties = await propertiesFromHospitable();
    const fromFile = await unitsAnswer(properties?.length ?? null).catch(() => null);
    if (fromFile) return fromFile;
  }
  const properties = await propertiesFromHospitable();
  if (properties === null) {
    return "Hospitable isn't connected, so I can't see the units. Add the key in OPS Settings. I didn't guess a count.";
  }
  if (!properties.length) {
    return "Hospitable returned no properties. I didn't guess a count.";
  }
  const lines = properties.map((property) => {
    const name = property.name.trim() || "Untitled property";
    const address = property.address.trim();
    const where = address && address.toLowerCase() !== name.toLowerCase() ? ` — ${address}` : "";
    const listed = property.listed === false ? " (not listed)" : "";
    return `${name}${where}${listed}`;
  });
  const noun = properties.length === 1 ? "property" : "properties";
  return `Hospitable lists ${properties.length} ${noun}.\n${lines.join("\n")}`;
}

async function propertiesFromHospitable() {
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) return null;
  return listAllHospitableProperties(pat);
}

async function newReviews(): Promise<string> {
  const sb = getSupabaseAdmin();
  if (!sb) return "The review book isn't available from here. I didn't guess.";
  const since = `${addDays(torontoToday(), -14)}T00:00:00.000Z`;
  const { data, error } = await sb
    .from("pm_reviews")
    .select("property_id, rating, guest_first_name, reviewed_at, public_review")
    .gte("reviewed_at", since)
    .order("reviewed_at", { ascending: false })
    .limit(8);
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) {
      return "The review book isn't set up, so I can't see new reviews. I didn't guess.";
    }
    return "I couldn't read the review book just now. I didn't guess.";
  }
  const rows = (data ?? []) as {
    property_id?: string;
    rating?: number | null;
    guest_first_name?: string;
    reviewed_at?: string | null;
    public_review?: string;
  }[];
  if (!rows.length) {
    return "No reviews are saved from the last 14 days. I didn't look past the review book, and I didn't guess.";
  }
  const properties = await listPmProperties().catch(() => []);
  const nameFor = new Map(properties.map((property) => [property.id, property.name]));
  const lines = rows.slice(0, 5).map((row) => {
    const who = row.guest_first_name?.trim() || "A guest";
    const unit = nameFor.get(String(row.property_id ?? "")) || "a unit";
    const rating = row.rating == null ? "" : `, ${row.rating} of 5`;
    const quote = clip(row.public_review || "", 90);
    return `${who} at ${unit}${rating}, ${when(row.reviewed_at ?? null)}${quote ? `: “${quote}”` : ""}`;
  });
  const more = rows.length > 5 ? ` ${rows.length - 5} more are in that window.` : "";
  return `${rows.length} ${rows.length === 1 ? "review is" : "reviews are"} saved from the last 14 days. ${lines.join(" ")} ${more}`.replace(/\s+/g, " ").trim();
}

async function lastMessage(): Promise<string> {
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) {
    return "Hospitable isn't connected, so I can't see who sent the last guest message. Add the key in OPS Settings. I didn't guess a name.";
  }
  const properties = await propertiesFromHospitable();
  if (!properties?.length) {
    return "Hospitable returned no properties, so I can't see a guest thread. I didn't guess a name.";
  }
  const unitFor = new Map(properties.map((property) => [property.id, property.name]));
  const today = torontoToday();
  const reservations = await listHospitableReservations({
    pat,
    propertyIds: properties.map((property) => property.id),
    startDate: addDays(today, -21),
    endDate: addDays(today, 45),
    include: ["guest"],
  });
  const stays = reservations.filter((stay) => !DEAD.test(stay.status));
  if (!stays.length) {
    return "No current stays came back from Hospitable, so there isn't a guest thread to read. I didn't guess a name.";
  }

  type Hit = { at: string; role: string; name: string; unit: string; guest: string };
  const outbound: Hit[] = [];
  const inbound: Hit[] = [];
  const opened: number[] = [];
  const deadline = Date.now() + 25_000;
  let next = 0;
  async function lane() {
    while (next < stays.length && Date.now() < deadline) {
      const stay = stays[next++];
      let messages;
      try {
        messages = await listReservationMessages(pat, stay.id);
      } catch {
        continue;
      }
      opened.push(1);
      const guest = guestFirst(stay.raw);
      const unit = unitFor.get(stay.property_id) || "a unit";
      for (const message of messages) {
        const hit: Hit = {
          at: message.created_at || "",
          role: message.sender_role,
          name: message.author_name.trim(),
          unit,
          guest,
        };
        if (message.sender_role === "guest") inbound.push(hit);
        else outbound.push(hit);
      }
    }
  }
  await Promise.all([lane(), lane(), lane(), lane()]);

  const newestOut = latest(outbound);
  const newestGuest = latest(inbound);
  const read = opened.length;
  const partial = read < stays.length ? " I didn't finish every current thread." : "";
  if (!newestOut && !newestGuest) {
    return `I opened ${read} current ${read === 1 ? "stay" : "stays"} and didn't find a message.${partial} I didn't guess a name.`;
  }
  const out = newestOut
    ? `The last message sent to a guest was ${who(newestOut)} at ${newestOut.unit}, ${when(newestOut.at)}.`
    : "I didn't find a message sent to a guest in the threads I opened.";
  const guestLine =
    newestGuest && (!newestOut || newestGuest.at > newestOut.at)
      ? ` A guest wrote more recently: ${newestGuest.guest} at ${newestGuest.unit}, ${when(newestGuest.at)}.`
      : "";
  return `${out}${guestLine}${partial}`.replace(/\s+/g, " ").trim();
}

function latest<T extends { at: string }>(rows: T[]): T | null {
  return rows.reduce<T | null>((best, row) => (!best || row.at > best.at ? row : best), null);
}

function who(hit: { role: string; name: string }): string {
  if (hit.role === "system") return "an automated message, with no person named";
  if (hit.name) return `from ${hit.name}`;
  if (hit.role === "host") return "from the host side, and the name wasn't on the message";
  return "from a sender that Hospitable didn't name";
}

function guestFirst(raw: Record<string, unknown>): string {
  const guest = raw.guest && typeof raw.guest === "object" ? (raw.guest as Record<string, unknown>) : {};
  const first = String(guest.first_name ?? guest.firstName ?? "").trim();
  if (first) return first;
  const full = String(guest.full_name ?? guest.name ?? "").trim();
  return full.split(/\s+/)[0] || "A guest";
}

function when(iso: string | null): string {
  if (!iso) return "at an unknown time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (!one) return "";
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}
