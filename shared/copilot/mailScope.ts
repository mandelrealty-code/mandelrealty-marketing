/** Mailbox scope shared by Gmail and Outlook. Keywords never choose the folder. */

export function isAirbnbNotification(email: string): boolean {
  return /@(?:.+\.)?airbnb\.com$/i.test(email.trim());
}

/** Strip folder operators so a keyword string cannot leave Sent or the main inbox. */
export function mailKeywords(raw: string): string {
  return raw
    .replace(/\b(in|category|label|is|has):[^\s]+/gi, " ")
    .replace(/["'(){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export type MailFolder = "sent" | "inbox";
export type MailboxName = "gmail" | "outlook";
