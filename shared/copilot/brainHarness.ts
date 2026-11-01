/**
 * The brain: routing, retry, timeout, fallback, streaming; the agent loop and its tools; business memory.
 * Nothing calls a real API. Nothing is sent.
 */

import { agentSystem, agentTools, answerInChat, runAgentTurn, type AgentTool } from "./agentChat.js";
import { metaModelFrom, brainAvailable, complete, diagnoseBrain, routePlan, setBrainFetch, setBrainLogger, setBrainModel, type BrainRequest } from "./brain.js";
import { extractAndSaveFacts, listFacts, parseExtracted, recallFacts, resetBusinessFacts, saveFact } from "./businessFacts.js";
import { callToolForChat } from "./toolServer.js";
import { capturedCommits, capturedDrafts, capturedReports, resetCaptures } from "./parity/capture.js";
import { createChat, addMessage, listMessages, listSkills, saveSkill } from "./store.js";
import { startSkillRun } from "./skillRunner.js";
import { streamAgentReply } from "../adminApi/copilot.js";
import type { VercelResponse } from "@vercel/node";
import { hospitableRead, resetHospitableConnection, saveHospitableToken, setHospitableProbe, withReservationWindow } from "./hospitableConnection.js";
import { installWorld } from "./parity/world.js";

const META = "meta-test-key-not-a-secret-1";
const ANTH = "anth-test-key-not-a-secret-2";

function fail(label: string): never {
  throw new Error(`Brain harness failed: ${label}`);
}

installWorld({ now: new Date("2026-10-20T15:00:00-04:00"), properties: [], reservations: [], gmail: [], outlook: [], memory: [], items: [] });
resetCaptures();
resetBusinessFacts();

// ---------- Routing ----------
process.env.META_API_KEY = META;
process.env.ANTHROPIC_API_KEY = ANTH;
if (routePlan("chat")[0]?.provider !== "meta" || routePlan("chat")[0]?.model !== "muse-spark-1.3") fail("chat does not go to Meta first");
if (routePlan("simple")[0]?.provider !== "meta") fail("simple does not go to Meta first");
if (routePlan("hard")[0]?.provider !== "anthropic" || !/sonnet/.test(routePlan("hard")[0]!.model)) fail("hard does not go to the strong model first");
if (routePlan("chat").at(-1)?.provider !== "anthropic") fail("chat has no Anthropic fallback");
process.env.BRAIN_ROUTE_CHAT = "anthropic:haiku,meta";
if (routePlan("chat")[0]?.provider !== "anthropic" || !/haiku/.test(routePlan("chat")[0]!.model)) fail("the route override was ignored");
delete process.env.BRAIN_ROUTE_CHAT;
delete process.env.META_API_KEY;
if (routePlan("chat").some((route) => route.provider === "meta")) fail("Meta was planned without a key");
process.env.META_API_KEY = META;

// ---------- The HTTP path: retry, bearer auth, fallback, timeout, streaming ----------
type Call = { url: string; headers: Record<string, string>; body: { model: string; stream?: boolean } };
const calls: Call[] = [];
const ok = (text: string) => new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "content-type": "application/json" } });
const asFetch = (handler: (call: Call) => Response | Promise<Response>): typeof fetch =>
  (async (url: unknown, init?: RequestInit) => {
    const call: Call = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) as Call["body"] };
    calls.push(call);
    if (init?.signal?.aborted) throw new Error("aborted");
    return handler(call);
  }) as typeof fetch;
const req = (task: BrainRequest["task"] = "chat", extra: Partial<BrainRequest> = {}): BrainRequest => ({ task, system: "s", user: "hello", ...extra });

