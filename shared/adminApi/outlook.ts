import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionFromRequest, verifyAdminSessionToken } from "../adminAuth.js";
import { isAirbnbNotification, mailKeywords, type MailFolder } from "../copilot/mailScope.js";
import { readOutlookLogin, saveOutlookLogin } from "../copilot/store.js";

const REDIRECT = "https://admin.mandelrealtygroup.com/api/admin/outlook/callback";
const SCOPE = "offline_access User.Read Mail.Read Mail.Send";
const BACK = "https://admin.mandelrealtygroup.com/copilot";

function clientId(): string {
  return process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
}

function tenant(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "mandelrealtygroup.com";
}

export function outlookKeysReady(): boolean {
  return Boolean(clientId() && clientSecret());
}

export async function outlookConnected(): Promise<boolean> {
  return Boolean(await readOutlookLogin());
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "";
}

function signState(): string {
  const payload = String(Date.now());
  const sig = createHmac("sha256", secret()).update(`outlook|${payload}`).digest("hex");
  return `${payload}.${sig}`;
}

function stateOk(state: string): boolean {
  const key = secret();
  const [payload, sig] = state.split(".");
  if (!key || !payload || !sig) return false;
  const age = Date.now() - Number(payload);
  if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) return false;
  const expected = createHmac("sha256", key).update(`outlook|${payload}`).digest("hex");
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

function opOf(req: VercelRequest): string {
  const named = String(req.query.op ?? "");
  if (named) return named;
  const url = String(req.url ?? "");
  if (url.includes("/callback")) return "callback";
  if (url.includes("/start")) return "start";
  return "";
}

export default async function handleOutlook(req: VercelRequest, res: VercelResponse) {
  const op = opOf(req);
  if (!signedIn(req)) return go(res, BACK);
  if (!outlookKeysReady()) return go(res, `${BACK}?outlook=nokeys`);

  if (op === "start") {
    const url = new URL(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId());
    url.searchParams.set("redirect_uri", REDIRECT);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", signState());
    return go(res, url.toString());
  }

  if (op === "callback") {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !stateOk(state)) return go(res, `${BACK}?outlook=failed`);
    try {
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId(),
          client_secret: clientSecret(),
          redirect_uri: REDIRECT,
          grant_type: "authorization_code",
          scope: SCOPE,
        }),
      });
      const token = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
      const previous = await readOutlookLogin();
      const refresh = token.refresh_token?.trim() || previous?.refreshToken || "";
      if (!tokenRes.ok || !refresh) return go(res, `${BACK}?outlook=failed`);
      let email = previous?.email ?? "";
      if (token.access_token) {
        const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const profile = (await profileRes.json().catch(() => ({}))) as { mail?: string; userPrincipalName?: string };
        email = profile.mail?.trim() || profile.userPrincipalName?.trim() || email;
      }
      await saveOutlookLogin(refresh, email);
      return go(res, `${BACK}?outlook=connected`);
    } catch {
      return go(res, `${BACK}?outlook=failed`);
    }
  }

  return res.status(404).json({ error: "Unknown Outlook step." });
}

export type OutlookOffer = {
  from: string;
  email: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
  rfcId: string;
  body: string;
  receivedAt: string;
};

async function accessToken(): Promise<string> {
  const login = await readOutlookLogin();
  if (!login || !outlookKeysReady()) throw new Error("Outlook isn't connected.");
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: login.refreshToken,
      grant_type: "refresh_token",
      scope: SCOPE,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !data.access_token) throw new Error("Outlook didn't accept the sign-in. Click Connect again.");
  return data.access_token;
}

type OutlookAddress = { emailAddress?: { name?: string; address?: string } };

type OutlookMessage = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  conversationId?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  parentFolderId?: string;
  inferenceClassification?: string;
  from?: OutlookAddress;
  toRecipients?: OutlookAddress[];
  body?: { content?: string; contentType?: string };
};

export type OutlookHit = {
  id: string;
  folder: MailFolder;
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
};

export type OutlookLetter = OutlookHit & { body: string };

const OUTLOOK_SELECT = "id,from,toRecipients,subject,bodyPreview,receivedDateTime,sentDateTime,inferenceClassification,parentFolderId";

function outlookHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' };
}

function outlookTo(rows: OutlookAddress[] | undefined): string {
  return (rows ?? [])
    .map((row) => row.emailAddress?.address?.trim() || row.emailAddress?.name?.trim() || "")
    .filter(Boolean)
    .join(", ");
}

function outlookHit(item: OutlookMessage, folder: MailFolder): OutlookHit | null {
  const address = item.from?.emailAddress?.address?.trim() ?? "";
  const name = item.from?.emailAddress?.name?.trim() || address;
  if (!item.id) return null;
  return {
    id: item.id,
    folder,
    from: name,
    email: address,
    to: outlookTo(item.toRecipients),
    date: item.sentDateTime || item.receivedDateTime || "",
    subject: item.subject?.trim() || "(no subject)",
    snippet: (item.bodyPreview ?? "").replace(/\s+/g, " ").trim().slice(0, 280),
  };
}

function outlookInboxOk(item: OutlookMessage): boolean {
  const kind = item.inferenceClassification?.toLowerCase();
  return kind !== "other";
}

async function outlookFolderId(token: string, name: "inbox" | "sentitems"): Promise<string> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${name}?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  if (!res.ok || !data.id) throw new Error("Outlook didn't return that folder.");
  return data.id;
}

