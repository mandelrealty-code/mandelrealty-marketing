import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionFromRequest, verifyAdminSessionToken } from "../adminAuth.js";
import { readGmailLogin, saveGmailLogin } from "../copilot/store.js";

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

export async function latestInboxOffer(): Promise<InboxOffer | null> {
  const token = await accessToken();
  const login = await readGmailLogin();
  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=in:inbox newer_than:3d -category:promotions -category:social", {
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
