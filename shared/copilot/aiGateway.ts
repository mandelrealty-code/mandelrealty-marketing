/**
 * The one door every team agent uses to reach a model. The rules live here, in code, so no prompt can bend them:
 *   1. Meta first by job table. An easy job tries Meta once, then Claude once, then stops. A hard job goes to Claude only.
 *      A job names itself; it never names a model.
 *   2. Small context. Each job has a token limit on what it may send. Over it, the call is refused, not trimmed silently.
 *   3. Event driven. A call must name the event that woke it. No event, no call.
 *   4. No repeats. The same job on the same input is answered from the cache, at no cost.
 *   5. One retry only. Two calls at most (Meta, then Claude); after that the agent says so and waits for the next event.
 *   6. A monthly dollar ceiling per agent. At the ceiling the agent pauses itself, tells the partners, and makes no calls.
 *   7. Every call is logged with the agent, the job, the model and the tokens; dollars where the model has a price.
 */

import { createHash } from "node:crypto";
import { brainAvailable, complete, type BrainTask } from "./brain.js";
import { parityNow } from "./parity/clock.js";
import { partnerNumbers, sendPartnerText } from "./partnerText.js";
import { torontoToday } from "./time.js";
import { costOf, readMeta, writeMeta } from "./watchMeta.js";

export type AgentId = "copilot" | "theo" | "nora" | "penny";

/** Approved monthly ceilings, in dollars. Changing one is a code change. */
export const CEILINGS: Record<AgentId, number> = { theo: 15, nora: 5, penny: 3, copilot: 5 };
export const TEAM_CEILING = 28;

export type Job = {
  agent: AgentId;
  /** Easy jobs go to Meta first. Hard jobs go to Claude only. */
  tier: "easy" | "hard";
  task: BrainTask;
  /** The most input, in tokens (estimated at 4 characters each), this job may send. */
  maxInputTokens: number;
  maxOutputTokens: number;
  /** How long an answer to the same input is reused. */
  cacheDays: number;
  label: string;
};

export const JOBS = {
  watch_triage: { agent: "copilot", tier: "easy", task: "simple", maxInputTokens: 6000, maxOutputTokens: 1200, cacheDays: 1, label: "Sorting what needs a partner" },
  theo_draft: { agent: "theo", tier: "easy", task: "draft", maxInputTokens: 4000, maxOutputTokens: 600, cacheDays: 7, label: "Drafting a guest reply" },
  theo_complaint: { agent: "theo", tier: "hard", task: "hard", maxInputTokens: 6000, maxOutputTokens: 900, cacheDays: 7, label: "Answering a guest complaint" },
  nora_reply: { agent: "nora", tier: "easy", task: "draft", maxInputTokens: 2000, maxOutputTokens: 400, cacheDays: 30, label: "Drafting a review reply" },
  penny_explain: { agent: "penny", tier: "easy", task: "simple", maxInputTokens: 1500, maxOutputTokens: 300, cacheDays: 1, label: "Explaining a price proposal" },
  copilot_chat: { agent: "copilot", tier: "easy", task: "simple", maxInputTokens: 3000, maxOutputTokens: 500, cacheDays: 1, label: "Answering a question to Copilot" },
  theo_chat: { agent: "theo", tier: "easy", task: "simple", maxInputTokens: 3000, maxOutputTokens: 500, cacheDays: 1, label: "Answering a question on Theo's desk" },
  nora_chat: { agent: "nora", tier: "easy", task: "simple", maxInputTokens: 3000, maxOutputTokens: 500, cacheDays: 1, label: "Answering a question on Nora's desk" },
  penny_chat: { agent: "penny", tier: "easy", task: "simple", maxInputTokens: 3000, maxOutputTokens: 500, cacheDays: 1, label: "Answering a question on Penny's desk" },
} as const satisfies Record<string, Job>;
export type JobName = keyof typeof JOBS;

