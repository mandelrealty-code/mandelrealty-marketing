import { Agent, AgentBusyError, CursorAgentError } from "@cursor/sdk";
import { addMessage, addReminder, listMessages, readCursorLink, renameChat, saveCursorLink } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

export const CURSOR_MISSING =
  "Cursor isn’t connected on the server, so I can’t think this through. Nothing was sent.";

type ThinkStep = { text: string; meta?: string; url?: string };
type ThinkState = { pending: boolean; steps: ThinkStep[]; thought?: string };

function explain(err: unknown): string {
  if (err instanceof CursorAgentError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Cursor could not start.";
}

function promptFor(facts: string, history: string, skillMode: boolean, hasImages: boolean, web: boolean): string {
  return [
    "You are Mandel Realty Copilot, answering the two partners inside their admin app.",
    "Think, then answer. Ask one plain question when you are unsure. If you already know, answer.",
    web
      ? "They asked you to look on the web. Open the browser, go to the site they named, and read the page. Then answer with what you found and the page address. Do not say you cannot search. Do not tell them to look it up themselves."
      : "Do not edit files, open a pull request, or treat this as a coding job. This workspace is empty on purpose.",
    "Do not text, email, or message a guest, a host, or a client. The app only sends after they press confirm.",
    web
      ? "Do not invent fees, names, or whether an account is connected. Include the address of the page you opened. Facebook Marketplace and Amazon are normal websites. Open them."
      : "Do not invent fees, names, issues, links, or whether an account is connected. Use the facts. If a fact is missing, say so.",
    skillMode
      ? "They pressed Create a skill. Ask what you still need, one question at a time. When you have enough, put a skill draft in the JSON. Do not save it yourself."
      : "Only include a draft when they need to approve a note, an email, or a skill.",
    `Today is ${torontoToday()} in Toronto.`,
    "Skills are how work runs on its own. When a partner asks for something recurring, draft a skill. Set skillSchedule to \"daily\" when it should run by itself every morning around 5:00, or \"\" when it should only run when they ask. Every morning is the only schedule today. For an event such as a new booking, say it will check every morning, not the moment it happens.",
    "When a skill runs on its own, it can read Hospitable stays and guest messages, leave a report in its own chat, leave drafts that wait for approval, and save reminders. It cannot read Gmail, WhatsApp, the cleaner calendar, or AirROI yet, and it cannot send anything. If a skill needs one of those, say so in the skill draft.",
    "To save a reminder, set reminder to {\"due_on\":\"YYYY-MM-DD\",\"text\":\"what to remind them\"}. It shows as a card on that morning.",
    "Never say a skill or reminder is saved or turned on. A skill is saved only when they press Save on its card. The app adds the reminder line after it actually saves it.",
    "The body is the only thing they read. Write it the way you would say it out loud. Do not mention JSON, tools, files, or paths in the body.",
    hasImages
      ? "A photo is attached. Say what it shows in a sentence or two, as if you are looking at it with them. Name the page and the details that are actually visible. Do not say you are examining a screenshot."
      : "",
    "Reply with one JSON object and no markdown fence:",
    '{"body":"plain text the person reads","choices":null,"draft":null,"reminder":null}',
    "choices is two or three short labels when a guess would send the work the wrong way, otherwise null.",
    'draft is null or {"channel":"email"|"note"|"skill","subject":"","body":"","to":"","skillName":"","skillWhen":"","skillReads":"","skillDrafts":"","skillMustNot":"","skillKind":"playbook"|"text","skillPhone":"","skillSchedule":"daily"|""}.',
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
    .filter((item) => item && !/^something else\.?$/i.test(item))
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
    skillSchedule: row.skillSchedule === "daily" ? "daily" : "",
  };
}

type Parsed = {
  body: string;
  choices: string[] | null;
  draft: CopilotDraft | null;
  json: boolean;
  reminder: { due_on: string; text: string } | null | "bad";
};

function asReminder(value: unknown): Parsed["reminder"] {
  if (value == null) return null;
  if (typeof value !== "object") return "bad";
  const row = value as Record<string, unknown>;
  const due = String(row.due_on ?? "").trim();
  const text = String(row.text ?? "").trim().slice(0, 300);
  const today = torontoToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !text || due < today || due > addDays(today, 366)) return "bad";
  return { due_on: due, text };
}

function spoken(body: string): string {
  return body
    .replace(/^I will describe the attached screenshot[^\n]*\n+/i, "")
    .replace(/^I(?:'m| am) examining the attached screenshot[^\n]*\n+/i, "")
    .trim();
}

function parseModel(text: string): Parsed {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const body = spoken(typeof value.body === "string" ? value.body.trim() : "");
      if (body) {
        return {
          body,
          choices: asChoices(value.choices),
          draft: asDraft(value.draft),
          json: true,
          reminder: asReminder(value.reminder),
        };
      }
    } catch {
      /* The model wrote prose. Show that. */
    }
  }
  const body = spoken(text.trim());
  return { body: body || "Cursor finished without a reply.", choices: null, draft: null, json: false, reminder: null };
}

function prettyDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const CLAIMS = /\b(turned on|set up|i('| wi)ll remind|reminder (is )?(set|saved)|i('ve| have) saved|saved (it|the|a)|will check (each|every)|each morning i)\b/i;

/** Saves what Cursor asked for, then says plainly what was and was not saved. */
async function applyAsks(parsed: Parsed): Promise<string> {
  const notes: string[] = [];
  if (parsed.reminder === "bad") {
    notes.push("The reminder was not saved. I couldn't read the date.");
  } else if (parsed.reminder) {
    try {
      await addReminder(parsed.reminder.text, parsed.reminder.due_on);
      notes.push(`Reminder saved for ${prettyDay(parsed.reminder.due_on)}.`);
    } catch (err) {
      notes.push(`The reminder was not saved. ${err instanceof Error ? err.message : ""}`.trim());
    }
  }
  if (parsed.reminder === null && !parsed.draft && CLAIMS.test(parsed.body)) {
    notes.push("Nothing was saved. No skill or reminder was turned on.");
  }
  return notes.length ? `${parsed.body}\n\n${notes.join("\n")}` : parsed.body;
}

const heldAgents = new Map<string, { [Symbol.asyncDispose](): Promise<void> }>();

async function releaseAgent(chatId: string) {
  const agent = heldAgents.get(chatId);
  heldAgents.delete(chatId);
  if (agent) await agent[Symbol.asyncDispose]().catch(() => undefined);
}

async function hideAgent(agentId: string, apiKey: string) {
  await Agent.archive(agentId, { apiKey }).catch(() => undefined);
}

async function openAgent(chatId: string, apiKey: string) {
  const link = await readCursorLink(chatId);
  if (link?.agentId) {
    await Agent.unarchive(link.agentId, { apiKey }).catch(() => undefined);
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

export async function startCursorRun(
  chatId: string,
  facts: string,
  skillMode: boolean,
  images: { mimeType: string; data: string }[] = [],
  web = false,
): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) throw new Error(CURSOR_MISSING);
  const existing = await readCursorLink(chatId);
  if (existing?.runId) return;
  const messages = await listMessages(chatId);
  const history = messages.map((message) => `${message.role}: ${message.body}`).join("\n\n");
  const agent = await openAgent(chatId, apiKey);
  try {
    await saveCursorLink(chatId, agent.agentId, existing?.runId ?? "");
    const prompt = promptFor(facts, history, skillMode, images.length > 0, web);
    const run = images.length
      ? await agent.send({ text: prompt, images })
      : await agent.send(prompt);
    heldAgents.set(chatId, agent);
    await saveCursorLink(chatId, agent.agentId, run.id);
  } catch (err) {
    await agent[Symbol.asyncDispose]().catch(() => undefined);
    if (err instanceof AgentBusyError) return;
    throw new Error(explain(err));
  }
}

export async function collectCursorRun(chatId: string): Promise<ThinkState> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  const link = await readCursorLink(chatId);
  if (!apiKey || !link?.agentId || !link.runId) return { pending: false, steps: [] };
  const run = await Agent.getRun(link.runId, { runtime: "cloud", agentId: link.agentId, apiKey });
  const looking = { steps: [{ text: "Looking this up" }] };
  if (run.status === "running") return { pending: true, ...looking };
  const again = await readCursorLink(chatId);
  if (!again?.runId) {
    await releaseAgent(chatId);
    return { pending: false, steps: [] };
  }
  const messages = await listMessages(chatId);
  if (messages[messages.length - 1]?.role !== "assistant") {
    const parsed: Parsed = run.status === "finished"
      ? parseModel(run.result ?? "")
      : {
          json: false,
          reminder: null,
          body: run.status === "cancelled"
            ? "Stopped. Nothing was sent."
            : `Cursor stopped before it answered. ${run.error?.message ?? ""}`.trim(),
          choices: null,
          draft: null,
        };
    await addMessage({
      chatId,
      role: "assistant",
      body: run.status === "finished" ? await applyAsks(parsed) : parsed.body,
      draft: parsed.draft,
      choices: parsed.choices,
      steps: looking.steps,
      thought: undefined,
    });
    const skillName = parsed.draft?.channel === "skill" ? parsed.draft.skillName?.trim() : "";
    if (skillName) await renameChat(chatId, skillName);
  }
  await saveCursorLink(chatId, link.agentId, "");
  await hideAgent(link.agentId, apiKey);
  await releaseAgent(chatId);
  return { pending: false, ...looking };
}

export async function cancelCursorRun(chatId: string): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  const link = await readCursorLink(chatId);
  if (!link?.agentId) return;
  await saveCursorLink(chatId, link.agentId, "");
  if (apiKey && link.runId) {
    await Agent.cancelRun(link.runId, { runtime: "cloud", agentId: link.agentId, apiKey }).catch(() => undefined);
  }
  if (apiKey) await hideAgent(link.agentId, apiKey);
  await releaseAgent(chatId);
  const messages = await listMessages(chatId);
  if (messages[messages.length - 1]?.role === "user") {
    await addMessage({ chatId, role: "assistant", body: "Stopped. Nothing was sent." });
  }
}
