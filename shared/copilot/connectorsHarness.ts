/**
 * Mail connectors tell the truth: a stored sign-in that the provider rejects is "Needs re-authorization", never "Connected",
 * and Disconnect always clears what is stored. Nothing calls Google or Microsoft.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { setAirroiValidator } from "../airroi.js";
import { runAgentTurn } from "./agentChat.js";
import { setBrainModel } from "./brain.js";
import { checkGmailLogin, gmailStatus, setGmailValidator } from "../adminApi/gmail.js";
import { checkOutlookLogin, outlookStatus, setOutlookValidator } from "../adminApi/outlook.js";
import { forgetLoginState } from "./mailLoginStatus.js";
import { readGmailLogin, readOutlookLogin, saveGmailLogin, saveOutlookLogin, setParityMailLogin } from "./store.js";
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

console.log("Connectors harness passed.");
