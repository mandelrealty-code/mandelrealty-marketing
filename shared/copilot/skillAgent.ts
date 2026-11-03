/**
 * Running a saved skill, or a workflow from the builder, through the same agent loop chat uses.
 *
 * - A skill's own words become the brain's task, with only the tools it is allowed and the rules it was saved with.
 * - A workflow runs its steps in order, each one through the loop, with what the earlier steps found carried forward.
 * - When something fails, it says exactly where, what it tried and what came back, with a fix when it has one.
 *
 * Nothing here sends outside the company. "Text me" tells a partner. A draft for anyone else waits for Submit.
 */

import { agentSystem, agentTools, SKILL_TOOL_NAMES, STEP_LABELS } from "./agentChat.js";
import { runLoop, type AgentTool, type LoopOutcome, type ToolCall } from "./agentLoop.js";
import { factsForPrompt, listFacts, relevantFacts } from "./businessFacts.js";
import { failure, type Failure } from "./skillFailure.js";
import { allowedToolNames, handlingOf, HANDLING_LINE } from "./skillPolicy.js";
import { callToolForRun } from "./toolServer.js";
import { torontoToday } from "./time.js";
import type { WfNode, Workflow } from "./workflow.js";
import type { CopilotRun, CopilotSkill } from "./types.js";

export type Paused = { remaining: string[]; context: string; waitingFor: string };
export type WorkOutcome = { ok: true; final: string; paused?: Paused; drafted?: boolean } | { ok: false; failure: Failure };

const RUN_BUDGET_MS = 240_000;
const SKILL_ROUNDS = 30;
const STEP_ROUNDS = 8;

const toolName = (call: ToolCall) => {
  const first = Object.values(call.input).find((value) => typeof value === "string" && value.length < 60);
  return first ? `${call.tool} ${String(first)}` : call.tool;
};
const triedOf = (calls: ToolCall[]) => (calls.length ? calls.slice(-3).map(toolName).join(", then ") : "to think it through");

/** Why a loop that didn't finish stopped, in plain words, with what the last failing tool said. */
function stoppedBecause(loop: LoopOutcome): string {
  const lastFailed = [...loop.calls].reverse().find((call) => !call.ok);
  if (loop.end === "brain") return "The AI brain didn't answer. Nothing was sent.";
  if (loop.end === "deadline") return "It ran too long, so I stopped it.";
  if (loop.end === "rounds") return `It used up its steps before it finished.${lastFailed ? ` The last thing that failed: ${lastFailed.result}` : ""}`;
  return lastFailed?.result ?? "It stopped.";
}

async function factsBlock(blob: string): Promise<string> {
  return factsForPrompt(relevantFacts(await listFacts().catch(() => []), blob, 12));
}

// ---------- A skill described in words ----------

async function skillBlock(skill: CopilotSkill, trigger: CopilotRun["trigger"], previous: string): Promise<string> {
  const handling = handlingOf(skill);
  return [
    `You are running one of the partners' saved skills on your own while they are away. A chat question is a one-off skill and this is a repeating one: bring the same care.`,
    "",
    `Skill: ${skill.name}`,
    `When it runs: ${skill.when_text}`,
    `What it reads or may touch: ${skill.reads}`,
    `What it leaves for the partners: ${skill.drafts}`,
    `It must not: ${skill.must_not}`,
    handling ? `How it handles things: ${HANDLING_LINE[handling]}` : "",
    "",
    `${trigger === "manual" ? "A partner pressed Run now." : "This is the scheduled morning run."}`,
    "",
    "Use only the tools you were given. Anything for a guest, a client, a building, or any third party is propose_draft and waits until a partner presses Submit. Never say one was sent. Never purchase anything.",
    handling === "notify" ? "This skill only tells the partners. Do not draft anything for anyone else and do not change anything." : "",
    handling === "ask" ? "This skill asks first: leave drafts and suggestions, and do nothing outward." : "",
    handling === "autonomous" ? "This skill handles things on its own, but only inside what it may touch and what the tools allow. Outward messages still wait for Submit." : "",
    "Deliver to the partners with deliver_to_partners: in the app, by email, or by text. If a channel is not configured, say so; do not switch to another.",
    "Use web_lookup when you need something from the web. Cite what you found.",
    "For anything about a unit (check-in and check-out times, parking, rules, amenities) use unit_facts: the Hospitable Knowledge Hub is the source. Access codes, door codes, and WiFi passwords stay in the Hospitable Knowledge Hub. Do not put them in a draft.",
    "For details found in guest messages, say the guest may have sent it, and quote the line.",
    "If a tool fails, say so in the report. Never report an all-clear after a failed read.",
    "If the skill needs something no tool can do, say plainly what you could not do.",
    "Write the report for two busy partners: short headings, one line per guest or item, no markdown. Pass title, summary and sections to post_report as well as the plain text, so it shows as a tidy card.",
    "Finish by calling post_report exactly once. Set needs_you true when someone is waiting, something changed since the last report, a draft is waiting, or something failed.",
    "",
    "Last report from this skill, to say what changed:",
    previous || "(none yet)",
  ].filter((line) => line !== "").join("\n");
}

