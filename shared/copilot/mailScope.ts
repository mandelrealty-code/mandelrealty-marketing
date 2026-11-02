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

/** A message body with its own line breaks: spaces tidied within a line, blank runs cut to one, nothing joined into a wall. */
export function keepLines(text: string): string {
  return text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
