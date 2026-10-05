import { Agent, AgentBusyError, CursorAgentError, type Run } from "@cursor/sdk";
import { addMessage, listMessages, readCursorLink, saveCursorLink } from "./store.js";
import type { CopilotDraft } from "./types.js";

export const CURSOR_MISSING =
  "Cursor isn’t connected on the server, so I can’t think this through. Nothing was sent.";

type ThinkStep = { text: string; meta?: string };
type ThinkState = { pending: boolean; steps: ThinkStep[]; thought?: string };

function explain(err: unknown): string {
  if (err instanceof CursorAgentError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Cursor could not start.";
}

function clip(value: string, max = 220): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1).trimEnd()}…`;
}

function argText(args: object, key: string): string {
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function describeTool(message: object): string | null {
  const args = "args" in message && message.args && typeof message.args === "object" ? message.args : {};
  const query = argText(args, "query") || argText(args, "pattern") || argText(args, "searchTerm");
  const path = argText(args, "path") || argText(args, "targetFile") || argText(args, "file");
  const url = argText(args, "url");
  const command = argText(args, "command").split("\n")[0] ?? "";
  if (query) return `Searched for “${clip(query, 90)}”`;
  if (url) return `Opened ${clip(url, 90)}`;
  if (path) return `Read ${clip(path, 90)}`;
  if (command) return clip(command, 140);
  return null;
}

function promptFor(facts: string, history: string, skillMode: boolean): string {
  return [
    "You are Mandel Realty Copilot, answering the two partners inside their admin app.",
    "Think, then answer. Ask one plain question when you are unsure. If you already know, answer.",
    "Do not edit files, open a pull request, or treat this as a coding job. This workspace is empty on purpose.",
    "Do not text, email, or message a guest, a host, or a client. The app only sends after they press confirm.",
    "Do not invent fees, names, issues, links, or whether an account is connected. Use the facts. If a fact is missing, say so.",
    skillMode
      ? "They pressed Create a skill. Ask what you still need, one question at a time. When you have enough, put a skill draft in the JSON. Do not save it yourself."
      : "Only include a draft when they need to approve a note, an email, or a skill.",
    "Reply with one JSON object and no markdown fence:",
    '{"body":"plain text the person reads","choices":null,"draft":null}',
    "choices is two or three short labels when a guess would send the work the wrong way, otherwise null.",
    'draft is null or {"channel":"email"|"note"|"skill","subject":"","body":"","to":"","skillName":"","skillWhen":"","skillReads":"","skillDrafts":"","skillMustNot":"","skillKind":"playbook"|"text","skillPhone":""}.',
    "For a text skill, skillKind is text and skillPhone is their number. Saving still waits for them.",
    "",
    "Facts:",
    facts || "No extra facts were loaded.",
    "",
    "Conversation:",
    history || "(empty)",
  ].join("\n");
}

function asChoices(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const choices = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  return choices.length ? choices : null;
}

function asDraft(value: unknown): CopilotDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.channel !== "email" && row.channel !== "note" && row.channel !== "skill") return null;
  const text = (key: string, max: number) => String(row[key] ?? "").trim().slice(0, max);
  return {
    channel: row.channel,
    subject: text("subject", 180),
    body: text("body", 4000),
    to: text("to", 180),
    status: "waiting",
    skillName: text("skillName", 80),
    skillWhen: text("skillWhen", 240),
    skillReads: text("skillReads", 400),
    skillDrafts: text("skillDrafts", 400),
    skillMustNot: text("skillMustNot", 400),
    skillKind: row.skillKind === "text" ? "text" : "playbook",
    skillPhone: text("skillPhone", 20),
  };
}

function parseModel(text: string): { body: string; choices: string[] | null; draft: CopilotDraft | null } {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const body = typeof value.body === "string" ? value.body.trim() : "";
      if (body) return { body, choices: asChoices(value.choices), draft: asDraft(value.draft) };
    } catch {
      /* The model wrote prose. Show that. */
    }
  }
  return { body: text.trim() || "Cursor finished without a reply.", choices: null, draft: null };
}

async function liveSteps(run: Run): Promise<{ steps: ThinkStep[]; thought?: string }> {
  const waiting = { steps: [{ text: "Sent your message to Cursor" }] };
  if (!run.supports("conversation")) return waiting;
  try {
    const turns = await run.conversation();
    const timeline: { text: string; kind: "thought" | "action" }[] = [];
    for (const turn of turns) {
      if (turn.type !== "agentConversationTurn") continue;
      for (const step of turn.turn.steps) {
        if (step.type === "thinkingMessage") {
          const text = clip(step.message.text);
          if (text) timeline.push({ text, kind: "thought" });
        } else if (step.type === "toolCall") {
          const text = describeTool(step.message);
          if (text) timeline.push({ text, kind: "action" });
        }
      }
    }
    const recent = timeline.slice(-12);
    const lastThought = [...recent].reverse().find((item) => item.kind === "thought");
    const steps = recent.filter((item) => item !== lastThought).map((item) => ({ text: item.text }));
    if (!lastThought && !steps.length) return waiting;
    return { thought: lastThought?.text, steps };
  } catch {
    return waiting;
  }
}

async function openAgent(chatId: string, apiKey: string) {
  const link = await readCursorLink(chatId);
  if (link?.agentId) {
    try {
      return await Agent.resume(link.agentId, { apiKey, model: { id: "auto" } });
    } catch {
      /* The old agent is gone. Start another. */
    }
  }
  return Agent.create({
    apiKey,
    model: { id: "auto" },
    name: "Mandel Copilot",
    cloud: { repos: [], autoCreatePR: false, skipReviewerRequest: true },
  });
}

export async function startCursorRun(chatId: string, facts: string, skillMode: boolean): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) throw new Error(CURSOR_MISSING);
  const existing = await readCursorLink(chatId);
  if (existing?.runId) return;
  const messages = await listMessages(chatId);
  const history = messages.map((message) => `${message.role}: ${message.body}`).join("\n\n");
  const agent = await openAgent(chatId, apiKey);
  try {
    await saveCursorLink(chatId, agent.agentId, existing?.runId ?? "");
    const run = await agent.send(promptFor(facts, history, skillMode));
    await saveCursorLink(chatId, agent.agentId, run.id);
  } catch (err) {
    if (err instanceof AgentBusyError) return;
    throw new Error(explain(err));
  } finally {
    await agent[Symbol.asyncDispose]().catch(() => undefined);
  }
}

export async function collectCursorRun(chatId: string): Promise<ThinkState> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  const link = await readCursorLink(chatId);
  if (!apiKey || !link?.agentId || !link.runId) return { pending: false, steps: [] };
  const run = await Agent.getRun(link.runId, { runtime: "cloud", agentId: link.agentId, apiKey });
  const trail = await liveSteps(run);
  if (run.status === "running") return { pending: true, ...trail };
  const result = await Promise.race([
    run.wait(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
  ]);
  if (!result) return { pending: true, ...trail };
  const again = await readCursorLink(chatId);
  if (!again?.runId) return { pending: false, ...trail };
  const messages = await listMessages(chatId);
  if (messages[messages.length - 1]?.role !== "assistant") {
    const parsed = result.status === "finished"
      ? parseModel(result.result ?? "")
      : {
          body: result.status === "cancelled"
            ? "Stopped. Nothing was sent."
            : `Cursor stopped before it answered. ${result.error?.message ?? ""}`.trim(),
          choices: null,
          draft: null,
        };
    await addMessage({
      chatId,
      role: "assistant",
      body: parsed.body,
      draft: parsed.draft,
      choices: parsed.choices,
      steps: trail.steps,
      thought: trail.thought,
    });
  }
  await saveCursorLink(chatId, link.agentId, "");
  return { pending: false, ...trail };
}

export async function cancelCursorRun(chatId: string): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  const link = await readCursorLink(chatId);
  if (!link?.agentId) return;
  await saveCursorLink(chatId, link.agentId, "");
  if (apiKey && link.runId) {
    await Agent.cancelRun(link.runId, { runtime: "cloud", agentId: link.agentId, apiKey }).catch(() => undefined);
  }
  const messages = await listMessages(chatId);
  if (messages[messages.length - 1]?.role === "user") {
    await addMessage({ chatId, role: "assistant", body: "Stopped. Nothing was sent." });
  }
}