function skillTools(run: CopilotRun, skill: CopilotSkill): AgentTool[] {
  const all = agentTools({ run, skill, names: SKILL_TOOL_NAMES });
  const allowed = new Set(allowedToolNames(skill, all.map((tool) => tool.name)));
  return all.filter((tool) => allowed.has(tool.name));
}

async function runSkillWords(run: CopilotRun, skill: CopilotSkill, trigger: CopilotRun["trigger"], previous: string): Promise<WorkOutcome> {
  const system = [agentSystem(await factsBlock(`${skill.name} ${skill.reads} ${skill.drafts}`), torontoToday()), await skillBlock(skill, trigger, previous)].join("\n\n");
  const loop = await runLoop({
    system,
    messages: [{ role: "user", content: "Run the skill now. Finish by calling post_report once." }],
    tools: skillTools(run, skill),
    chatId: skill.chat_id ?? "",
    // The same route a chat ask takes, so a saved skill is exactly as smart as a question typed in chat.
    task: "chat",
    maxRounds: SKILL_ROUNDS,
    maxTokens: 4000,
    deadline: Date.now() + RUN_BUDGET_MS,
    label: (name) => STEP_LABELS[name] ?? `Used ${name}`,
  });
  if (loop.end !== "done") {
    return { ok: false, failure: failure({ where: loop.calls.length ? `the run, after ${loop.calls.length} tool call${loop.calls.length === 1 ? "" : "s"}` : "the start of the run", tried: triedOf(loop.calls), cameBack: stoppedBecause(loop) }) };
  }
  return { ok: true, final: loop.text, drafted: loop.calls.some((call) => call.tool === "propose_draft" && call.ok) };
}

// ---------- A workflow from the builder ----------

/** The steps in the order they run: follow the links from the top, the left branch first, never a step before the one that feeds it. */
export function stepOrder(wf: Workflow): WfNode[] {
  const byId = new Map(wf.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>(wf.nodes.map((node) => [node.id, 0]));
  for (const edge of wf.edges) if (byId.has(edge.from) && byId.has(edge.to)) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const spot = (a: WfNode, b: WfNode) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
  const ready = wf.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).sort(spot);
  const out: WfNode[] = [];
  const seen = new Set<string>();
  while (ready.length) {
    const node = ready.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    out.push(node);
    for (const edge of wf.edges.filter((item) => item.from === node.id)) {
      const left = (incoming.get(edge.to) ?? 1) - 1;
      incoming.set(edge.to, left);
      const next = byId.get(edge.to);
      if (next && left <= 0) ready.push(next);
    }
    ready.sort(spot);
  }
  return out.concat(wf.nodes.filter((node) => !seen.has(node.id)).sort(spot));
}