/** A guest message that needs the strong model: a complaint, damage, a refund, a safety problem. Fixed words, never a model. */
export const HARD_GUEST = /\b(refund|compensat\w*|complain\w*|unacceptable|disgust\w*|filthy|dirty|broken|damage\w*|unsafe|bed ?bugs?|mold|mould|cockroach\w*|lawyer|police|review you|report you|injur\w*|flood\w*|no hot water|no heat|locked out)\b/i;
export const theoJobFor = (guestText: string): JobName => (HARD_GUEST.test(guestText) ? "theo_complaint" : "theo_draft");

// ---------- What it remembers: one document per month ----------

export type AgentCost = { usd: number; calls: number; cached: number; failed: number; metaIn: number; metaOut: number; claudeIn: number; claudeOut: number; unpricedTokens: number; byDay: Record<string, number> };
export type JobCost = { agent: AgentId; calls: number; cached: number; usd: number; metaCalls: number; claudeCalls: number; tokens: number; unpricedTokens: number; lastModel: string };
export type CallLog = { at: string; agent: AgentId; job: string; provider: string; model: string; input: number; output: number; usd: number; priced: boolean; cached: boolean; event: string };
export type MonthCost = {
  month: string;
  agents: Partial<Record<AgentId, AgentCost>>;
  jobs: Record<string, JobCost>;
  paused: Partial<Record<AgentId, string>>;
  notified: Partial<Record<AgentId, string>>;
  failed: Partial<Record<AgentId, { at: string; job: string }>>;
  log: CallLog[];
};

const monthKey = (month: string) => `meta:cost:${month}`;
const blank = (month: string): MonthCost => ({ month, agents: {}, jobs: {}, paused: {}, notified: {}, failed: {}, log: [] });
const emptyAgent = (): AgentCost => ({ usd: 0, calls: 0, cached: 0, failed: 0, metaIn: 0, metaOut: 0, claudeIn: 0, claudeOut: 0, unpricedTokens: 0, byDay: {} });
const nowOf = () => parityNow() ?? new Date();

export async function readMonth(now: Date = nowOf()): Promise<MonthCost> {
  const month = torontoToday(now).slice(0, 7);
  return { ...blank(month), ...((await readMeta<MonthCost>(monthKey(month))) ?? {}) };
}
const saveMonth = (doc: MonthCost) => writeMeta(monthKey(doc.month), doc);

/** Dollars this agent has spent this month that the code can see (Meta calls with no price set are counted in tokens only). */
export async function spentThisMonth(agent: AgentId, now: Date = nowOf()): Promise<number> {
  return (await readMonth(now)).agents[agent]?.usd ?? 0;
}

export async function isPaused(agent: AgentId, now: Date = nowOf()): Promise<boolean> {
  const doc = await readMonth(now);
  return Boolean(doc.paused[agent]) || (doc.agents[agent]?.usd ?? 0) >= CEILINGS[agent];
}

// ---------- The cache ----------

const cacheKey = (job: string, system: string, user: string) => "meta:aicache:" + job + ":" + createHash("sha256").update(system + "\u0000" + user).digest("hex").slice(0, 32);
type Cached = { text: string; at: string; model: string };

// ---------- The call ----------

export type AiResult =
  | { ok: true; text: string; provider: string; model: string; cached: boolean; usd: number; input: number; output: number }
  | { ok: false; reason: "no-event" | "too-large" | "paused" | "failed" | "unavailable"; note: string };

const tokensOf = (text: string) => Math.ceil(text.length / 4);

