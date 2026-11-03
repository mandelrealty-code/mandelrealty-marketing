/**
 * The one way Copilot texts a partner. It goes only to a partner's own number on file, never at night unless it is urgent,
 * never without a reason the partner or a saved skill gave it, and every text it sends is logged for review.
 */

import { toE164 } from "../followUpSequences.js";
import { sendTwilioSms } from "../twilioSms.js";
import { twilioReady } from "./cleanText.js";
import { withoutHubSecrets } from "./hubSecrets.js";
import { parityNow } from "./parity/clock.js";
import { parityEnabled } from "./parity/flag.js";
import { addTextLog, listTextLog, listTextNumbers } from "./store.js";
import { quietHours } from "./time.js";

export type TextResult =
  | { sent: true; to: string; note: string }
  | { sent: false; reason: "not-configured" | "no-number" | "not-partner" | "ambiguous" | "quiet-hours" | "rate-limit" | "empty" | "twilio"; note: string };

type Recorder = (row: { to: string; subject: string; body: string }) => void;
let recorder: Recorder | null = null;
let parityReady: (() => boolean) | null = null;

/** Parity: where a text is recorded instead of sent, and whether the text channel counts as configured. */
export function setTextRecorder(next: Recorder | null, ready: (() => boolean) | null): void {
  recorder = next;
  parityReady = ready;
}

const LOG_PREFIX = "Text to ";
const PER_HOUR = 12;
const MAX_BODY = 600;

/** Each partner's own number, as kept in Settings. */
export async function partnerNumbers(): Promise<string[]> {
  const rows = await listTextNumbers().catch(() => [] as string[]);
  return [...new Set(rows.map((phone) => toE164(phone)).filter((phone): phone is string => Boolean(phone)))];
}

const mask = (phone: string) => `the number ending ${phone.slice(-4)}`;

export function textChannelReady(): boolean {
  return parityEnabled() ? Boolean(parityReady?.()) : twilioReady();
}

export async function sendPartnerText(input: { to?: string; body: string; urgent?: boolean; askedNow?: boolean; skillId?: string }): Promise<TextResult> {
  const clean = withoutHubSecrets(input.body.replace(/\s+/g, " ").trim()).text.slice(0, MAX_BODY);
  if (!clean) return { sent: false, reason: "empty", note: "There was nothing to text." };
  if (!textChannelReady()) return { sent: false, reason: "not-configured", note: "Text is not configured yet. Nothing was texted." };
  const numbers = await partnerNumbers();
  if (!numbers.length) return { sent: false, reason: "no-number", note: "No partner number is on file, so nothing was texted. Add one in Settings." };
  let to = "";
  if (input.to?.trim()) {
    const asked = toE164(input.to) ?? "";
    if (!asked || !numbers.includes(asked)) {
      return { sent: false, reason: "not-partner", note: "That isn't a partner number on file, so I didn't text it. I only text the partners' own numbers." };
    }
    to = asked;
  } else if (numbers.length === 1) {
    to = numbers[0]!;
  } else {
    return { sent: false, reason: "ambiguous", note: `There are ${numbers.length} partner numbers on file (${numbers.map(mask).join(", ")}). Which one?` };
  }
  const now = parityNow() ?? new Date();
  // A partner asking in the chat is awake and asking now. Anything a saved skill sends on its own keeps the night quiet.
  if (!input.askedNow && !input.urgent && quietHours(now)) {
    return { sent: false, reason: "quiet-hours", note: "It's quiet hours (10 PM to 8 AM Toronto), so this wasn't texted. Nothing was lost: it is in the app." };
  }
  const lastHour = (await listTextLog().catch(() => [])).filter((row) => row.unit.startsWith(LOG_PREFIX) && now.getTime() - Date.parse(row.created_at) < 3_600_000);
  if (lastHour.length >= PER_HOUR) return { sent: false, reason: "rate-limit", note: `That's ${PER_HOUR} texts in the last hour, so I stopped. Nothing more was texted.` };
  if (parityEnabled()) recorder?.({ to, subject: "", body: clean });
  else {
    const sent = await sendTwilioSms({
      accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
      authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
      from: toE164(process.env.TWILIO_PHONE_NUMBER ?? "") ?? process.env.TWILIO_PHONE_NUMBER?.trim() ?? "",
      to,
      body: clean,
    });
    if (!sent.ok) return { sent: false, reason: "twilio", note: `Twilio didn't send it: ${sent.error || "no reason given"}. Nothing was texted.` };
  }
  // Every text is written down: who, when and the first 100 characters. A log that can't be written never hides a sent text.
  await addTextLog({ skill_id: (input.skillId || null) as unknown as string, unit: `${LOG_PREFIX}${to}`, body: clean.slice(0, 100), link: "" }).catch(() => undefined);
  return { sent: true, to, note: `Texted ${mask(to)}.` };
}

/** What was texted lately, newest first, for the partner to review. */
export async function recentTexts(limit = 20): Promise<{ to: string; at: string; preview: string }[]> {
  return (await listTextLog().catch(() => []))
    .filter((row) => row.unit.startsWith(LOG_PREFIX))
    .slice(0, limit)
    .map((row) => ({ to: row.unit.slice(LOG_PREFIX.length), at: row.created_at, preview: row.body }));
}

/** The partner asked for a text, in their own words. */
export function asksForText(words: string): boolean {
  return /\b(?:text|sms)\b|\bsend (?:it |that |this |the \w+ )?to (?:me|my phone)\b|\bsend me\b|\bmy (?:phone|cell)\b|\bping me\b|\bnotify me\b/i.test(words);
}
