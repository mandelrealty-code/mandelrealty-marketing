/**
 * "Any new mail today" is answered from the mailbox, not from the web.
 * The answer names who wrote and the subject. It does not paste the message.
 */

import { listInbox, type MailHit } from "./mailSearch.js";
import { asksMailBreakdown } from "./mailChain.js";
import { addDays, torontoToday } from "./time.js";

export function asksInboxToday(text: string): boolean {
  if (asksMailBreakdown(text)) return false;
  const mail = /\b(e-?mails?|inbox|gmail|outlook)\b/i.test(text);
  const fresh = /\b(new|today|tonight|this morning|come in|came in|arrived)\b/i.test(text);
  return mail && fresh;
}

function onToday(value: string, today: string): boolean {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
  return day === today;
}

function speak(hits: MailHit[], where: string): string {
  const noun = hits.length === 1 ? "email" : "emails";
  const lines = hits.map((hit) => `${hit.from.trim() || "Someone"} wrote about ${hit.subject.trim() || "an email"}`);
  return `${hits.length} new ${noun} came in today in ${where}. ${lines.join(". ")}.`;
}

export async function answerInboxToday(text: string): Promise<string | null> {
  if (!asksInboxToday(text)) return null;
  const onlyGmail = /\bgmail\b/i.test(text) && !/\boutlook\b/i.test(text);
  const onlyOutlook = /\boutlook\b/i.test(text) && !/\bgmail\b/i.test(text);
  const boxes: Array<"gmail" | "outlook"> = onlyOutlook ? ["outlook"] : onlyGmail ? ["gmail"] : ["gmail", "outlook"];
  const where = boxes.length === 2 ? "Gmail and Outlook" : boxes[0] === "outlook" ? "Outlook" : "Gmail";
  const today = torontoToday();
  const after = addDays(today, -1).replace(/-/g, "/");
  const hits: MailHit[] = [];
  const notes: string[] = [];
  for (const box of boxes) {
    const found = await listInbox(box, box === "gmail" ? after : "");
    hits.push(...found.hits);
    notes.push(...found.notes);
  }
  const seen = new Set<string>();
  const todays = hits
    .filter((hit) => {
      const key = `${hit.mailbox}:${hit.id}`;
      if (seen.has(key) || !onToday(hit.date, today)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (!todays.length) {
    const down = notes.find((line) => /isn't connected/i.test(line));
    if (down) {
      const name = /outlook/i.test(down) && !/gmail/i.test(down) ? "Outlook" : "Gmail";
      return `${name} isn't connected, so I can't see today's mail. Click Connect in Settings. I didn't guess.`;
    }
    return `No new email came in today in ${where}.`;
  }
  return speak(todays, where);
}