export async function aiCall(input: { job: JobName; event: string; system: string; user: string }, now: Date = nowOf()): Promise<AiResult> {
  const job: Job | undefined = JOBS[input.job];
  if (!job) return { ok: false, reason: "failed", note: "That job is not on the job table. Nothing was called." };
  const agent = job.agent;
  if (!input.event.trim()) return { ok: false, reason: "no-event", note: "No event woke this job, so the AI was not called." };
  if (tokensOf(input.system) + tokensOf(input.user) > job.maxInputTokens) {
    return { ok: false, reason: "too-large", note: "That is more than this job is allowed to read at once. The AI was not called." };
  }
  const key = cacheKey(input.job, input.system, input.user);
  const hit = await readMeta<Cached>(key);
  if (hit && now.getTime() - Date.parse(hit.at) < job.cacheDays * 86_400_000) {
    const doc = await readMonth(now);
    const row = (doc.agents[agent] ??= emptyAgent());
    row.cached += 1;
    (doc.jobs[input.job] ??= { agent, calls: 0, cached: 0, usd: 0, metaCalls: 0, claudeCalls: 0, tokens: 0, unpricedTokens: 0, lastModel: "" }).cached += 1;
    await saveMonth(doc);
    return { ok: true, text: hit.text, provider: "cache", model: hit.model, cached: true, usd: 0, input: 0, output: 0 };
  }
  const before = await readMonth(now);
  if (before.paused[agent] || (before.agents[agent]?.usd ?? 0) >= CEILINGS[agent]) {
    return { ok: false, reason: "paused", note: "Paused: this agent reached its monthly ceiling of $" + CEILINGS[agent] + ". The AI was not called." };
  }
  if (!brainAvailable()) return { ok: false, reason: "unavailable", note: "No AI is connected. Nothing was called." };

  const result = await complete({ task: job.task, system: input.system, user: input.user, maxTokens: job.maxOutputTokens, once: true, ...(job.tier === "hard" ? { claudeOnly: true } : {}) }).catch(() => null);
  const doc = await readMonth(now);
  const row = (doc.agents[agent] ??= emptyAgent());
  const jobRow = (doc.jobs[input.job] ??= { agent, calls: 0, cached: 0, usd: 0, metaCalls: 0, claudeCalls: 0, tokens: 0, unpricedTokens: 0, lastModel: "" });
  const at = now.toISOString();
  if (!result || !result.text.trim()) {
    row.failed += 1;
    doc.failed[agent] = { at, job: input.job };
    await saveMonth(doc);
    return { ok: false, reason: "failed", note: "The AI did not answer for " + job.label.toLowerCase() + ". Nothing was sent. I will look again on the next change." };
  }
  delete doc.failed[agent];
  const used = result.usage ?? { input: tokensOf(input.system + input.user), output: tokensOf(result.text) };
  const cost = costOf(result.model, used.input, used.output);
  const meta = result.provider === "meta";
  const day = torontoToday(now);
  row.calls += 1;
  row.usd = Math.round((row.usd + cost.usd) * 1_000_000) / 1_000_000;
  row.byDay[day] = Math.round(((row.byDay[day] ?? 0) + cost.usd) * 1_000_000) / 1_000_000;
  if (meta) { row.metaIn += used.input; row.metaOut += used.output; } else { row.claudeIn += used.input; row.claudeOut += used.output; }
  if (!cost.priced) row.unpricedTokens += used.input + used.output;
  jobRow.calls += 1;
  jobRow.usd = Math.round((jobRow.usd + cost.usd) * 1_000_000) / 1_000_000;
  jobRow[meta ? "metaCalls" : "claudeCalls"] += 1;
  jobRow.tokens += used.input + used.output;
  if (!cost.priced) jobRow.unpricedTokens += used.input + used.output;
  jobRow.lastModel = result.model;
  doc.log = [{ at, agent, job: input.job, provider: result.provider, model: result.model, input: used.input, output: used.output, usd: cost.usd, priced: cost.priced, cached: false, event: input.event }, ...doc.log].slice(0, 60);
  // Reaching the ceiling pauses the agent for the rest of the month and tells the partners once. It never keeps working.
  const reached = row.usd >= CEILINGS[agent];
  if (reached && !doc.paused[agent]) doc.paused[agent] = at;
  await saveMonth(doc);
  await writeMeta(key, { text: result.text, at, model: result.model } satisfies Cached);
  if (reached && !doc.notified[agent]) await tellPartners(agent, doc, now);
  return { ok: true, text: result.text, provider: result.provider, model: result.model, cached: false, usd: cost.usd, input: used.input, output: used.output };
}

