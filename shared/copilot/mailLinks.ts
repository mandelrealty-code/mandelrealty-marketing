/**
 * The links in an email, read from its HTML (the address a link goes to, never the words shown for it), and the rules for
 * which of them the agent may open: only a link on the sender's own domain.
 */

export type MailLink = { url: string; text: string };

function entities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#x2F;/gi, "/");
}

/** Every http(s) link in an HTML body, with the words shown for it. mailto, tel and in-page links are left out. */
export function extractLinks(html: string): MailLink[] {
  const seen = new Set<string>();
  const out: MailLink[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = entities((match[1] ?? match[2] ?? "").trim());
    if (!/^https?:\/\//i.test(raw) || seen.has(raw)) continue;
    seen.add(raw);
    const text = entities(match[3]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 120);
    out.push({ url: raw.slice(0, 1500), text });
    if (out.length >= 40) break;
  }
  return out;
}

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "on"]);

/** The registrable part of a host: walmart.ca for www.walmart.ca and e.walmart.ca. */
export function registrable(host: string): string {
  const labels = host.toLowerCase().replace(/^\.+|\.+$/g, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const last = labels.at(-1)!;
  const second = labels.at(-2)!;
  return last.length === 2 && SECOND_LEVEL.has(second) ? labels.slice(-3).join(".") : labels.slice(-2).join(".");
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function senderDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : registrable(email.slice(at + 1).replace(/[>\s]+$/g, ""));
}

/** True only when the link is on the sender's own domain: a walmart.ca link in a walmart.ca email. */
export function onSenderDomain(url: string, senderEmail: string): boolean {
  const sender = senderDomain(senderEmail);
  const host = hostOf(url);
  return Boolean(sender && host && registrable(host) === sender);
}

export const SHORTENERS = /^(?:bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|lnkd\.in|buff\.ly|rebrand\.ly|is\.gd|cutt\.ly|shorturl\.at|tiny\.cc|t\.ly|rb\.gy|fb\.me|amzn\.to|youtu\.be)$/i;

/** A link that does something when opened rather than shows something: never followed. */
export const ACTION_LINK = /unsubscribe|opt-?out|\/cancel|cancel-|confirm-?(?:email|subscription)|\/delete|remove-?me|log-?out|sign-?out|\/optout/i;