setBrainFetch(asFetch(() => (calls.filter((c) => c.url.includes("meta.ai")).length === 1 ? new Response("busy", { status: 503 }) : ok("from meta"))));
const retried = await complete(req());
if (retried?.text !== "from meta" || retried.provider !== "meta") fail(`retry: ${JSON.stringify(retried)}`);
if (calls.length !== 2 || !calls.every((c) => c.url === "https://api.meta.ai/v1/messages")) fail(`retry calls ${calls.map((c) => c.url).join(",")}`);
if (calls[0]!.headers.authorization !== `Bearer ${META}` || calls[0]!.headers["x-api-key"]) fail("Meta must use bearer auth only");
if (calls[0]!.body.model !== "muse-spark-1.3") fail("model name");
if (JSON.stringify(retried).includes(META)) fail("the key was returned");

calls.length = 0;
setBrainFetch(asFetch((call) => (call.url.includes("meta.ai") ? new Response("down", { status: 500 }) : ok("from anthropic"))));
const fellBack = await complete(req());
if (fellBack?.text !== "from anthropic" || fellBack.provider !== "anthropic") fail("no fallback to Anthropic");
if (calls.filter((c) => c.url.includes("meta.ai")).length !== 2) fail("Meta should be tried twice (one retry)");
const anthropicCall = calls.find((c) => c.url.includes("anthropic.com"))!;
if (anthropicCall.headers["x-api-key"] !== ANTH || anthropicCall.headers.authorization) fail("Anthropic auth");

calls.length = 0;
setBrainFetch(asFetch((call) => (call.url.includes("meta.ai") ? new Response("bad key", { status: 401 }) : ok("from anthropic"))));
const noRetry = await complete(req());
if (noRetry?.provider !== "anthropic" || calls.filter((c) => c.url.includes("meta.ai")).length !== 1) fail("a 401 must not be retried");

calls.length = 0;
setBrainFetch(asFetch(() => new Response("down", { status: 500 })));
if ((await complete(req())) !== null) fail("all providers failed but a result came back");

process.env.BRAIN_TIMEOUT_MS = "1000";
calls.length = 0;
const hang = (call: Call): Promise<Response> => new Promise<Response>((resolve) => { if (!call.url.includes("meta.ai")) resolve(ok("after the timeout")); });
setBrainFetch(((url: unknown, init?: RequestInit) => {
  const call: Call = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) as Call["body"] };
  calls.push(call);
  if (!call.url.includes("meta.ai")) return Promise.resolve(ok("after the timeout"));
  return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
}) as typeof fetch);
void hang;
const timed = await complete(req());
if (timed?.provider !== "anthropic" || timed.text !== "after the timeout") fail(`timeout did not fall through: ${JSON.stringify(timed)}`);
delete process.env.BRAIN_TIMEOUT_MS;

const sse = (events: object[]) => new Response(events.map((event) => `event: x\ndata: ${JSON.stringify(event)}\n\n`).join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
setBrainFetch(asFetch(() => sse([
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Let me " } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "check." } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu_1", name: "list_stays" } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"days_ahead\":" } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "7}" } },
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "tool_use" } },
])));
const pieces: string[] = [];
const streamed = await complete(req("chat", { onText: (piece) => pieces.push(piece), tools: [{ name: "list_stays", description: "d", input_schema: { type: "object" } }] }));
if (pieces.join("") !== "Let me check." || streamed?.text !== "Let me check.") fail(`stream text ${pieces.join("|")}`);
if (streamed.toolUses[0]?.name !== "list_stays" || (streamed.toolUses[0]?.input as { days_ahead?: number }).days_ahead !== 7 || streamed.stop !== "tool_use") fail(`stream tool ${JSON.stringify(streamed.toolUses)}`);
setBrainFetch(null);

