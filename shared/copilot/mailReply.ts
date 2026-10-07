import { latestInboxOffer, sendGmailReply, type InboxOffer } from "../adminApi/gmail.js";
import { readGmailOffer, saveGmailOffer, type GmailOffer } from "./store.js";

const MAIL = /\b(emails?|inbox|gmail)\b/i;
const YES = /^(a\.\s*)?(yes|yeah|yep|sure|ok|okay|draft|reply)(\b|[,.])/i;
const NO = /^(b\.\s*)?(no|not now|don't|do not|skip)/i;

export function asksAboutMail(text: string): boolean {
  return MAIL.test(text);
}

export function agreesToReply(text: string, prior: string): boolean {
  return /want me to reply/i.test(prior) && YES.test(text.trim());
}

export function declinesReply(text: string, prior: string): boolean {
  return /want me to reply/i.test(prior) && NO.test(text.trim());
}

function line(offer: { from: string; subject: string }): string {
  const who = offer.from.trim() || "Someone";
  const subject = offer.subject.trim() || "an email";
  return `${who} wrote about ${subject}. Want me to reply?`;
}

export async function mailQuestion(): Promise<{ body: string; choices: string[] } | { body: string }> {
  let offer: InboxOffer | null = null;
  try {
    offer = await latestInboxOffer();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/isn't connected|Connect again/i.test(message)) {
      return { body: "Gmail isn't connected, so I can't see the inbox. Click Connect in Settings. I didn't guess." };
    }
    return { body: "I couldn't read the inbox just now. I didn't guess." };
  }
  if (!offer) return { body: "Nothing in the inbox from the last 3 days needs a reply. I didn't guess." };
  await saveGmailOffer(offer);
  return { body: line(offer), choices: ["Yes, draft a reply", "Not now"] };
}

async function writeBody(offer: GmailOffer & { body?: string }): Promise<string> {
  const letter = (offer.body || offer.snippet || "").slice(0, 3500);
  const system = "Write a short plain-text reply for Mandel Realty Group. Use only facts that are in the email. Do not invent fees, dates, promises, or names. If the email does not say what they need, ask one short question. No subject line and no signature.";
  const user = `From: ${offer.from} <${offer.email}>\nSubject: ${offer.subject}\n\n${letter}`;
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
    if (text) return text;
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (text) return text;
  }
  return "";
}

export async function mailDraftFromOffer(): Promise<{
  body: string;
  draft?: { subject: string; body: string; to: string; threadId: string; replyMessageId: string };
}> {
  const saved = await readGmailOffer();
  if (!saved) return { body: "I don't have an email waiting for a reply. Ask me to check the inbox." };
  let full = saved;
  try {
    const live = await latestInboxOffer();
    if (live && live.messageId === saved.messageId) full = { ...saved, ...live };
  } catch {
    /* The saved subject and snippet are enough to draft. */
  }
  const written = await writeBody(full);
  if (!written) return { body: "I can see the email, but I couldn't write a reply. Nothing was sent." };
  const subject = /^re:/i.test(saved.subject) ? saved.subject : `Re: ${saved.subject}`;
  return {
    body: `Here's a reply to ${saved.from}. Submit sends it. Hold keeps it here.`,
    draft: {
      subject,
      body: written,
      to: saved.email,
      threadId: saved.threadId,
      replyMessageId: saved.rfcId,
    },
  };
}

export async function deliverReply(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  rfcId?: string;
}): Promise<void> {
  await sendGmailReply(input);
}
