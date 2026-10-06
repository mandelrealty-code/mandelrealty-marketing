import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { passwordMatches } from "../adminAuth.js";
import { getHospitablePat } from "../pm/clientStore.js";
import { buildBrief } from "../copilot/brief.js";
import { cleanerWebhookReady, twilioFromLabel, twilioReady } from "../copilot/cleanText.js";
import { accountSpend } from "../copilot/accounts.js";
import { answerWithClaude } from "../copilot/claudeAnswer.js";
import { CURSOR_MISSING, cancelCursorRun, collectCursorRun, settleOpenCursorRuns, startCursorRun } from "../copilot/cursorThink.js";
import { nameChat } from "../copilot/chatTitle.js";
import { pictureModel, wantsWeb, workModel } from "../copilot/models.js";
import { answerGeneral, answerPhoto, solveMath } from "../copilot/plainAnswer.js";
import { makePicture } from "../copilot/picture.js";
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
  const airroi = Boolean(process.env.AIRROI_API_KEY?.trim());
  const cursor = Boolean(process.env.CURSOR_API_KEY?.trim());
  const cleaner = cleanerWebhookReady();
  const twilio = twilioReady();
  return [
    {
      id: "gmail",
      name: "Gmail",
      detail: "Reads and drafts email.",
      status: "not_connected",
      statusLabel: "Not connected",
      note: "Nothing sends until this is connected and you confirm.",
    },
    {
      id: "hospitable",
      name: "Hospitable",
      detail: "Guest messages, earnings, issues, and each property’s knowledge base.",
      status: hospitable ? "connected" : "not_connected",
      statusLabel: hospitable ? "Connected" : "Not connected",
      note: !hospitable
        ? "Add the Hospitable key in OPS Settings."
        : readsGuests
          ? "Reads guest messages each morning. Managed in OPS Settings."
          : "Managed in OPS Settings.",
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
      note: cursor ? "Answers this chat on Auto." : "The team key is not set on the server.",
    },
  ];
}

async function factsFor(): Promise<string> {
  const [brief, rows, skills, memory] = await Promise.all([
    buildBrief().catch(() => null),
    connectors(),
    skillRows().catch(() => [] as SkillRow[]),
    listMemory().catch(() => []),
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
      const runningChatIds = await settleOpenCursorRuns().catch(() => [] as string[]);
      const skills = await skillRows();
      const [brief, chats, memory, textLog, textNumbers] = await Promise.all([
        buildBrief(),
        listChats(),
        listMemory().catch(() => []),
        listTextLog().catch(() => []),
        listTextNumbers().catch(() => []),
      ]);
      return res.status(200).json({
        brief,
        chats,
        skills,
        textLog,
        textNumbers,
        twilioFrom: twilioFromLabel(),
        memory,
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
      let pending = false;
      if (!process.env.CURSOR_API_KEY?.trim()) {
        await addMessage({ chatId: chat.id, role: "assistant", body: CURSOR_MISSING });
      } else {
        try {
          await startCursorRun(chat.id, await factsFor(), false);
          pending = true;
        } catch (err) {
          await addMessage({
            chatId: chat.id,
            role: "assistant",
            body: err instanceof Error ? err.message : CURSOR_MISSING,
          });
        }
      }
      return res.status(200).json({ chat, messages: await listMessages(chat.id), pending, chats: await listChats() });
    }

    if (op === "think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
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
      await cancelCursorRun(chatId);
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
      const pictureMode = body.pictureMode === true;
      const skillMode = body.skillMode === true;
      const webSearch = body.webSearch === true || wantsWeb(text);
      const picked = workModel(String(body.model ?? "auto")).id;
      const pictureChoice = pictureModel(String(body.model ?? "draft"));
      await addMessage({ chatId, role: "user", body: text, images, picture: pictureMode });
      let pending = false;
      const done = async () => {
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats, pending });
      };
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
      const claude = webSearch
        ? null
        : picked === "haiku" || picked === "sonnet"
          ? picked
          : picked === "auto" && skillMode && process.env.ANTHROPIC_API_KEY?.trim()
            ? "sonnet"
            : null;
      if (claude) {
        const spoken = await answerWithClaude(claude, text, skillMode, images);
        const name = claude === "haiku" ? "Haiku" : "Sonnet";
        await addMessage({
          chatId,
          role: "assistant",
          body: spoken?.body ?? "Anthropic isn’t connected, so that model didn’t answer. Nothing was sent.",
          draft: spoken?.draft ?? null,
          choices: spoken?.choices ?? null,
          steps: [{ text: spoken ? `Answered with ${name}` : "Could not reach Anthropic" }],
          thought: spoken ? `This used ${name}. Nothing was sent.` : "Anthropic isn’t connected.",
        });
        return done();
      }
      const forceCursor = picked === "cursor" || webSearch;
      if (!forceCursor && images.length && !skillMode) {
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
      if (!forceCursor && !skillMode && !webSearch) {
        const math = solveMath(text);
        const spoken = math ?? (await answerGeneral(text));
        if (spoken) {
          await addMessage({
            chatId,
            role: "assistant",
            body: spoken,
            steps: [{ text: math ? "Worked it out" : "Answered" }],
            thought: math ? "This was arithmetic, so it stayed in the app." : "This did not need Cursor.",
          });
          return done();
        }
      }
      if (!process.env.CURSOR_API_KEY?.trim()) {
        await addMessage({ chatId, role: "assistant", body: CURSOR_MISSING });
      } else {
        try {
          await startCursorRun(chatId, await factsFor(), skillMode, images, webSearch);
          pending = true;
        } catch (err) {
          await addMessage({
            chatId,
            role: "assistant",
            body: err instanceof Error ? err.message : "Cursor could not start. Nothing was sent.",
          });
        }
      }
      const messages = await listMessages(chatId);
      const chats = await listChats();
      return res.status(200).json({ chatId, messages, chats, pending });
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
          bodyText: body.channel === "note" ? "Held. Nothing was sent." : undefined,
        });
        return res.status(200).json({ message });
      }
      if (action === "send") {
        const note = body.channel === "note";
        const message = await updateDraft(messageId, {
          status: "approved_unsent",
          body: edited || undefined,
          // Email keeps its text. The card shows Approved and that nothing was sent.
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