// ---------- The log says who was tried, who answered, and the status code: never the key, never a body ----------
const logged: Record<string, unknown>[] = [];
setBrainLogger((line) => logged.push(line));
setBrainFetch(asFetch((call) => (call.url.includes("meta.ai") ? new Response(JSON.stringify({ error: { type: "invalid_request_error", code: "model_not_found", message: "secret-body-text" } }), { status: 404 }) : ok("from anthropic"))));
const viaLog = await complete(req());
if (viaLog?.provider !== "anthropic") fail("setup for the log");
const lines = logged.map((line) => JSON.stringify(line)).join("\n");
if (!/"brain":"start"/.test(lines) || !/"provider":"meta"[^}]*"status":404/.test(lines) || !/"brain":"answered"[^}]*"provider":"anthropic"[^}]*"fellBack":true/.test(lines)) fail(`the log lacks the attempt, the status or the answer:\n${lines}`);
if (lines.includes(META) || lines.includes(ANTH) || /secret-body-text|model_not_found/.test(lines)) fail("the log leaked a key or a response body");
logged.length = 0;
delete process.env.META_API_KEY;
await complete(req());
if (!/"noKey":\["meta"\]/.test(logged.map((line) => JSON.stringify(line)).join("\n"))) fail("a missing Meta key was not logged");
process.env.META_API_KEY = META;
// The diagnosis names the status for each Meta model name, and the same key never shows up in what it returns.
setBrainFetch(asFetch((call) => {
  if (!call.url.includes("meta.ai")) return ok("ok");
  return call.body.model === "muse-spark" ? new Response("{}", { status: 404 }) : ok("ok");
}));
const probes = await diagnoseBrain();
const versioned = probes.find((row) => row.provider === "meta");
if (versioned?.model !== "muse-spark-1.3" || versioned.outcome !== "ok" || !versioned.keyPresent) fail(`diagnosis ${JSON.stringify(probes)}`);
if (metaModelFrom(undefined) !== "muse-spark-1.3" || metaModelFrom("  muse-spark-1.4 ") !== "muse-spark-1.4" || metaModelFrom("muse-spark-1.3-contributor") !== "muse-spark-1.3" || metaModelFrom("MUSE-SPARK-1.3-Contributor") !== "muse-spark-1.3") fail("META_MODEL override or the contributor guard");
// The router asks Meta for the versioned standard model, never the contributor tier, and never the old unversioned name.
const metaAsked: string[] = [];
setBrainFetch(asFetch((call) => { if (call.url.includes("meta.ai")) metaAsked.push(String(call.body.model)); return ok("ok"); }));
await complete(req());
if (metaAsked.join() !== "muse-spark-1.3") fail(`Meta was asked for ${metaAsked.join()}`);
if (JSON.stringify(probes).includes(META) || JSON.stringify(probes).includes(ANTH)) fail("the diagnosis returned a key");
delete process.env.META_API_KEY;
if (!(await diagnoseBrain()).some((row) => row.provider === "meta" && row.outcome === "no key" && !row.keyPresent)) fail("a missing Meta key was not diagnosed");
process.env.META_API_KEY = META;
setBrainLogger(null);
setBrainFetch(null);

// Parity never calls out without a seam.
if ((await complete(req())) !== null) fail("parity made a live call");
if (brainAvailable()) fail("brain looks available in parity with no seam");

