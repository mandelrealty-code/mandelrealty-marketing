/**
 * Mail connectors tell the truth: a stored sign-in that the provider rejects is "Needs re-authorization", never "Connected",
 * and Disconnect always clears what is stored. Nothing calls Google or Microsoft.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { setAirroiValidator } from "../airroi.js";
import { runAgentTurn } from "./agentChat.js";
import { installWorld } from "./parity/world.js";
import { latestSent } from "./mailSearch.js";
import { setBrainModel } from "./brain.js";
import { checkGmailLogin, diagnoseGmail, gmailStatus, latestSentGmail, readGmailThread, searchGmail, setGmailLogger, setGmailValidator } from "../adminApi/gmail.js";
import { checkOutlookLogin, outlookStatus, setOutlookValidator } from "../adminApi/outlook.js";
import { forgetLoginState } from "./mailLoginStatus.js";
import { clearGmailLogin, readGmailLogin, readOutlookLogin, saveGmailLogin, saveOutlookLogin, setParityMailLogin } from "./store.js";
import type { ConnectorRow } from "./types.js";

function fail(label: string): never {
  throw new Error(`Connectors harness failed: ${label}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
process.env.GOOGLE_GMAIL_CLIENT_ID = "test-client-id";
process.env.GOOGLE_GMAIL_CLIENT_SECRET = "test-client-secret";
process.env.MICROSOFT_CLIENT_ID = "test-client-id";
process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
const token = createAdminSessionToken();
const cookie = { cookie: `mrg_admin_session=${encodeURIComponent(token)}` };

async function call(method: "GET" | "POST", body: Record<string, unknown>): Promise<{ status: number; body: { connectors?: ConnectorRow[]; error?: string } }> {
  let status = 0;
  let payload: { connectors?: ConnectorRow[]; error?: string } = {};
  await handleCopilot(
    { method, headers: cookie, body: method === "POST" ? body : {}, query: method === "GET" ? body : {} } as never,
    { status(code: number) { status = code; return this; }, json(next: typeof payload) { payload = next; return this; } } as never,
  );
  return { status, body: payload };
}
const gmailRow = async () => (await call("GET", { op: "boot" })).body.connectors?.find((row) => row.id === "gmail");
const outlookRow = async () => (await call("GET", { op: "boot" })).body.connectors?.find((row) => row.id === "outlook");

// The fixture default is a working connection.
const fixture = await gmailRow();
if (fixture?.statusLabel !== "Connected") fail(`fixture default ${fixture?.statusLabel}`);

// (a) A token is stored, and Google rejects it: the page says so, with a Connect button, never "Connected".
setParityMailLogin("gmail", undefined);
await saveGmailLogin("revoked-refresh-token-not-a-secret", "info@mandelrealtygroup.com");
let asked = 0;
setGmailValidator(async () => {
  asked += 1;
  return "rejected";
});
forgetLoginState();
const rejected = await gmailRow();
if (!rejected) fail("no Gmail row");
if (rejected.statusLabel !== "Needs re-authorization" || rejected.status !== "not_connected") fail(`a rejected token read as ${rejected.statusLabel} / ${rejected.status}`);
if (/^connected/i.test(rejected.statusLabel)) fail("a rejected token was shown as Connected");
if (!rejected.connectUrl || !/gmail\/start/.test(rejected.connectUrl)) fail("no Connect button target on a rejected token");
if (!rejected.canDisconnect) fail("a rejected token can't be disconnected");
if (!/Click Connect/.test(rejected.note ?? "")) fail(`note: ${rejected.note}`);
if (asked !== 1) fail(`the token was checked ${asked} times`);
await gmailRow();
if (asked !== 1) fail("the check was not kept for a minute");
const outcome = await gmailStatus();
if (outcome.state !== "needs_reauth") fail(`status ${outcome.state}`);

// Accepted: Connected. Couldn't reach Google: said plainly, not guessed.
setGmailValidator(async () => "ok");
forgetLoginState();
if ((await gmailRow())?.statusLabel !== "Connected") fail("a good token was not Connected");
setGmailValidator(async () => "unreachable");
forgetLoginState();
const unsure = await gmailRow();
if (!/couldn't verify/i.test(unsure?.statusLabel ?? "")) fail(`unreachable read as ${unsure?.statusLabel}`);

// (b) Disconnect clears the stored token, and the page goes to Not connected with a Connect button.
setGmailValidator(async () => "rejected");
forgetLoginState();
if (!(await readGmailLogin())) fail("setup: no stored token");
const gone = await call("POST", { op: "connector-disconnect", id: "gmail" });
if (gone.status !== 200) fail(`disconnect ${gone.status} ${gone.body.error}`);
if (await readGmailLogin()) fail("disconnect left the stored token");
const after = gone.body.connectors?.find((row) => row.id === "gmail");
if (after?.statusLabel !== "Not connected" || after.canDisconnect || !after.connectUrl) fail(`after disconnect: ${JSON.stringify(after)}`);
if ((await gmailStatus()).state !== "not_connected") fail("status after disconnect");
// A second disconnect with nothing stored is harmless.
if ((await call("POST", { op: "connector-disconnect", id: "gmail" })).status !== 200) fail("disconnecting twice failed");
setGmailValidator(null);

// Outlook follows the same rules.
setParityMailLogin("outlook", undefined);
await saveOutlookLogin("revoked-outlook-token-not-a-secret", "info@mandelrealtygroup.com");
setOutlookValidator(async () => "rejected");
forgetLoginState();
const outlookRejected = await outlookRow();
if (outlookRejected?.statusLabel !== "Needs re-authorization" || !outlookRejected.connectUrl || !outlookRejected.canDisconnect) fail(`outlook rejected: ${JSON.stringify(outlookRejected)}`);
const outlookGone = await call("POST", { op: "connector-disconnect", id: "outlook" });
if (await readOutlookLogin() || outlookGone.body.connectors?.find((row) => row.id === "outlook")?.statusLabel !== "Not connected") fail("outlook disconnect");
setOutlookValidator(null);
if ((await outlookStatus()).state !== "not_connected") fail("outlook status after disconnect");

// A connection that lives on the server can't be disconnected here, and says so.
const env = await call("POST", { op: "connector-disconnect", id: "twilio" });
if (env.status !== 400 || !/set on the server/.test(env.body.error ?? "")) fail(`env connector: ${env.status} ${env.body.error}`);
setParityMailLogin("gmail", undefined);
setParityMailLogin("outlook", undefined);

// The real checks, with Google and Microsoft answered by a stand-in: refused, unreachable, refreshed after a hiccup.
const realFetch = globalThis.fetch;
const login = { refreshToken: "stored-refresh-token-not-a-secret", email: "info@mandelrealtygroup.com" };
function answer(handler: (url: string, count: number) => Response | Promise<Response>): void {
  const counts = new Map<string, number>();
  globalThis.fetch = (async (url: unknown) => {
    const key = String(url);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return handler(key, counts.get(key)!);
  }) as typeof fetch;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
answer((url) => (url.includes("oauth2.googleapis.com") ? json(400, { error: "invalid_grant" }) : json(200, {})));
if ((await checkGmailLogin(login)) !== "rejected") fail("a revoked refresh token (invalid_grant) was not rejected");
answer((url) => (url.includes("oauth2.googleapis.com") ? json(200, { access_token: "a" }) : json(401, {})));
if ((await checkGmailLogin(login)) !== "rejected") fail("a Gmail 401 after a good refresh was not rejected");
answer((url) => (url.includes("oauth2.googleapis.com") ? json(200, { access_token: "a" }) : json(200, { emailAddress: "info@mandelrealtygroup.com" })));
if ((await checkGmailLogin(login)) !== "ok") fail("a working token was not ok");
let tokenTries = 0;
answer((url, count) => {
  if (url.includes("oauth2.googleapis.com")) {
    tokenTries = count;
    return count === 1 ? json(503, {}) : json(200, { access_token: "a" });
  }
  return json(200, {});
});
if ((await checkGmailLogin(login)) !== "ok" || tokenTries !== 2) fail(`the refresh was not retried after a hiccup (${tokenTries} tries)`);
answer((url) => (url.includes("oauth2.googleapis.com") ? json(503, {}) : json(200, {})));
if ((await checkGmailLogin(login)) !== "unreachable") fail("Google down was not reported as unreachable");
globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
if ((await checkGmailLogin(login)) !== "unreachable") fail("a network failure was not reported as unreachable");
answer((url) => (url.includes("login.microsoftonline.com") ? json(400, { error: "invalid_grant" }) : json(200, {})));
if ((await checkOutlookLogin(login)) !== "rejected") fail("Outlook: a revoked refresh token was not rejected");
answer((url) => (url.includes("login.microsoftonline.com") ? json(200, { access_token: "a" }) : json(200, { mail: "info@mandelrealtygroup.com" })));
if ((await checkOutlookLogin(login)) !== "ok") fail("Outlook: a working token was not ok");
globalThis.fetch = realFetch;

// WhatsApp was removed on purpose: no connector row, and nothing in the agent's tools offers it.
const rows = (await call("GET", { op: "boot" })).body.connectors ?? [];
if (rows.some((row) => /whatsapp/i.test(`${row.id} ${row.name} ${row.detail} ${row.note ?? ""}`))) fail("a WhatsApp connector is still listed");
const { agentTools, agentSystem } = await import("./agentChat.js");
if (agentTools().some((tool) => /whatsapp/i.test(`${tool.name} ${tool.description}`))) fail("the agent still offers a WhatsApp tool");
// Cursor was removed too: no connector row, no tool, no model choice.
if (rows.some((row) => /cursor/i.test(`${row.id} ${row.name} ${row.detail} ${row.note ?? ""}`))) fail("a Cursor connector is still listed");
if (agentTools().some((tool) => /cursor/i.test(`${tool.name} ${tool.description}`))) fail("the agent still offers a Cursor tool");
const { WORK_MODELS } = await import("./models.js");
if (WORK_MODELS.some((model) => /cursor/i.test(`${model.id} ${model.name} ${model.line}`))) fail("a Cursor model choice is still offered");
if (!/never offer to read or send WhatsApp/i.test(agentSystem("", "2026-10-20"))) fail("the agent isn't told WhatsApp is off limits");

// ---------- The agent answers "is airroi connected?" from the live connector state ----------
process.env.AIRROI_API_KEY = "airroi-test-key-not-a-secret";
forgetLoginState();
setAirroiValidator(async () => "ok");
const settings = (await call("GET", { op: "boot" })).body.connectors?.find((row) => row.id === "airroi");
if (settings?.statusLabel !== "Connected" || !settings.checkedAt) fail(`settings: ${JSON.stringify(settings)}`);
let toolNames: string[] = [];
let round = 0;
function scriptedBrain(): void {
  round = 0;
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    round += 1;
    toolNames = (request.tools ?? []).map((tool) => tool.name);
    if (round === 1) {
      const input = { name: "airroi" };
      return { text: "", toolUses: [{ id: "c1", name: "connector_status", input }], blocks: [{ type: "tool_use", id: "c1", name: "connector_status", input }], stop: "tool_use" };
    }
    const last = request.messages!.at(-1)!;
    const raw = Array.isArray(last.content) ? last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("") : "";
    const row = (JSON.parse(raw) as { connectors: { connected: boolean; needsReauthorization: boolean; state: string }[] }).connectors[0]!;
    const text = row.needsReauthorization ? "AirROI needs re-authorization." : row.connected ? "Yes, AirROI is connected." : "No, AirROI is not connected.";
    return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
  });
}
scriptedBrain();
const yes = await runAgentTurn({ chatId: "c", text: "is airroi connected?" });
if (yes.body !== "Yes, AirROI is connected.") fail(`the agent said: ${yes.body}`);
if (!yes.steps.includes("Checked what is connected")) fail("the agent did not check the connectors");
for (const tool of ["connector_status", "market_comps"]) if (!toolNames.includes(tool)) fail(`the agent lacks ${tool}`);
// A key AirROI refuses is not "connected", in Settings or in the agent's answer.
forgetLoginState();
setAirroiValidator(async () => "rejected");
const refused = (await call("GET", { op: "boot" })).body.connectors?.find((row) => row.id === "airroi");
if (refused?.statusLabel !== "Needs re-authorization" || refused.status !== "not_connected") fail(`a refused key read as ${refused?.statusLabel}`);
scriptedBrain();
const reauth = await runAgentTurn({ chatId: "c", text: "is airroi connected?" });
if (reauth.body !== "AirROI needs re-authorization.") fail(`the agent said: ${reauth.body}`);
// Not set at all.
delete process.env.AIRROI_API_KEY;
setAirroiValidator(null);
forgetLoginState();
scriptedBrain();
const none = await runAgentTurn({ chatId: "c", text: "is airroi connected?" });
if (none.body !== "No, AirROI is not connected.") fail(`the agent said: ${none.body}`);
// An unknown connector is named plainly, with the real list.
const { agentTools: toolsNow } = await import("./agentChat.js");
let unknown = "";
try {
  await toolsNow().find((tool) => tool.name === "connector_status")!.run({ name: "carrier pigeon" }, "c");
} catch (err) {
  unknown = err instanceof Error ? err.message : "";
}
if (!/no connector called/.test(unknown) || !/Gmail/.test(unknown)) fail(`unknown connector: ${unknown}`);
setBrainModel(null);
if (!/call connector_status/.test((await import("./agentChat.js")).agentSystem("", "2026-10-20"))) fail("the agent isn't told to read connector state");

// ---------- "What was the last thing I sent?" is the newest message in Sent, from the mailbox that was asked ----------
const mail = (id: string, mailbox: "gmail" | "outlook", folder: "sent" | "inbox", date: string, to: string, subject: string) => ({
  id, mailbox, folder, from: "Mandel Realty Group", email: "info@mandelrealtygroup.com", to, date, subject, snippet: subject, body: subject, airbnb: false,
});
installWorld({
  now: new Date("2026-10-31T15:00:00-04:00"),
  properties: [],
  reservations: [],
  gmail: [
    // Oldest first, and an inbox message newer than all of them: neither may fool the answer.
    mail("g-oct26", "gmail", "sent", "2026-10-26T14:00:00Z", "Manik <manik@example.com>", "Re: parking question"),
    mail("g-oct30", "gmail", "sent", "2026-10-30T15:30:00Z", "Supervisor <supervisor@bluejaysway.example>", "Unit 318 registration, Oct 30 to Nov 1"),
    mail("g-oct28", "gmail", "sent", "2026-10-28T13:00:00Z", "Priya <priya@example.com>", "Welcome to Unit 318"),
    mail("g-in-nov1", "gmail", "inbox", "2026-11-01T09:00:00Z", "info@mandelrealtygroup.com", "Thanks!"),
  ],
  outlook: [mail("o-oct31", "outlook", "sent", "2026-10-31T12:00:00Z", "Owner <owner@example.com>", "September statement")],
  memory: [],
  items: [],
});
setParityMailLogin("gmail", undefined);
setParityMailLogin("outlook", undefined);
const newest = await latestSent();
if (newest.message?.id !== "g-oct30" || newest.answeredFrom !== "Gmail" || newest.message.mailboxLabel !== "Gmail" || newest.note) fail(`last sent: ${JSON.stringify(newest)}`);
if (!/October 30, 2026/.test(newest.message.when ?? "")) fail(`when: ${newest.message.when}`);
if ((await latestSent({ mailbox: "outlook" })).message?.id !== "o-oct31") fail("Outlook's newest sent");
// Searching returns newest first across both mailboxes, each named for its mailbox.
const searched = await agentTools().find((tool) => tool.name === "search_mail")!.run({ keywords: "mandel" }, "c") as { hits: { id: string; mailboxLabel: string; mailbox: string }[] };
if (searched.hits[0]?.id !== "g-in-nov1" || searched.hits.some((hit) => hit.mailboxLabel !== (hit.mailbox === "gmail" ? "Gmail" : "Outlook"))) fail(`search order or labels: ${JSON.stringify(searched.hits.map((hit) => [hit.id, hit.mailboxLabel]))}`);
if (searched.hits.map((hit) => hit.id).join() !== "g-in-nov1,o-oct31,g-oct30,g-oct28,g-oct26") fail(`not newest first across mailboxes: ${searched.hits.map((hit) => hit.id).join()}`);
// Gmail can't be read: the answer says so and names Outlook. It is never presented as Gmail.
setParityMailLogin("gmail", null);
const fellBack = await latestSent();
if (fellBack.answeredFrom !== "Outlook" || fellBack.message?.mailboxLabel !== "Outlook" || !/Gmail couldn't be read/.test(fellBack.note) || !/from Outlook, not Gmail/.test(fellBack.note)) fail(`fallback: ${JSON.stringify(fellBack)}`);
setParityMailLogin("outlook", null);
const neither = await latestSent();
if (neither.message || neither.answeredFrom || !/Gmail:/.test(neither.note) || !/Outlook:/.test(neither.note)) fail(`neither mailbox: ${JSON.stringify(neither)}`);
setParityMailLogin("gmail", undefined);
setParityMailLogin("outlook", undefined);
// Through the agent: the answer comes from the tool, and names the mailbox.
function mailBrain(): void {
  let step = 0;
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    step += 1;
    if (step === 1) return { text: "", toolUses: [{ id: "m1", name: "last_sent_email", input: {} }], blocks: [{ type: "tool_use", id: "m1", name: "last_sent_email", input: {} }], stop: "tool_use" };
    const last = request.messages!.at(-1)!;
    const raw = Array.isArray(last.content) ? last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("") : "";
    const result = JSON.parse(raw) as LatestSentShape;
    const text = `${result.note ? `${result.note} ` : ""}The last email sent was from ${result.answeredFrom}: "${result.message?.subject}" to ${result.message?.to}, ${result.message?.when}.`;
    return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
  });
}
type LatestSentShape = { answeredFrom: string; note: string; message: { subject: string; to: string; when: string } | null };
mailBrain();
const said = await runAgentTurn({ chatId: "c", text: "what was the last thing I sent?" });
if (!/from Gmail: "Unit 318 registration, Oct 30 to Nov 1" to Supervisor/.test(said.body) || /Manik|Oct(ober)? 26/.test(said.body)) fail(`the agent said: ${said.body}`);
setParityMailLogin("gmail", null);
mailBrain();
const saidFallback = await runAgentTurn({ chatId: "c", text: "what was the last thing I sent?" });
if (!/Gmail couldn't be read/.test(saidFallback.body) || !/from Outlook/.test(saidFallback.body)) fail(`the agent hid the fallback: ${saidFallback.body}`);
setParityMailLogin("gmail", undefined);
setBrainModel(null);
if (!/call last_sent_email/.test((await import("./agentChat.js")).agentSystem("", "2026-10-20"))) fail("the agent isn't told how to find the last sent email");
if (!agentTools().some((tool) => tool.name === "last_sent_email")) fail("no last_sent_email tool");

// ---------- The real Gmail requests, against a stand-in Gmail with dated mail ----------
// Parity answers from fixtures, so the request itself is only exercised with parity off for this block. The stand-in lists oldest
// first on purpose: the answer must come from the dates, never from list order.
type StandIn = { id: string; threadId: string; internalDate: string; labels: string[]; subject: string; to: string; body: string };
const day = (iso: string) => String(Date.parse(iso));
const BOX: StandIn[] = [
  { id: "s-oct25", threadId: "t318", internalDate: day("2026-10-25T14:00:00Z"), labels: ["SENT"], subject: "Unit 318 parking", to: "Manik <manik@example.com>", body: "oct 25 body words" },
  { id: "s-oct28", threadId: "t-priya", internalDate: day("2026-10-28T13:00:00Z"), labels: ["SENT"], subject: "Welcome to Unit 318", to: "Priya <priya@example.com>", body: "oct 28 body words" },
  { id: "s-oct30", threadId: "t318", internalDate: day("2026-10-30T15:30:00Z"), labels: ["SENT", "CATEGORY_PROMOTIONS"], subject: "Unit 318 registration, Oct 30 to Nov 1", to: "Supervisor <supervisor@bluejaysway.example>", body: "oct 30 body words" },
  { id: "i-nov1", threadId: "t-in", internalDate: day("2026-11-01T09:00:00Z"), labels: ["INBOX", "CATEGORY_PERSONAL"], subject: "Thanks", to: "info@mandelrealtygroup.com", body: "nov 1 inbox body words" },
];
const rfc = (ms: string) => new Date(Number(ms)).toUTCString();
const asMessage = (row: StandIn, format: string) => ({
  id: row.id,
  threadId: row.threadId,
  labelIds: row.labels,
  internalDate: row.internalDate,
  snippet: row.body.slice(0, 20),
  payload: {
    mimeType: "text/plain",
    headers: [{ name: "From", value: "Mandel Realty Group <info@mandelrealtygroup.com>" }, { name: "To", value: row.to }, { name: "Subject", value: row.subject }, { name: "Date", value: rfc(row.internalDate) }],
    ...(format === "full" ? { body: { data: Buffer.from(row.body).toString("base64url") } } : {}),
  },
});
const gmailSeen: { url: string; params: URLSearchParams }[] = [];
let failGet = "";
let failThread = false;
function gmailStandIn(): void {
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    if (url.host === "oauth2.googleapis.com") return json(200, { access_token: "access-token-xyz" });
    if (url.host !== "gmail.googleapis.com") return json(404, {});
    const path = url.pathname.replace("/gmail/v1/users/me", "");
    if (path === "/messages") {
      gmailSeen.push({ url: url.pathname, params: url.searchParams });
      const q = url.searchParams.get("q") ?? "";
      const label = url.searchParams.get("labelIds") ?? "";
      const words = q.replace(/\b(in|category|label|is|has):\S+/g, " ").replace(/-\w+:\S+/g, " ").split(/\s+/).filter(Boolean);
      const wantsSent = /\bin:sent\b/.test(q) || label === "SENT";
      const rows = BOX.filter((row) => (wantsSent ? row.labels.includes("SENT") : /\bin:inbox\b/.test(q) ? row.labels.includes("INBOX") : true)).filter((row) => words.every((word) => `${row.subject} ${row.to}`.toLowerCase().includes(word.toLowerCase())));
      const cap = Number(url.searchParams.get("maxResults") ?? "100");
      // Oldest first, adversarially: a real list is newest first, and the code must not rely on either.
      return json(200, { messages: rows.slice(0, cap).map((row) => ({ id: row.id, threadId: row.threadId })), resultSizeEstimate: rows.length });
    }
    const message = /^\/messages\/(.+)$/.exec(path);
    if (message) {
      if (message[1] === failGet) return json(500, {});
      const row = BOX.find((item) => item.id === message[1]);
      return row ? json(200, asMessage(row, url.searchParams.get("format") ?? "metadata")) : json(404, {});
    }
    const thread = /^\/threads\/(.+)$/.exec(path);
    if (thread) {
      if (failThread) return json(500, {});
      const rows = BOX.filter((item) => item.threadId === thread[1]).sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
      return rows.length ? json(200, { messages: rows.map((row) => asMessage(row, "full")) }) : json(404, {});
    }
    return json(404, {});
  }) as typeof fetch;
}
const wasParity = process.env.COPILOT_PARITY;
const gmailLines: Record<string, unknown>[] = [];
process.env.COPILOT_PARITY = "0";
try {
  await saveGmailLogin("stand-in-refresh-token-not-a-secret", "info@mandelrealtygroup.com");
  gmailStandIn();
  setGmailLogger((line) => gmailLines.push(line));
  const latest = await latestSentGmail();
  if (latest.id !== "s-oct30") fail(`the newest sent message was ${latest.id}`);
  const found = await searchGmail({ keywords: "Unit 318", where: "sent", includeAirbnb: false });
  if (found.map((hit) => hit.id).join() !== "s-oct30,s-oct28,s-oct25") fail(`search order: ${found.map((hit) => hit.id).join()}`);
  // The request itself: Sent only, the keywords, the cap, no label filter, no page token, no date bound.
  const listed = gmailSeen.filter((row) => row.params.get("q")?.includes("Unit 318"))[0];
  if (listed?.params.get("q") !== "in:sent -from:airbnb.com Unit 318" || listed.params.get("maxResults") !== "8" || listed.params.has("labelIds") || listed.params.has("pageToken") || /after:|before:|newer_than|older_than/.test(listed.params.get("q") ?? "")) fail(`the sent query: ${JSON.stringify([...(listed?.params.entries() ?? [])])}`);
  const logText = gmailLines.map((line) => JSON.stringify(line)).join("\n");
  if (!/"gmail":"list"[^}]*"q":"in:sent -from:airbnb.com Unit 318"[^}]*"maxResults":8[^}]*"labelIds":""[^}]*"pageToken":false[^}]*"status":200[^}]*"returned":3/.test(logText)) fail(`the log lacks the exact list parameters:\n${logText}`);
  if (!/"newest":"2026-10-30T15:30:00.000Z"/.test(logText)) fail("the log lacks the newest date returned");
  if (/access-token-xyz|stand-in-refresh|body words|manik@|supervisor@/i.test(logText)) fail("the log leaked a credential, a body or an address");
  // A message you sent is in Sent even when Gmail also tagged it with a category (Promotions here).
  if (found[0]?.folder !== "sent") fail("the Oct 30 message was not read as sent");
  // The newest message can't be read: say so, never answer with an older one.
  failGet = "s-oct30";
  let unreadable = "";
  try {
    await searchGmail({ keywords: "Unit 318", where: "sent", includeAirbnb: false });
  } catch (err) {
    unreadable = err instanceof Error ? err.message : "";
  }
  if (!/newest may be missing/.test(unreadable)) fail(`an unreadable newest message was skipped: ${unreadable}`);
  let latestError = "";
  try {
    await latestSentGmail();
  } catch (err) {
    latestError = err instanceof Error ? err.message : "";
  }
  if (!/can't say which is the latest/.test(latestError)) fail(`latest with an unreadable message: ${latestError}`);
  failGet = "";
  // A thread that won't load is not a one-message thread.
  failThread = true;
  let threadError = "";
  try {
    await readGmailThread("s-oct25", true);
  } catch (err) {
    threadError = err instanceof Error ? err.message : "";
  }
  if (!/newer messages in it may be missing/.test(threadError)) fail(`a failed thread read fell back silently: ${threadError}`);
  failThread = false;
  // read_mail shows the whole chain, so the Oct 30 reply can't hide behind the Oct 25 message it replies to.
  const readOld = (await agentTools().find((tool) => tool.name === "read_mail")?.run({ mailbox: "gmail", id: "s-oct25" }, "c")) as { thisIsTheNewest: boolean; newestInThread: { id: string }; threadSize: number; mailboxLabel: string } | undefined;
  if (!readOld || readOld.thisIsTheNewest || readOld.newestInThread.id !== "s-oct30" || readOld.threadSize !== 2 || readOld.mailboxLabel !== "Gmail") fail(`read_mail hid the newer reply: ${JSON.stringify(readOld)}`);
  // The diagnosis lists the same folder four ways, and each one has the newest.
  const diagnosis = await diagnoseGmail("Unit 318");
  if (diagnosis.newest !== "s-oct30" || diagnosis.probes.length !== 5 || diagnosis.probes.some((probe) => !probe.hasNewest)) fail(`diagnosis: ${JSON.stringify(diagnosis.probes.map((probe) => [probe.name, probe.hasNewest]))}`);
} finally {
  globalThis.fetch = realFetch;
  setGmailLogger(null);
  await clearGmailLogin();
  if (wasParity === undefined) delete process.env.COPILOT_PARITY;
  else process.env.COPILOT_PARITY = wasParity;
}

console.log("Connectors harness passed.");
