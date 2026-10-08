import { gmailConnected, readGmailThread, searchGmail } from "../adminApi/gmail.js";
import { outlookConnected, readOutlookThread, searchOutlook } from "../adminApi/outlook.js";
import { mailKeywords, type MailFolder, type MailboxName } from "./mailScope.js";

export type MailHit = {
  mailbox: MailboxName;
  id: string;
  threadId: string;
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

/** Recent inbox mail, with no keyword filter. `after` is a Gmail after: date, YYYY/MM/DD. */
export async function listInbox(mailbox: "gmail" | "outlook", after = ""): Promise<{ hits: MailHit[]; notes: string[] }> {
  const hits: MailHit[] = [];
  const notes: string[] = [];
  if (mailbox === "gmail") {
    if (!(await gmailConnected().catch(() => false))) return { hits, notes: ["Gmail isn't connected."] };
    try {
      const rows = await searchGmail({ keywords: "", where: "inbox", includeAirbnb: false, after });
      for (const row of rows) hits.push({ mailbox: "gmail", ...row });
    } catch (err) {
      notes.push(err instanceof Error ? err.message : "Gmail didn't return the inbox.");
    }
    return { hits, notes };
  }
  if (!(await outlookConnected().catch(() => false))) return { hits, notes: ["Outlook isn't connected."] };
  try {
    const rows = await searchOutlook({ keywords: "", where: "inbox", includeAirbnb: false });
    for (const row of rows) hits.push({ mailbox: "outlook", ...row });
  } catch (err) {
    notes.push(err instanceof Error ? err.message : "Outlook didn't return the inbox.");
  }
  return { hits, notes };
}

/** Every message in the chain, oldest first. A thread id works when the message id does not. */
export async function readMailThread(input: { mailbox?: string; id?: string; includeAirbnb?: boolean }): Promise<MailLetter[]> {
  const id = String(input.id ?? "").trim();
  const mailbox = input.mailbox === "outlook" ? "outlook" : input.mailbox === "gmail" ? "gmail" : "";
  if (!id || !mailbox) throw new Error("mailbox and id are required.");
  const includeAirbnb = Boolean(input.includeAirbnb);
  if (mailbox === "outlook") {
    if (!(await outlookConnected().catch(() => false))) throw new Error("Outlook isn't connected.");
    const letters = await readOutlookThread(id, includeAirbnb);
    return letters.map((letter) => ({ mailbox, ...letter }));
  }
  if (!(await gmailConnected().catch(() => false))) throw new Error("Gmail isn't connected.");
  const letters = await readGmailThread(id, includeAirbnb);
  return letters.map((letter) => ({ mailbox, ...letter }));
}

export async function readMail(input: { mailbox?: string; id?: string; includeAirbnb?: boolean }): Promise<MailLetter> {
  const letters = await readMailThread(input);
  const id = String(input.id ?? "").trim();
  return letters.find((row) => row.id === id) ?? letters[letters.length - 1];
}
