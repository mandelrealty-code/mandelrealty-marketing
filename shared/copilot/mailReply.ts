import { latestInboxOffer, sendGmailReply, type InboxOffer } from "../adminApi/gmail.js";
import { latestOutlookOffer, sendOutlookReply } from "../adminApi/outlook.js";
import { readGmailOffer, saveGmailOffer, type GmailOffer } from "./store.js";

const MAIL = /\b(emails?|inbox|gmail|outlook)\b/i;
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

function line(offer: { from: string; subject: string }, mailbox: "gmail" | "outlook"): string {
  const who = offer.from.trim() || "Someone";
  const subject = offer.subject.trim() || "an email";
  const where = mailbox === "outlook" ? " in Outlook" : " in Gmail";
  return `${who} wrote about ${subject}${where}. Want me to reply?`;
}

export async function mailQuestion(text = ""): Promise<{ body: string; choices: string[] } | { body: string }> {
  const onlyOutlook = /\boutlook\b/i.test(text) && !/\bgmail\b/i.test(text);
  const onlyGmail = /\bgmail\b/i.test(text) && !/\boutlook\b/i.test(text);
  let gmailOffer: InboxOffer | null = null;
  let outlookOffer: Awaited<ReturnType<typeof latestOutlookOffer>> = null;
  let gmailDown = false;
  let outlookDown = false;
  let failed = false;
  if (!onlyOutlook) {
    try {
      gmailOffer = await latestInboxOffer();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/isn't connected|Connect again/i.test(message)) gmailDown = true;
      else failed = true;
    }
  }
  if (!onlyGmail) {
    try {
      outlookOffer = await latestOutlookOffer();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/isn't connected|Connect again/i.test(message)) outlookDown = true;
      else failed = true;
    }
  }
  const mailbox: "gmail" | "outlook" | null = outlookOffer && (onlyOutlook || !gmailOffer) ? "outlook" : gmailOffer ? "gmail" : null;
  const offer = mailbox === "outlook" ? outlookOffer : gmailOffer;
  if (!offer || !mailbox) {
    if (failed) return { body: "I couldn't read the inbox just now. I didn't guess." };
    if ((onlyOutlook && outlookDown) || (onlyGmail && gmailDown) || (gmailDown && outlookDown)) {
      const name = onlyOutlook ? "Outlook" : onlyGmail ? "Gmail" : "A mailbox";
      return { body: `${name} isn't connected, so I can't see the inbox. Click Connect in Settings. I didn't guess.` };
    }
    return { body: "Nothing in the inbox from the last 3 days needs a reply. I didn't guess." };
  }
  await saveGmailOffer({ ...offer, mailbox });
  return { body: line(offer, mailbox), choices: ["Yes, draft a reply", "Not now"] };
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

export async function mailDraftFromOffer(hint = ""): Promise<{
  body: string;
  draft?: { subject: string; body: string; to: string; threadId: string; replyMessageId: string; mailbox: "gmail" | "outlook" };
}> {
  const wantOutlook = /in Outlook|\boutlook\b/i.test(hint) && !/in Gmail/i.test(hint);
  if (wantOutlook) {
    try {
      const live = await latestOutlookOffer();
      if (live) await saveGmailOffer({ ...live, mailbox: "outlook" });
    } catch {
      /* Use the offer already saved. */
    }
  } else if (/in Gmail|\bgmail\b/i.test(hint)) {
    try {
      const live = await latestInboxOffer();
      if (live) await saveGmailOffer({ ...live, mailbox: "gmail" });
    } catch {
      /* Use the offer already saved. */
    }
  }
  const saved = await readGmailOffer();
  if (!saved) return { body: "I don't have an email waiting for a reply. Ask me to check the inbox." };
  const mailbox = saved.mailbox === "outlook" ? "outlook" : "gmail";
  let full: GmailOffer & { body?: string } = saved;
  try {
    if (mailbox === "outlook") {
      const live = await latestOutlookOffer();
      if (live && live.messageId === saved.messageId) full = { ...saved, ...live, mailbox: "outlook" };
    } else {
      const live = await latestInboxOffer();
      if (live && live.messageId === saved.messageId) full = { ...saved, ...live, mailbox: "gmail" };
    }
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
      replyMessageId: mailbox === "outlook" ? saved.messageId : saved.rfcId,
      mailbox,
    },
  };
}

export async function deliverReply(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  rfcId?: string;
  mailbox?: "gmail" | "outlook";
}): Promise<void> {
  if (input.mailbox === "outlook") {
    if (!input.rfcId) throw new Error("Outlook didn't send it. Nothing went out.");
    await sendOutlookReply({ messageId: input.rfcId, body: input.body });
    return;
  }
  await sendGmailReply(input);
}
