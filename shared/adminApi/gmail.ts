import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionFromRequest, verifyAdminSessionToken } from "../adminAuth.js";
import { isAirbnbNotification, mailKeywords, type MailFolder } from "../copilot/mailScope.js";
import { readGmailLogin, saveGmailLogin } from "../copilot/store.js";
import { captureCommit } from "../copilot/parity/capture.js";
import { parityEnabled } from "../copilot/parity/flag.js";
import { parityGmailOffer, parityReadMailThread, paritySearchGmail } from "../copilot/parity/world.js";

const REDIRECT = "https://admin.mandelrealtygroup.com/api/admin/gmail/callback";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const BACK = "https://admin.mandelrealtygroup.com/copilot";

function clientId(): string {
  return process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() ?? "";
}

export function gmailKeysReady(): boolean {
  return Boolean(clientId() && clientSecret());
}

export async function gmailConnected(): Promise<boolean> {
  if (parityEnabled()) return true;
  return Boolean(await readGmailLogin());
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "";
}

function signState(): string {
  const payload = String(Date.now());
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function stateOk(state: string): boolean {
  const key = secret();
  const [payload, sig] = state.split(".");
  if (!key || !payload || !sig) return false;
  const age = Date.now() - Number(payload);
  if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) return false;
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signedIn(req: VercelRequest): boolean {
  const cookie = req.headers.cookie;
  return verifyAdminSessionToken(getSessionFromRequest(typeof cookie === "string" ? cookie : undefined));
}

function go(res: VercelResponse, url: string) {
  res.setHeader("Location", url);
  return res.status(302).end();
}

export default async function handleGmail(req: VercelRequest, res: VercelResponse) {
  const op = String(req.query.op ?? "");
  if (!signedIn(req)) return go(res, BACK);
  if (!gmailKeysReady()) return go(res, `${BACK}?gmail=nokeys`);

  if (op === "start") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId());
    url.searchParams.set("redirect_uri", REDIRECT);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", signState());
    return go(res, url.toString());
  }

  if (op === "callback") {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !stateOk(state)) return go(res, `${BACK}?gmail=failed`);
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId(),
          client_secret: clientSecret(),
          redirect_uri: REDIRECT,
          grant_type: "authorization_code",
        }),
      });
      const token = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
      const previous = await readGmailLogin();
      const refresh = token.refresh_token?.trim() || previous?.refreshToken || "";
      if (!tokenRes.ok || !refresh) return go(res, `${BACK}?gmail=failed`);
      let email = previous?.email ?? "";
      if (token.access_token) {
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const profile = (await profileRes.json().catch(() => ({}))) as { emailAddress?: string };
        if (profile.emailAddress) email = profile.emailAddress;
      }
      await saveGmailLogin(refresh, email);
      return go(res, `${BACK}?gmail=connected`);
    } catch {
      return go(res, `${BACK}?gmail=failed`);
    }
  }

  return res.status(404).json({ error: "Unknown Gmail step." });
}

export type InboxOffer = {
  from: string;
  email: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
  rfcId: string;
  body: string;
};

