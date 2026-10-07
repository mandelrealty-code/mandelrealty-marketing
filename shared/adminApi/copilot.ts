import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { passwordMatches } from "../adminAuth.js";
import { getHospitablePat, isHospitableMcpConfigured, updatePmSettings } from "../pm/clientStore.js";
import { gmailConnected, gmailKeysReady } from "./gmail.js";
import { outlookConnected, outlookKeysReady } from "./outlook.js";
import { buildBrief } from "../copilot/brief.js";
import { cleanerWebhookReady, twilioFromLabel, twilioReady } from "../copilot/cleanText.js";
import { accountSpend } from "../copilot/accounts.js";
import { answerSignIn, cancelCursorRun, collectCursorRun, settleOpenCursorRuns } from "../copilot/cursorThink.js";
import { cancelBrowser, collectBrowser, browserIsLive, publicError, resumeBrowser, settleOpenBrowsers, startBrowser } from "../copilot/webBrowser.js";
import { nameChat } from "../copilot/chatTitle.js";
import { pictureFor, wantsWeb, workModel } from "../copilot/models.js";
import type { WorkModelId } from "../copilot/models.js";
import { answerGeneral, answerPhoto, solveMath } from "../copilot/plainAnswer.js";
import { answerRecords } from "../copilot/recordsAnswer.js";
import { answerStay } from "../copilot/stayAnswer.js";
import { answerHospitable, applyHospitableEdit, ASKS_HOSPITABLE, commitHospitable } from "../copilot/hospitableAgent.js";
import { cleanMcpToken, verifyHospitableMcpToken } from "../copilot/hospitableMcp.js";
import { agreesToReply, asksAboutMail, declinesReply, deliverReply, mailDraftFromOffer } from "../copilot/mailReply.js";
import { deleteMemoryFile, listMemoryFiles, promptLines, takeMemoryTurn } from "../copilot/memoryFiles.js";
import { makePicture } from "../copilot/picture.js";
import { draftForCard, skillTurn } from "../copilot/reply.js";
import { chooseOpenItem, listOpenItems, openItemChoice } from "../copilot/openItems.js";
import { toE164 } from "../followUpSequences.js";
import {
  addMessage,
  addTextNumber,
  createChat,
  deleteChat,
  deleteSkill,
  dismissCard,
  listChats,
  listMemory,
  markChatSeen,
  listMessages,
  readMessage,
  listSkills,
  listTextLog,
  listTextNumbers,
  removeTextNumber,
  renameChat,
  saveSkill,
  updateDraft,
} from "../copilot/store.js";
import { collectSkillRuns, runsOnItsOwn, startSkillRun } from "../copilot/skillRunner.js";
import { listRuns } from "../copilot/store.js";
import type { ConnectorRow, SkillRow } from "../copilot/types.js";

const HOSPITABLE_TOOLS = ["guest_inbox", "list_stays", "read_guest_messages"];

async function skillRows(): Promise<SkillRow[]> {
  const skills = await listSkills();
  return Promise.all(
    skills.map(async (skill) => ({
      ...skill,
      lastRun: skill.kind === "playbook" ? ((await listRuns(skill.id, 1).catch(() => []))[0] ?? null) : null,
    })),
  );
}

function readImages(value: unknown): { mimeType: string; data: string }[] {
  if (!Array.isArray(value)) return [];
  const images: { mimeType: string; data: string }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const mimeType = String((item as { mimeType?: string }).mimeType ?? "");
    let data = String((item as { data?: string }).data ?? "");
    const comma = data.indexOf(",");
    if (data.startsWith("data:") && comma > 0) data = data.slice(comma + 1);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) continue;
    if (data.length < 32 || data.length > 1_800_000) continue;
    images.push({ mimeType, data });
    if (images.length === 4) break;
  }
  return images;
}

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Sign in required." });
}

function mcpSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not save the MCP token.";
  if (/hospitable_mcp_token|schema cache/i.test(message)) {
    return "The MCP token column is not on the database yet. Run supabase/pm_hospitable_mcp_token_v1.sql, then save the token again.";
  }
  return message;
}