/** Every step that comes after this one, along the links. */
export function stepsAfter(wf: Workflow, id: string): Set<string> {
  const found = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const edge of wf.edges.filter((item) => item.from === current)) {
      if (!found.has(edge.to)) {
        found.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return found;
}

const READ_TOOLS = ["guest_inbox", "list_stays", "read_guest_messages", "guest_contacts", "hospitable_read", "unit_facts", "search_mail", "read_mail", "open_link", "last_sent_email", "ops_clients", "ops_revenue", "cleaner_read", "market_comps", "resolve_client", "recall_facts", "connector_status", "web_lookup", "sheet_read", "find_furniture", "furniture_stores"];
const STEP_TOOLS: Record<string, string[]> = {
  Read: READ_TOOLS,
  "Look on the web": ["web_lookup", "research_web", "recall_facts"],
  Write: [...READ_TOOLS, "propose_draft", "make_pdf", "furniture_report"],
  "Text me": ["deliver_to_partners"],
};

function stepInstruction(node: WfNode, context: string): string {
  const carried = context ? `What the earlier steps found:\n${context}\n\n` : "";
  if (node.fn === "Read") return `${carried}STEP: Read. Read: ${node.note}. Reads from: ${node.field || "whatever fits"}.\nUse your tools to read it for real. Answer with what you found: exact names, dates and quotes. If a read failed, say so plainly and do not guess.`;
  if (node.fn === "Look on the web") return `${carried}STEP: Look on the web. Find out: ${node.note}. Where to look: ${node.field || "wherever fits"}.\nUse web_lookup (and research_web for a specific page). Answer with what you found and where you found it. If you could not find it, say so.`;
  if (node.fn === "Write") return `${carried}STEP: Write. Write: ${node.note}. Tone: ${node.field || "short and plain"}.\nUse what the earlier steps found, nothing invented. If this is for a guest, a client, a building or anyone outside the company, call propose_draft so it waits for a partner to press Submit, then say it is waiting. If it is only for the partners, write it as your answer.`;
  if (node.fn === "Text me") return `${carried}STEP: Text me. Text the partner, in under 300 characters, about: ${node.note}.\nCall deliver_to_partners once with channels ["text"], a short headline, and that text. This is a notice to a partner, not a message to a guest.`;
  return `${carried}STEP: ${node.fn}. ${node.note}`;
}

type StepLog = { node: WfNode; output: string };

const carry = (log: StepLog[]) => log.map((entry) => `${entry.node.fn}: ${entry.node.note}\n${entry.output}`).join("\n\n").slice(-6000);

async function runWorkflowSteps(run: CopilotRun, skill: CopilotSkill, wf: Workflow, resume: Paused | null): Promise<WorkOutcome> {
  const order = stepOrder(wf);
  const doneIds = new Set<string>();
  const skip = resume ? new Set(order.filter((node) => !resume.remaining.includes(node.id)).map((node) => node.id)) : new Set<string>();
  const log: StepLog[] = resume ? [{ node: { id: "before", fn: "When", note: "Earlier in this run", field: "", x: 0, y: 0 }, output: resume.context }] : [];
  const blocked = new Set<string>();
  const facts = await factsBlock(`${skill.name} ${wf.nodes.map((node) => node.note).join(" ")}`);
  const system = [agentSystem(facts, torontoToday()), `You are running the workflow "${wf.name}" for the partners, one step at a time. ${wf.boundary ? `Its boundary: ${wf.boundary}` : ""} Anything for a guest, a client, a building or any third party waits for a partner to press Submit. Never purchase anything. Use only the tools you were given for this step.`].join("\n\n");
  const all = agentTools({ run, skill, names: SKILL_TOOL_NAMES });
  const started = Date.now();
  let drafted = false;
  for (const node of order) {
    if (skip.has(node.id) || blocked.has(node.id)) continue;
    const where = `step ${order.indexOf(node) + 1} of ${order.length} (${node.fn}: ${node.note || node.field || "no note"})`;
    if (node.fn === "When") {
      doneIds.add(node.id);
      log.push({ node, output: `Started: ${node.note}${node.field ? ` (${node.field})` : ""}.` });
      continue;
    }
    if (node.fn === "Wait for you") {
      for (const id of stepsAfter(wf, node.id)) blocked.add(id);
      log.push({ node, output: `Paused: ${node.field || "waiting for the partner"}.` });
      doneIds.add(node.id);
      continue;
    }
    if (node.fn === "Text me" && !(node.field.trim() || skill.phone.trim())) {
      return { ok: false, failure: failure({ where, tried: "texting the partner", cameBack: "No partner number is on the Text me step, so nothing was texted." }) };
    }
    const allowed = new Set(STEP_TOOLS[node.fn] ?? []);
    const loop = await runLoop({
      system,
      messages: [{ role: "user", content: stepInstruction(node, carry(log)) }],
      tools: all.filter((tool) => allowed.has(tool.name)),
      chatId: skill.chat_id ?? "",
      task: "chat",
      maxRounds: STEP_ROUNDS,
      maxTokens: 2500,
      deadline: started + RUN_BUDGET_MS,
      label: (name) => STEP_LABELS[name] ?? `Used ${name}`,
    });
    const failed = loop.calls.filter((call) => !call.ok);
    const delivered = loop.calls.find((call) => call.tool === "deliver_to_partners" && call.ok);
    const notes = delivered ? (JSON.parse(delivered.result || "{}") as { notes?: string[] }).notes ?? [] : [];
    const textProblem = node.fn === "Text me" ? (!delivered ? "Nothing was texted: the step never delivered." : notes.find((note) => /nothing was texted|no partner number|not configured/i.test(note))) : undefined;
    const everyReadFailed = loop.calls.length > 0 && failed.length === loop.calls.length && node.fn !== "Write";
    if (loop.end !== "done" || textProblem || everyReadFailed) {
      const last = failed[failed.length - 1];
      return { ok: false, failure: failure({ where, tried: triedOf(loop.calls), cameBack: textProblem ?? (loop.end !== "done" ? stoppedBecause(loop) : last?.result ?? "It stopped.") }) };
    }
    if (loop.calls.some((call) => call.tool === "propose_draft" && call.ok)) drafted = true;
    log.push({ node, output: loop.text || "(it left a draft for the partner)" });
    doneIds.add(node.id);
  }
  const remaining = order.filter((node) => !doneIds.has(node.id) && !skip.has(node.id)).map((node) => node.id);
  const summary = log.filter((entry) => entry.node.id !== "before").map((entry) => `${entry.node.fn}: ${entry.output}`).join("\n");
  if (remaining.length) {
    const waiting = order.find((node) => node.fn === "Wait for you" && doneIds.has(node.id));
    return { ok: true, final: summary, drafted, paused: { remaining, context: carry(log), waitingFor: waiting?.field || "your OK" } };
  }
  return { ok: true, final: summary, drafted };
}

// ---------- One way in ----------

/** Runs the skill: its workflow step by step when it has steps, otherwise its own words, through the same agent loop. */
export async function executeSkill(input: { run: CopilotRun; skill: CopilotSkill; trigger: CopilotRun["trigger"]; previous: string; resume?: Paused | null }): Promise<WorkOutcome> {
  const wf = input.skill.workflow;
  if (wf && wf.nodes.length) return runWorkflowSteps(input.run, input.skill, wf, input.resume ?? null);
  return runSkillWords(input.run, input.skill, input.trigger, input.previous);
}

/** The report a workflow leaves, posted through the same tool a skill uses. */
export async function postWorkflowReport(run: CopilotRun, skill: CopilotSkill, outcome: Extract<WorkOutcome, { ok: true }>): Promise<void> {
  const paused = outcome.paused;
  await callToolForRun(
    "post_report",
    {
      headline: paused ? `${skill.name}: paused for you` : `${skill.name}: done`,
      text: [outcome.final || "Finished.", paused ? `Paused: waiting for ${paused.waitingFor}. Press Run now to carry on with the rest.` : "", outcome.drafted ? "A draft is waiting for you to submit. Nothing was sent." : ""].filter(Boolean).join("\n\n"),
      needs_you: Boolean(paused || outcome.drafted),
      title: `${skill.name}`,
      summary: paused ? "Paused for you. Nothing was sent." : "Nothing was sent.",
    },
    run,
    skill,
  );
}
