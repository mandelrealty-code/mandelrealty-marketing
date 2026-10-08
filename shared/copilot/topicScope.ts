/**
 * Scope is which properties Copilot may work on.
 * A partner can still ask a general question. That goes to the web lookup.
 * A request to message or report on a listing we do not manage is refused.
 */

import { answerWebLookup } from "./webLookup.js";

const UNMANAGED = /\b(1103|1104|2104)\b|\bmarkham\b|partner loft|king st w/i;
const PROPERTY_WORK = /\b(draft|write|send|message|reply|text|email|report|check-?ins?|check-?outs?|reservations?|bookings?|guests?|stays?)\b/i;
const RENTAL = /\b(guests?|reservations?|bookings?|check-?ins?|check-?outs?|hospitable|airbnb|payouts?|owner statements?|turnovers?|charlotte|roseglor|scarborough|spacious|blue jays|\b606\b|\b318\b|shaw)\b/i;

export const UNMANAGED_REFUSAL = "That listing is not one we manage. I didn't draft a message or report on it.";

export function unmanagedPropertyWork(text: string): boolean {
  const asked = text.trim();
  return UNMANAGED.test(asked) && PROPERTY_WORK.test(asked);
}

/** A partner question that is not work on a rental. Web lookup answers it. */
export function asksOpenLookup(text: string): boolean {
  const asked = text.trim();
  if (!asked || unmanagedPropertyWork(asked) || RENTAL.test(asked)) return false;
  if (/\?/.test(asked)) return true;
  return /\b(what|when|where|who|how|which|find|look up|search|hours)\b/i.test(asked);
}

export async function answerOutsideRentals(text: string): Promise<{ kind: "lookup" | "refused"; body: string } | null> {
  if (unmanagedPropertyWork(text)) return { kind: "refused", body: UNMANAGED_REFUSAL };
  if (!asksOpenLookup(text)) return null;
  return { kind: "lookup", body: await answerWebLookup(text) };
}
