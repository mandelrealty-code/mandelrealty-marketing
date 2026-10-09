/**
 * Company questions go to their connector or a deterministic read.
 * Web lookup is only for a venue, a product, or other public information.
 */

const UNMANAGED = /\b(1103|1104|2104)\b|\bmarkham\b|partner loft|king st w/i;
const PROPERTY_WORK = /\b(draft|write|send|message|reply|text|email|report|check[\s-]?ins?|check[\s-]?outs?|reservations?|bookings?|guests?|stays?)\b/i;
const RENTAL = /\b(guests?|reservations?|bookings?|check[\s-]?ins?|check[\s-]?outs?|hospitable|airbnb|payouts?|owner statements?|turnovers?|charlotte|roseglor|scarborough|spacious|blue jays|\b606\b|\b318\b|shaw)\b/i;

const MAIL = /\b(e-?mails?|inboxes?|gmail|outlook|mailbox)\b/i;
const STAY = /\b(stays?|check[\s-]?ins?|check[\s-]?outs?|checking[\s-]?in|checking[\s-]?out)\b/i;
const RESERVATION = /\b(reservations?|bookings?)\b/i;
const CLEANER = /\b(cleaner\s+app|turnovers?|no cleaner assigned|cleaner assigned|assign(?:ed)?\s+(?:a\s+)?cleaner)\b/i;
const SOP = /\bsops?\b|\bstandard operating procedures?\b/i;
const PROPOSAL = /\bproposals?\b/i;
const REVENUE = /\brevenues?\b|\bhost revenue\b/i;
const CLIENT = /\bclients?\b/i;
const MEMORY = /\b(remember(?:ed)?|memories|memory)\b/i;

const EXTERNAL_WEB = /\b(look up|look this up|look it up|search the web|search for|on the web|google)\b/i;
const EXTERNAL_PRODUCT = /\b(amazon|walmart|ikea|canadian tire|home depot|facebook marketplace|marketplace)\b/i;
const EXTERNAL_PUBLIC = /\b(box office|venue|stadium|arena|museum|theatre|theater|hours|open to the public)\b/i;

export const UNMANAGED_REFUSAL = "That listing is not one we manage. I didn't draft a message or report on it.";

export type QuestionRoute =
  | "mail"
  | "stay"
  | "reservation"
  | "cleaner"
  | "sop"
  | "proposal"
  | "revenue"
  | "client"
  | "memory"
  | "web"
  | "chat";

export function unmanagedPropertyWork(text: string): boolean {
  const asked = text.trim();
  return UNMANAGED.test(asked) && PROPERTY_WORK.test(asked);
}

/** Mail, stays, reservations, the cleaner app, SOPs, clients, revenue, or remembered facts. */
export function questionRoute(text: string): QuestionRoute {
  const asked = text.trim();
  if (!asked) return "chat";
  if (MAIL.test(asked)) return "mail";
  if (STAY.test(asked)) return "stay";
  if (RESERVATION.test(asked)) return "reservation";
  if (CLEANER.test(asked)) return "cleaner";
  if (SOP.test(asked)) return "sop";
  if (PROPOSAL.test(asked)) return "proposal";
  if (REVENUE.test(asked)) return "revenue";
  if (CLIENT.test(asked)) return "client";
  if (MEMORY.test(asked)) return "memory";
  if (EXTERNAL_PRODUCT.test(asked) || EXTERNAL_PUBLIC.test(asked) || EXTERNAL_WEB.test(asked)) return "web";
  return "chat";
}

export function asksConnector(text: string): boolean {
  const route = questionRoute(text);
  return route !== "web" && route !== "chat";
}

export function asksExternal(text: string): boolean {
  return questionRoute(text) === "web";
}

/** A unit split: what MRG makes and what the host makes. Not a retail price. */
export function asksPayoutSplit(text: string): boolean {
  const asked = text.trim();
  return /\bhow much\b/i.test(asked)
    && /\b(we|mrg)\b/i.test(asked)
    && /\b(host|owner)\b/i.test(asked)
    && /\b(make|take|net|earn)\b/i.test(asked);
}

/** Connector, rental, payout, and unmanaged-listing questions never go to web search. */
export function skipsWeb(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  return unmanagedPropertyWork(asked) || RENTAL.test(asked) || asksConnector(asked) || asksPayoutSplit(asked);
}
