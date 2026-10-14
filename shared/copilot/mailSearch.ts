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
  /** The same instant in Toronto time, as every answer prints it: "Tuesday, October 13, 2026 at 9:58 PM". */
  when?: string;
  subject: string;
  snippet: string;
};

export type MailLetter = MailHit & { body: string };

/** "Tuesday, October 13, 2026 at 9:58 PM", Toronto, from any timestamp; the sender's clock never leaks through. */
export function torontoWhen(date: string): string {
  const at = new Date(date);
  if (!date || Number.isNaN(at.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at);
  return `${day} at ${time}`;
}

function withWhen<T extends { date: string }>(row: T): T & { when: string } {
  return { ...row, when: torontoWhen(row.date) };
}

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
        for (const row of rows) hits.push(withWhen({ mailbox: "gmail" as const, ...row }));
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
        for (const row of rows) hits.push(withWhen({ mailbox: "outlook" as const, ...row }));
      } catch (err) {
        notes.push(err instanceof Error ? err.message : "Outlook didn't return that search.");
      }
    }
  }
  return { hits, notes };
}

/** Recent inbox mail, with no keyword filter. `after` is a Gmail after: date, YYYY/MM/DD. */
export async function listInbox(mailbox: "gmail" | "outlook", after = "", limit = 0): Promise<{ hits: MailHit[]; notes: string[] }> {
  const hits: MailHit[] = [];
  const notes: string[] = [];
  if (mailbox === "gmail") {
    if (!(await gmailConnected().catch(() => false))) return { hits, notes: ["Gmail isn't connected."] };
    try {
      const rows = await searchGmail({ keywords: "", where: "inbox", includeAirbnb: false, after, ...(limit > 0 ? { limit } : {}) });
      for (const row of rows) hits.push({ mailbox: "gmail", ...row });
    } catch (err) {
      notes.push(err instanceof Error ? err.message : "Gmail didn't return the inbox.");
    }
    return { hits, notes };
  }
  if (!(await outlookConnected().catch(() => false))) return { hits, notes: ["Outlook isn't connected."] };
  try {
    const rows = await searchOutlook({ keywords: "", where: "inbox", includeAirbnb: false, ...(limit > 0 ? { limit } : {}) });
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
    return letters.map((letter) => withWhen({ mailbox, ...letter }));
  }
  if (!(await gmailConnected().catch(() => false))) throw new Error("Gmail isn't connected.");
  const letters = await readGmailThread(id, includeAirbnb);
  return letters.map((letter) => withWhen({ mailbox, ...letter }));
}

export async function readMail(input: { mailbox?: string; id?: string; includeAirbnb?: boolean }): Promise<MailLetter> {
  const letters = await readMailThread(input);
  const id = String(input.id ?? "").trim();
  return letters.find((row) => row.id === id) ?? letters[letters.length - 1];
}