async function hospitableMessage(
  chatId: string,
  model: WorkModelId,
  question: string,
  images: { mimeType: string; data: string }[],
): Promise<boolean> {
  const history = await listMessages(chatId);
  const prior = history
    .slice(0, -1)
    .slice(-6)
    .map((message) => `${message.role}: ${message.body.slice(0, 700)}`)
    .join("\n\n");
  const turn = await answerHospitable({ model, question, prior, facts: await factsFor(), images });
  if (!turn) return false;
  await addMessage({
    chatId,
    role: "assistant",
    body: turn.body,
    steps: turn.steps,
    thought: turn.thought,
    draft: turn.draft,
    choices: turn.choices,
  });
  return true;
}

async function connectors(skills?: SkillRow[]): Promise<ConnectorRow[]> {
  const rows = skills ?? (await skillRows().catch(() => []));
  const readsGuests = rows.some(
    (skill) =>
      skill.enabled &&
      runsOnItsOwn(skill) &&
      skill.lastRun?.status === "ok" &&
      skill.lastRun.result?.tools.some((tool) => HOSPITABLE_TOOLS.includes(tool)),
  );
  let hospitable = false;
  try {
    hospitable = Boolean(await getHospitablePat());
  } catch {
    hospitable = Boolean(process.env.HOSPITABLE_PAT?.trim());
  }
  const hospitableMcp = await isHospitableMcpConfigured().catch(() => Boolean(process.env.HOSPITABLE_MCP_TOKEN?.trim()));
  const gmail = await gmailConnected().catch(() => false);
  const gmailReady = gmailKeysReady();
  const outlook = await outlookConnected().catch(() => false);
  const outlookReady = outlookKeysReady();
  const airroi = Boolean(process.env.AIRROI_API_KEY?.trim());
  const cursor = Boolean(process.env.CURSOR_API_KEY?.trim());
  const cleaner = cleanerWebhookReady();
  const twilio = twilioReady();
  return [
    {
      id: "gmail",
      name: "Gmail",
      detail: "Reads Sent and Primary, and drafts a reply when you ask.",
      status: gmail ? "connected" : "not_connected",
      statusLabel: gmail ? "Connected" : "Not connected",
      note: gmail
        ? "Searches Sent and Primary. Social and Promotions stay out. A reply sends only after you press Submit."
        : gmailReady
          ? "Click Connect and allow reading and sending. A reply still waits for Submit."
          : "The Gmail sign-in is not on the server yet.",
    },
    {
      id: "outlook",
      name: "Outlook",
      detail: "Reads Sent and Focused, and drafts a reply when you ask.",
      status: outlook ? "connected" : "not_connected",
      statusLabel: outlook ? "Connected" : "Not connected",
      note: outlook
        ? "Searches Sent and the Focused inbox. Other stays out. A reply sends only after you press Submit."
        : outlookReady
          ? "Click Connect and sign in as the company mailbox. A reply still waits for Submit."
          : "The Outlook sign-in is not on the server yet.",
    },
    {
      id: "hospitable",
      name: "Hospitable",
      detail: "Guest messages, bookings, calendar, tasks, reviews, and owner statements.",
      status: hospitableMcp || hospitable ? "connected" : "not_connected",
      statusLabel: hospitableMcp ? "Connected" : hospitable ? "API key only" : "Not connected",
      setup: hospitableMcp ? "mcp" : hospitable ? "pat" : "none",
      note: hospitableMcp
        ? readsGuests
          ? "The agent uses Hospitable MCP, including the morning read. A change waits until you press Submit."
          : "The agent uses Hospitable MCP. A change waits until you press Submit."
        : hospitable
          ? "The Public API key can read properties, stays, messages, the calendar, and reviews. Paste the MCP fallback token for guest replies, tasks, and owner statements."
          : "Paste the MCP fallback token from Hospitable → Settings → Integrations → MCP. The Public API key in OPS Settings is only the fallback.",
    },
    {
      id: "cleaner",
      name: "Cleaner app",
      detail: "Calendar, assignments, issues, inventory.",
      status: cleaner ? "connected" : "not_connected",
      statusLabel: cleaner ? "Connected" : "Not connected",
      note: cleaner
        ? "Pings Copilot when a clean is done."
        : "Turnovers still open tasks in OPS. A live calendar read is next.",
    },
    {
      id: "twilio",
      name: "Twilio",
      detail: "Texts the numbers you set.",
      status: twilio ? "connected" : "not_connected",
      statusLabel: twilio ? "Connected" : "Not connected",
      note: twilio ? "It texts you. It does not text guests." : "Twilio keys are not set on the server.",
    },
    {
      id: "airroi",
      name: "AirROI",
      detail: "Comps.",
      status: airroi ? "connected" : "not_connected",
      statusLabel: airroi ? "Connected" : "Not connected",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      detail: "Host groups only.",
      status: "not_connected",
      statusLabel: "Not connected",
    },
    {
      id: "cursor",
      name: "Cursor",
      detail: "Team keys.",
      status: cursor ? "connected" : "not_connected",
      statusLabel: cursor ? "Team keys are set" : "Not connected",
      note: cursor ? "Saved skill runs can use the team key. This chat does not." : "The team key is not set on the server.",
    },
  ];
}

