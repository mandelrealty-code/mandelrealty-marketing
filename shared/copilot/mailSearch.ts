import { gmailConnected, readGmailMessage, searchGmail } from "../adminApi/gmail.js";
import { outlookConnected, readOutlookMessage, searchOutlook } from "../adminApi/outlook.js";
import { mailKeywords, type MailFolder, type MailboxName } from "./mailScope.js";

export type MailHit = {
  mailbox: MailboxName;
  id: string;
  folder: MailFolder;
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
};

export type MailLetter = MailHit & { body: string };

export async function searchMail(input: {
  keywords: string;
  mailbox?: string;
  where?: string;
  includeAirbnb?: boolean;
}): Promise<{ hits: MailHit[]; notes: string[] }> {
  const keywords = mailKeywords(input.keywords);
  if (keywords.length < 2) return { hits: [], notes: ["Say what to look for in the mail."] };
  const mailbox = input.mailbox === "gmail" || input.mailbox === "outlook" ? input.mailbox : "both";
  const where: MailFolder | "both" = input.where === "sent" || input.where === "inbox" ? input.where : "both";
  const includeAirbnb = Boolean(input.includeAirbnb) || /\bairbnb\b/i.test(keywords);
  const hits: MailHit[] = [];
  const notes: string[] = [];
  if (mailbox !== "outlook") {
    if (!(await gmailConnected().catch(() => false))) notes.push("Gmail isn't connected.");
    else {
      try {
        const rows = await searchGmail({ keywords, where, includeAirbnb });
        for (const row of rows) hits.push({ mailbox: "gmail", ...row });
      } catch (err) {
        notes.push(err instanceof Error ? err.message : "Gmail didn't return that search.");
      }
    }
  }
  if (mailbox !== "gmail") {
    if (!(await outlookConnected().catch(() => false))) notes.push("Outlook isn't connected.");
    else {
      try {
        const rows = await searchOutlook({ keywords, where, includeAirbnb });
        for (const row of rows) hits.push({ mailbox: "outlook", ...row });
      } catch (err) {
        notes.push(err instanceof Error ? err.message : "Outlook didn't return that search.");
      }
    }
  }
  return { hits, notes };
}

export async function readMail(input: { mailbox?: string; id?: string; includeAirbnb?: boolean }): Promise<MailLetter> {
  const id = String(input.id ?? "").trim();
  const mailbox = input.mailbox === "outlook" ? "outlook" : input.mailbox === "gmail" ? "gmail" : "";
  if (!id || !mailbox) throw new Error("mailbox and id are required.");
  const includeAirbnb = Boolean(input.includeAirbnb);
  if (mailbox === "outlook") {
    if (!(await outlookConnected().catch(() => false))) throw new Error("Outlook isn't connected.");
    const letter = await readOutlookMessage(id, includeAirbnb);
    return { mailbox, ...letter };
  }
  if (!(await gmailConnected().catch(() => false))) throw new Error("Gmail isn't connected.");
  const letter = await readGmailMessage(id, includeAirbnb);
  return { mailbox, ...letter };
}