// ---------- The agent loop ----------
const asked: BrainRequest[] = [];
let round = 0;
setBrainModel(async (request) => {
  asked.push(JSON.parse(JSON.stringify(request)) as BrainRequest);
  if (request.task === "extract") return { text: JSON.stringify({ facts: [] }), toolUses: [], blocks: [{ type: "text", text: "{\"facts\":[]}" }], stop: "end_turn" };
  round += 1;
  if (round === 1) return { text: "", toolUses: [{ id: "a", name: "read_thread", input: { reservation_id: "r1" } }, { id: "b", name: "no_such_tool", input: {} }], blocks: [{ type: "tool_use", id: "a", name: "read_thread", input: { reservation_id: "r1" } }, { type: "tool_use", id: "b", name: "no_such_tool", input: {} }], stop: "tool_use" };
  return { text: "Sarah asked about parking. Draft is waiting.", toolUses: [], blocks: [{ type: "text", text: "Sarah asked about parking. Draft is waiting." }], stop: "end_turn" };
});
const seen: string[] = [];
const fake: AgentTool[] = [{ name: "read_thread", description: "d", input_schema: { type: "object" }, run: async (input) => ({ thread: `Guest asked about parking for ${String(input.reservation_id)}` }) }];
const streamedEvents: string[] = [];
const turn = await runAgentTurn({ chatId: "c1", text: "What does Sarah need?", tools: fake, onEvent: (event) => streamedEvents.push(event.type === "step" ? `step:${event.text}` : "text") });
void seen;
if (turn.body !== "Sarah asked about parking. Draft is waiting.") fail(`loop answer: ${turn.body}`);
if (!turn.steps.includes("Used read_thread")) fail(`steps ${turn.steps.join("|")}`);
const second = asked.find((_r, index) => index === 1)!;
const lastMessage = second.messages!.at(-1)!;
const results = (lastMessage.content as { type: string; content: string; is_error?: boolean }[]);
if (!results[0]?.content.includes("parking for r1")) fail("the tool result was not fed back to the brain");
if (!results[1]?.is_error) fail("an unknown tool was not reported as an error");
if (!streamedEvents.some((line) => line.startsWith("step:"))) fail("no step events");
if (!second.system.includes("NOTHING SENDS WITHOUT A PARTNER")) fail("system prompt lacks the approval rule");

round = 0;
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  return { text: "", toolUses: [{ id: `x${(round += 1)}`, name: "read_thread", input: {} }], blocks: [{ type: "tool_use", id: `x${round}`, name: "read_thread", input: {} }], stop: "tool_use" };
});
const runaway = await runAgentTurn({ chatId: "c1", text: "loop forever", tools: fake });
if (!/ran out of steps/.test(runaway.body) || round > 9) fail(`runaway loop: ${runaway.body} after ${round}`);

setBrainModel(async () => null);
const down = await runAgentTurn({ chatId: "c1", text: "hello", tools: fake });
if (!/couldn't reach the AI brain/.test(down.body) || !/Nothing was sent/.test(down.body)) fail(`brain down: ${down.body}`);
setBrainModel(null);
const noBrain = await runAgentTurn({ chatId: "c1", text: "hello", tools: fake });
if (!/isn't connected/.test(noBrain.body) || /\b(I can't|I cannot)\s*\.?$/.test(noBrain.body)) fail(`no brain: ${noBrain.body}`);

// ---------- Tools: reads and drafts that wait; nothing that sends ----------
const names = agentTools().map((tool) => tool.name);
for (const banned of ["deliver_to_partners", "send_proposal", "sheet_write", "assign_cleaner", "amend_contract", "build_proposal", "edit_proposal", "create_sop", "post_report"]) {
  if (names.includes(banned)) fail(`the agent can call ${banned}`);
}
for (const needed of ["propose_draft", "web_lookup", "recall_facts", "read_guest_messages", "unit_facts", "search_mail", "hospitable_read"]) {
  if (!names.includes(needed)) fail(`the agent lacks ${needed}`);
}
const draft = (await callToolForChat("propose_draft", { channel: "hospitable", body: "Hi Sarah, parking is in P2.", hospitable_tool: "send-message", hospitable_args: { reservation_id: "r1" } }, "c1")) as { waiting_for_approval?: boolean };
if (!draft.waiting_for_approval || capturedDrafts().length !== 1 || !capturedDrafts()[0]!.needs_you) fail("propose_draft did not leave a draft waiting");
if (capturedCommits().length) fail("a draft committed something");
const web = agentTools().find((tool) => tool.name === "web_lookup")!;
const webResult = (await web.run({ question: "What is Toronto's short-term rental licence rule?" }, "c1")) as { answer: string };
if (typeof webResult.answer !== "string" || !webResult.answer) fail("web_lookup returned nothing");