async function factsFor(): Promise<string> {
  const [brief, rows, skills, memory, memoryFiles] = await Promise.all([
    buildBrief().catch(() => null),
    connectors(),
    skillRows().catch(() => [] as SkillRow[]),
    listMemory().catch(() => []),
    listMemoryFiles().catch(() => []),
  ]);
  const lines: string[] = [];
  if (brief) {
    lines.push(`${brief.hello} ${brief.line}`.trim());
    const cards = [...brief.focus, ...brief.eating];
    if (!cards.length) lines.push("No brief cards right now.");
    for (const card of cards) lines.push(`Card: ${card.text}`);
  }
  for (const row of rows) lines.push(`${row.name}: ${row.statusLabel}. ${row.detail} ${row.note ?? ""}`.trim());
  if (!skills.length) lines.push("No saved skills.");
  for (const skill of skills) {
    lines.push(
      `Skill ${skill.name} (${skill.enabled ? "on" : "off"}, ${skill.kind}, ${runsOnItsOwn(skill) ? "runs on its own every morning" : "runs only when asked"}, last run ${skill.lastRun ? skill.lastRun.status : "never"}): when ${skill.when_text}. Reads ${skill.reads}. Writes ${skill.drafts}. Must not ${skill.must_not}. Phone ${skill.phone || "none"}.`,
    );
  }
  for (const note of memory) lines.push(`Remembered: ${note}`);
  lines.push(...promptLines(memoryFiles));
  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) return unauthorized(res);

  try {
    if (req.method === "GET") {
      const op = String(req.query.op ?? "boot");
      if (op === "messages") {
        const chatId = String(req.query.chatId ?? "");
        return res.status(200).json({ messages: await listMessages(chatId) });
      }
      await collectSkillRuns().catch(() => undefined);
      const [cursorRuns, browserRuns] = await Promise.all([
        settleOpenCursorRuns().catch(() => [] as string[]),
        settleOpenBrowsers().catch(() => [] as string[]),
      ]);
      const runningChatIds = [...new Set([...cursorRuns, ...browserRuns])];
      const skills = await skillRows();
      const [brief, chats, memory, textLog, textNumbers, memoryFiles] = await Promise.all([
        buildBrief(),
        listChats(),
        listMemory().catch(() => []),
        listTextLog().catch(() => []),
        listTextNumbers().catch(() => []),
        listMemoryFiles().catch(() => []),
      ]);
      return res.status(200).json({
        brief,
        chats,
        skills,
        textLog,
        textNumbers,
        twilioFrom: twilioFromLabel(),
        memory,
        memoryFiles,
        connectors: await connectors(skills),
        runningChatIds,
        billing: process.env.CURSOR_API_KEY
          ? "Cursor Auto is connected. The team spend total appears when the admin key is set."
          : "Cursor isn’t connected yet. The brief still uses your records. Nothing is sent.",
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
    const body = (typeof req.body === "object" && req.body ? req.body : {}) as Record<string, unknown>;
    const op = String(body.op ?? "");

    if (op === "seen") {
      const chatId = String(body.chatId ?? "").trim();
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      await markChatSeen(chatId);
      return res.status(200).json({ chats: await listChats(), brief: await buildBrief() });
    }

    if (op === "run-skill") {
      const id = String(body.id ?? "").trim();
      if (!id) return res.status(400).json({ error: "Missing skill." });
      const run = await startSkillRun(id, "manual");
      const skills = await skillRows();
      return res.status(200).json({ run, skills, connectors: await connectors(skills), chats: await listChats() });
    }

    if (op === "hospitable-mcp") {
      if (body.action === "clear") {
        try {
          await updatePmSettings({ hospitable_mcp_token: "" });
        } catch (err) {
          return res.status(400).json({ error: mcpSaveError(err) });
        }
        return res.status(200).json({ connectors: await connectors() });
      }
      const token = cleanMcpToken(String(body.token ?? ""));
      if (!token) return res.status(400).json({ error: "Paste the MCP fallback token." });
      try {
        await verifyHospitableMcpToken(token);
        await updatePmSettings({ hospitable_mcp_token: token });
      } catch (err) {
        return res.status(400).json({ error: mcpSaveError(err) });
      }
      return res.status(200).json({ connectors: await connectors() });
    }

    if (op === "memory-file") {
      const action = String(body.action ?? "");
      const filePath = String(body.path ?? "").trim();
      if (action !== "delete" || !filePath) return res.status(400).json({ error: "Missing file." });
      const memoryFiles = await deleteMemoryFile(filePath);
      return res.status(200).json({ memoryFiles });
    }

    if (op === "dismiss") {
      const cardId = String(body.cardId ?? "").trim();
      if (!cardId) return res.status(400).json({ error: "Missing card." });
      await dismissCard(cardId);
      return res.status(200).json({ brief: await buildBrief() });
    }

    if (op === "new") {
      const kind = body.kind === "code" ? "code" : "chat";
      const chat = await createChat(kind === "code" ? "Code" : "New chat", kind);
      return res.status(200).json({ chat, messages: [] });
    }

    if (op === "card") {
      const text = String(body.text ?? "").trim();
      if (!text) return res.status(400).json({ error: "Missing card." });
      const chat = await createChat(await nameChat(text));
      await addMessage({ chatId: chat.id, role: "user", body: text });
      if (/Want me to reply\?/i.test(text)) {
        const result = await mailDraftFromOffer(text);
        await addMessage({
          chatId: chat.id,
          role: "assistant",
          body: result.body,
          draft: result.draft ? { ...result.draft, status: "waiting", channel: "email" } : null,
          steps: [{ text: result.draft ? "Wrote a reply" : "Couldn't write a reply" }],
          thought: "Nothing was sent. Submit is what sends it.",
        });
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      if (/Already upgraded/.test(text) && /Still pending/.test(text)) {
        await addMessage({
          chatId: chat.id,
          role: "assistant",
          body: text,
          choices: ["Already upgraded", "Still pending"],
          thought: "Nothing was sent.",
        });
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      if (ASKS_HOSPITABLE.test(text) && (await hospitableMessage(chat.id, "auto", text, []))) {
        return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
      }
      const result = draftForCard(text, String(body.action ?? ""));
      await addMessage({
        chatId: chat.id,
        role: "assistant",
        body: result.body,
        draft: result.draft,
        choices: result.choices ?? null,
        steps: [{ text: "Wrote a note" }],
        thought: "Nothing was sent.",
      });
      return res.status(200).json({ chat, messages: await listMessages(chat.id), pending: false, chats: await listChats() });
    }

    if (op === "think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const browser = await collectBrowser(chatId, body.hold === true);
      if (browser) {
        return res.status(200).json({
          chatId,
          messages: await listMessages(chatId),
          pending: browser.pending,
          steps: browser.steps,
          thought: browser.thought,
          view: browser.view,
          chats: browser.pending ? undefined : await listChats(),
        });
      }
      const state = await collectCursorRun(chatId, true);
      const stamp = state.view?.image ? `${state.view.image.length}:${state.view.image.slice(0, 16)}:${state.view.image.slice(-16)}` : "";
      const sameFrame = Boolean(stamp) && stamp === String(body.viewRev ?? "");
      const view = state.view
        ? {
            url: state.view.url,
            pointer: state.view.pointer,
            ...(stamp ? { rev: stamp } : {}),
            ...(state.view.image && !sameFrame ? { image: state.view.image, mime: state.view.mime } : {}),
          }
        : undefined;
      return res.status(200).json({
        chatId,
        messages: await listMessages(chatId),
        pending: state.pending,
        steps: state.steps,
        thought: state.thought,
        view,
        chats: state.pending ? undefined : await listChats(),
      });
    }

    if (op === "accounts") {
      return res.status(200).json({ accounts: await accountSpend() });
    }

    if (op === "cancel-think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const stoppedBrowser = await cancelBrowser(chatId);
      if (!stoppedBrowser) await cancelCursorRun(chatId);
      return res.status(200).json({ chatId, messages: await listMessages(chatId), pending: false });
    }

    if (op === "send") {
      const images = readImages(body.images);
      const text = String(body.text ?? "").trim() || (images.length ? "Look at the attached photo." : "");
      const kind = body.kind === "code" ? "code" : "chat";
      if (!text) return res.status(400).json({ error: "Write a message first." });
      let chatId = String(body.chatId ?? "");
      if (!chatId) {
        const chat = await createChat(await nameChat(text), kind);
        chatId = chat.id;
      }
      if (chatId && /^(please\s+)?(stop|stop running|stop the browser|stop it|cancel)(\s+running)?[.!]*$/i.test(text) && (await browserIsLive(chatId))) {
        await addMessage({ chatId, role: "user", body: text });
        await cancelBrowser(chatId);
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending: false });
      }
      const pictureMode = body.pictureMode === true;
      const skillMode = body.skillMode === true;
      const webSearch = body.webSearch === true || wantsWeb(text);
      const pictureChoice = pictureFor(text, images.length > 0);
      const userMessage = await addMessage({ chatId, role: "user", body: text, images, picture: pictureMode });
      const signIn = await answerSignIn(chatId);
      if (signIn) {
        await addMessage({
          chatId,
          role: "assistant",
          body: signIn.body,
          choices: signIn.choices,
          steps: signIn.steps,
          thought: signIn.thought,
        });
        let pending = false;
        let view: { url: string; liveUrl: string } | undefined;
        let steps: { text: string }[] | undefined;
        let thought: string | undefined;
        if (signIn.continueWeb) {
          try {
            const opened = await resumeBrowser(chatId);
            pending = opened.pending;
            view = opened.view;
            steps = opened.steps;
            thought = opened.thought;
          } catch (err) {
            await addMessage({
              chatId,
              role: "assistant",
              body: publicError(err),
            });
          }
        }
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending, view, steps, thought });
      }
      let pending = false;
      const done = async () => {
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending });
      };
      const choice = openItemChoice(text);
      if (choice && !pictureMode && !skillMode) {
        const open = (await listOpenItems()).filter((item) => item.status === "open");
        const target = open.length === 1 ? open[0] : null;
        if (target) {
          await chooseOpenItem(target.id, choice);
          await addMessage({
            chatId,
            role: "assistant",
            body: choice === "closed" ? "Closed. It will not come back." : "Still open. I didn't add a reminder.",
            thought: "Nothing was sent.",
          });
          return done();
        }
      }
      if (pictureMode) {
        if (pictureChoice.needsPhoto && !images.length) {
          await addMessage({
            chatId,
            role: "assistant",
            body: "Add a photo first. Draft makes a new picture and will not keep a face. Nothing was generated.",
          });
        } else {
          const image = await makePicture(text, {
            quality: pictureChoice.quality,
            images: pictureChoice.needsPhoto ? images : [],
          });
          await addMessage(
            image
              ? { chatId, role: "assistant", body: text, images: [image], picture: true }
              : { chatId, role: "assistant", body: "The picture didn’t come back. Nothing was saved." },
          );
        }
        return done();
      }
      if (!pictureMode && !skillMode) {
        try {
          const history = await listMessages(chatId);
          const previous = history[history.length - 2];
          const before = history[history.length - 3];
          const linked = (await connectors()).filter((row) => row.status === "connected").map((row) => row.id);
          const memoryTurn = await takeMemoryTurn({
            text,
            messageId: userMessage.id,
            chatId,
            priorAssistant: previous?.role === "assistant" ? previous.body : "",
            priorUser: before?.role === "user" ? before.body : "",
            connected: linked,
          });
          if (memoryTurn) {
            await addMessage({
              chatId,
              role: "assistant",
              body: memoryTurn.body,
              choices: memoryTurn.choices ?? null,
              steps: [{ text: memoryTurn.step }],
              thought: memoryTurn.thought,
              memoryFile: memoryTurn.file,
            });
            const messages = await listMessages(chatId);
            const chats = await listChats();
            const memoryFiles = await listMemoryFiles().catch(() => []);
            return res.status(200).json({ chatId, messages, chats, pending: false, memoryFiles });
          }
        } catch (err) {
          await addMessage({
            chatId,
            role: "assistant",
            body: err instanceof Error ? err.message : "The file was not written.",
          });
          return done();
        }
      }
      if (!webSearch && !skillMode) {
        const history = await listMessages(chatId);
        let prior = "";
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === "assistant") {
            prior = history[i]?.body ?? "";
            break;
          }
        }
        if (declinesReply(text, prior)) {
          await addMessage({ chatId, role: "assistant", body: "Held. Nothing was sent.", thought: "Nothing was sent." });
          return done();
        }
        if (agreesToReply(text, prior) || /wrote about .+\. Want me to reply\?/i.test(text)) {
          const result = await mailDraftFromOffer(text);
          await addMessage({
            chatId,
            role: "assistant",
            body: result.body,
            draft: result.draft ? { ...result.draft, status: "waiting", channel: "email" } : null,
            steps: [{ text: result.draft ? "Wrote a reply" : "Couldn't write a reply" }],
            thought: "Nothing was sent. Submit is what sends it.",
          });
          return done();
        }
      }
      if (!webSearch && !skillMode) {
        const history = await listMessages(chatId);
        let prior = "";
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i]?.role === "assistant") {
            prior = history[i]?.body ?? "";
            break;
          }
        }
        const stay = await answerStay(text, prior);
        if (stay) {
          await addMessage({
            chatId,
            role: "assistant",
            body: stay,
            steps: [{ text: "Read the reservation" }],
            thought: "This came from Hospitable. Nothing was sent.",
          });
          return done();
        }
        const records = await answerRecords(text, prior);
        const missed = records ? /isn't connected|didn't guess|couldn't read|isn't set up|isn't available|didn't return/i.test(records) : false;
        if (records && !missed) {
          await addMessage({
            chatId,
            role: "assistant",
            body: records,
            steps: [{ text: "Read the records" }],
            thought: records.startsWith("We manage")
              ? "This came from Units we manage."
              : "This came from Hospitable. Nothing was sent.",
          });
          return done();
        }
        if (images.length && !ASKS_HOSPITABLE.test(text) && !asksAboutMail(text)) {
          const spoken = await answerPhoto(text, images);
          const photoMissed = /couldn't read|isn't connected/i.test(spoken);
          await addMessage({
            chatId,
            role: "assistant",
            body: spoken,
            steps: [{ text: photoMissed ? "Could not read the photo" : "Looked at the photo" }],
            thought: photoMissed ? "The photo did not come back as a description." : "The photo was read here. Nothing was sent.",
          });
          return done();
        }
        if (await hospitableMessage(chatId, workModel(String(body.model ?? "auto")).id, text, images)) return done();
        if (missed && records) {
          await addMessage({
            chatId,
            role: "assistant",
            body: records,
            steps: [{ text: "Couldn't read the records" }],
            thought: "Hospitable didn't return that. Nothing was sent.",
          });
          return done();
        }
      }
      if (skillMode && !webSearch) {
        const history = await listMessages(chatId);
        const prior = history.slice(0, -1).map((message) => ({ role: message.role, body: message.body }));
        const result = skillTurn(text, prior);
        await addMessage({
          chatId,
          role: "assistant",
          body: result.body,
          draft: result.draft,
          choices: result.choices ?? null,
          steps: [{ text: result.draft ? "Drafted the skill" : "Asked about the skill" }],
          thought: "Nothing was saved, and nothing was sent.",
        });
        return done();
      }
      if (images.length && !skillMode && !webSearch && !ASKS_HOSPITABLE.test(text)) {
        const spoken = await answerPhoto(text, images);
        const missed = /couldn't read|isn't connected/i.test(spoken);
        await addMessage({
          chatId,
          role: "assistant",
          body: spoken,
          steps: [{ text: missed ? "Could not read the photo" : "Looked at the photo" }],
          thought: missed ? "The photo did not come back as a description." : "The photo was read here. Nothing was sent.",
        });
        return done();
      }
      if (!skillMode && !webSearch) {
        const math = solveMath(text);
        const spoken = math ?? (await answerGeneral(text));
        if (spoken) {
          await addMessage({
            chatId,
            role: "assistant",
            body: spoken,
            steps: [{ text: math ? "Worked it out" : "Answered" }],
            thought: math ? "This was arithmetic, so it stayed in the app." : "This stayed in the app. Nothing was sent.",
          });
          return done();
        }
        await addMessage({
          chatId,
          role: "assistant",
          body: "I don't have that in the records I can read. I didn't guess.",
          steps: [{ text: "Stayed in the app" }],
          thought: "Nothing was sent.",
        });
        return done();
      }
      if (webSearch) {
        try {
          const opened = await startBrowser(chatId, text);
          pending = opened.pending;
          const messages = await listMessages(chatId);
          const chats = await listChats();
          return res.status(200).json({
            chatId,
            messages,
            chats,
            pending,
            view: opened.view,
            steps: opened.steps,
            thought: opened.thought,
          });
        } catch (err) {
          await addMessage({ chatId, role: "assistant", body: publicError(err) });
          const messages = await listMessages(chatId);
          const chats = await listChats();
          return res.status(200).json({ chatId, messages, chats, pending: false });
        }
      }
      return done();
    }

    if (op === "draft") {
      const messageId = String(body.messageId ?? "");
      const action = String(body.action ?? "");
      const edited = String(body.edited ?? "");
      if (!messageId) return res.status(400).json({ error: "Missing draft." });
      if (action === "save-skill") {
        const kind = body.kind === "text" ? "text" : "playbook";
        const phone = kind === "text" ? toE164(String(body.phone ?? "")) : "";
        if (kind === "text" && !phone) {
          return res.status(400).json({ error: "Add your mobile number. Nothing was saved." });
        }
        const skill = await saveSkill({
          name: String(body.name ?? "New skill"),
          when_text: String(body.when ?? ""),
          reads: String(body.reads ?? ""),
          drafts: String(body.drafts ?? ""),
          must_not: String(body.mustNot ?? ""),
          enabled: true,
          kind,
          phone: phone ?? "",
          schedule: kind === "playbook" && body.schedule === "daily" ? "daily" : "",
        });
        if (phone) {
          try {
            await addTextNumber(phone);
          } catch {
            /* The skill still keeps the number if the allowlist table is not there yet. */
          }
        }
        const message = await updateDraft(messageId, { status: "approved_unsent" });
        if (message?.chat_id) await renameChat(message.chat_id, skill.name);
        return res.status(200).json({ message, skill, skills: await skillRows(), textNumbers: await listTextNumbers(), chats: await listChats() });
      }
      if (action === "discard-skill") {
        const message = await updateDraft(messageId, { status: "held" });
        return res.status(200).json({ message });
      }
      if (action === "hold") {
        const message = await updateDraft(messageId, {
          status: "held",
          bodyText: body.channel === "hospitable" ? "Held. Nothing was changed." : body.channel === "note" ? "Held. Nothing was sent." : undefined,
        });
        return res.status(200).json({ message });
      }
      if (action === "send") {
        const note = body.channel === "note";
        const current = await readMessage(messageId);
        const draft = current?.draft;
        if (draft?.channel === "hospitable" && draft.hospitable?.tool) {
          try {
            const args = applyHospitableEdit(draft.hospitable.args, draft.body, edited || draft.body);
            await commitHospitable(draft.hospitable.tool, args);
            const message = await updateDraft(messageId, {
              status: "sent",
              body: edited || undefined,
              hospitable: { tool: draft.hospitable.tool, args },
              bodyText: "Done. It is in Hospitable.",
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "waiting",
              body: edited || undefined,
              bodyText: err instanceof Error ? `${err.message} Nothing was changed.` : "Nothing was changed.",
            });
            return res.status(200).json({ message });
          }
        }
        if (draft?.channel === "hospitable") {
          const message = await updateDraft(messageId, {
            status: "waiting",
            bodyText: "That draft has no Hospitable change to commit. Nothing was changed.",
          });
          return res.status(200).json({ message });
        }
        if (!note && draft?.channel === "email" && draft.to) {
          try {
            await deliverReply({
              to: draft.to,
              subject: draft.subject,
              body: edited || draft.body,
              threadId: draft.threadId,
              rfcId: draft.replyMessageId,
              mailbox: draft.mailbox,
            });
            const message = await updateDraft(messageId, {
              status: "sent",
              body: edited || undefined,
              bodyText: "Sent.",
            });
            return res.status(200).json({ message });
          } catch (err) {
            const message = await updateDraft(messageId, {
              status: "approved_unsent",
              body: edited || undefined,
              bodyText: err instanceof Error ? err.message : "The mailbox didn't send it. Nothing went out.",
            });
            return res.status(200).json({ message });
          }
        }
        const message = await updateDraft(messageId, {
          status: "approved_unsent",
          body: edited || undefined,
          bodyText: note ? "Kept. Nothing was sent." : undefined,
        });
        return res.status(200).json({ message });
      }
      return res.status(400).json({ error: "Unknown action." });
    }

    if (op === "skill") {
      if (body.action === "delete") {
        await deleteSkill(String(body.id ?? ""));
        return res.status(200).json({ skills: await skillRows() });
      }
      const kind = body.kind === "text" ? "text" : "playbook";
      const rawPhone = String(body.phone ?? "").trim();
      const phone = rawPhone ? toE164(rawPhone) : "";
      if (kind === "text" && rawPhone && !phone) {
        return res.status(400).json({ error: "That mobile number is not valid." });
      }
      const skill = await saveSkill({
        id: body.id ? String(body.id) : undefined,
        name: String(body.name ?? "New skill"),
        when_text: String(body.when ?? ""),
        reads: String(body.reads ?? ""),
        drafts: String(body.drafts ?? ""),
        must_not: String(body.mustNot ?? ""),
        enabled: body.enabled !== false,
        kind,
        phone: phone ?? "",
      });
      if (phone) {
        try {
          await addTextNumber(phone);
        } catch {
          /* The skill still keeps the number if the allowlist table is not there yet. */
        }
      }
      return res.status(200).json({ skill, skills: await skillRows(), textNumbers: await listTextNumbers().catch(() => []) });
    }

    if (op === "text-number") {
      const phone = toE164(String(body.phone ?? ""));
      if (!phone) return res.status(400).json({ error: "That mobile number is not valid." });
      if (body.action === "remove") {
        const textNumbers = await removeTextNumber(phone);
        return res.status(200).json({ textNumbers, skills: await skillRows() });
      }
      const textNumbers = await addTextNumber(phone);
      return res.status(200).json({ textNumbers });
    }

    if (op === "rename") {
      await renameChat(String(body.chatId ?? ""), String(body.title ?? ""));
      return res.status(200).json({ chats: await listChats() });
    }

    if (op === "delete-chat") {
      await deleteChat(String(body.chatId ?? ""));
      return res.status(200).json({ chats: await listChats() });
    }

    if (op === "password") {
      const next = String(body.next ?? "");
      const confirm = String(body.confirm ?? "");
      if (!next || next !== confirm) return res.status(200).json({ ok: false, code: "mismatch" });
      if (!passwordMatches(String(body.current ?? ""))) return res.status(200).json({ ok: false, code: "current" });
      return res.status(200).json({ ok: false, code: "server" });
    }

    return res.status(400).json({ error: "Unknown op." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Copilot failed.";
    return res.status(500).json({ error: message });
  }
}
