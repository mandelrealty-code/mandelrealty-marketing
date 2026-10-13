/**
 * A Checks card is labelled from its own record: who it goes to, the subject, the purpose.
 * The label must agree with the card's To and Subject, so a card can never be introduced as the
 * building email while it holds a reply to someone else. Browser-safe: the card reads this at render.
 */

import { BLUE_JAYS_CONTACTS } from "./processFacts.js";

type DraftLike = { to?: string; subject?: string; body?: string; channel?: string };

const REGISTRATION_SUBJECT = /\b(airbnb rental for unit|registration|register (?:these|this) vehicles?)\b/i;

function recipients(to: string): string[] {
  return to.split(/[,;]+/).map((item) => (/<([^>]+)>/.exec(item)?.[1] ?? item).trim().toLowerCase()).filter(Boolean);
}

/** A building vehicle-registration email, by its own To and Subject. */
export function isRegistrationDraft(draft: DraftLike | null | undefined): boolean {
  if (!draft || (draft.channel && draft.channel !== "email")) return false;
  const to = recipients(draft.to ?? "");
  const building = to.length > 0 && to.every((email) => BLUE_JAYS_CONTACTS.includes(email));
  const subject = REGISTRATION_SUBJECT.test(draft.subject ?? "");
  return subject || (building && /\b(vehicle|car|plate|parking|p4-62)\b/i.test(draft.body ?? ""));
}

const CLAIMS_REGISTRATION = /\b(building email|registration email|vehicle registration|parking email)\b/i;

/** The email card's label, read from the record it holds. */
export function emailCardLabel(stored: string, draft: DraftLike | null | undefined): string {
  if (!draft) return stored;
  const registration = isRegistrationDraft(draft);
  if (registration && stored.trim()) return stored;
  if (registration) return "Here is the building vehicle registration email. Nothing was sent.";
  if (!stored.trim() || CLAIMS_REGISTRATION.test(stored)) {
    const to = (draft.to ?? "").trim();
    const subject = (draft.subject ?? "").trim();
    return `Here is the email${to ? ` to ${to}` : ""}${subject ? `, “${subject}”` : ""}. Nothing was sent.`;
  }
  return stored;
}