// ---------- Memory: store, recall, correct ----------
resetBusinessFacts();
const first = await saveFact({ subject: "Shaw Street owner", fact: "Owner prefers a text over email and approves repairs under $300 without asking.", category: "client", source: "chat 1" });
if (first.action !== "added") fail(`first save ${first.action}`);
await saveFact({ subject: "Early check-in policy", fact: "Early check-in is a flat $40 when the unit is ready.", category: "standing", source: "chat 1" });
await saveFact({ subject: "Blue Jays parking", fact: "Parking is P2, spot assigned by the building.", category: "unit", source: "chat 2" });
const corrected = await saveFact({ subject: "shaw street OWNER", fact: "Owner prefers a text over email and approves repairs under $500 without asking.", category: "client", source: "chat 3" });
if (corrected.action !== "updated" || !/\$300/.test(corrected.previous ?? "")) fail(`correction ${JSON.stringify(corrected)}`);
const all = await listFacts();
if (all.length !== 3 || all.filter((f) => /shaw/i.test(f.subject)).length !== 1) fail(`a correction added a duplicate: ${all.map((f) => f.subject).join(", ")}`);
if (!/\$500/.test(all.find((f) => /shaw/i.test(f.subject))!.fact)) fail("the correction did not replace the fact");
if ((await saveFact({ subject: "Shaw Street owner", fact: "Owner prefers a text over email and approves repairs under $500 without asking." })).action !== "unchanged") fail("the same fact was saved again");
const shaw = await recallFacts("What does the Shaw Street owner prefer?");
if (shaw[0]?.subject !== "Shaw Street owner") fail(`recall order ${shaw.map((f) => f.subject).join(", ")}`);
if (shaw.some((f) => /parking/i.test(f.subject))) fail("an unrelated fact was recalled");
if (!(await recallFacts("Can a guest check in early?")).some((f) => /Early check-in/.test(f.subject))) fail("a matching standing fact was not recalled");
for (const secret of ["The Shaw Street door code is 4821.", "Wifi password is blue42", "Owner's cell is 416-555-0188", "Email her at owner@example.com"]) {
  if ((await saveFact({ subject: "Secret", fact: secret })).action !== "refused") fail(`kept a secret: ${secret}`);
}
if (parseExtracted("not json").length || parseExtracted("{\"facts\":[{\"subject\":\"\",\"fact\":\"x\"}]}").length) fail("bad extraction accepted");

// Extraction after a conversation, and the facts reach the next prompt.
setBrainModel(async (request) => {
  if (request.task !== "extract") return { text: "ok", toolUses: [], blocks: [{ type: "text", text: "ok" }], stop: "end_turn" };
  const text = JSON.stringify({ facts: [
    { subject: "Shaw Street owner", fact: "Owner approves repairs under $750 without asking.", category: "client", correction: true },
    { subject: "Cleaner pay day", fact: "Cleaners are paid every Friday.", category: "standing", correction: false },
    { subject: "Blue Jays lockbox", fact: "The lockbox code is 7788.", category: "unit", correction: false },
  ] });
  return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
});
const saved = await extractAndSaveFacts({ conversation: [{ role: "user", text: "Actually Shaw owner approves up to $750 now. Cleaners are paid Fridays." }, { role: "assistant", text: "Got it." }], known: await listFacts(), source: "chat 4" });
if (saved.length !== 2 || saved.map((item) => item.action).sort().join() !== "added,updated") fail(`extraction ${JSON.stringify(saved.map((item) => item.action))}`);
if ((await listFacts()).some((f) => /7788|lockbox/i.test(f.fact))) fail("a code was kept");
if ((await listFacts()).filter((f) => /shaw/i.test(f.subject)).length !== 1) fail("extraction duplicated the corrected fact");
if (!/\$750/.test(agentSystem("", "2026-10-20") + (await recallFacts("shaw owner repairs")).map((f) => f.fact).join())) fail("corrected fact missing from recall");

