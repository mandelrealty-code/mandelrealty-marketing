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
import { CURSOR_MISSING, cancelCursorRun, collectCursorRun, startCursorRun } from "../copilot/cursorThink.js";
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
import type { ConnectorRow } from "../copilot/types.js";

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

async function connectors(): Promise<ConnectorRow[]> {
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
      note: hospitable ? "Managed in OPS Settings." : "Add the Hospitable key in OPS Settings.",
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
    listSkills().catch(() => []),
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
      `Skill ${skill.name} (${skill.enabled ? "on" : "off"}, ${skill.kind}): when ${skill.when_text}. Reads ${skill.reads}. Writes ${skill.drafts}. Must not ${skill.must_not}. Phone ${skill.phone || "none"}.`,
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
      const [brief, chats, memory, skills, textLog, textNumbers] = await Promise.all([
        buildBrief(),
        listChats(),
        listMemory().catch(() => []),
        listSkills().catch(() => []),
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
        connectors: await connectors(),
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
      const chat = await createChat(text.slice(0, 48));
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
      return res.status(200).json({ chat, messages: await listMessages(chat.id), pending });
    }

    if (op === "think") {
      const chatId = String(body.chatId ?? "");
      if (!chatId) return res.status(400).json({ error: "Missing chat." });
      const state = await collectCursorRun(chatId);
      return res.status(200).json({
        chatId,
        messages: await listMessages(chatId),
        pending: state.pending,
        steps: state.steps,
        thought: state.thought,
        chats: state.pending ? undefined : await listChats(),
      });
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
        const chat = await createChat(text.slice(0, 48), kind);
        chatId = chat.id;
      }
      await addMessage({ chatId, role: "user", body: text, images });
      let pending = false;
      if (!process.env.CURSOR_API_KEY?.trim()) {
        await addMessage({ chatId, role: "assistant", body: CURSOR_MISSING });
      } else {
        try {
          await startCursorRun(chatId, await factsFor(), body.skillMode === true, images);
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
        });
        if (phone) {
          try {
            await addTextNumber(phone);
          } catch {
            /* The skill still keeps the number if the allowlist table is not there yet. */
          }
        }
        const message = await updateDraft(messageId, { status: "approved_unsent" });
        return res.status(200).json({ message, skill, skills: await listSkills(), textNumbers: await listTextNumbers() });
      }
      if (action === "discard-skill") {
        const message = await updateDraft(messageId, { status: "held" });
        return res.status(200).json({ message });
      }
      if (action === "hold") {
        const message = await updateDraft(messageId, {
          status: "held",
          bodyText: "Held. Nothing was sent.",
        });
        return res.status(200).json({ message });
      }
      if (action === "send") {
        const note = body.channel === "note";
        const message = await updateDraft(messageId, {
          status: "approved_unsent",
          body: edited || undefined,
          bodyText: note
            ? "Kept. Nothing was sent."
            : "You approved this. Gmail is not connected, so it was not sent. Nothing left this app.",
        });
        return res.status(200).json({ message });
      }
      return res.status(400).json({ error: "Unknown action." });
    }

    if (op === "skill") {
      if (body.action === "delete") {
        await deleteSkill(String(body.id ?? ""));
        return res.status(200).json({ skills: await listSkills() });
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
      return res.status(200).json({ skill, skills: await listSkills(), textNumbers: await listTextNumbers().catch(() => []) });
    }

    if (op === "text-number") {
      const phone = toE164(String(body.phone ?? ""));
      if (!phone) return res.status(400).json({ error: "That mobile number is not valid." });
      if (body.action === "remove") {
        const textNumbers = await removeTextNumber(phone);
        return res.status(200).json({ textNumbers, skills: await listSkills() });
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
