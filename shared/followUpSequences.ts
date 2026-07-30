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
      `Hey ${first(name)}, it's Mandel Realty Group. Got your free Airbnb makeover application. Grab a free 15-min call here: ${bookUrl}`,
  },
  {
    step: 2,
    delayMinutes: 120,
    body: (name, bookUrl) =>
      `${first(name)}, quick bump from MRG. Spots are limited this quarter. Book your call: ${bookUrl}`,
  },
  {
    step: 3,
    delayMinutes: 60 * 24,
    body: (name, bookUrl) =>
      `Still interested in a free furnish + management makeover, ${first(name)}? Pick a time: ${bookUrl} Reply STOP to opt out.`,
  },
  {
    step: 4,
    delayMinutes: 60 * 72,
    body: (name, bookUrl) =>
      `Last note from MRG, ${first(name)}. Closing your file for now. Reply anytime or book here: ${bookUrl}`,
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