export async function searchOutlook(input: {
  keywords: string;
  where: MailFolder | "both";
  includeAirbnb: boolean;
}): Promise<OutlookHit[]> {
  const token = await accessToken();
  const keywords = mailKeywords(input.keywords);
  if (!keywords) return [];
  const folders: MailFolder[] = input.where === "both" ? ["sent", "inbox"] : [input.where];
  const hits: OutlookHit[] = [];
  for (const folder of folders) {
    const name = folder === "sent" ? "sentitems" : "inbox";
    const url = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders/${name}/messages`);
    url.searchParams.set("$search", `"${keywords}"`);
    url.searchParams.set("$top", "8");
    url.searchParams.set("$select", OUTLOOK_SELECT);
    const listRes = await fetch(url, { headers: { ...outlookHeaders(token), ConsistencyLevel: "eventual" } });
    const list = (await listRes.json().catch(() => ({}))) as { value?: OutlookMessage[]; error?: { message?: string } };
    if (!listRes.ok) throw new Error(list.error?.message || "Outlook didn't return that search.");
    for (const item of list.value ?? []) {
      if (folder === "inbox" && !outlookInboxOk(item)) continue;
      const hit = outlookHit(item, folder);
      if (!hit) continue;
      if (!input.includeAirbnb && isAirbnbNotification(hit.email)) continue;
      hits.push(hit);
    }
  }
  return hits.slice(0, 16);
}

export async function readOutlookMessage(id: string, includeAirbnb: boolean): Promise<OutlookLetter> {
  const token = await accessToken();
  const [inboxId, sentId] = await Promise.all([outlookFolderId(token, "inbox"), outlookFolderId(token, "sentitems")]);
  const url = new URL(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}`);
  url.searchParams.set("$select", `${OUTLOOK_SELECT},body`);
  const res = await fetch(url, { headers: outlookHeaders(token) });
  const item = (await res.json().catch(() => ({}))) as OutlookMessage & { error?: { message?: string } };
  if (!res.ok) throw new Error(item.error?.message || "Outlook didn't return that message.");
  const folder: MailFolder | null = item.parentFolderId === sentId ? "sent" : item.parentFolderId === inboxId ? "inbox" : null;
  if (!folder) throw new Error("That message isn't in Sent or the Focused inbox.");
  if (folder === "inbox" && !outlookInboxOk(item)) throw new Error("That message is in Outlook Other, so it stays out of this search.");
  const hit = outlookHit(item, folder);
  if (!hit) throw new Error("Outlook didn't return that message.");
  if (!includeAirbnb && isAirbnbNotification(hit.email)) throw new Error("That Airbnb notice stays out of this search.");
  const html = item.body?.contentType === "html";
  const text = html ? (item.bodyPreview ?? "") : (item.body?.content ?? item.bodyPreview ?? "");
  return { ...hit, body: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000) };
}

export async function latestOutlookOffer(): Promise<OutlookOffer | null> {
  const token = await accessToken();
  const login = await readOutlookLogin();
  const sinceMs = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages");
  url.searchParams.set("$top", "15");
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$select", "id,from,subject,bodyPreview,body,conversationId,internetMessageId,receivedDateTime,inferenceClassification");
  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
  });
  const list = (await listRes.json().catch(() => ({}))) as {
    value?: {
      id?: string;
      subject?: string;
      bodyPreview?: string;
      conversationId?: string;
      internetMessageId?: string;
      receivedDateTime?: string;
      inferenceClassification?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
      body?: { content?: string; contentType?: string };
    }[];
  };
  if (!listRes.ok) throw new Error("Outlook didn't return the inbox. I didn't guess.");
  for (const item of list.value ?? []) {
    if (item.receivedDateTime && Date.parse(item.receivedDateTime) < sinceMs) continue;
    if (item.inferenceClassification?.toLowerCase() === "other") continue;
    const address = item.from?.emailAddress?.address?.trim() ?? "";
    const name = item.from?.emailAddress?.name?.trim() || address;
    if (!address || address.toLowerCase() === (login?.email ?? "").toLowerCase()) continue;
    if (/no-?reply|notifications?@|mailer-daemon|newsletter/i.test(address)) continue;
    if (isAirbnbNotification(address)) continue;
    const html = item.body?.contentType === "html";
    const text = html ? (item.bodyPreview ?? "") : (item.body?.content ?? item.bodyPreview ?? "");
    return {
      from: name,
      email: address,
      subject: item.subject?.trim() || "(no subject)",
      snippet: (item.bodyPreview ?? "").replace(/\s+/g, " ").trim(),
      threadId: item.conversationId || item.id || "",
      messageId: item.id || "",
      rfcId: item.internetMessageId || "",
      body: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
      receivedAt: item.receivedDateTime || "",
    };
  }
  return null;
}

export async function sendOutlookMail(input: { to: string; subject: string; body: string }): Promise<void> {
  const token = await accessToken();
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
    }),
  });
  if (!res.ok && res.status !== 202) {
    if (res.status === 403) throw new Error("Outlook can read mail, but sending isn't allowed yet. Click Connect again and allow sending.");
    throw new Error("Outlook didn't send it. Nothing went out.");
  }
}

export async function sendOutlookReply(input: { messageId: string; body: string }): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(input.messageId)}/reply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment: input.body }),
  });
  if (!res.ok && res.status !== 202) {
    if (res.status === 403) throw new Error("Outlook can read mail, but sending isn't allowed yet. Click Connect again and allow sending.");
    throw new Error("Outlook didn't send it. Nothing went out.");
  }
}
