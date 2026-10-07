import { sendGmailNew } from "../adminApi/gmail.js";
import { sendTwilioSms } from "../twilioSms.js";
import { twilioReady } from "./cleanText.js";
import { addMessage, flagChatNeedsYou, readGmailLogin } from "./store.js";
import { captureDraft, captureReport } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import type { CopilotSkill } from "./types.js";

export type PartnerChannel = "app" | "email" | "text";

export type PartnerDelivery = {
  channel: PartnerChannel;
  to: string;
  subject: string;
  body: string;
  pdfName?: string;
  pdfText?: string;
};

const deliveries: PartnerDelivery[] = [];
let textConfigured = false;
let partnerEmail: string | null = null;

export function resetPartnerDeliveries(): void {
  deliveries.length = 0;
  textConfigured = false;
  partnerEmail = null;
}

export function capturedPartnerDeliveries(): PartnerDelivery[] {
  return deliveries.map((row) => ({ ...row }));
}

export function setTextChannel(on: boolean): void {
  textConfigured = on;
}

export function setPartnerMailbox(email: string | null): void {
  partnerEmail = email;
}

export const TEXT_MISSING = "Text is not configured yet. Nothing was texted.";
export const MAIL_MISSING = "Gmail is not connected, so nothing was emailed.";

export function asksThirdParty(blob: string): boolean {
  return /\b(email|text|message|send) (the|a) (guest|client|building|host)\b/i.test(blob)
    || /\b(the|a) (guest|client|building) (an email|a text|a message)\b/i.test(blob);
}

export function channelsFor(skill: Pick<CopilotSkill, "name" | "when_text" | "drafts" | "phone">): PartnerChannel[] {
  const blob = `${skill.name} ${skill.when_text} ${skill.drafts}`;
  const channels: PartnerChannel[] = ["app"];
  if (/\bemail me\b/i.test(blob)) channels.push("email");
  if (/\btext me\b/i.test(blob) || (Boolean(skill.phone.trim()) && /\btext\b/i.test(blob))) channels.push("text");
  return channels;
}

async function mailbox(): Promise<string> {
  if (parityEnabled()) return partnerEmail?.trim() ?? "";
  const login = await readGmailLogin().catch(() => null);
  return login?.email?.trim() ?? "";
}

function textReady(): boolean {
  if (parityEnabled()) return textConfigured;
  return twilioReady();
}

/**
 * Partner delivery only. A test run must not call this.
 * A missing channel is named. Another channel is not used in its place.
 */
export async function deliverToPartners(input: {
  skill: CopilotSkill;
  headline: string;
  text: string;
  channels: PartnerChannel[];
  pdf?: { filename: string; bytes: Uint8Array; plain: string };
}): Promise<{ notes: string[] }> {
  const notes: string[] = [];
  const body = input.text.trim();
  if (!body) return { notes: ["There was nothing to deliver."] };
  if (input.channels.includes("app")) {
    if (parityEnabled()) {
      captureReport({ headline: input.headline, text: body, needs_you: false, title: input.headline, summary: "For the partners." });
    } else if (input.skill.chat_id) {
      await addMessage({
        chatId: input.skill.chat_id,
        role: "assistant",
        body,
        report: { title: input.headline, summary: "For the partners.", sections: [], failed: null },
      });
      await flagChatNeedsYou(input.skill.chat_id).catch(() => undefined);
    }
    notes.push("Posted in the app.");
  }
  if (input.channels.includes("email")) {
    const to = await mailbox();
    if (!to) notes.push(MAIL_MISSING);
    else if (parityEnabled()) {
      deliveries.push({
        channel: "email",
        to,
        subject: input.headline,
        body,
        pdfName: input.pdf?.filename,
        pdfText: input.pdf?.plain,
      });
      notes.push(`Emailed to ${to}.`);
    } else {
      await sendGmailNew({ to, subject: input.headline, body, pdf: input.pdf });
      notes.push(`Emailed to ${to}.`);
    }
  }
  if (input.channels.includes("text")) {
    if (!textReady()) notes.push(TEXT_MISSING);
    else if (!input.skill.phone.trim()) notes.push("No partner number is on this skill, so nothing was texted.");
    else if (parityEnabled()) {
      deliveries.push({ channel: "text", to: input.skill.phone, subject: input.headline, body });
      notes.push("Texted the partner.");
    } else {
      const sent = await sendTwilioSms({
        accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
        authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
        from: process.env.TWILIO_PHONE_NUMBER?.trim() ?? "",
        to: input.skill.phone,
        body: body.slice(0, 1400),
      });
      notes.push(sent.ok ? "Texted the partner." : sent.error || TEXT_MISSING);
    }
  }
  return { notes };
}

export function waitingDraft(body: string, to = ""): { text: string } {
  if (parityEnabled()) {
    captureDraft({ channel: "email", to, subject: "Waiting for you", body, warnings: [], needs_you: true });
  }
  return { text: "Waiting for a partner to submit. Nothing was sent." };
}
