import { brainAvailable, complete, type BrainBlock, type BrainMessage } from "./brain.js";
import { callToolForRun, runToolDefinitions } from "./toolServer.js";
import {
  addMessage,
  chatExists,
  createChat,
  flagChatNeedsYou,
  getRun,
  listMessages,
  listRunningRuns,
  listRuns,
  listSkills,
  saveSkill,
  startRun,
  updateRun,
} from "./store.js";
import { skillMemoryText } from "./memoryFiles.js";
import { torontoToday } from "./time.js";
import { skillDue } from "./skillSchedule.js";
import type { CopilotRun, CopilotSkill, SkillRow } from "./types.js";

/**
 * Runs saved skills with the brain: it reads through the Copilot tools, and leaves its report and any drafts for the partners.
 * Hospitable reads go through the tools. A change is only a draft until a partner presses Submit.
 */

/** A run lives inside one server call, so one that is still "running" after this was cut off. */
const INTERRUPTED_MS = 10 * 60 * 1000;
/** The longest one run may work, kept inside the function's time limit. */
const RUN_BUDGET_MS = 240_000;
const MAX_ROUNDS = 30;

function prettyToday(): string {
  return new Date(`${torontoToday()}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function runsOnItsOwn(skill: CopilotSkill): boolean {
  return skill.kind === "playbook" && (skill.schedule === "daily" || skill.schedule.startsWith("weekly:"));
}

/** Skills whose switch is on and whose morning has arrived. Afternoon passes do not start them. */
export function skillsToStart(skills: CopilotSkill[], now: Date, lastRunDay: (id: string) => string | null = () => null): CopilotSkill[] {
  return skills.filter((skill) => skillDue(skill, now, lastRunDay(skill.id)));
}

async function lastReport(chatId: string): Promise<string> {
  const messages = await listMessages(chatId).catch(() => []);
  const last = [...messages].reverse().find((m) => m.role === "assistant" && !m.draft);
  return last ? last.body.slice(0, 3000) : "";
}

async function promptFor(skill: CopilotSkill, trigger: CopilotRun["trigger"], previous: string): Promise<string> {
  const memory = await skillMemoryText();
  return [
    "You are Mandel Realty Copilot, running one of the partners' saved skills on your own while they are away.",
    "",
    `Skill: ${skill.name}`,
    `When it runs: ${skill.when_text}`,
    `What it reads: ${skill.reads}`,
    `What it leaves for the partners: ${skill.drafts}`,
    `It must not: ${skill.must_not}`,
    "",
    `Today is ${torontoToday()} in Toronto. ${trigger === "manual" ? "A partner pressed Run now." : "This is the scheduled morning run."}`,
    "",
    "Use hospitable_read to look at Hospitable. It cannot change anything.",
    "Use search_mail and read_mail for mail. They search Gmail and Outlook, inbox and Sent, and read one message in full. They do not send. Set include_airbnb only when the question is about Airbnb email.",
    "To see whether an email thread about a stay already exists, including a building thread, search_mail for the unit or the stay. To see whether anyone replied later, read_mail on that thread and compare the dates.",
    "Use read_memory for a unit's standing file. Pass check_in and check_out from the reservation when you have them. If those times disagree with the file, the tool returns the reservation times.",
    "Use guest_contacts for names and phone numbers on a reservation. If a reservation has no phone, say no phone on this reservation. Do not invent a number.",
    "Use read_knowledge_hub for a property's Knowledge Hub. Use cleaner_read for turnovers and stock. Both are read only.",
    "Use ops_clients and ops_revenue for client counts and host revenue. Those numbers come from OPS at answer time. Use amend_contract to prepare a resend, and assign_cleaner to prepare a cleaner assignment. Both wait for Submit. Use create_sop to save an SOP in OPS.",
    "Use build_proposal to save a unit proposal in OPS, and edit_proposal to make it cheaper, move an item, or remove one. Each of those saves a new version. Use send_proposal to prepare the client email. It waits for Submit and does not send by itself.",
    "Use research_web to open a page. Cite the page title it returns. Use make_pdf to make a PDF from that report. Use sheet_read and sheet_write with a sheet link or id.",
    "Deliver a finished run to the partners with deliver_to_partners: in the app, by email, or by text. If a channel is not configured, say so. Do not switch to a different channel.",
    "Access codes, door codes, and WiFi passwords are not in memory files. They stay in the Hospitable Knowledge Hub. Do not put them in a draft.",
    "The copilot tools are the only way to leave something for the partners.",
    "Rules:",
    "- Deliver to the partners with deliver_to_partners. Anything for a guest, a client, a building, or any third party is propose_draft and waits until a partner presses Submit. Never say that one was sent.",
    "- Never purchase anything. A purchase is only an offer a partner approves.",
    "- Do not invent fees, names, clauses, products, links, or facts. If a fact is missing, leave a blank like [fee] in the draft and list it in warnings.",
    "- If a tool fails, say so in the report. Never report an all-clear after a failed read.",
    "- For details found in guest messages, say the guest may have sent it, and quote the line. Never say they sent it.",
    "- If hospitable_read is not connected, use guest_inbox, list_stays, and read_guest_messages, and say what you could not do.",
    "- If the skill needs something no tool can do, say plainly what you could not do.",
    "- Write the report for two busy partners: short headings, one line per guest or item, no markdown. Pass title, summary and sections to post_report as well as the plain text, so it shows as a tidy card.",
    "- Finish by calling post_report exactly once. Set needs_you true when someone is waiting, something changed since the last report, a draft is waiting, or something failed.",
    "",
    "Memory files, the same ones chat uses:",
    memory,
    "",
    "Last report from this skill, to say what changed:",
    previous || "(none yet)",
  ].join("\n");
}

async function ensureChat(skill: CopilotSkill): Promise<CopilotSkill> {
  if (skill.chat_id && (await chatExists(skill.chat_id))) return skill;
  const chat = await createChat(skill.name);
  return saveSkill({ ...skill, chat_id: chat.id });
}

async function finish(run: CopilotRun, skill: CopilotSkill | undefined, outcome: { ok: boolean; error?: string; fallback?: string }) {
  const fresh = (await getRun(run.id)) ?? run;
  const result = fresh.result ?? { headline: "", needs_you: false, posted: false, tools: [] };
  const finishedAt = new Date().toISOString();
  let needsYou = result.needs_you;
  if (skill?.chat_id) {
    if (!outcome.ok) {
      const why = outcome.error || "The run stopped.";
      await addMessage({
        chatId: skill.chat_id,
        role: "assistant",
        body: `${skill.name} couldn't finish: ${why}\nThis is not a current report. Nothing was sent.`,
        runId: run.id,
        report: {
          title: `${skill.name} · ${prettyToday()}`,
          summary: "Nothing was sent.",
          sections: [],
          failed: { line: why, sub: "This is not a current report. A part read could miss someone." },
        },
      });
      needsYou = true;
    } else if (!result.posted) {
      await addMessage({
        chatId: skill.chat_id,
        role: "assistant",
        body: outcome.fallback?.trim() || `${skill.name} finished without leaving a report. Nothing was sent.`,
        runId: run.id,
      });
      needsYou = true;
    }
    if (needsYou) await flagChatNeedsYou(skill.chat_id);
  }
  await updateRun(run.id, {
    status: outcome.ok ? "ok" : "failed",
    finished_at: finishedAt,
    error: outcome.ok ? "" : outcome.error || "The run stopped.",
    result: { ...result, needs_you: needsYou },
  });
  const latest = skill ? (await listSkills()).find((row) => row.id === skill.id) : undefined;
  if (latest) await saveSkill({ ...latest, last_run_at: finishedAt }).catch(() => undefined);
}

