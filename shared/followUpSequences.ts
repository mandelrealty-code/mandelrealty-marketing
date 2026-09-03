import { BOOK_A_CALL_URL } from "./auditEmails.js";
import { normalizePhoneDigits } from "./leadStore.js";

export type FollowUpSequence = "hot_sms" | "nurture_sms" | "ai_nudge";

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
      `Hey ${first(name)}, it's Mandel Realty Group! We help Airbnb hosts fill more nights and earn more, and your free makeover application is in. Book a free 30-min call so we can get to know you and walk you through exactly how it works: ${bookUrl}\nReply STOP to opt out.`,
  },
  {
    step: 2,
    delayMinutes: 120,
    body: (name, bookUrl) =>
      `${first(name)}, quick bump from MRG, spots are limited this quarter, so we'd love to grab 30 minutes with you soon. Book here: ${bookUrl}`,
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

/** Nurture: education path. Step 2 body is normally built by scheduleEducationNurtureFollowup. */
export const NURTURE_SMS_STEPS: FollowUpStepDef[] = [
  {
    step: 1,
    delayMinutes: 0,
    body: (name) =>
      `Hey ${first(name)}, thanks for applying to Mandel Realty Group. Once your Airbnb/STR is ready, reply YES and we'll re-check you for a free makeover.`,
  },
  {
    step: 2,
    delayMinutes: 60 * 24 * 30,
    body: (name) =>
      `Hey ${first(name)}, checking in from Mandel Realty Group, hope the Airbnb intro was helpful. When you have a place in mind (or questions), reply here and we'll help with the next step.\nReply STOP to opt out.`,
  },
  {
    step: 3,
    delayMinutes: 60 * 24 * 60,
    body: (name) =>
      `MRG here, ${first(name)}. Still here when you're ready, reply anytime.\nReply STOP to opt out.`,
  },
];

function first(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

export function stepsForSequence(sequence: FollowUpSequence): FollowUpStepDef[] {
  if (sequence === "hot_sms") return HOT_SMS_STEPS;
  if (sequence === "nurture_sms") return NURTURE_SMS_STEPS;
  return [];
}

export function bookUrlForLead(_leadId?: string | null): string {
  return BOOK_A_CALL_URL;
}

export function hotSmsBody(step: number, name: string, bookUrl = BOOK_A_CALL_URL): string | null {
  const def = HOT_SMS_STEPS.find((s) => s.step === step);
  if (!def) return null;
  return def.body(name, bookUrl);
}

/** Normalize to E.164 for CA/US numbers. Returns null if unusable. */
export function toE164(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

/** Public marketing / business line (constants.ts) — not Twilio, not a client. */
export const PUBLIC_BUSINESS_PHONE_DIGITS = "6473817325";

/** Digits for our Twilio SMS/voice sender (from env). */
export function twilioSenderDigits(): string {
  return normalizePhoneDigits(process.env.TWILIO_PHONE_NUMBER || "");
}

/** True if this is our Twilio sender number (e.g. +1 289-672-4026). */
export function isTwilioSenderPhone(phone: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(phone || "");
  const twilio = twilioSenderDigits();
  return Boolean(digits && twilio && digits === twilio);
}

/** True if this is the public business line (647-381-7325). */
export function isPublicBusinessPhone(phone: string | null | undefined): boolean {
  return normalizePhoneDigits(phone || "") === PUBLIC_BUSINESS_PHONE_DIGITS;
}

/**
 * Numbers that must never be stored as a lead phone or used as the CRM
 * operator callback: Twilio sender + public business line.
 */
export function isNonClientCompanyPhone(phone: string | null | undefined): boolean {
  return isTwilioSenderPhone(phone) || isPublicBusinessPhone(phone);
}

/** @deprecated use isNonClientCompanyPhone / isTwilioSenderPhone */
export function isCompanyTwilioPhone(phone: string | null | undefined): boolean {
  return isNonClientCompanyPhone(phone);
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
