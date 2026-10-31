import { brainAvailable } from "./brain.js";
import { executeSkill, postWorkflowReport, type Paused } from "./skillAgent.js";
import { failure, failureText, type Failure } from "./skillFailure.js";
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
import { torontoToday } from "./time.js";
import { skillDue } from "./skillSchedule.js";
import type { CopilotRun, CopilotSkill, SkillRow } from "./types.js";

/**
 * Runs saved skills with the brain: it reads through the Copilot tools, and leaves its report and any drafts for the partners.
 * Hospitable reads go through the tools. A change is only a draft until a partner presses Submit.
 */

/** A run lives inside one server call, so one that is still "running" after this was cut off. */
const INTERRUPTED_MS = 10 * 60 * 1000;

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

async function ensureChat(skill: CopilotSkill): Promise<CopilotSkill> {
  if (skill.chat_id && (await chatExists(skill.chat_id))) return skill;
  const chat = await createChat(skill.name);
  return saveSkill({ ...skill, chat_id: chat.id });
}

type Outcome = { ok: true; fallback?: string; paused?: Paused } | { ok: false; failure: Failure };

async function finish(run: CopilotRun, skill: CopilotSkill | undefined, outcome: Outcome) {
  const fresh = (await getRun(run.id)) ?? run;
  const result = fresh.result ?? { headline: "", needs_you: false, posted: false, tools: [] };
  const finishedAt = new Date().toISOString();
  let needsYou = result.needs_you;
  if (skill?.chat_id) {
    if (!outcome.ok) {
      // Exactly where it stopped, what it tried and what came back, with a fix when there is one. It lands in Decisions.
      await addMessage({
        chatId: skill.chat_id,
        role: "assistant",
        body: failureText(skill.name, outcome.failure),
        runId: run.id,
        report: {
          title: `${skill.name} · ${prettyToday()}`,
          summary: "Nothing was sent.",
          sections: [],
          failed: { line: `${outcome.failure.where}: ${outcome.failure.cameBack}`, sub: outcome.failure.suggestion || "This is not a current report. A part read could miss someone." },
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
    if (outcome.ok && outcome.paused) needsYou = true;
    if (needsYou) await flagChatNeedsYou(skill.chat_id);
  }
  await updateRun(run.id, {
    status: outcome.ok ? "ok" : "failed",
    finished_at: finishedAt,
    error: outcome.ok ? "" : `${outcome.failure.where}: ${outcome.failure.cameBack}`,
    result: { ...result, needs_you: needsYou, ...(outcome.ok && outcome.paused ? { paused: outcome.paused } : {}) },
  });
  const latest = skill ? (await listSkills()).find((row) => row.id === skill.id) : undefined;
  if (latest) await saveSkill({ ...latest, last_run_at: finishedAt }).catch(() => undefined);
}

const RESUME_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** A skill that couldn't even start still says so, in its own chat and in Decisions: never silent. */
async function failToStart(skill: CopilotSkill, cameBack: string): Promise<void> {
  const chat = skill.chat_id ? skill : await ensureChat(skill);
  if (!chat.chat_id) return;
  const found = failure({ where: "the start of the run", tried: "starting the skill", cameBack });
  await addMessage({ chatId: chat.chat_id, role: "assistant", body: failureText(skill.name, found), report: { title: `${skill.name} · ${prettyToday()}`, summary: "Nothing was sent.", sections: [], failed: { line: `${found.where}: ${found.cameBack}`, sub: found.suggestion || "This is not a current report." } } });
  await flagChatNeedsYou(chat.chat_id);
}

/**
 * Runs the skill now, start to finish, through the same agent loop chat uses, and returns the finished run.
 * A workflow runs its steps in order. One that paused at "Wait for you" carries on from there when run again.
 */
export async function startSkillRun(skillId: string, trigger: CopilotRun["trigger"]): Promise<CopilotRun> {
  const found = (await listSkills()).find((row) => row.id === skillId);
  if (!found) throw new Error("That skill no longer exists.");
  if (found.kind !== "playbook") throw new Error("Text skills run when the cleaner app pings. They don't use Run now.");
  if (!brainAvailable()) {
    const why = "The AI brain isn't connected on the server, so the skill did not run.";
    await failToStart(found, why).catch(() => undefined);
    throw new Error(why);
  }
  const skill = await ensureChat(found);
  await collectSkillRuns().catch(() => undefined);
  const prior = (await listRuns(skill.id, 1))[0];
  if (prior?.status === "running") return prior;
  const resume = trigger === "manual" && prior?.status === "ok" && prior.result?.paused && Date.now() - Date.parse(prior.finished_at ?? prior.started_at) < RESUME_WINDOW_MS ? prior.result.paused : null;

  const previous = await lastReport(skill.chat_id as string);
  const run = await startRun(skill.id, trigger);
  try {
    const outcome = await executeSkill({ run, skill, trigger, previous, resume });
    if (outcome.ok) {
      // A workflow leaves its report through the same tool a skill uses.
      if (skill.workflow?.nodes.length) await postWorkflowReport(run, skill, outcome);
      await finish(run, skill, { ok: true, fallback: outcome.final, ...(outcome.paused ? { paused: outcome.paused } : {}) });
    } else {
      await finish(run, skill, { ok: false, failure: outcome.failure });
    }
  } catch (err) {
    await finish(run, skill, { ok: false, failure: failure({ where: "the run", tried: "to finish", cameBack: err instanceof Error ? err.message : "The run stopped." }) });
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
      await finish(run, skills.find((row) => row.id === run.skill_id), { ok: false, failure: failure({ where: "the run", tried: "to finish", cameBack: "The run was cut off before it finished." }) }).catch(() => undefined);
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
