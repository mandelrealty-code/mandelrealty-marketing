/**
 * Mail connectors tell the truth: a stored sign-in that the provider rejects is "Needs re-authorization", never "Connected",
 * and Disconnect always clears what is stored. Nothing calls Google or Microsoft.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { setAirroiValidator } from "../airroi.js";
import { runAgentTurn } from "./agentChat.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { worldAt, ID } from "./parity/catalog.js";
import { setHospitableLogger } from "../pm/hospitableClient.js";
import { resolveScope } from "./clientProperty.js";
import { diagnoseStays, nextStays, readableUnit } from "./stayLookup.js";
import { readFileSync } from "node:fs";
import { SKILL_TOOL_NAMES } from "./agentChat.js";
import { resetBusinessFacts, saveFact } from "./businessFacts.js";
import { conflictsWith, timeAfter, unitFacts } from "./unitFacts.js";
import { latestSent } from "./mailSearch.js";
import { setBrainModel } from "./brain.js";
import { checkGmailLogin, diagnoseGmail, gmailStatus, latestSentGmail, readGmailThread, searchGmail, setGmailLogger, setGmailValidator } from "../adminApi/gmail.js";
import { checkOutlookLogin, outlookStatus, setOutlookValidator } from "../adminApi/outlook.js";
import { forgetLoginState } from "./mailLoginStatus.js";
import { clearGmailLogin, readGmailLogin, readOutlookLogin, saveGmailLogin, saveOutlookLogin, setParityMailLogin } from "./store.js";
import type { ConnectorRow } from "./types.js";
import { setToolLogger } from "./agentLoop.js";
import { streamPiece, streamStart, streamStep } from "./streamText.js";
import { setParityClock } from "./parity/clock.js";
import { setStayLogger, dayMovements, findStays } from "./stayLookup.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { listMessages } from "./store.js";
import { answerBuildingRegistrationItem } from "./buildingRegistration.js";
import { parityChecksMessages, resetParityChecksMessages } from "./parity/storeStub.js";
import { searchMail } from "./mailSearch.js";

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

// ---------- "What's the next reservation for that unit?" ----------
const stay = (id: string, propertyId: string, guest: string, checkIn: string, checkOut: string, status = "accepted"): ParityReservation => ({ id, code: id.toUpperCase(), propertyId, status, checkIn, checkOut, guest, adults: 2, children: 0, messages: [] });
const stayWorld = worldAt("2026-10-31T12:00:00-04:00");
stayWorld.reservations = [
  stay("r-michelle", ID.blue, "Michelle Sanders", "2026-11-04", "2026-11-07"),
  stay("r-mark", ID.blue, "Mark Bixler", "2026-11-22", "2026-11-28"),
  stay("r-zoe", ID.blue, "Zoe", "2026-11-10", "2026-11-12", "cancelled"),
  stay("r-ola", ID.shaw, "Ola", "2026-11-25", "2026-11-28"),
];
installWorld(stayWorld);
const rajScope = resolveScope("Raj")!;
const hospitableLines: Record<string, unknown>[] = [];
setHospitableLogger((line) => hospitableLines.push(line));
const raj = await nextStays(rajScope, 3, new Date("2026-10-31T16:00:00Z"));
if (raj.next.map((row) => row.guest).join() !== "Michelle Sanders,Mark Bixler" || raj.next[0]!.checkIn !== "2026-11-04" || raj.next[0]!.checkOut !== "2026-11-07" || raj.next[1]!.checkIn !== "2026-11-22") fail(`Raj's next stays: ${JSON.stringify(raj.next)}`);
if (raj.next.some((row) => row.status === "cancelled") || raj.current.length || raj.moreAfter) fail("cancelled or current stays were wrong");
if (raj.propertyIds.join() !== ID.blue || raj.read.from !== "2026-10-31" || raj.read.to !== "2027-10-31") fail(`what was asked: ${JSON.stringify(raj.read)} ${raj.propertyIds}`);
// The logs say which property and which dates were asked, by both date filters, and never a token.
const reads = hospitableLines.filter((line) => line.path === "/reservations");
if (reads.length < 2 || !reads.every((line) => line.properties === ID.blue && line.from === "2026-10-31" && line.to === "2027-10-31" && line.status === 200) || !["checkin", "checkout"].every((kind) => reads.some((line) => line.dateQuery === kind))) fail(`the Hospitable log: ${JSON.stringify(reads)}`);
if (/token|bearer|authorization/i.test(JSON.stringify(hospitableLines))) fail("the Hospitable log leaked a credential");
setHospitableLogger(null);
// The 14-day look misses Roya's stay on Nov 25 and says so, rather than "no reservations".
const shortLook = (await agentTools().find((tool) => tool.name === "list_stays")!.run({ days_ahead: 14, for: "Roya" }, "c")) as { stays: unknown[]; note: string; propertyIds: string[] };
if (shortLook.stays.length || !/only this window/.test(shortLook.note) || !/next_stays/.test(shortLook.note) || shortLook.propertyIds.join() !== ID.shaw) fail(`the short look: ${JSON.stringify(shortLook)}`);
if ((await nextStays(resolveScope("Roya")!, 3, new Date("2026-10-31T16:00:00Z"))).next[0]?.guest !== "Ola") fail("Roya's next stay");
const rajShort = (await agentTools().find((tool) => tool.name === "list_stays")!.run({ days_ahead: 14, for: "Raj" }, "c")) as { stays: { guest: string; propertyId: string }[] };
if (rajShort.stays.map((row) => row.guest).join() !== "Michelle Sanders" || rajShort.stays[0]!.propertyId !== ID.blue) fail(`Raj's 14-day look: ${JSON.stringify(rajShort)}`);
// A unit Copilot can't read is said plainly, never "no stays".
const rose = resolveScope("Roseglor")!;
installWorld({ ...stayWorld, properties: stayWorld.properties.filter((row) => row.id !== ID.rose) });
const unreadable = await readableUnit(rose);
if (unreadable.properties.length || !/isn't a property Copilot knows from OPS/.test(unreadable.why)) fail(`an unreadable unit: ${JSON.stringify(unreadable)}`);
let unreadableError = "";
try {
  await nextStays(rose, 3, new Date("2026-10-31T16:00:00Z"));
} catch (err) {
  unreadableError = err instanceof Error ? err.message : "";
}
if (!/isn't a property Copilot knows/.test(unreadableError)) fail(`next_stays on an unreadable unit: ${unreadableError}`);
installWorld(stayWorld);
// The diagnosis lays the chain out and pins a missing stay to the step that dropped it.
const probe = await diagnoseStays(rajScope, "Michelle", new Date("2026-10-31T16:00:00Z"));
if (probe.chosen.length !== 1 || probe.chosen[0]!.hospitableId !== ID.blue || !probe.chosen[0]!.existsInHospitable || !probe.chosen[0]!.inSavedSelection) fail(`the property chain: ${JSON.stringify(probe.chosen)}`);
if (!probe.highlighted.some((line) => /Michelle .*2026-11-04 to 2026-11-07/.test(line)) || probe.reservations.find((row) => row.id === "r-mark")?.dropped !== "checks in after the 14-day look" || probe.reservations.find((row) => row.id === "r-zoe")?.dropped !== "status \"cancelled\" is filtered out") fail(`the diagnosis: ${JSON.stringify(probe.reservations)}`);
const missing = await diagnoseStays(rajScope, "Nobody", new Date("2026-10-31T16:00:00Z"));
if (!missing.notes.some((note) => /returned no reservation for a guest named "Nobody"/.test(note))) fail(`a guest the API doesn't have: ${JSON.stringify(missing.notes)}`);
// Through the agent: "what's the next reservation for that unit?" is answered from next_stays.
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  const last = request.messages!.at(-1)!;
  if (!Array.isArray(last.content)) return { text: "", toolUses: [{ id: "n1", name: "next_stays", input: { for: "Raj" } }], blocks: [{ type: "tool_use", id: "n1", name: "next_stays", input: { for: "Raj" } }], stop: "tool_use" };
  const raw = last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("");
  const result = JSON.parse(raw) as { next: { guest: string; checkIn: string; checkOut: string }[] };
  const text = `The next reservation at 20 Blue Jays Way is ${result.next[0]!.guest}, ${result.next[0]!.checkIn} to ${result.next[0]!.checkOut}, then ${result.next[1]!.guest} from ${result.next[1]!.checkIn}.`;
  return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
});
const nextAnswer = await runAgentTurn({ chatId: "c", text: "whats the next reservation for that unit" });
if (!/Michelle Sanders, 2026-11-04 to 2026-11-07, then Mark Bixler from 2026-11-22/.test(nextAnswer.body)) fail(`the agent said: ${nextAnswer.body}`);
setBrainModel(null);
if (!/call next_stays/.test((await import("./agentChat.js")).agentSystem("", "2026-10-20"))) fail("the agent isn't told to use next_stays");

// ---------- Where the agent's facts come from: Hospitable beats memory, and no file is ever a source ----------
const SENTINEL = "SENTINEL-FROM-A-LOCAL-NOTE-FILE-4:15 PM";
const factsWorld = worldAt("2026-10-31T12:00:00-04:00");
factsWorld.memory = [...factsWorld.memory, { path: "memory/20-blue-jays-way.md", body: `Check-in time: ${SENTINEL}` } as never];
installWorld(factsWorld);
resetBusinessFacts();
await saveFact({ subject: "8 Charlotte 606 check-in", fact: "Check-in at 8 Charlotte 606 is 4:00 PM.", category: "unit", source: "an earlier chat" });
await saveFact({ subject: "20 Blue Jays Way parking", fact: "Parking at 20 Blue Jays Way is P2, check-in is 4:00 PM.", category: "unit", source: "an earlier chat" });
// The tool lists: no memory-file reader, no raw Hub reader, the live unit facts instead.
for (const names of [agentTools().map((tool) => tool.name), agentTools({ names: SKILL_TOOL_NAMES }).map((tool) => tool.name)]) {
  if (names.includes("read_memory") || names.includes("read_knowledge_hub") || !names.includes("unit_facts")) fail(`knowledge tools: ${names.join()}`);
}
if (agentTools({ names: SKILL_TOOL_NAMES }).some((tool) => /memory file|notes? file|local file|\.md\b/i.test(`${tool.name} ${tool.description}`))) fail("a tool still describes reading a file");
// No agent code reads a file or the memory files.
for (const source of ["agentChat", "agentLoop", "skillAgent", "skillPolicy", "unitFacts", "stayLookup", "brain", "toolServer"]) {
  const code = readFileSync(new URL(`./${source}.ts`, import.meta.url), "utf8");
  if (/node:fs|readFileSync|readdirSync|memoryFiles|skillMemoryText|readStanding|\bglob\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) fail(`${source}.ts reaches for a file or the memory files`);
}
// Hospitable's Knowledge Hub is the source, read live, and memory shows beside it.
const charlotte = await unitFacts(resolveScope("Charlotte")!);
if (!/Check-in 3:00 PM/.test(charlotte.text) || !/live/.test(charlotte.source)) fail(`the Hub: ${JSON.stringify(charlotte)}`);
if (charlotte.memory.length !== 1 || !/4:00 PM/.test(charlotte.memory[0]!.fact)) fail(`memory beside it: ${JSON.stringify(charlotte.memory)}`);
if (charlotte.conflicts.length !== 1 || charlotte.conflicts[0]!.hospitable !== "3:00 PM" || charlotte.conflicts[0]!.memory !== "4:00 PM" || !/Going with Hospitable/.test(charlotte.conflicts[0]!.saying)) fail(`the conflict: ${JSON.stringify(charlotte.conflicts)}`);
if (JSON.stringify(charlotte).includes("SENTINEL")) fail("a local note's text reached the agent");
if (timeAfter("Check-in is at 3 p.m. sharp", "check-?in")?.minutes !== 15 * 60 || conflictsWith("Check-in 4:00 PM", [{ id: "x", subject: "Check-in", fact: "Check-in 4:00 PM", category: "unit", source: "", updatedAt: "" }]).length) fail("time comparison: agreeing times must not conflict");
// A Hub that doesn't answer is said: memory does not stand in for it.
let hubError = "";
installWorld({ ...factsWorld, hub: [...(factsWorld.hub ?? []).filter((row) => row.propertyId !== ID.blue), { propertyId: ID.blue, body: "", unreadable: true }] });
try {
  await unitFacts(resolveScope("Raj")!);
} catch (err) {
  hubError = err instanceof Error ? err.message : "";
}
installWorld(factsWorld);
if (!/Knowledge Hub didn't return/.test(hubError) || !/Nothing was taken from memory/.test(hubError) || /P2|4:00 PM/.test(hubError)) fail(`a silent Hub fell back to memory: ${hubError}`);
// Through the agent: the answer goes with Hospitable and says the memory disagreed.
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  const last = request.messages!.at(-1)!;
  if (!Array.isArray(last.content)) return { text: "", toolUses: [{ id: "u1", name: "unit_facts", input: { for: "Charlotte" } }], blocks: [{ type: "tool_use", id: "u1", name: "unit_facts", input: { for: "Charlotte" } }], stop: "tool_use" };
  const raw = last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("");
  const result = JSON.parse(raw) as { conflicts: { saying: string; hospitable: string }[] };
  const text = `Check-in is ${result.conflicts[0]!.hospitable} at Charlotte 606. ${result.conflicts[0]!.saying}`;
  return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
});
const checkin = await runAgentTurn({ chatId: "c", text: "what time is check-in at Charlotte?" });
if (!/Check-in is 3:00 PM/.test(checkin.body) || !/says the check-in time is 4:00 PM, but Hospitable says 3:00 PM\. Going with Hospitable\./.test(checkin.body) || /SENTINEL/.test(checkin.body)) fail(`the agent said: ${checkin.body}`);
setBrainModel(null);
const rules = (await import("./agentChat.js")).agentSystem("", "2026-10-20");
if (!/HOSPITABLE BEATS MEMORY/.test(rules) || !/never read local files, notes or drafts as knowledge/.test(rules) || !/call unit_facts/.test(rules) || !/guidebook/.test(rules) || !/cleaner app/.test(rules)) fail("the agent isn't told where facts come from");
resetBusinessFacts();

// ---------- "Draft the building email for Michelle's stay" (no unit named) ----------
{
  const building = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  const oct30 = { id: "oct30-sent", mailbox: "gmail" as const, folder: "sent" as const, from: "Mandel Realty", email: "mandelrealtyteam@gmail.com", to: building, date: "2026-10-30T11:00:00-04:00",
    subject: "Re: AirBNB Rental for Unit 318, October 30 \u2013 November 1, 2026", snippet: "20 Blue Jays Way Unit 318",
    body: "Hello,\n\nPlease register this vehicle with the building.\nGuest: Dana\nCheck-in: October 30, 2026\nCheck-out: November 1, 2026\nMake: Honda\nModel: Civic\nPlate: ABCD123\nColour: Grey\n\nShane, Co-Host 647-822-0448", airbnb: false };
  const world = worldAt("2026-10-31T12:00:00-04:00", false, [oct30]);
  world.reservations = [
    stay("r-michelle", ID.blue, "Michelle Sanders", "2026-11-04", "2026-11-08", "accepted"),
    stay("r-nance", ID.charlotte, "Tom", "2026-11-06", "2026-11-09"),
  ];
  world.reservations[0]!.messages = [{ id: "m-car", at: "2026-10-30T18:00:00-04:00", role: "guest", name: "Michelle", body: "Make: Kia. Model: Soul. Plate: BXYZ456. One car." }];
  installWorld(world);
  resetCaptures();
  resetParityChecksMessages();
  // The old failures: a guest's first name is not a client or unit, and a described template is not a keyword.
  const stays = await findStays({ guest: "Michelle" }, new Date("2026-10-31T16:00:00Z"));
  if (stays.matches.length !== 1 || stays.matches[0]!.propertyId !== ID.blue || stays.matches[0]!.checkIn !== "2026-11-04") fail(`find_stay: ${JSON.stringify(stays)}`);
  if (!/No reservation for "Nobody"/.test((await findStays({ guest: "Nobody" }, new Date("2026-10-31T16:00:00Z"))).note)) fail("find_stay for a guest that doesn't exist");
  if ((await searchMail({ keywords: "building email template", where: "sent" })).hits.length) fail("a described template unexpectedly matched");
  if (!(await searchMail({ keywords: "AirBNB Rental Unit 318", where: "sent" })).hits.length) fail("the Oct 30 email wasn't found by its subject words");
  // Through the agent: the tool calls and their arguments are logged, nothing leaks, and the draft lands in Checks unsent.
  const lines: Record<string, unknown>[] = [];
  setToolLogger((line) => lines.push(line as Record<string, unknown>));
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    const last = request.messages!.at(-1)!;
    if (!Array.isArray(last.content)) return { text: "", toolUses: [{ id: "f1", name: "find_stay", input: { guest: "Michelle" } }], blocks: [{ type: "tool_use", id: "f1", name: "find_stay", input: { guest: "Michelle" } }], stop: "tool_use" };
    const names = request.messages!.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_use").map((b) => (b as { name: string }).name) : []));
    if (!names.includes("building_email")) return { text: "", toolUses: [{ id: "b1", name: "building_email", input: { guest: "Michelle" } }], blocks: [{ type: "tool_use", id: "b1", name: "building_email", input: { guest: "Michelle" } }], stop: "tool_use" };
    return { text: "The building email is waiting for approval.", toolUses: [], blocks: [{ type: "text", text: "The building email is waiting for approval." }], stop: "end_turn" };
  });
  const turn = await runAgentTurn({ chatId: "c", text: "draft the building email for Michelle's stay, Nov 4-8" });
  setBrainModel(null);
  setToolLogger(null);
  const tools = lines.filter((line) => line.agent === "tool");
  const resolved = tools.find((line) => line.tool === "find_stay");
  if (!resolved || (resolved.args as Record<string, unknown>).guest !== "Michelle" || resolved.ok !== true) fail(`the agent's tool log: ${JSON.stringify(lines)}`);
  if (/Charlotte/.test(JSON.stringify(lines.map((line) => line.args)))) fail("the agent's calls named Charlotte");
  const mailed = tools.find((line) => line.tool === "building_email");
  if (!mailed || mailed.ok !== true) fail(`building_email: ${JSON.stringify(tools)}`);
  if (/ABCD123|BXYZ456|Co-Host/.test(JSON.stringify(lines))) fail("the log carried message text");
  // The card is in the chat itself with approve and hold-off actions, never in Checks.
  const card = (await listMessages("c")).find((row) => row.draft?.channel === "email" && row.draft.status === "waiting");
  if (!card || card.draft!.to !== building || !/Make: Kia/.test(card.draft!.body) || !/Michelle/.test(card.draft!.body)) fail(`the building draft: ${JSON.stringify(card?.draft)} / ${turn.body}`);
  if (parityChecksMessages().some((row) => row.draft?.channel === "email")) fail("the building draft went to Checks");
  if (capturedCommits().length) fail("the building email request sent something");
  if (!/call find_stay/.test((await import("./agentChat.js")).agentSystem("", "2026-10-31"))) fail("the agent isn't told to find the guest's stay");
  if (!/Never ask the partner for a car detail the thread holds/.test((await import("./agentChat.js")).agentSystem("", "2026-10-31"))) fail("the agent isn't told never to ask for the car");

  // The guest wrote the car in her own words, which the pattern reader misses: the thread is still read and the car goes in.
  const wordy = worldAt("2026-10-31T12:00:00-04:00", false, [oct30]);
  wordy.reservations = [stay("r-wordy", ID.blue, "Michelle Sanders", "2026-11-04", "2026-11-08")];
  wordy.reservations[0]!.messages = [{ id: "w1", at: "2026-10-30T18:00:00-04:00", role: "guest", name: "Michelle", body: "Hi! Our ride is the little grey Soul, tag is BXYZ456. Just the one." }];
  installWorld(wordy);
  resetParityChecksMessages();
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: JSON.stringify({ vehicles: [{ make: "Kia", model: "Soul", plate: "BXYZ456", colour: "grey" }] }), toolUses: [], blocks: [], stop: "end_turn" };
    return { text: "", toolUses: [], blocks: [], stop: "end_turn" };
  });
  const wordyAnswer = await answerBuildingRegistrationItem("draft the building email for Michelle's stay", "", true, "c2");
  setBrainModel(null);
  const wordyCard = (await listMessages("c2")).find((row) => row.draft?.status === "waiting");
  if (!wordyCard || !/BXYZ456/.test(wordyCard.draft!.body) || /Make: Kia/.test(wordyCard.draft!.body)) fail(`the car from her own words: ${wordyCard?.draft?.body} / ${wordyAnswer?.body}`);
  if (/shortly/i.test(wordyCard.draft!.body) || /still a blank: \[plate\]/.test(wordyCard.body)) fail(`a read thread with a car still left a placeholder: ${wordyCard.draft!.body}`);

  // The thread is read and has no car: it says so plainly above the card, and never asks the partner.
  const none = worldAt("2026-10-31T12:00:00-04:00", false, [oct30]);
  none.reservations = [stay("r-none", ID.blue, "Michelle Sanders", "2026-11-04", "2026-11-08")];
  none.reservations[0]!.messages = [{ id: "n1", at: "2026-10-30T18:00:00-04:00", role: "guest", name: "Michelle", body: "Hi, looking forward to the stay!" }];
  installWorld(none);
  setBrainModel(async (request) => ({ text: request.task === "extract" ? "{\"vehicles\":[]}" : "", toolUses: [], blocks: [], stop: "end_turn" }));
  const emptyAnswer = await answerBuildingRegistrationItem("draft the building email for Michelle's stay", "", true, "c3");
  setBrainModel(null);
  const emptyCard = (await listMessages("c3")).find((row) => row.draft?.status === "waiting");
  if (!emptyCard || !/I read all 1 message in Michelle Sanders's thread and she hasn't sent vehicle details/.test(emptyCard.body + (emptyAnswer?.body ?? ""))) fail(`an empty thread was not said plainly: ${emptyCard?.body} / ${emptyAnswer?.body}`);
}

// ---------- "How many people are checking out today": one read across the properties, answered in one tool call ----------
{
  const world = worldAt("2026-10-31T12:00:00-04:00");
  world.reservations = [
    stay("o1", ID.blue, "Pat Lee", "2026-10-28", "2026-10-31"),
    stay("o2", ID.shaw, "Sam Wu", "2026-10-29", "2026-10-31"),
    stay("o3", ID.charlotte, "Kim Ho", "2026-10-31", "2026-11-03"),
    stay("o4", ID.rose, "Gone", "2026-10-28", "2026-10-31", "cancelled"),
    stay("o5", ID.rose, "Later", "2026-11-01", "2026-11-04"),
  ];
  world.datetimeDates = true;
  installWorld(world);
  const reads: Record<string, unknown>[] = [];
  setHospitableLogger((line) => reads.push(line));
  const today = await dayMovements({}, new Date("2026-10-31T16:00:00Z"));
  setHospitableLogger(null);
  // Late on Sun Nov 1 (10:57 PM, after the clocks went back) it is still Nov 1 in Toronto, though Nov 2 in UTC.
  const late = new Date("2026-11-02T03:57:00Z");
  const sent: Record<string, unknown>[] = [];
  setStayLogger((line) => sent.push(line));
  const lateWorld = worldAt("2026-11-01T22:57:00-05:00");
  lateWorld.datetimeDates = true;
  lateWorld.reservations = [stay("n1", ID.blue, "Ashley Gamez", "2026-10-29", "2026-11-01"), stay("n2", ID.shaw, "Shaw Guest", "2026-10-30", "2026-11-01"), stay("n3", ID.blue, "Next", "2026-11-02", "2026-11-05")];
  installWorld(lateWorld);
  const night = await dayMovements({}, late);
  setStayLogger(null);
  if (night.date !== "2026-11-01" || night.checkOuts.map((row) => row.guest).sort().join() !== "Ashley Gamez,Shaw Guest" || night.checkIns.length) fail(`two check-outs on the queried date: ${JSON.stringify(night)}`);
  if (sent[0]?.sentDate !== "2026-11-01" || (sent[0]?.checkoutQueryReturned as string[]).length !== 2 || !/2026-11-01/.test(String(sent[0]?.checkoutQueryReturned))) fail(`the raw stays log: ${JSON.stringify(sent)}`);
  installWorld(world);
  const resRead = reads.filter((line) => line.path === "/reservations");
  if (today.checkOuts.map((row) => row.guest).sort().join() !== "Pat Lee,Sam Wu" || today.checkIns.map((row) => row.guest).join() !== "Kim Ho") fail(`day movements: ${JSON.stringify(today)}`);
  if (resRead.length !== 2 || resRead.some((line) => String(line.properties).split(",").length !== 4)) fail(`not one read across the properties: ${JSON.stringify(resRead)}`);
  const lines: Record<string, unknown>[] = [];
  setToolLogger((line) => lines.push(line as Record<string, unknown>));
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    const last = request.messages!.at(-1)!;
    if (!Array.isArray(last.content)) return { text: "Two checkouts today, pulling the details now.", toolUses: [{ id: "d1", name: "day_movements", input: {} }], blocks: [{ type: "text", text: "Two checkouts today, pulling the details now." }, { type: "tool_use", id: "d1", name: "day_movements", input: {} }], stop: "tool_use" };
    const raw = last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("");
    const result = JSON.parse(raw) as { checkOuts: unknown[] };
    const text = `${result.checkOuts.length} people check out today.`;
    return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
  });
  setParityClock(new Date("2026-10-31T16:00:00Z"));
  const pieces: string[] = [];
  const asked = await runAgentTurn({ chatId: "c", text: "how many people are checking out today", onEvent: (event) => { if (event.type === "text") pieces.push(event.text); } });
  setBrainModel(null);
  setToolLogger(null);
  setParityClock(null);
  const used = lines.filter((line) => line.agent === "tool");
  if (used.length !== 1 || used[0]!.tool !== "day_movements" || asked.body !== "2 people check out today.") fail(`aggregate took ${used.length} calls: ${JSON.stringify(used)} / ${asked.body}`);
  void pieces;
  // Eight rounds that each open with the same line show it once; a round's words replace the last round's after a tool step.
  let shown = streamStart;
  for (let round = 0; round < 5; round += 1) {
    for (const chunk of ["Two checkouts today", " \u2014 pulling the details now."]) shown = streamPiece(shown, chunk);
    shown = streamStep(shown);
  }
  shown = streamPiece(shown, "2 people check out today.");
  if (shown.text !== "2 people check out today." ) fail(`stacked stream text: ${shown.text}`);
  let one = streamStart;
  for (const chunk of ["Two checkouts today", " \u2014 pulling the details now."]) one = streamPiece(one, chunk);
  if (one.text !== "Two checkouts today \u2014 pulling the details now.") fail(`chunks within a round must append: ${one.text}`);
  if (!/call day_movements once/.test((await import("./agentChat.js")).agentSystem("", "2026-10-31"))) fail("the agent isn't told to use day_movements");
}

// ---------- "What did Rebecca mention about food in her thread? For raj unit": one thread, 1 tool call, no wandering ----------
{
  const world = worldAt("2026-10-31T12:00:00-04:00");
  world.reservations = [
    stay("rr", ID.blue, "Rebecca Roitz", "2026-10-21", "2026-10-25"),
    stay("rs", ID.blue, "Rebecca Simpson", "2026-12-21", "2026-12-27"),
  ];
  world.reservations[0]!.messages = [{ id: "f1", at: "2026-10-19T18:00:00-04:00", role: "guest", name: "Rebecca", body: "We are vegetarian, could you leave a few snacks?" }];
  world.reservations[1]!.messages = [{ id: "f2", at: "2026-10-30T18:00:00-04:00", role: "guest", name: "Rebecca", body: "Looking forward to December." }];
  installWorld(world);
  setParityClock(new Date("2026-10-31T16:00:00Z"));
  const reads: Record<string, unknown>[] = [];
  setHospitableLogger((line) => reads.push(line));
  const lines: Record<string, unknown>[] = [];
  setToolLogger((line) => lines.push(line as Record<string, unknown>));
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    const last = request.messages!.at(-1)!;
    const input = { guest: "Rebecca", for: "raj" };
    if (!Array.isArray(last.content)) return { text: "", toolUses: [{ id: "g1", name: "guest_thread", input }], blocks: [{ type: "tool_use", id: "g1", name: "guest_thread", input }], stop: "tool_use" };
    const result = JSON.parse(last.content.map((block) => (block.type === "tool_result" ? block.content : "")).join("")) as { guest: string; messages: { body: string }[]; otherMatchesNotRead?: { guest: string }[] };
    const text = `${result.guest} said: ${result.messages[0]!.body} (Also matched: ${result.otherMatchesNotRead?.map((row) => row.guest).join()}, not opened.)`;
    return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
  });
  const turn = await runAgentTurn({ chatId: "c", text: "What did Rebecca mention about food in her thread? For raj unit" });
  setBrainModel(null);
  setToolLogger(null);
  setHospitableLogger(null);
  setParityClock(null);
  const used = lines.filter((line) => line.agent === "tool");
  if (used.length !== 1 || used[0]!.tool !== "guest_thread") fail(`the thread question took ${used.length} calls: ${JSON.stringify(used)}`);
  if (!/Rebecca Roitz said: We are vegetarian/.test(turn.body) || !/Rebecca Simpson, not opened/.test(turn.body)) fail(`the answer: ${turn.body}`);
  const threadReads = reads.filter((line) => /message/i.test(String(line.path)));
  if (threadReads.length !== 1 || /Looking forward to December/.test(JSON.stringify(turn))) fail(`more than one thread was opened: ${JSON.stringify(threadReads)}`);
  if (!/Never open another guest's thread/.test((await import("./agentChat.js")).agentSystem("", "2026-10-31"))) fail("the agent isn't told to stop after one thread");
}

console.log("Connectors harness passed.");
