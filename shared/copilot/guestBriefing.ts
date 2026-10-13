/**
 * "Anything I should know before Husson checks in on Thursday?"
 *
 * The guest is found in the reservations, never by asking the partner which property. The briefing
 * leads with what matters for that stay: building notices in effect, the turnover after the last
 * checkout, the building registration, and open follow-ups at that unit. Day words come from today.
 */

import { findPlanArrival, loadPeriod, type StayMove } from "./dayBoard.js";
import { registrationState } from "./buildingRegistration.js";
import { loadGuestQueue } from "./guestMessaging.js";
import { buildingNotices } from "./outstandingAnswer.js";
import { addDays, torontoToday } from "./time.js";

const ASKS = /\b(anything|what)\b[^?]*\b(know|aware|heads[- ]up|watch out|prepare|ready)\b|\bbrief me\b|\bheads[- ]up\b/i;
const STAY = /\b(check(?:s|ing)?[\s-]?in|arriv\w*|stay|gets? in|coming)\b/i;

/** "Husson" from "before Husson checks in", "for Husson's stay", "about Husson arriving". */
export function briefingGuest(text: string): string {
  if (!ASKS.test(text) || !STAY.test(text)) return "";
  const match = /\b(?:before|for|about|with)\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?)(?:'s)?\s+(?:checks?|checking|arriv|stay|gets?|is|coming)/.exec(text);
  const name = (match?.[1] ?? "").replace(/'s$/, "");
  return /^(the|a|our|my|this|next|that)$/i.test(name) ? "" : name;
}

/** "today", "tomorrow", "Thursday, Oct 15", or "Thu Oct 22" further out. */
export function dayWords(day: string, today: string): string {
  if (day === today) return "today";
  if (day === addDays(today, 1)) return "tomorrow";
  const at = new Date(`${day}T12:00:00Z`);
  const days = Math.round((at.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  if (days > 1 && days < 7) return `${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(at)}, ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(at)}`;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(at).replace(",", "");
}

function short(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** The guest's next arrival: exact name first, then a first-name match in the next 30 days. */
async function arrivalOf(name: string, now: Date): Promise<StayMove | null> {
  const exact = await findPlanArrival(name, now).catch(() => null);
  if (exact && exact !== "unread") return exact;
  const today = torontoToday(now);
  const loaded = await loadPeriod(addDays(today, -1), addDays(today, 30)).catch(() => null);
  if (!loaded?.ok) return null;
  const first = name.toLowerCase().split(/\s+/)[0]!;
  return loaded.board.arrivals.filter((row) => row.guest.toLowerCase().split(/\s+/)[0] === first && row.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export async function answerGuestBriefing(text: string, now = new Date()): Promise<{ body: string; step: string; thought: string } | null> {
  const name = briefingGuest(text);
  if (!name) return null;
  const today = torontoToday(now);
  const arrival = await arrivalOf(name, now);
  if (!arrival) {
    return { body: `I didn't find ${name} arriving at a managed unit between yesterday and the next 30 days in Hospitable. Nothing was guessed.`, step: "Read the reservations", thought: "Nothing was sent." };
  }
  const nights = arrival.checkOut ? Math.round((Date.parse(`${arrival.checkOut}T12:00:00Z`) - Date.parse(`${arrival.date}T12:00:00Z`)) / 86400000) : 0;
  const lines = [`${arrival.guest} arrives ${dayWords(arrival.date, today)} at ${arrival.property}${arrival.checkOut ? ` for ${nights} night${nights === 1 ? "" : "s"} (${short(arrival.date)}–${short(arrival.checkOut)})` : ""}.`];
  const watch: string[] = [];

  // What's in effect at the building now.
  const notices = await buildingNotices(today).catch(() => ({ lines: [], notes: [] as string[] }));
  for (const notice of notices.lines.filter((line) => line.place === arrival.property)) watch.push(`${notice.text}${notice.text.endsWith(".") ? "" : "."}`);

  // The turnover between the last checkout and this arrival.
  const board = await loadPeriod(addDays(arrival.date, -14), arrival.date, true).catch(() => null);
  if (board?.ok) {
    const before = board.board.turnovers.filter((row) => row.propertyId === arrival.propertyId && row.date <= arrival.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (before) watch.push(`Turnover after ${before.guest || "the last guest"}'s ${short(before.date)} checkout: ${before.assigned ? "a cleaner is assigned" : "no cleaner is assigned yet"}.`);
    else watch.push(`No turnover is on record between the last checkout and ${short(arrival.date)}.`);
  } else watch.push("The cleaner app didn't return, so the turnover wasn't checked.");

  // The building registration, where the building needs one.
  if (/blue jays|\b318\b/i.test(arrival.property)) watch.push(await registrationState(arrival).catch(() => "The building registration wasn't checked; the mailbox didn't return."));

  // Open follow-ups at that unit.
  try {
    const queue = await loadGuestQueue(now);
    for (const row of queue.followUps ?? []) {
      if (row.property !== arrival.property && !row.property.includes(arrival.property)) continue;
      watch.push(`Open follow-up: ${row.line}${row.when ? ` (${row.when})` : ""}.`);
    }
  } catch {
    /* Follow-ups are extra; the briefing stands without them. */
  }
  const body = [...lines, ...(watch.length ? ["Before then:", ...watch.map((line) => `• ${line}`)] : ["Nothing else at that unit needs you before then."])].join("\n");
  return { body, step: "Read the reservation, building mail, cleaner app and follow-ups", thought: "Built from the records. Nothing was sent." };
}