// A whole stored chat turn: history, answer, memory.
let sawFacts = false;
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  sawFacts = /Cleaners are paid every Friday/.test(request.system) || sawFacts;
  const text = "Friday. Want me to remind you the day before?";
  return { text, toolUses: [], blocks: [{ type: "text", text }], stop: "end_turn" };
});
const chat = await createChat("pay");
await addMessage({ chatId: chat.id, role: "user", body: "When are cleaners paid?" });
const done = await answerInChat({ chatId: chat.id, text: "When are cleaners paid?" });
const stored = await listMessages(chat.id);
if (stored.at(-1)?.role !== "assistant" || stored.at(-1)?.body !== done.body || !sawFacts) fail(`chat turn: ${JSON.stringify(stored.map((m) => m.body))} facts=${sawFacts}`);
setBrainModel(null);

// ---------- The reply as a stream: chat, step, text chunks, then done with the stored messages ----------
const wire: string[] = [];
const headers: Record<string, string> = {};
const fakeRes = { setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, status: () => fakeRes, write: (chunk: string) => { wire.push(chunk); return true; }, end: () => undefined } as unknown as VercelResponse;
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  request.onText?.("Friday. ");
  request.onText?.("Want a reminder?");
  return { text: "Friday. Want a reminder?", toolUses: [], blocks: [{ type: "text", text: "Friday. Want a reminder?" }], stop: "end_turn" };
});
const streamChat = await createChat("stream");
await addMessage({ chatId: streamChat.id, role: "user", body: "When are cleaners paid?" });
await streamAgentReply(fakeRes, streamChat.id, "When are cleaners paid?");
const events = wire.join("").split("\n\n").filter(Boolean).map((raw) => ({ event: /^event: (.+)$/m.exec(raw)![1]!, data: JSON.parse(/^data: (.+)$/m.exec(raw)![1]!) as { text?: string; messages?: { role: string; body: string }[] } }));
if (!/event-stream/.test(headers["content-type"] ?? "")) fail("stream content type");
if (events[0]?.event !== "chat" || events.at(-1)?.event !== "done") fail(`stream order ${events.map((e) => e.event).join(",")}`);
if (events.filter((e) => e.event === "text").map((e) => e.data.text).join("") !== "Friday. Want a reminder?") fail("text chunks do not add up to the reply");
const doneEvent = events.at(-1)!;
if (doneEvent.data.messages?.at(-1)?.body !== "Friday. Want a reminder?") fail("done does not carry the stored reply");
setBrainModel(async () => { throw new Error("boom"); });
wire.length = 0;
await streamAgentReply(fakeRes, streamChat.id, "again");
if (!wire.join("").includes("event: error") || wire.join("").includes("boom")) fail("a failed stream must end with a plain error event");
setBrainModel(null);

// ---------- Reservation reads always carry an explicit window ----------
resetHospitableConnection();
const seenArgs: { name: string; args: Record<string, unknown> }[] = [];
setHospitableProbe(async (token, name, args) => {
  if (token !== "window-token-not-a-secret-9Zx") throw new Error("rejected");
  seenArgs.push({ name, args });
  return { data: [] };
});
await saveHospitableToken("window-token-not-a-secret-9Zx");
// Parity's clock is 2026-10-20: 30 days back is 2026-09-20, 365 ahead is 2027-10-20.
await hospitableRead("get-reservations", { properties: ["p1"] });
const bare = seenArgs.at(-1)!.args;
if (bare.start_date !== "2026-09-20" || bare.end_date !== "2027-10-20" || bare.date_query !== "checkout") fail(`default window ${JSON.stringify(bare)}`);
await callToolForChat("hospitable_read", { name: "get-reservations", arguments: { properties: ["p1"], include: "guest" } }, "c1");
const viaAgent = seenArgs.at(-1)!.args;
if (viaAgent.start_date !== "2026-09-20" || viaAgent.end_date !== "2027-10-20") fail(`the agent's read has no window ${JSON.stringify(viaAgent)}`);
if (viaAgent.include !== "guest") fail("the window dropped the other arguments");
await hospitableRead("get-reservations", { properties: ["p1"], start_date: "2026-11-01", end_date: "2026-11-30", date_query: "checkin" });
const explicit = seenArgs.at(-1)!.args;
if (explicit.start_date !== "2026-11-01" || explicit.end_date !== "2026-11-30" || explicit.date_query !== "checkin") fail("a read that names its own window was changed");
const half = withReservationWindow({ start_date: "2026-10-01" }, new Date("2026-10-31T12:00:00-04:00"));
if (half.start_date !== "2026-10-01" || half.end_date !== "2027-10-31") fail(`half a window ${JSON.stringify(half)}`);
// The guest who checked in Oct 26 is in a read made on Oct 31.
const oct31 = withReservationWindow({}, new Date("2026-10-31T12:00:00-04:00"));
if (!(String(oct31.start_date) <= "2026-10-26" && "2026-10-26" <= String(oct31.end_date))) fail("an Oct 26 check-in is outside the window on Oct 31");
await hospitableRead("get-properties", {});
if ("start_date" in seenArgs.at(-1)!.args) fail("a window was added to a read that isn't reservations");
setHospitableProbe(null);
resetHospitableConnection();