async function tellPartners(agent: AgentId, doc: MonthCost, now: Date): Promise<void> {
  const name = agent === "copilot" ? "Copilot" : agent[0]!.toUpperCase() + agent.slice(1);
  const body = name + " paused itself: it reached its $" + CEILINGS[agent] + " monthly ceiling. It will make no more AI calls this month. See the Team page.";
  try {
    for (const to of await partnerNumbers()) await sendPartnerText({ to, body, urgent: true });
  } catch {
    // The Team page still shows it.
  }
  doc.notified[agent] = now.toISOString();
  await saveMonth(doc);
}

// ---------- For the Team page ----------

export type CostView = {
  ceiling: number;
  today: number;
  month: number;
  projection: number;
  calls: number;
  cached: number;
  paused: boolean;
  failed: string;
  /** Meta tokens with no price set: counted, not priced, and not held to the ceiling. */
  unpricedTokens: number;
  jobs: { job: string; label: string; calls: number; cached: number; usd: number; perCall: number | null; tokensPerCall: number; model: string; unpricedTokens: number }[];
};

const modelName = (j: JobCost) => (j.metaCalls && j.claudeCalls ? "Meta and Claude" : j.claudeCalls ? "Claude" : j.metaCalls ? "Meta" : "No calls yet");

export async function costViews(now: Date = nowOf()): Promise<{ agents: Record<AgentId, CostView>; total: { today: number; month: number; projection: number; ceiling: number; unpricedTokens: number } }> {
  const doc = await readMonth(now);
  const today = torontoToday(now);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = {} as Record<AgentId, CostView>;
  for (const agent of Object.keys(CEILINGS) as AgentId[]) {
    const a = doc.agents[agent] ?? emptyAgent();
    const jobs = Object.entries(doc.jobs).filter(([, j]) => j.agent === agent).map(([name, j]) => ({
      job: name, label: (JOBS as Record<string, Job>)[name]?.label ?? name, calls: j.calls, cached: j.cached, usd: j.usd,
      perCall: j.calls && j.unpricedTokens < j.tokens ? j.usd / j.calls : null, tokensPerCall: j.calls ? Math.round(j.tokens / j.calls) : 0, model: modelName(j), unpricedTokens: j.unpricedTokens,
    }));
    out[agent] = {
      ceiling: CEILINGS[agent], today: a.byDay[today] ?? 0, month: a.usd, projection: (a.usd / d) * daysInMonth, calls: a.calls, cached: a.cached,
      paused: Boolean(doc.paused[agent]) || a.usd >= CEILINGS[agent], failed: doc.failed[agent] ? doc.failed[agent]!.job : "", unpricedTokens: a.unpricedTokens, jobs,
    };
  }
  const all = Object.values(out);
  return { agents: out, total: { today: all.reduce((s, v) => s + v.today, 0), month: all.reduce((s, v) => s + v.month, 0), projection: all.reduce((s, v) => s + v.projection, 0), ceiling: TEAM_CEILING, unpricedTokens: all.reduce((s, v) => s + v.unpricedTokens, 0) } };
}

/** The shadow-mode cost report: real calls, real dollars, per job, for the days since the clock started. */
export async function costReport(now: Date = nowOf()): Promise<string> {
  const doc = await readMonth(now);
  const lines = Object.entries(doc.jobs).map(([name, j]) => {
    const priced = j.unpricedTokens < j.tokens;
    return name + ": " + j.calls + " call" + (j.calls === 1 ? "" : "s") + ", " + j.cached + " from cache, " + modelName(j) + ", " + j.tokens + " tokens, " + (priced ? "$" + j.usd.toFixed(4) + " (about $" + (j.usd / Math.max(1, j.calls)).toFixed(4) + " a call)" : "no price set for this model, tokens only") + ".";
  });
  return lines.length ? lines.join("\n") : "No AI calls yet this month.";
}

/** The model calls one agent made this month, newest first, for the "tool calls" in its session timeline. */
export async function callsFor(agent: AgentId, now: Date = nowOf()): Promise<(CallLog & { label: string })[]> {
  return (await readMonth(now)).log.filter((c) => c.agent === agent).slice(0, 12).map((c) => ({ ...c, label: (JOBS as Record<string, Job>)[c.job]?.label ?? c.job }));
}
