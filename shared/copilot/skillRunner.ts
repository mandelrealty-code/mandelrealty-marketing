import { Agent, CursorAgentError } from "@cursor/sdk";
import { mintRunToken, toolsReady } from "./runToken.js";
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
import type { CopilotRun, CopilotSkill } from "./types.js";

/**
 * Runs saved skills with a Cursor cloud agent.
 * Hospitable reads go through the Copilot tools. A change is only a draft until a partner presses Submit.
 */

const TOOLS_URL = () => process.env.COPILOT_TOOLS_URL?.trim() || "https://admin.mandelrealtygroup.com/api/copilot/tools";
const NEVER_STARTED_MS = 10 * 60 * 1000;
const TOO_LONG_MS = 45 * 60 * 1000;

function prettyToday(): string {
  return new Date(`${torontoToday()}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function apiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) throw new Error("Cursor isn't connected on the server, so the skill did not run.");
  return key;
}

function explain(err: unknown): string {
  if (err instanceof CursorAgentError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Cursor could not start.";
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
    "- This workspace is empty on purpose. Do not edit files, run code, or open pull requests.",
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
      const why = outcome.error || "Cursor stopped.";
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
    error: outcome.ok ? "" : outcome.error || "Cursor stopped.",
    result: { ...result, needs_you: needsYou },
  });
  const latest = skill ? (await listSkills()).find((row) => row.id === skill.id) : undefined;
  if (latest) await saveSkill({ ...latest, last_run_at: finishedAt }).catch(() => undefined);
}

/** Starts the agent and returns right away. The agent posts its own report through the tools. */
export async function startSkillRun(skillId: string, trigger: CopilotRun["trigger"]): Promise<CopilotRun> {
  const found = (await listSkills()).find((row) => row.id === skillId);
  if (!found) throw new Error("That skill no longer exists.");
  if (found.kind !== "playbook") throw new Error("Text skills run when the cleaner app pings. They don't use Run now.");
  if (!toolsReady()) throw new Error("COPILOT_TOOLS_SECRET is not set on the server, so skills cannot run.");
  const key = apiKey();
  const skill = await ensureChat(found);
  await collectSkillRuns().catch(() => undefined);
  const running = (await listRuns(skill.id, 1))[0];
  if (running?.status === "running") return running;

  const previous = await lastReport(skill.chat_id as string);
  const run = await startRun(skill.id, trigger);
  let agent: Awaited<ReturnType<typeof Agent.create>> | null = null;
  try {
    agent = await Agent.create({
      apiKey: key,
      model: { id: "auto" },
      name: `Mandel Copilot · ${skill.name}`.slice(0, 80),
      cloud: { repos: [], autoCreatePR: false, skipReviewerRequest: true, metadata: { copilot_skill: skill.id, copilot_run: run.id } },
      mcpServers: {
        copilot: { type: "http", url: TOOLS_URL(), headers: { Authorization: `Bearer ${mintRunToken(run.id)}` } },
      },
    });
    const cursorRun = await agent.send(await promptFor(skill, trigger, previous));
    await updateRun(run.id, { agent_id: agent.agentId, cursor_run_id: cursorRun.id });
    return { ...run, agent_id: agent.agentId, cursor_run_id: cursorRun.id };
  } catch (err) {
    await finish(run, skill, { ok: false, error: explain(err) });
    throw new Error(`${skill.name} did not start: ${explain(err)}`);
  } finally {
    await agent?.[Symbol.asyncDispose]().catch(() => undefined);
  }
}

/** Checks on runs still marked running. Cheap: one Cursor call per running run. */
export async function collectSkillRuns(now = Date.now()): Promise<void> {
  const running = await listRunningRuns();
  if (!running.length) return;
  const skills = await listSkills();
  const key = process.env.CURSOR_API_KEY?.trim();
  for (const run of running) {
    const skill = skills.find((row) => row.id === run.skill_id);
    const age = now - Date.parse(run.started_at);
    try {
      if (!key || !run.cursor_run_id) {
        if (age > NEVER_STARTED_MS) await finish(run, skill, { ok: false, error: "Cursor never started this run." });
        continue;
      }
      const cursorRun = await Agent.getRun(run.cursor_run_id, { runtime: "cloud", agentId: run.agent_id, apiKey: key });
      if (cursorRun.status === "running") {
        if (age > TOO_LONG_MS) {
          await Agent.cancelRun(run.cursor_run_id, { runtime: "cloud", agentId: run.agent_id, apiKey: key }).catch(() => undefined);
          await finish(run, skill, { ok: false, error: "It ran for more than 45 minutes, so I stopped it." });
          if (run.agent_id) await Agent.archive(run.agent_id, { apiKey: key }).catch(() => undefined);
        }
        continue;
      }
      const result = await Promise.race([
        cursorRun.wait(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!result) continue;
      if (result.status === "finished") await finish(run, skill, { ok: true, fallback: result.result ?? "" });
      else await finish(run, skill, { ok: false, error: result.error?.message || (result.status === "cancelled" ? "It was stopped." : "Cursor stopped.") });
      if (run.agent_id) await Agent.archive(run.agent_id, { apiKey: key }).catch(() => undefined);
    } catch (err) {
      if (age > TOO_LONG_MS) await finish(run, skill, { ok: false, error: explain(err) }).catch(() => undefined);
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