// ---------- Saved skills run on the brain, with the same tools and the same approvals ----------
const skill = await saveSkill({ name: "Morning check", when_text: "Every morning", reads: "Hospitable", drafts: "A short report", must_not: "Send anything", enabled: true, kind: "playbook", schedule: "daily", phone: "" });
resetCaptures();
let seenPrompt = "";
let seenTools: string[] = [];
let skillRound = 0;
setBrainModel(async (request) => {
  skillRound += 1;
  if (skillRound === 1) {
    seenPrompt = request.system;
    seenTools = (request.tools ?? []).map((tool) => tool.name);
    const input = { headline: "Nothing waiting", text: "No guest is waiting on a reply.", needs_you: false };
    return { text: "", toolUses: [{ id: "r1", name: "post_report", input }], blocks: [{ type: "tool_use", id: "r1", name: "post_report", input }], stop: "tool_use" };
  }
  return { text: "Report posted.", toolUses: [], blocks: [{ type: "text", text: "Report posted." }], stop: "end_turn" };
});
const ran = await startSkillRun(skill.id, "manual");
if (ran.status !== "ok" || !ran.finished_at) fail(`skill run ended ${ran.status} ${ran.error}`);
if (capturedReports().length !== 1 || capturedReports()[0]!.headline !== "Nothing waiting") fail("the skill's report was not posted through the tool");
if (!/Skill: Morning check/.test(seenPrompt) || !/It must not: Send anything/.test(seenPrompt)) fail("the skill's own rules did not reach the brain");
for (const needed of ["post_report", "propose_draft", "hospitable_read", "search_mail", "unit_facts"]) if (!seenTools.includes(needed)) fail(`a skill run lacks ${needed}`);
if (capturedCommits().length) fail("a skill run committed something");
// A brain that doesn't answer fails the run plainly, and leaves a "couldn't finish" note, not a false all-clear.
setBrainModel(async () => null);
const failed = await startSkillRun(skill.id, "manual");
if (failed.status !== "failed" || !/AI brain didn't answer/.test(failed.error)) fail(`a silent brain: ${failed.status} ${failed.error}`);
const skillChat = ((await listSkills()).find((row) => row.id === skill.id)?.chat_id ?? "") as string;
const failureNote = (await listMessages(skillChat)).find((row) => /stopped at/.test(row.body))?.body ?? "";
if (!/What it tried:/.test(failureNote) || !/What came back: The AI brain didn't answer/.test(failureNote) || !/Suggested fix: Try Run now again/.test(failureNote)) fail(`a failed skill run left no plain note: ${failureNote}`);
setBrainModel(null);
let noBrainError = "";
try {
  await startSkillRun(skill.id, "manual");
} catch (err) {
  noBrainError = err instanceof Error ? err.message : "";
}
if (!/AI brain isn't connected/.test(noBrainError)) fail(`no brain: ${noBrainError}`);

console.log("Brain harness passed.");