async function accessToken(): Promise<string> {
  const login = await readGmailLogin();
  if (!login || !gmailKeysReady()) throw new Error("Gmail isn't connected.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: login.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !data.access_token) throw new Error("Gmail didn't accept the sign-in. Click Connect again.");
  return data.access_token;
}

function header(headers: { name?: string; value?: string }[] | undefined, name: string): string {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

function person(from: string): { name: string; email: string } {
  const email = from.match(/<([^>]+)>/)?.[1]?.trim() || from.trim();
  const name = from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || email;
  return { name, email };
}

function decodePart(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function plainText(part: { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodePart(part.body.data);
  for (const child of part.parts ?? []) {
    const text = plainText(child as { mimeType?: string; body?: { data?: string }; parts?: unknown[] });
    if (text) return text;
  }
  return "";
}

const PRIMARY = "in:inbox category:primary -category:social -category:promotions";
const SENT = "in:sent";

export type GmailHit = {
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

export type GmailLetter = GmailHit & { body: string };

function gmailQuery(folder: MailFolder, keywords: string, includeAirbnb: boolean, after = ""): string {
  const scope = folder === "sent" ? SENT : PRIMARY;
  const airbnb = includeAirbnb ? "" : "-from:airbnb.com";
  const since = after ? `after:${after}` : "";
  return [scope, airbnb, since, keywords].filter(Boolean).join(" ");
}

type GmailPayload = {
  headers?: { name?: string; value?: string }[];
  mimeType?: string;
  body?: { data?: string };
  parts?: unknown[];
};

type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayload;
};

async function gmailGet(token: string, id: string, format: "metadata" | "full"): Promise<GmailMessage | null> {
  const headers = format === "metadata" ? "&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date" : "";
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=${format}${headers}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as GmailMessage | null;
}

function gmailWhen(msg: GmailMessage): string {
  const dated = header(msg.payload?.headers, "Date");
  if (dated) return dated;
  const ms = Number(msg.internalDate);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function gmailHit(msg: GmailMessage, folder: MailFolder): GmailHit | null {
  const who = person(header(msg.payload?.headers, "From"));
  if (!msg.id) return null;
  return {
    id: msg.id,
    threadId: msg.threadId || msg.id,
    folder,
    from: who.name,
    email: who.email,
    to: header(msg.payload?.headers, "To"),
    date: gmailWhen(msg),
    subject: header(msg.payload?.headers, "Subject") || "(no subject)",
    snippet: (msg.snippet ?? "").replace(/\s+/g, " ").trim().slice(0, 280),
  };
}

function gmailFolder(labels: string[]): MailFolder | null {
  const set = new Set(labels);
  if (set.has("CATEGORY_SOCIAL") || set.has("CATEGORY_PROMOTIONS")) return null;
  if (set.has("SENT")) return "sent";
  if (!set.has("INBOX")) return null;
  if (set.has("CATEGORY_UPDATES") || set.has("CATEGORY_FORUMS")) return null;
  return "inbox";
}

export async function searchGmail(input: {
  keywords: string;
  where: MailFolder | "both";
  includeAirbnb: boolean;
  /** Gmail after: date, YYYY/MM/DD. Empty lists without a date. */
  after?: string;
}): Promise<GmailHit[]> {
  const parity = paritySearchGmail(input);
  if (parity) return parity;
  const token = await accessToken();
  const keywords = mailKeywords(input.keywords);
  const folders: MailFolder[] = input.where === "both" ? ["sent", "inbox"] : [input.where];
  const hits: GmailHit[] = [];
  for (const folder of folders) {
    const q = gmailQuery(folder, keywords, input.includeAirbnb, input.after ?? "");
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const list = (await listRes.json().catch(() => ({}))) as { messages?: { id: string; threadId?: string }[]; error?: { message?: string } };
    if (!listRes.ok) throw new Error(list.error?.message || "Gmail didn't return that search.");
    for (const item of list.messages ?? []) {
      const msg = await gmailGet(token, item.id, "metadata");
      if (!msg) continue;
      if (!msg.threadId && item.threadId) msg.threadId = item.threadId;
      const hit = gmailHit(msg, folder);
      if (!hit) continue;
      if (!input.includeAirbnb && isAirbnbNotification(hit.email)) continue;
      const labels = msg.labelIds ?? [];
      if (labels.length && gmailFolder(labels) !== folder) continue;
      hits.push(hit);
    }
  }
  return hits.slice(0, 16);
}

async function gmailThreadMessages(token: string, id: string): Promise<GmailMessage[]> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(id)}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { messages?: GmailMessage[] } | null;
  return data?.messages ?? [];
}

function gmailLetter(msg: GmailMessage): GmailLetter | null {
  const labels = msg.labelIds ?? [];
  const set = new Set(labels);
  if (set.has("CATEGORY_SOCIAL") || set.has("CATEGORY_PROMOTIONS")) return null;
  const folder = gmailFolder(labels) ?? (set.has("SENT") ? "sent" : "inbox");
  const hit = gmailHit(msg, folder);
  if (!hit) return null;
  return { ...hit, body: plainText(msg.payload).replace(/\s+/g, " ").trim().slice(0, 4000) };
}

/** The whole chain. A message id opens its thread. A thread id opens the chain when the message read misses. */
export async function readGmailThread(id: string, includeAirbnb: boolean): Promise<GmailLetter[]> {
  if (parityEnabled()) {
    const letters = parityReadMailThread("gmail", id);
    if (!letters.length) throw new Error("Gmail didn't return that message.");
    const kept = includeAirbnb ? letters : letters.filter((row) => !isAirbnbNotification(row.email));
    if (!kept.length) throw new Error("That Airbnb notice stays out of this search.");
    return kept;
  }
  const token = await accessToken();
  const opened = await gmailGet(token, id, "full");
  const threadKey = opened?.threadId || id;
  let raw = await gmailThreadMessages(token, threadKey);
  if (!raw.length && opened) raw = [opened];
  if (!raw.length && threadKey !== id) raw = await gmailThreadMessages(token, id);
  const letters = raw
    .map((msg) => gmailLetter(msg))
    .filter((row): row is GmailLetter => Boolean(row))
    .filter((row) => includeAirbnb || !isAirbnbNotification(row.email));
  if (letters.length) return letters;
  if (opened) {
    const hit = gmailHit(opened, gmailFolder(opened.labelIds ?? []) ?? "inbox");
    if (hit && !includeAirbnb && isAirbnbNotification(hit.email)) throw new Error("That Airbnb notice stays out of this search.");
    if (!gmailFolder(opened.labelIds ?? [])) throw new Error("That message isn't in Sent or the Primary inbox.");
  }
  throw new Error("Gmail didn't return that message.");
}

export async function readGmailMessage(id: string, includeAirbnb: boolean): Promise<GmailLetter> {
  const letters = await readGmailThread(id, includeAirbnb);
  return letters.find((row) => row.id === id) ?? letters[letters.length - 1];
}

export async function latestInboxOffer(): Promise<InboxOffer | null> {
  if (parityEnabled()) return parityGmailOffer();
  const token = await accessToken();
  const login = await readGmailLogin();
  const q = "in:inbox category:primary newer_than:3d -category:promotions -category:social -from:airbnb.com";
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = (await listRes.json().catch(() => ({}))) as { messages?: { id: string; threadId: string }[] };
  if (!listRes.ok) return null;
  for (const item of list.messages ?? []) {
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const msg = (await msgRes.json().catch(() => ({}))) as {
      snippet?: string;
      threadId?: string;
      payload?: { headers?: { name?: string; value?: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown[] };
    };
    if (!msgRes.ok) continue;
    const from = header(msg.payload?.headers, "From");
    const who = person(from);
    if (!who.email || who.email.toLowerCase() === (login?.email ?? "").toLowerCase()) continue;
    if (/no-?reply|notifications?@|mailer-daemon|newsletter/i.test(who.email)) continue;
    if (isAirbnbNotification(who.email)) continue;
    return {
      from: who.name,
      email: who.email,
      subject: header(msg.payload?.headers, "Subject") || "(no subject)",
      snippet: (msg.snippet ?? "").replace(/\s+/g, " ").trim(),
      threadId: msg.threadId || item.threadId,
      messageId: item.id,
      rfcId: header(msg.payload?.headers, "Message-ID"),
      body: plainText(msg.payload).slice(0, 4000),
    };
  }
  return null;
}

export async function sendGmailReply(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  rfcId?: string;
}): Promise<void> {
  if (parityEnabled()) {
    captureCommit("gmail", input.to);
    return;
  }
  const token = await accessToken();
  const subject = /^re:/i.test(input.subject) ? input.subject : `Re: ${input.subject}`;
  const headers = [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
  ];
  if (input.rfcId) {
    headers.push(`In-Reply-To: ${input.rfcId}`, `References: ${input.rfcId}`);
  }
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: input.threadId || undefined }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    if (res.status === 403 || /insufficient/i.test(err.error?.status ?? "")) {
      throw new Error("Gmail can read mail, but sending isn't allowed yet. Click Connect again and allow sending.");
    }
    throw new Error("Gmail didn't send it. Nothing went out.");
  }
}

/** A new message to a partner, with an optional PDF. Parity delivery does not call this. */
export async function sendGmailNew(input: {
  to: string;
  subject: string;
  body: string;
  pdf?: { filename: string; bytes: Uint8Array };
}): Promise<void> {
  if (parityEnabled()) throw new Error("Parity does not send Gmail.");
  const token = await accessToken();
  const headers = [`To: ${input.to}`, `Subject: ${input.subject}`, "MIME-Version: 1.0"];
  let rawBody: string;
  if (input.pdf) {
    const boundary = "copilot-pdf";
    headers.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
    const file = Buffer.from(input.pdf.bytes).toString("base64");
    rawBody = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${input.pdf.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${input.pdf.filename}"`,
      "",
      file,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=utf-8");
    rawBody = input.body;
  }
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${rawBody}`).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error("Gmail didn't send it. Nothing went out.");
}
