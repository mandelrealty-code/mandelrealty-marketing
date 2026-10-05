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
import { draftForCard, replyTo, skillTurn } from "../copilot/reply.js";
import { toE164 } from "../followUpSequences.js";
import {
  addMessage,
  addReminder,
  addTextNumber,
  createChat,
  deleteChat,
  deleteSkill,
  dismissCard,
  listChats,
  listMemory,
  listMessages,
  listSkills,
  listTextLog,
  listTextNumbers,
  remember,
  removeTextNumber,
  renameChat,
  saveSkill,
  updateDraft,
} from "../copilot/store.js";
import type { ConnectorRow, CopilotDraft } from "../copilot/types.js";

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
      note: cursor ? "Usage shows in the chat list." : "The team key is not set on the server.",
    },
  ];
}

async function lastDraft(chatId: string): Promise<CopilotDraft | null> {
  const messages = await listMessages(chatId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].draft?.status === "waiting") return messages[i].draft;
  }
  return null;
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
      const action = String(body.action ?? "Draft").trim();
      if (!text) return res.status(400).json({ error: "Missing card." });
      const chat = await createChat(text.slice(0, 48));
      const result = draftForCard(text, action);
      const message = await addMessage({
        chatId: chat.id,
        role: "assistant",
        body: result.body,
        draft: result.draft,
      });
      return res.status(200).json({ chat, messages: [message] });
    }

    if (op === "send") {
      const text = String(body.text ?? "").trim();
      const kind = body.kind === "code" ? "code" : "chat";
      if (!text) return res.status(400).json({ error: "Write a message first." });
      let chatId = String(body.chatId ?? "");
      if (!chatId) {
        const chat = await createChat(text.slice(0, 48), kind);
        chatId = chat.id;
      }
      const prior = await listMessages(chatId);
      await addMessage({ chatId, role: "user", body: text });

      const interviewing = prior.some((message) => message.role === "assistant" && /What should the text include\?|Who should get this text\?|What number should it text|what should I prepare, and who is it for|What should it never do\?|What should it do, and who is it for\?|Before I write the skill/.test(message.body));
      if (body.skillMode === true || interviewing || /^create a skill\b/i.test(text) || /\bcreate a skill that\b/i.test(text)) {
        const skill = skillTurn(text, prior);
        if (skill.memory) await remember(skill.memory);
        await addMessage({
          chatId,
          role: "assistant",
          body: skill.body,
          draft: skill.draft,
          choices: skill.choices,
        });
        const messages = await listMessages(chatId);
        const chats = await listChats();
        return res.status(200).json({ chatId, messages, chats });
      }

      if (kind === "code") {
        const assistant = await addMessage({
          chatId,
          role: "assistant",
          body: process.env.CURSOR_API_KEY
            ? "I can prepare that change on Auto. I will not push it until you confirm, and I will not send any guest or host message from this mode. Say confirm when you want a pull request."
            : "Code mode needs the Cursor key before I can edit the repo. I will not push anything, and I will not send a message to a guest or a host from here.",
        });
        const messages = await listMessages(chatId);
        return res.status(200).json({ chatId, messages, message: assistant });
      }

      const previous = await lastDraft(chatId);
      const lastAssistant = [...prior].reverse().find((message) => message.role === "assistant")?.body ?? "";
      let stayPlace: string | null = null;
      let stayWhen: string | null = null;
      try {
        const brief = await buildBrief();
        const stay = [...brief.focus, ...brief.eating].find((card) => /checks in/.test(card.text));
        stayPlace = stay?.text.match(/\bat\s+(.+?)\.\s+Confirm the arrival details/i)?.[1] ?? null;
        stayWhen = /tomorrow/.test(stay?.text ?? "") ? "tomorrow" : /today/.test(stay?.text ?? "") ? "today" : null;
      } catch {
        stayPlace = null;
      }
      const result = replyTo(text, previous, new Date(), { lastAssistant, stayPlace, stayWhen });
      if (result.reminder) await addReminder(result.reminder.text, result.reminder.dueOn);
      if (result.memory) await remember(result.memory);
      await addMessage({
        chatId,
        role: "assistant",
        body: result.body,
        draft: result.draft,
        choices: result.choices,
      });
      const messages = await listMessages(chatId);
      const chats = await listChats();
      return res.status(200).json({ chatId, messages, chats });
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
