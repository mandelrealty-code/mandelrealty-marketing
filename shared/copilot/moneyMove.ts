/**
 * "What's the one thing you'd do this week to make us more money?"
 *
 * A revenue action, grounded in the business's own figures: each unit's next 30 days (open nights
 * and what they're listed at, from Hospitable) against AirROI comps for its specs (CAD). The pick is
 * the largest dollar opportunity, with its numbers named. Service items may follow, labelled as
 * service, never as the money move. Nothing is changed.
 */

import { calendarNights } from "./calendarAdvice.js";
import { compSet, money, sizeOf, type CompSet } from "./compsAnswer.js";
import { spokenProperty } from "./dayBoard.js";
import { loadGuestQueue } from "./guestMessaging.js";
import { nightsBetween, occupiesNight, overlappingStays } from "./occupancy.js";
import { managedReportProperties } from "./reportFigures.js";
import { addDays, torontoToday } from "./time.js";

const ASKS = /\b(make (?:us |me )?more money|more revenue|increase (?:revenue|income|earnings)|boost (?:revenue|income|bookings)|grow revenue|earn more|biggest (?:revenue |money )?(?:win|opportunity|lever)|money move)\b/i;

export function asksMoneyMove(text: string): boolean {
  return ASKS.test(text);
}

type Opportunity = { unit: string; value: number; text: string };

function short(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** The longest run of consecutive open nights. */
function longestRun(days: string[]): string[] {
  let best: string[] = [];
  let run: string[] = [];
  for (const day of [...days].sort()) {
    run = run.length && addDays(run[run.length - 1]!, 1) === day ? [...run, day] : [day];
    if (run.length > best.length) best = run;
  }
  return best;
}

export async function answerMoneyMove(text: string, now = new Date()): Promise<{ body: string; step: string; thought: string } | null> {
  if (!asksMoneyMove(text)) return null;
  const today = torontoToday(now);
  const end = addDays(today, 30);
  let properties: Awaited<ReturnType<typeof managedReportProperties>>;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "OPS didn't return the properties, so I couldn't size up the revenue options. Ask again and I'll retry.", step: "OPS didn't answer", thought: "Nothing was changed." };
  }
  const options: Opportunity[] = [];
  const unread: string[] = [];
  for (const unit of properties) {
    const name = spokenProperty(unit.name, unit.address);
    const id = unit.hospitable_property_id || unit.id;
    const calendar = await calendarNights(id, today, end);
    let booked: string[] = [];
    try {
      const stays = await overlappingStays(id, today, end);
      booked = nightsBetween(today, end).filter((day) => stays.some((stay) => occupiesNight(stay, day)));
    } catch {
      unread.push(name);
      continue;
    }
    if (!calendar) {
      unread.push(name);
      continue;
    }
    const open = calendar.filter((night) => night.available && !booked.includes(night.date));
    if (!open.length) continue;
    const comps: CompSet | null = await compSet(unit.address || name, await sizeOf(id));
    const priced = open.filter((night) => night.priceCents != null);
    const listed = priced.length ? priced.reduce((total, night) => total + night.priceCents!, 0) / priced.length / 100 : null;
    const underpriced = Boolean(comps && listed != null && listed < comps.low);
    const run = longestRun(open.map((night) => night.date));
    const rate = comps?.median ?? listed;
    if (run.length >= 4 && rate != null) {
      // A long empty stretch. If it's already priced under its comps, price isn't what's holding it back.
      const cheapAlready = underpriced
        ? ` It's already listed at about ${money(listed!)} a night, under the ${money(comps!.median)} ${comps!.currency} comp median, and still empty, so check the listing is live and the minimum stay isn't blocking short bookings before cutting price.`
        : " A short-stay discount or a lower minimum stay for those dates is the lever.";
      options.push({
        unit: name,
        value: rate * run.length * 0.6,
        text: `Fill ${name}'s empty stretch, ${short(run[0]!)} to ${short(addDays(run[run.length - 1]!, 1))} (${run.length} nights, nothing booked). At ${comps ? `the ${money(comps.median)} ${comps.currency} comp median` : `its listed ${money(rate)}`} that's ${money(rate * run.length)} on the table.${cheapAlready}`,
      });
    } else if (underpriced && comps && listed != null) {
      // Booking well but priced under the comps: raise the open nights toward the median.
      const gap = comps.median - listed;
      options.push({
        unit: name,
        value: gap * open.length,
        text: `Raise ${name}'s open-night prices. Its ${open.length} open nights in the next 30 days are listed at about ${money(listed)} a night, under the ${money(comps.median)} ${comps.currency} comp median (comps' middle half ${money(comps.low)}–${money(comps.high)}). Pricing them at the median is worth up to ${money(gap * open.length)} ${comps.currency} if they book.`,
      });
    }
  }
  const lines: string[] = [];
  const pick = options.sort((a, b) => b.value - a.value)[0];
  if (pick) {
    lines.push(`The money move this week: ${pick.text}`);
    const next = options.find((item) => item !== pick && item.unit !== pick.unit);
    if (next) lines.push(`Next best: ${next.text}`);
  } else {
    lines.push(unread.length === properties.length
      ? "I couldn't read the calendars or reservations, so I can't size a revenue move. Ask again and I'll retry."
      : "Every unit is booked or priced within its comps for the next 30 days, so there's no clear revenue gap to chase this week.");
  }
  if (unread.length && unread.length < properties.length) lines.push(`Not checked: ${unread.join(", ")} (the calendar or reservations didn't return).`);
  // Service items are worth doing, but they aren't the money move.
  try {
    const queue = await loadGuestQueue(now);
    const service = (queue.followUps ?? []).filter((row) => row.kind === "owe" || row.kind === "incident").slice(0, 2);
    if (service.length) lines.push(`Service, not the money move: ${service.map((row) => `${row.line} (${row.property})`).join("; ")}.`);
  } catch {
    /* Service items are optional here. */
  }
  lines.push("From Hospitable's calendar and reservations for the next 30 days and AirROI comps for each unit's specs. Nothing was changed.");
  return { body: lines.join("\n"), step: "Compared each unit's next 30 days with its comps", thought: "Read from Hospitable and AirROI. Nothing was changed." };
}
