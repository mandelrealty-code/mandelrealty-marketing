import { Agent, AgentBusyError, CursorAgentError } from "@cursor/sdk";
import { addMessage, addReminder, clearDesk, listCursorRuns, listMessages, readCursorLink, readDesk, renameChat, saveCursorLink, saveDesk } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

export const CURSOR_MISSING =
  "Cursor isn’t connected on the server, so I can’t think this through. Nothing was sent.";

type ThinkStep = { text: string; meta?: string; url?: string };
type DeskView = { url?: string; image?: string; mime?: string; pointer?: { x: number; y: number } };
type ThinkState = { pending: boolean; steps: ThinkStep[]; thought?: string; view?: DeskView };
type Desk = { steps: ThinkStep[]; url?: string; image?: string; mime?: string; pointer?: { x: number; y: number } };
type StreamMsg = { type: string; text?: string; name?: string; status?: string; args?: unknown; result?: unknown };

const desks = new Map<string, Desk>();

function explain(err: unknown): string {
  if (err instanceof CursorAgentError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Cursor could not start.";
}

function promptFor(facts: string, history: string, skillMode: boolean, hasImages: boolean, web: boolean): string {
  if (web) {
    return [
      "Look this up in the computer's browser for the two partners at Mandel Realty.",
      "Open the browser first. Do not inspect files, do not set up a repository, and do not write code.",
      "If they named Amazon, open https://www.amazon.ca and search there. If they named Facebook Marketplace, open https://www.facebook.com/marketplace.",
      "Otherwise open Google and search for what they asked. Stay on the results and the pages you open from them.",
      "Read what is on the screen, then answer with what you found and the page address. Do not invent a price, a product, or a page you did not see.",
      "Reply with one JSON object and no markdown fence:",
      '{"body":"plain sentences with the page address","choices":null,"draft":null,"reminder":null}',
      "",
      "Request:",
      history || "(empty)",
    ].join("\n");
  }
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
  return { body: body || "The model finished without a reply.", choices: null, draft: null, json: false, reminder: null };
}

export async function finishSpoken(text: string): Promise<{ body: string; draft: CopilotDraft | null; choices: string[] | null }> {
  const parsed = parseModel(text);
  return { body: await applyAsks(parsed), draft: parsed.draft, choices: parsed.choices };
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
  desks.delete(chatId);
  if (agent) await agent[Symbol.asyncDispose]().catch(() => undefined);
}

function deskSteps(chatId: string): ThinkStep[] {
  return desks.get(chatId)?.steps ?? [{ text: "Looking this up" }];
}

function deskView(chatId: string): DeskView | undefined {
  const desk = desks.get(chatId);
  if (!desk) return undefined;
  const image = desk.image && desk.image.length <= 1_800_000 ? desk.image : undefined;
  if (!desk.url && !image && !desk.pointer) return undefined;
  return {
    ...(desk.url ? { url: desk.url } : {}),
    ...(image ? { image, mime: desk.mime || "image/png" } : {}),
    ...(desk.pointer ? { pointer: desk.pointer } : {}),
  };
}

function pushStep(desk: Desk, text: string, url?: string) {
  const last = desk.steps[desk.steps.length - 1];
  if (last?.text === text) return;
  desk.steps.push({ text, ...(url ? { url } : {}) });
  if (desk.steps.length > 8) desk.steps.splice(0, desk.steps.length - 8);
}

function pageUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && value.length < 400) return value;
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return pageUrl(JSON.parse(value), depth + 1);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pageUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const row = value as Record<string, unknown>;
  for (const key of ["url", "uri", "href", "address"]) {
    const found = pageUrl(row[key], depth + 1);
    if (found) return found;
  }
  for (const item of Object.values(row)) {
    const found = pageUrl(item, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function shotOf(value: unknown, depth = 0): { data: string; mime: string } | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") {
    if (!value.startsWith("{") && !value.startsWith("[")) return null;
    try {
      return shotOf(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = shotOf(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const row = value as Record<string, unknown>;
  const data = row.data ?? row.image;
  const mime = row.mimeType ?? row.mime ?? row.mediaType;
  if (typeof data === "string" && data.length > 80 && typeof mime === "string" && mime.startsWith("image/")) {
    return { data, mime };
  }
  for (const item of Object.values(row)) {
    const found = shotOf(item, depth + 1);
    if (found) return found;
  }
  return null;
}

function pointOf(value: unknown, depth = 0): { x: number; y: number } | null {
  if (depth > 6 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number") return normPoint(value[0], value[1]);
    for (const item of value) {
      const found = pointOf(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.x === "number" && typeof row.y === "number") {
    const point = normPoint(row.x, row.y);
    if (point) return point;
  }
  for (const item of Object.values(row)) {
    const found = pointOf(item, depth + 1);
    if (found) return found;
  }
  return null;
}

function normPoint(x: number, y: number): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 8000 || y > 8000) return null;
  if (x === 0 && y === 0) return null;
  return { x, y };
}

function imageSize(data: string, mime: string): { width: number; height: number } | null {
  let raw: Buffer;
  try {
    raw = Buffer.from(data, "base64");
  } catch {
    return null;
  }
  if (mime.includes("png") || raw[0] === 0x89) {
    if (raw.length < 24) return null;
    return { width: raw.readUInt32BE(16), height: raw.readUInt32BE(20) };
  }
  let i = 2;
  while (i < raw.length - 8) {
    if (raw[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = raw[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: raw.readUInt16BE(i + 5), width: raw.readUInt16BE(i + 7) };
    }
    const len = raw.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function gesture(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) return null;
  if (typeof value === "string") {
    const text = value.toLowerCase();
    if (text.includes("scroll")) return "Scrolling";
    if (text === "type" || text.includes("keypress") || text === "key") return "Typing";
    if (text.includes("click") || text.includes("mouse")) return "Clicking the page";
    return null;
  }
  if (typeof value !== "object") return null;
  for (const item of Object.values(value as object)) {
    const found = gesture(item, depth + 1);
    if (found) return found;
  }
  return null;
}

function openedLabel(url: string): string {
  try {
    return `Opened ${new URL(url).hostname.replace(/^www\./, "")}`;
  } catch {
    return "Opened the page";
  }
}

function pointerFor(point: { x: number; y: number }, shot: { data: string; mime: string } | null): { x: number; y: number } | undefined {
  if (point.x <= 1 && point.y <= 1) return { x: point.x * 100, y: point.y * 100 };
  if (!shot) return undefined;
  const size = imageSize(shot.data, shot.mime);
  if (!size?.width || !size.height) return undefined;
  return {
    x: Math.min(100, Math.max(0, (point.x / size.width) * 100)),
    y: Math.min(100, Math.max(0, (point.y / size.height) * 100)),
  };
}

function applyDesk(chatId: string, msg: StreamMsg) {
  const desk = desks.get(chatId) ?? { steps: [{ text: "Starting the computer" }] };
  if (msg.type === "status") {
    if (msg.status === "CREATING") pushStep(desk, "Starting the computer");
    else if (msg.status === "RUNNING") pushStep(desk, "Opening the browser");
  } else if (msg.type === "tool_call") {
    const url = pageUrl(msg.args) || pageUrl(msg.result);
    const shot = shotOf(msg.result) || shotOf(msg.args);
    const name = (msg.name || "").toLowerCase();
    if (url) {
      desk.url = url;
      pushStep(desk, openedLabel(url), url);
    } else {
      const motion = gesture(msg.args) || gesture(msg.name);
      if (motion) pushStep(desk, motion);
      else if (name.includes("search")) pushStep(desk, "Searching the web");
      else if (name.includes("browser") || name.includes("computer")) pushStep(desk, "Opening the browser");
      else if (shot) pushStep(desk, "Looking at the page");
    }
    if (shot && shot.data.length <= 1_800_000) {
      desk.image = shot.data;
      desk.mime = shot.mime;
    }
    const point = pointOf(msg.args);
    const pointer = point ? pointerFor(point, shot) : undefined;
    if (pointer) desk.pointer = pointer;
  }
  desks.set(chatId, desk);
}

async function rememberDesk(chatId: string) {
  const desk = desks.get(chatId);
  if (!desk) return;
  await saveDesk(chatId, {
    steps: desk.steps,
    url: desk.url,
    image: desk.image && desk.image.length <= 1_800_000 ? desk.image : undefined,
    mime: desk.mime,
    pointer: desk.pointer,
  }).catch(() => undefined);
}

async function pullDesk(chatId: string, apiKey: string, agentId: string, runId: string) {
  const run = await Agent.getRun(runId, { runtime: "cloud", agentId, apiKey });
  if (run.status !== "running") return;
  if (!desks.has(chatId)) desks.set(chatId, { steps: [{ text: "Starting the computer" }] });
  const closer = run as { stream(): AsyncIterable<StreamMsg>; disposeClientStream?: () => Promise<void> };
  const events = closer.stream();
  const timer = setTimeout(() => {
    void closer.disposeClientStream?.();
  }, 8000);
  try {
    const seen = desks.get(chatId)?.image;
    for await (const msg of events) {
      applyDesk(chatId, msg);
      const image = desks.get(chatId)?.image;
      if (image && image !== seen) break;
    }
  } catch {
    /* The cloud run keeps going. The next check opens the screen again. */
  } finally {
    clearTimeout(timer);
    const generator = events as AsyncGenerator<StreamMsg>;
    if (typeof generator.return === "function") await generator.return(undefined).catch(() => undefined);
    await closer.disposeClientStream?.().catch(() => undefined);
  }
  await rememberDesk(chatId);
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
    await saveCursorLink(chatId, agent.agentId, run.id);
    desks.set(chatId, { steps: [{ text: "Starting the computer" }] });
    await rememberDesk(chatId);
    // Drop this request's event stream so the next check can open the screen on its own.
    await agent[Symbol.asyncDispose]().catch(() => undefined);
  } catch (err) {
    desks.delete(chatId);
    await agent[Symbol.asyncDispose]().catch(() => undefined);
    if (err instanceof AgentBusyError) return;
    throw new Error(explain(err));
  }
}

const runGates = new Set<string>();

async function loadStoredDesk(chatId: string) {
  if (desks.has(chatId)) return;
  const stored = await readDesk(chatId).catch(() => null);
  if (stored?.steps?.length) desks.set(chatId, stored);
}

async function readCursorRun(chatId: string, follow: boolean): Promise<ThinkState> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  const link = await readCursorLink(chatId);
  if (!apiKey || !link?.agentId || !link.runId) return { pending: false, steps: [] };
  await loadStoredDesk(chatId);
  const run = await Agent.getRun(link.runId, { runtime: "cloud", agentId: link.agentId, apiKey });
  if (run.status === "running" && follow) await pullDesk(chatId, apiKey, link.agentId, link.runId).catch(() => undefined);
  const looking = { steps: deskSteps(chatId), view: deskView(chatId) };
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
  const latest = { steps: deskSteps(chatId), view: deskView(chatId) };
  await clearDesk(chatId).catch(() => undefined);
  await saveCursorLink(chatId, link.agentId, "");
  await hideAgent(link.agentId, apiKey);
  await releaseAgent(chatId);
  return { pending: false, ...latest };
}

export async function collectCursorRun(chatId: string, follow = false): Promise<ThinkState> {
  while (runGates.has(chatId)) await new Promise((resolve) => setTimeout(resolve, 40));
  runGates.add(chatId);
  try {
    return await readCursorRun(chatId, follow);
  } finally {
    runGates.delete(chatId);
  }
}

/** Finishes runs that completed while the app was closed, and lists the ones still going. */
export async function settleOpenCursorRuns(): Promise<string[]> {
  const pending: string[] = [];
  for (const link of await listCursorRuns()) {
    try {
      const state = await collectCursorRun(link.chatId);
      if (state.pending) pending.push(link.chatId);
    } catch {
      pending.push(link.chatId);
    }
  }
  return pending;
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