const clip = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value) ?? "").slice(0, 14_000);

/** Works the skill through the tools until it has left its report. Returns the closing words, or why it could not finish. */
async function work(run: CopilotRun, skill: CopilotSkill, system: string): Promise<{ ok: true; final: string } | { ok: false; error: string }> {
  const started = Date.now();
  const tools = runToolDefinitions();
  const messages: BrainMessage[] = [{ role: "user", content: "Run the skill now. Finish by calling post_report once." }];
  let final = "";
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (Date.now() - started > RUN_BUDGET_MS) return { ok: false, error: "It ran too long, so I stopped it." };
    const result = await complete({ task: "hard", system, messages, tools, maxTokens: 4000 });
    if (!result) return { ok: false, error: "The AI brain didn't answer. Nothing was sent." };
    final = result.text || final;
    if (!result.toolUses.length) return { ok: true, final };
    messages.push({ role: "assistant", content: result.blocks });
    const results: BrainBlock[] = [];
    for (const use of result.toolUses) {
      try {
        results.push({ type: "tool_result", tool_use_id: use.id, content: clip(await callToolForRun(use.name, use.input, run, skill)) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: err instanceof Error ? err.message : "The tool failed.", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { ok: false, error: "It used up its steps before it finished." };
}

/** Runs the skill now, start to finish, and returns the finished run. The report is posted by the skill itself through post_report. */
export async function startSkillRun(skillId: string, trigger: CopilotRun["trigger"]): Promise<CopilotRun> {
  const found = (await listSkills()).find((row) => row.id === skillId);
  if (!found) throw new Error("That skill no longer exists.");
  if (found.kind !== "playbook") throw new Error("Text skills run when the cleaner app pings. They don't use Run now.");
  if (!brainAvailable()) throw new Error("The AI brain isn't connected on the server, so the skill did not run.");
  const skill = await ensureChat(found);
  await collectSkillRuns().catch(() => undefined);
  const running = (await listRuns(skill.id, 1))[0];
  if (running?.status === "running") return running;

  const previous = await lastReport(skill.chat_id as string);
  const run = await startRun(skill.id, trigger);
  try {
    const outcome = await work(run, skill, await promptFor(skill, trigger, previous));
    await finish(run, skill, outcome.ok ? { ok: true, fallback: outcome.final } : { ok: false, error: outcome.error });
  } catch (err) {
    await finish(run, skill, { ok: false, error: err instanceof Error ? err.message : "The run stopped." });
  }
  return (await getRun(run.id)) ?? run;
}

/** A run is worked inside one server call, so one still marked running long after it began was cut off. Close it out plainly. */
export async function collectSkillRuns(now = Date.now()): Promise<void> {
  const running = await listRunningRuns();
  if (!running.length) return;
  const skills = await listSkills();
  for (const run of running) {
    if (now - Date.parse(run.started_at) > INTERRUPTED_MS) {
      await finish(run, skills.find((row) => row.id === run.skill_id), { ok: false, error: "The run was cut off before it finished." }).catch(() => undefined);
    }
  }
}

/** The morning pass, Toronto time. Starts each due skill once that day. The afternoon pass does not. */
export async function runScheduledSkills(now = new Date()): Promise<{ started: string[]; skipped: string[]; failed: string[] }> {
  await collectSkillRuns(now.getTime()).catch(() => undefined);
  const out = { started: [] as string[], skipped: [] as string[], failed: [] as string[] };
  const skills = await listSkills();
  const lastDay = async (id: string) => {
    const last = (await listRuns(id, 5)).find((run) => run.trigger === "schedule");
    return last ? torontoToday(new Date(last.started_at)) : null;
  };
  const due: CopilotSkill[] = [];
  for (const skill of skills.filter((row) => row.enabled && runsOnItsOwn(row))) {
    if (skillDue(skill, now, await lastDay(skill.id))) due.push(skill);
    else out.skipped.push(skill.name);
  }
  for (const skill of due) {
    try {
      await startSkillRun(skill.id, "schedule");
      out.started.push(skill.name);
    } catch {
      out.failed.push(skill.name);
    }
  }
  return out;
}

/** Every saved skill with its latest run, for the pages and the agent that show them. */
export async function skillRows(): Promise<SkillRow[]> {
  const skills = await listSkills();
  return Promise.all(
    skills.map(async (skill) => ({
      ...skill,
      lastRun: skill.kind === "playbook" ? ((await listRuns(skill.id, 1).catch(() => []))[0] ?? null) : null,
    })),
  );
}
