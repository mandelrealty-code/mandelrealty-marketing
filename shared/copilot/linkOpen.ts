/**
 * Opens a link from an email the agent read, and reads the page. It only follows a link that is really in that email and
 * is on the sender's own domain, never an action link, never a hop off that domain, and it stops at a login wall.
 */

import { parityEnabled } from "./parity/flag.js";
import { readMailThread } from "./mailSearch.js";
import { ACTION_LINK, SHORTENERS, hostOf, onSenderDomain, registrable, senderDomain } from "./mailLinks.js";
import { parseReceipt, type Receipt } from "./receipt.js";

export type Hop = { status: number; url: string; location?: string; html: string };
type Fetcher = (url: string) => Promise<Hop>;
let fetcher: Fetcher | null = null;

/** Test seam: the parity suite serves fixture pages and redirects instead of the live web. */
export function setLinkFetcher(next: Fetcher | null): void {
  fetcher = next;
}

async function liveHop(url: string): Promise<Hop> {
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=0.9" },
    signal: AbortSignal.timeout(15000),
  });
  const location = res.headers.get("location") ?? undefined;
  return { status: res.status, url, ...(location ? { location: new URL(location, url).toString() } : {}), html: res.status >= 300 && res.status < 400 ? "" : (await res.text()).slice(0, 1_500_000) };
}

/** The readable words of a page: scripts and styles gone, one line per block, tables kept as rows. */
export function readable(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|header|footer|table|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .split("\n").map((line) => line.replace(/[ \t ]+/g, " ").replace(/^[\s|]+|[\s|]+$/g, "").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

const LOGIN_PATH = /\/(?:log-?in|sign-?in|signin|account\/login|auth|authorize|identity|sso|oauth|session\/new)(?:[/?#]|$)/i;

export function looksLikeLogin(url: string, html: string, text: string): boolean {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    // An address that won't parse can't be a login path.
  }
  if (LOGIN_PATH.test(path)) return true;
  if (/<input[^>]+type=["']?password/i.test(html)) return true;
  return text.length < 1500 && /\b(?:sign|log)\s?in\b.*\b(?:to (?:view|see|continue|access)|required)\b|\bplease (?:sign|log) in\b/i.test(text);
}

export type OpenResult =
  | { opened: true; url: string; resolvedUrl: string; title: string; receipt: Receipt | null; isReceipt: boolean; text: string }
  | { opened: false; loginRequired?: boolean; reason: string; note: string; destination?: string };

function refuse(reason: string, note: string, extra: { destination?: string; loginRequired?: boolean } = {}): OpenResult {
  return { opened: false, reason, note, ...extra };
}

/**
 * The email is read first and the link must be one of its own links. The page is fetched hop by hop: every hop has to stay
 * on the sender's domain, so a redirect to anywhere else is reported with where it goes and is not followed.
 */
export async function openMailLink(input: { mailbox: string; id: string; url: string; includeAirbnb?: boolean }): Promise<OpenResult> {
  const letters = await readMailThread({ mailbox: input.mailbox, id: input.id, includeAirbnb: input.includeAirbnb });
  const letter = letters.find((row) => row.id === input.id) ?? letters[letters.length - 1];
  if (!letter) return refuse("no-email", "I couldn't read that email, so I didn't open anything.");
  const asked = input.url.trim();
  const strip = (value: string) => value.replace(/#.*$/, "");
  const listed = (letter.links ?? []).find((link) => strip(link.url) === strip(asked));
  if (!listed) return refuse("not-in-email", `That address isn't one of the links in the email, so I didn't open it. Use a link from the email's links list.`);
  const host = hostOf(listed.url);
  if (SHORTENERS.test(host)) return refuse("shortened", `That is a shortened link (${host}). I don't follow those. I haven't opened it.`, { destination: host });
  if (!/^https:\/\//i.test(listed.url)) return refuse("not-https", "That link isn't https, so I didn't open it.");
  if (!onSenderDomain(listed.url, letter.email)) {
    return refuse("other-domain", `The email is from ${senderDomain(letter.email) || letter.email} but this link goes to ${host}. I only open links on the sender's own domain, so I didn't open it.`, { destination: host });
  }
  if (ACTION_LINK.test(listed.url) || ACTION_LINK.test(listed.text)) return refuse("action-link", "That link looks like it does something when opened (unsubscribe, cancel, confirm), so I didn't open it.");
  const sender = senderDomain(letter.email);
  let url = listed.url;
  let page: Hop | null = null;
  for (let hops = 0; hops < 6; hops += 1) {
    const got: Hop | null = await (fetcher ?? (parityEnabled() ? null : liveHop))?.(url).catch(() => null) ?? null;
    if (!got) return refuse("unreachable", "The page didn't open, so I couldn't read it.");
    if (got.location) {
      const next = got.location;
      if (registrable(hostOf(next)) !== sender || !/^https:\/\//i.test(next)) {
        const where = (() => { try { const u = new URL(next); return `${u.hostname}${u.pathname}`.replace(/\/$/, ""); } catch { return next.slice(0, 80); } })();
        return refuse("redirects-away", `This link redirects to ${where}, which isn't ${sender}. I did not follow it. Tell me if you want it opened another way.`, { destination: where });
      }
      if (ACTION_LINK.test(next)) return refuse("action-link", "That link redirects to something that looks like an action (unsubscribe, cancel, confirm), so I stopped.");
      url = next;
      continue;
    }
    page = got;
    break;
  }
  if (!page) return refuse("too-many-redirects", "The link redirected too many times, so I stopped.");
  if (page.status === 401 || page.status === 403) return refuse("login", `The page needs you to sign in (${page.status}). I stopped there. I won't ask for a store password: open it yourself while signed in, or paste what it shows and I'll read it.`, { loginRequired: true });
  if (page.status >= 400) return refuse("error-page", `The page answered ${page.status}, so there was nothing to read.`);
  let text = readable(page.html);
  if (looksLikeLogin(page.url, page.html, text)) return refuse("login", "The page asks you to sign in before it shows the receipt. I stopped there. I won't ask for a store password: open it yourself while signed in, or paste what it shows and I'll read it.", { loginRequired: true });
  if (text.length < 200 && !parityEnabled() && !fetcher) {
    // A page that fills itself in with scripts: the same address is opened in a real browser, and still only on the sender's domain.
    const { researchWeb } = await import("./skillResearch.js");
    const rendered = await researchWeb(page.url);
    if ("text" in rendered && registrable(hostOf(rendered.url)) === sender) {
      if (looksLikeLogin(rendered.url, "", rendered.text)) return refuse("login", "The page asks you to sign in before it shows the receipt. I stopped there. I won't ask for a store password.", { loginRequired: true });
      text = rendered.text;
    }
  }
  if (!text) return refuse("empty", "The page had no readable content.");
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(page.html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const receipt = parseReceipt(text);
  return { opened: true, url: listed.url, resolvedUrl: page.url, title, receipt, isReceipt: Boolean(receipt), text: text.slice(0, receipt ? 1500 : 6000) };
}
