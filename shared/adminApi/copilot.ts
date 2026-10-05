import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { getHospitablePat } from "../pm/clientStore.js";
import { buildBrief } from "../copilot/brief.js";
import { draftForCard, replyTo } from "../copilot/reply.js";
import {
  addMessage,
  addReminder,
  createChat,
  listChats,
  listMemory,
  listMessages,
  remember,
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
  return [
    {
      id: "gmail",
      name: "Gmail",
      detail: "Reads and sends",
      status: "not_connected",
      statusLabel: "Not connected",
      note: "Nothing sends until this is connected and you confirm.",
    },
    {
      id: "hospitable",
      name: "Hospitable",
      detail: "Guest messages, earnings, issues, and each property’s knowledge base",
      status: hospitable ? "connected" : "not_connected",
      statusLabel: hospitable ? "Connected" : "Not connected",
      note: hospitable ? "Managed in OPS Settings." : "Add the Hospitable key in OPS Settings.",
    },
    {
      id: "cleaner",
      name: "Cleaner app",
      detail: "Calendar, assignments, issues, inventory",
      status: "not_connected",
      statusLabel: "Not connected",
      note: "Turnovers still open tasks in OPS. A live calendar read is next.",
    },
    {
      id: "airroi",
      name: "AirROI",
      detail: "Comps",
      status: airroi ? "connected" : "not_connected",
      statusLabel: airroi ? "Connected" : "Not connected",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      detail: "Host groups only. Family chats are never saved.",
      status: "not_connected",
      statusLabel: "Not connected",
      note: "A group is kept only when it is you, your partner, and a host in Admin.",
    },
    {
      id: "cursor",
      name: "Cursor",
      detail: "Team keys for Auto",
      status: cursor ? "connected" : "not_connected",
      statusLabel: cursor ? "Team keys are set" : "Not connected",
      note: "Usage shows here when the team spend key is set.",
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
      const [brief, chats, memory] = await Promise.all([
        buildBrief(),
        listChats(),
        listMemory().catch(() => []),
      ]);
      return res.status(200).json({
        brief,
        chats,
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
      await addMessage({ chatId, role: "user", body: text });

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
      const result = replyTo(text, previous);
      if (result.reminder) await addReminder(result.reminder.text, result.reminder.dueOn);
      if (result.memory) await remember(result.memory);
      await addMessage({
        chatId,
        role: "assistant",
        body: result.body,
        draft: result.draft,
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
      if (action === "hold") {
        const message = await updateDraft(messageId, {
          status: "held",
          bodyText: "Held. Nothing was sent.",
        });
        return res.status(200).json({ message });
      }
      if (action === "send") {
        const message = await updateDraft(messageId, {
          status: "approved_unsent",
          body: edited || undefined,
          bodyText:
            "You approved this. Gmail is not connected, so it was not sent. Nothing left this app.",
        });
        return res.status(200).json({ message });
      }
      return res.status(400).json({ error: "Unknown action." });
    }

    return res.status(400).json({ error: "Unknown op." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Copilot failed.";
    return res.status(500).json({ error: message });
  }
}
