import { BOOK_A_CALL_URL } from "./auditEmails.js";
import { normalizePhoneDigits } from "./leadStore.js";

export type FollowUpSequence = "hot_sms" | "nurture_sms";

export type FollowUpStepDef = {
  step: number;
  /** Minutes after sequence start */
  delayMinutes: number;
  body: (name: string, bookUrl: string) => string;
};

/** Hot path: live Airbnb → push to book a call fast. */
export const HOT_SMS_STEPS: FollowUpStepDef[] = [
  {
    step: 1,
    delayMinutes: 0,
    body: (name, bookUrl) =>
      `Hey ${first(name)}, it's Mandel Realty Group! We help Airbnb hosts fill more nights and earn more — and your free makeover application is in. Book a free 30-min call so we can get to know you and walk you through exactly how it works: ${bookUrl}\nReply STOP to opt out.`,
  },
  {
    step: 2,
    delayMinutes: 120,
    body: (name, bookUrl) =>
      `${first(name)}, quick bump from MRG — spots are limited this quarter, so we'd love to grab 30 minutes with you soon. Book here: ${bookUrl}`,
  },
  {
    step: 3,
    delayMinutes: 60 * 24,
    body: (name, bookUrl) =>
      `Still around, ${first(name)}? We'd genuinely love to talk through how to grow your Airbnb's revenue. Pick a time for a 30-min call: ${bookUrl}\nReply STOP to opt out.`,
  },
  {
    step: 4,
    delayMinutes: 60 * 72,
    body: (name, bookUrl) =>
      `Last note from MRG, ${first(name)}. We're closing your file for now, but the door's always open if you'd like to chat. Book a 30-min call anytime here: ${bookUrl}`,
  },
];

/** Nurture: no listing yet → stay warm, no hard booking push. */
export const NURTURE_SMS_STEPS: FollowUpStepDef[] = [
  {
    step: 1,
    delayMinutes: 0,
    body: (name) =>
      `Hey ${first(name)}, thanks for applying to Mandel Realty Group. Once your Airbnb/STR is ready, reply YES and we'll re-check you for a free makeover.`,
  },
  {
    step: 2,
    delayMinutes: 60 * 24 * 7,
    body: (name, bookUrl) =>
      `${first(name)}, checking in from MRG. If your short-term rental is live now, book a quick call: ${bookUrl} Reply STOP to opt out.`,
  },
  {
    step: 3,
    delayMinutes: 60 * 24 * 30,
    body: (name, bookUrl) =>
      `MRG here, ${first(name)}. Still here when you're ready for a free unit makeover. ${bookUrl}`,
  },
];

function first(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

export function stepsForSequence(sequence: FollowUpSequence): FollowUpStepDef[] {
  return sequence === "hot_sms" ? HOT_SMS_STEPS : NURTURE_SMS_STEPS;
}

export function bookUrlForLead(_leadId?: string | null): string {
  // Google Calendar appointment links ignore our tracking params — keep SMS clean.
  return BOOK_A_CALL_URL;
}

/** Normalize to E.164 for CA/US numbers. Returns null if unusable. */
export function toE164(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function isTwilioConfigured(env: {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      env.TWILIO_PHONE_NUMBER?.trim(),
  );
}
