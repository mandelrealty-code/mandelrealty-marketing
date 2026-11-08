/**
 * Cost control for the agent team, in code: Meta first by job table, one fallback then stop, Claude only for hard jobs,
 * small context, an event for every call, a cache, a monthly ceiling that pauses the agent, and cost counted per agent.
 * No real API is called.
 */

import { readFileSync } from "node:fs";
import { setBrainFetch, setBrainModel } from "./brain.js";
import { aiCall, CEILINGS, costReport, costViews, JOBS, theoJobFor } from "./aiGateway.js";
import { setParityClock } from "./parity/clock.js";
import { teamBoard } from "./team.js";
import { resetWatchMeta } from "./watchMeta.js";

function fail(label: string): never {
  throw new Error("AI gateway harness failed: " + label);
}

process.env.META_API_KEY = "test-meta";
process.env.ANTHROPIC_API_KEY = "test-claude";
delete process.env.META_PRICE_IN_PER_MTOK;
delete process.env.META_PRICE_OUT_PER_MTOK;
setBrainModel(null);
const NOW = new Date("2026-11-10T15:00:00Z");
setParityClock(NOW);

type Plan = { meta: number | "ok"; claude: number | "ok"; usage?: [number, number] };
let calls: { who: "meta" | "claude"; model: string }[] = [];
const fake = (plan: Plan) => {
  calls = [];
  setBrainFetch((async (url: string, init?: { body?: string }) => {
    const who = String(url).includes("anthropic.com") ? "claude" : "meta";
    const model = JSON.parse(init?.body ?? "{}").model as string;
    calls.push({ who, model });
    const outcome = plan[who];
    if (outcome !== "ok") return new Response("{}", { status: outcome });
    const [i, o] = plan.usage ?? [100, 50];
    return new Response(JSON.stringify({ content: [{ type: "text", text: "answer " + n() }], usage: { input_tokens: i, output_tokens: o } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch);
};
const n = () => calls.length;
const go = (job: keyof typeof JOBS, user: string, event = "a new message") => aiCall({ job, event, system: "You help.", user }, NOW);

// 3. An easy job asks Meta first; if Meta fails it asks Claude once and stops.
resetWatchMeta();
fake({ meta: 500, claude: "ok" });
let r = await go("theo_draft", "Guest asks about parking.");
if (!r.ok || calls.map((c) => c.who).join() !== "meta,claude" || r.provider !== "anthropic" || r.model !== "claude-sonnet-4-6") fail("fallback: " + JSON.stringify(calls) + JSON.stringify(r));
// A working Meta answers an easy job and Claude is never asked.
fake({ meta: "ok", claude: "ok" });
r = await go("theo_draft", "Guest asks about late checkout.");
if (!r.ok || n() !== 1 || calls[0]!.who !== "meta") fail("meta first: " + JSON.stringify(calls));
// 4. Both down: exactly one try each, then stop and say so. The agent shows as Retrying.
fake({ meta: 500, claude: 500 });
r = await go("watch_triage", "sort these");
if (r.ok || r.reason !== "failed" || n() !== 2) fail("one retry only: " + JSON.stringify(calls));
if ((await teamBoard(NOW)).agents.find((a) => a.id === "copilot")!.state !== "retrying") fail("the agent should show Retrying");
// 5. A hard job never touches Meta.
fake({ meta: "ok", claude: "ok" });
r = await go("theo_complaint", "The flat was filthy, I want a refund.");
if (!r.ok || calls.some((c) => c.who === "meta") || n() !== 1) fail("hard job: " + JSON.stringify(calls));
if (theoJobFor("The place was filthy, refund please") !== "theo_complaint" || theoJobFor("What time is checkout?") !== "theo_draft") fail("which guest messages are hard");
// 1b. Nothing in the table sends an easy job to Claude only.
for (const [name, job] of Object.entries(JOBS)) if (job.tier === "hard" && job.task !== "hard") fail(name + " is hard but not routed hard");

// 3. No event, no call. 2. Over its context limit, no call.
fake({ meta: "ok", claude: "ok" });
const noEvent = await aiCall({ job: "theo_draft", event: " ", system: "x", user: "y" }, NOW);
if (noEvent.ok || noEvent.reason !== "no-event" || n()) fail("a call with no event");
const big = await go("penny_explain", "x".repeat(JOBS.penny_explain.maxInputTokens * 4 + 40));
if (big.ok || big.reason !== "too-large" || n()) fail("a prompt over the context limit");

// 4. The same job on the same input is answered from the cache, free.
resetWatchMeta();
fake({ meta: "ok", claude: "ok" });
const first = await go("nora_reply", "Review: lovely stay.");
const second = await go("nora_reply", "Review: lovely stay.");
if (!first.ok || !second.ok || n() !== 1 || !second.cached || second.text !== first.text) fail("the cache: " + n());
const other = await go("nora_reply", "Review: noisy street.");
if (!other.ok || other.cached || n() !== 2) fail("a different input must be asked");

// 7. Meta has no price set: tokens are counted, dollars are not guessed.
let views = await costViews(NOW);
if (views.agents.nora.calls !== 2 || views.agents.nora.cached !== 1 || views.agents.nora.month !== 0 || views.agents.nora.unpricedTokens !== 300) fail("meta tokens: " + JSON.stringify(views.agents.nora));
if (views.agents.nora.jobs[0]!.model !== "Meta" || views.agents.nora.jobs[0]!.perCall !== null) fail("job model/per call: " + JSON.stringify(views.agents.nora.jobs));

// 6. A priced model at the ceiling pauses the agent: no more calls, and the Team page says so.
resetWatchMeta();
fake({ meta: 500, claude: "ok", usage: [10, 700_000] }); // Haiku at $5 per million output: $3.50, over Penny's $3.
const spend = await go("penny_explain", "Explain the Shaw price.");
if (!spend.ok || spend.usd < 3) fail("the call that crosses the ceiling: " + JSON.stringify(spend));
if (CEILINGS.penny !== 3 || CEILINGS.theo !== 15 || CEILINGS.nora !== 5 || CEILINGS.copilot !== 5) fail("the approved ceilings");
fake({ meta: "ok", claude: "ok" });
const blocked = await go("penny_explain", "A different question.");
if (blocked.ok || blocked.reason !== "paused" || n()) fail("a paused agent made a call");
views = await costViews(NOW);
if (!views.agents.penny.paused || views.agents.penny.month < 3 || views.agents.theo.paused) fail("pause is per agent: " + JSON.stringify(views.agents.penny));
const board = await teamBoard(NOW);
if (board.agents.find((a) => a.id === "penny")!.state !== "stopped") fail("Penny should show Stopped");
// The cached answer is still free to read while paused.
const again = await go("penny_explain", "Explain the Shaw price.");
if (!again.ok || !again.cached) fail("a cached answer while paused");
// Next month starts clean.
const next = await aiCall({ job: "penny_explain", event: "a new month", system: "You help.", user: "A different question." }, new Date("2026-12-02T15:00:00Z"));
if (!next.ok) fail("a new month should start unpaused");

// 7. The report is real numbers per job.
setParityClock(NOW);
resetWatchMeta();
fake({ meta: "ok", claude: "ok" });
await go("theo_draft", "One.");
if (!/theo_draft: 1 call, 0 from cache, Meta, 150 tokens, no price set/.test(await costReport(NOW))) fail("the report: " + (await costReport(NOW)));

// Every team agent reaches a model only through the gateway.
for (const file of ["team.ts"]) if (/from "\.\/brain\.js"/.test(readFileSync(new URL("./" + file, import.meta.url), "utf8"))) fail(file + " imports the brain directly");

console.log("AI gateway harness passed.");
